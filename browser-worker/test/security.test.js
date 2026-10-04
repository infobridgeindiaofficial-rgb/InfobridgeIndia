import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { publicIP, resolvePublic, webURL, navigationURL } from '../network.js';
import { createEgressProxy } from '../proxy.js';
import { createWorker } from '../server.js';
import { deviceScale, LIMITS } from '../browser.js';

test('SSRF blocks special IPv4, IPv6, mapped addresses, credentials and alternate schemes', async () => {
  for (const address of ['127.0.0.1', '0.0.0.0', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '100.100.100.200', '192.0.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::1', '::',
    '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '64:ff9b::7f00:1']) assert.equal(publicIP(address), false, address);
  for (const url of ['http://localhost', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'file:///etc/passwd',
    'javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', 'http://example.com:8090', 'https://[::ffff:127.0.0.1]']) assert.throws(() => webURL(url), undefined, url);
  assert.equal(publicIP('8.8.8.8'), true);
  await assert.rejects(resolvePublic('rebind.example.com', async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]));
  let calls = 0;
  assert.deepEqual(await resolvePublic('public.example.com', async () => { calls++; return [{ address: '8.8.8.8', family: 4 }]; }), { address: '8.8.8.8', family: 4 });
  assert.equal(calls, 1);
  assert.match(navigationURL('seller reports'), /^https:\/\/www.google.com\/search/);
});

test('egress proxy refuses private CONNECT and plain HTTP before any connection', async t => {
  const proxy = createEgressProxy(); await new Promise(r => proxy.listen(0, '127.0.0.1', r)); t.after(() => proxy.shutdown());
  const port = proxy.address().port;
  for (const target of ['127.0.0.1:443', '169.254.169.254:443', '[::1]:443', 'example.com:22']) {
    const result = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'CONNECT', path: target });
      req.on('connect', (res, socket) => { socket.destroy(); resolve(res.statusCode); }); req.on('error', reject); req.end();
    });
    assert.equal(result, 403);
  }
  const result = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: 'http://127.0.0.1/' }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(result, 403);
});

async function fixture(t, options = {}) {
  const actions = [], logs = []; let closed = 0;
  const worker = createWorker({ origins: ['http://localhost:4173'], proxy: 'http://127.0.0.1:8091',
    verifyAdmin: async token => { if (!['admin', 'other'].includes(token)) throw new Error('Denied'); return { id: token }; },
    browserFactory: () => ({ async start() {}, async command(event) { actions.push(event); }, async close() { closed++; } }),
    audit: entry => logs.push(entry), ...options });
  await new Promise(r => worker.server.listen(0, '127.0.0.1', r)); t.after(() => worker.close());
  const base = `http://127.0.0.1:${worker.server.address().port}`;
  const api = async (path, method = 'GET', token = 'admin', data) => {
    const response = await fetch(base + path, { method, headers: { Origin: 'http://localhost:4173', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const connect = async ticket => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/stream', { origin: 'http://localhost:4173' });
    await once(ws, 'open'); const ready = once(ws, 'message'); ws.send(JSON.stringify({ type: 'auth', ticket })); await ready; return ws;
  };
  return { worker, base, api, connect, actions, logs, closed: () => closed };
}

test('single participant, owner isolation, view-only enforcement, ticket replay, teardown and safe audit', async t => {
  const f = await fixture(t);
  assert.equal((await f.api('/api/sessions', 'POST', 'invalid')).status, 403);
  const created = await f.api('/api/sessions', 'POST'); assert.equal(created.status, 201);
  const s = created.data; assert.match(s.code, /^[A-F0-9]{18}$/);
  assert.equal((await f.api(`/api/sessions/${s.id}/ticket`, 'POST', 'other')).status, 403);
  const joined = await f.api('/api/join', 'POST', '', { code: s.code }); assert.equal(joined.status, 200);
  const token = joined.data.token;
  assert.equal((await f.api('/api/join', 'POST', '', { code: s.code })).status, 404);
  assert.equal((await f.api('/api/sessions', 'POST', token)).status, 403);
  const at = (await f.api(`/api/sessions/${s.id}/ticket`, 'POST')).data.ticket;
  const admin = await f.connect(at);
  const notice = once(admin, 'message'); admin.send(JSON.stringify({ type: 'text', value: 'SECRET' }));
  assert.match(JSON.parse((await notice)[0]).message, /View only/); assert.equal(f.actions.length, 0);
  const pt = (await f.api(`/api/sessions/${s.id}/ticket`, 'POST', token)).data.ticket;
  const participant = await f.connect(pt);
  participant.send(JSON.stringify({ type: 'text', value: 'SECRET' }));
  await new Promise(r => setTimeout(r, 30)); assert.equal(f.actions.length, 1);
  const replay = new WebSocket(f.base.replace('http:', 'ws:') + '/stream', { origin: 'http://localhost:4173' });
  await once(replay, 'open'); const replayClosed = once(replay, 'close'); replay.send(JSON.stringify({ type: 'auth', ticket: pt }));
  assert.equal((await replayClosed)[0], 1008);
  const closed = once(participant, 'close');
  assert.equal((await f.api(`/api/sessions/${s.id}`, 'DELETE', token)).status, 200); await closed;
  assert.equal(f.closed(), 1); assert.equal(f.worker.sessions.size, 0);
  assert.equal((await f.api(`/api/sessions/${s.id}/ticket`, 'POST', token)).status, 403);
  assert.equal((await f.api('/api/join', 'POST', '', { code: s.code })).status, 404);
  assert.doesNotMatch(JSON.stringify(f.logs), /SECRET|Bearer|ticket|password/);
});

test('expiry, idle timeout, origin validation and join rate limiting', async t => {
  const f = await fixture(t, { ttl: 50, idle: 30 });
  const s = (await f.api('/api/sessions', 'POST')).data;
  await new Promise(r => setTimeout(r, 70));
  assert.equal((await f.api('/api/join', 'POST', '', { code: s.code })).status, 404);
  assert.equal((await fetch(f.base + '/api/sessions', { headers: { Origin: 'https://evil.example', Authorization: 'Bearer admin' } })).status, 403);
  for (let i = 0; i < 8; i++) await f.api('/api/join', 'POST', '', { code: 'bad' });
  assert.equal((await f.api('/api/join', 'POST', '', { code: 'bad' })).status, 429);
});

test('participant render scale is untrusted: clamped to 1-2x and the device-pixel budget', () => {
  for (const value of [Infinity, NaN, -5, 0, 1e9, '3', undefined]) {
    const scale = deviceScale(value); assert.ok(scale >= 1 && scale <= 2, String(value));
  }
  assert.equal(deviceScale(3, 390, 844), 2);
  assert.ok(1024 * 1366 * deviceScale(2, 1024, 1366) ** 2 <= LIMITS.maxPixels);
  assert.equal(deviceScale(2, 1920, 1080), 1);
});

test('ending during Chromium startup waits for launch and closes the browser', async t => {
  let release, closed = 0;
  const f = await fixture(t, { browserFactory: () => ({ start: () => new Promise(r => { release = r; }), async close() { closed++; } }) });
  const s = (await f.api('/api/sessions', 'POST')).data;
  const joining = f.api('/api/join', 'POST', '', { code: s.code });
  while (!release) await new Promise(r => setTimeout(r, 5));
  const ending = f.api(`/api/sessions/${s.id}`, 'DELETE');
  while (f.worker.sessions.size) await new Promise(r => setTimeout(r, 5));
  release();
  assert.equal((await joining).status, 503); assert.equal((await ending).status, 200); assert.equal(closed, 1);
});
