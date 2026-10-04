import http from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { RemoteBrowser } from './browser.js';
import { createEgressProxy } from './proxy.js';
import { supabaseVerifier } from './auth.js';

const secret = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const code = () => randomBytes(9).toString('hex').toUpperCase();
const normalizeCode = value => String(value || '').replace(/[\s-]/g, '').toUpperCase();
const fail = (status, message) => Object.assign(new Error(message), { status });
const send = (ws, message) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
// At most one frame in flight per viewer; newer frames replace a waiting one so a slow
// receiver sees the latest browser state instead of a growing queue of stale frames.
function sendFrame(ws, frame) {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.frameInFlight) { ws.nextFrame = frame; return; }
  ws.frameInFlight = true;
  ws.send(frame, () => {
    ws.frameInFlight = false;
    const next = ws.nextFrame; ws.nextFrame = null;
    if (next) sendFrame(ws, next);
  });
}

export function createWorker({ origins, proxy, verifyAdmin, production = false, trustProxy = false,
  ttl = 60 * 60_000, idle = 10 * 60_000, maxSessions = 4, browserFactory = options => new RemoteBrowser(options),
  audit = entry => console.log(JSON.stringify(entry)) }) {
  const sessions = new Map(), codes = new Map(), participants = new Map(), tickets = new Map(), limits = new Map();
  let shuttingDown = false;
  const log = (s, event, details = {}) => audit({ timestamp: new Date().toISOString(), session: s.id, event, ...details });
  const summary = s => ({ id: s.id, code: s.claimed ? null : s.code, createdAt: s.createdAt, expiresAt: s.expiresAt,
    participant: !!s.participantSocket, browser: s.browserStatus });
  const valid = s => s && !s.ended && Date.now() < s.expiresAt && Date.now() - s.lastActive < idle;
  const broadcast = (s, data) => { for (const ws of s.sockets) send(ws, data); };
  const ip = req => trustProxy ? req.headers['x-real-ip'] || req.socket.remoteAddress : req.socket.remoteAddress;
  function rate(key, maximum, interval = 60_000) {
    let bucket = limits.get(key);
    if (!bucket || bucket.until < Date.now()) { bucket = { count: 0, until: Date.now() + interval }; limits.set(key, bucket); }
    if (++bucket.count > maximum) throw fail(429, 'Too many requests. Try again shortly.');
  }
  async function end(s, reason = 'ended') {
    if (!s || s.ended) return;
    s.ended = true; sessions.delete(s.id); codes.delete(s.code);
    if (s.participantHash) participants.delete(s.participantHash);
    for (const [key, ticket] of tickets) if (ticket.session === s) tickets.delete(key);
    broadcast(s, { type: 'ended', reason });
    for (const ws of s.sockets) ws.close(1000, 'Session ended');
    s.frame = null; s.state = null;
    // Joining can still be launching Chromium: wait so teardown cannot leak it.
    await s.starting?.catch(() => {});
    await s.remote?.close(); log(s, 'session ended', { reason });
  }
  async function identity(req) {
    const value = req.headers.authorization || '';
    if (!value.startsWith('Bearer ') || value.length > 8200) throw fail(401, 'Sign in required');
    const token = value.slice(7), participant = participants.get(hash(token));
    if (participant) {
      if (!valid(participant)) { await end(participant, 'expired'); throw fail(401, 'Session expired'); }
      return { role: 'participant', session: participant };
    }
    try { return { role: 'admin', user: await verifyAdmin(token) }; }
    catch { throw fail(403, 'Sign in with an authorized Screen View admin account'); }
  }
  function authorized(who, id) {
    const s = sessions.get(id);
    if (!valid(s)) throw fail(404, 'Session unavailable or expired');
    if (who.role === 'participant' ? who.session !== s : who.user.id !== s.owner) throw fail(403, 'Session access denied');
    return s;
  }
  async function body(req) {
    if (req.headers['content-type'] !== 'application/json') throw fail(415, 'JSON required');
    let bytes = 0, chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 4096) throw fail(413, 'Request too large'); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw fail(400, 'Invalid JSON'); }
  }
  function check(req) {
    if (!origins.includes(req.headers.origin)) throw fail(403, 'Origin denied');
    if (production && !(req.socket.encrypted || (trustProxy && req.headers['x-forwarded-proto'] === 'https'))) throw fail(403, 'HTTPS required');
    rate(`all:${ip(req)}`, 180);
  }
  const server = http.createServer(async (req, res) => {
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Vary', 'Origin');
    try {
      check(req);
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      if (req.method === 'OPTIONS') return reply(204, null);
      if (shuttingDown) throw fail(503, 'Worker shutting down');
      const path = new URL(req.url, 'http://worker').pathname;
      if (path === '/api/join' && req.method === 'POST') {
        rate(`join:${ip(req)}`, 8); rate('join-global', 120);
        const data = await body(req), joinCode = normalizeCode(data.code), s = codes.get(joinCode);
        if (!/^[A-F0-9]{18}$/.test(joinCode) || !valid(s) || s.claimed) throw fail(404, 'Session unavailable or expired');
        s.claimed = true; codes.delete(joinCode); s.lastActive = Date.now(); s.browserStatus = 'Starting';
        const token = secret(); s.participantHash = hash(token); participants.set(s.participantHash, s);
        log(s, 'participant joined');
        // Device scale is fixed for the browser's lifetime; the participant's DPR is a request, clamped by deviceScale().
        const scale = typeof data.scale === 'number' && Number.isFinite(data.scale) ? data.scale : 1;
        s.remote = browserFactory({ proxy, scale,
          frame: frame => { if (!s.ended) { s.frame = frame; for (const ws of s.sockets) sendFrame(ws, frame); } },
          state: data => { if (!s.ended) { s.state = { ...s.state, ...data }; broadcast(s, { type: 'state', ...s.state }); } },
          audit: (event, details) => log(s, event, details), ended: () => { end(s, 'browser closed').catch(() => {}); } });
        s.starting = s.remote.start();
        try { await s.starting; if (s.ended) throw new Error('ended'); }
        catch { await end(s, 'browser startup failed'); throw fail(503, 'Browser could not start. Ask the admin to create a new session.'); }
        s.browserStatus = 'Active'; log(s, 'browser started');
        return reply(200, { ...summary(s), token });
      }
      const who = await identity(req);
      if (path === '/api/sessions' && req.method === 'GET') {
        if (who.role !== 'admin') throw fail(403, 'Admin required');
        return reply(200, { sessions: [...sessions.values()].filter(s => valid(s) && s.owner === who.user.id).map(summary) });
      }
      if (path === '/api/sessions' && req.method === 'POST') {
        if (who.role !== 'admin') throw fail(403, 'Admin required');
        rate(`create:${who.user.id}`, 6);
        if (sessions.size >= maxSessions) throw fail(503, 'Worker is at capacity');
        const s = { id: randomUUID(), code: code(), owner: who.user.id, createdAt: Date.now(), lastActive: Date.now(),
          expiresAt: Date.now() + ttl, sockets: new Set(), browserStatus: 'Waiting', claimed: false };
        sessions.set(s.id, s); codes.set(s.code, s); log(s, 'session created');
        return reply(201, summary(s));
      }
      const match = /^\/api\/sessions\/([a-f0-9-]{36})(\/ticket)?$/.exec(path);
      if (!match) throw fail(404, 'Not found');
      const s = authorized(who, match[1]);
      if (req.method === 'DELETE' && !match[2]) { await end(s); return reply(200, { ended: true }); }
      if (req.method === 'POST' && match[2]) {
        rate(`ticket:${s.id}:${who.role}`, 20);
        const ticket = secret(); tickets.set(hash(ticket), { session: s, role: who.role, expires: Date.now() + 20000 });
        return reply(200, { ticket });
      }
      throw fail(405, 'Method not allowed');
    } catch (error) { if (!res.headersSent) reply(error.status || 500, { error: error.status ? error.message : 'Request failed' }); else res.end(); }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  const pendingSockets = new Set();
  server.on('upgrade', (req, socket, head) => {
    try {
      check(req); rate(`ws:${ip(req)}`, 30);
      if (req.url !== '/stream' || pendingSockets.size >= 100) throw fail(403, 'Denied');
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
    } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
  });
  wss.on('connection', ws => {
    pendingSockets.add(ws);
    let s, role, count = 0, windowAt = Date.now(), adminLease;
    const timeout = setTimeout(() => ws.close(1008, 'Authorization required'), 5000);
    ws.alive = true; ws.on('pong', () => { ws.alive = true; }); ws.on('error', () => {});
    ws.on('message', (raw, binary) => {
      try {
        if (binary) throw new Error('JSON only');
        const event = JSON.parse(raw.toString());
        if (!s) {
          if (event.type !== 'auth' || typeof event.ticket !== 'string') throw new Error('Authorization required');
          const key = hash(event.ticket), ticket = tickets.get(key); tickets.delete(key);
          if (!ticket || ticket.expires < Date.now() || !valid(ticket.session)) throw new Error('Authorization expired');
          s = ticket.session; role = ticket.role;
          if ((role === 'participant' && s.participantSocket) || s.sockets.size >= 4) { s = null; throw new Error('Already connected'); }
          if (role === 'participant') { s.participantSocket = ws; s.lastActive = Date.now(); }
          else adminLease = setTimeout(() => ws.close(4001, 'Renew admin authorization'), 60000);
          clearTimeout(timeout); pendingSockets.delete(ws); s.sockets.add(ws);
          send(ws, { type: 'ready', role, session: summary(s) });
          if (s.state) send(ws, { type: 'state', ...s.state });
          if (s.frame) sendFrame(ws, s.frame);
          broadcast(s, { type: 'presence', participant: !!s.participantSocket });
          return;
        }
        if (!valid(s)) { end(s, 'expired').catch(() => {}); return; }
        if (role !== 'participant') { send(ws, { type: 'error', message: 'View only: controls are disabled' }); return; }
        if (Date.now() - windowAt > 1000) { windowAt = Date.now(); count = 0; }
        if (++count > 80) throw new Error('Input rate exceeded');
        if (s.browserStatus !== 'Active') throw new Error('Browser not ready');
        s.lastActive = Date.now();
        s.remote.command(event).catch(error => {
          // Never forward Playwright's call log: it can contain credentials or URL queries.
          const netCode = /net::[A-Z_]+/.exec(error.message)?.[0];
          send(ws, { type: 'error', message: netCode ? `Navigation failed: ${netCode}` : 'Browser action failed or was blocked. Check the page and try again.' });
        });
      } catch { ws.close(1008, 'Invalid or unauthorized message'); }
    });
    ws.on('close', () => {
      clearTimeout(timeout); clearTimeout(adminLease); pendingSockets.delete(ws);
      if (!s) return;
      s.sockets.delete(ws);
      if (s.participantSocket === ws) { s.participantSocket = null; log(s, 'participant disconnected'); broadcast(s, { type: 'presence', participant: false }); }
    });
  });
  const cleanup = setInterval(() => {
    for (const s of sessions.values()) if (!valid(s)) end(s, 'expired').catch(() => {});
    for (const [key, t] of tickets) if (t.expires < Date.now()) tickets.delete(key);
    for (const [key, b] of limits) if (b.until < Date.now()) limits.delete(key);
  }, 1000).unref();
  const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } } }, 15000).unref();
  return { server, sessions, async close() {
    shuttingDown = true; clearInterval(cleanup); clearInterval(heartbeat);
    await Promise.all([...sessions.values()].map(s => end(s, 'worker stopped')));
    for (const ws of wss.clients) ws.terminate();
    wss.close(); await new Promise(resolve => server.close(resolve));
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const production = process.env.NODE_ENV === 'production';
  const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4173').split(',');
  if (production && (origins.some(x => !x.startsWith('https://')) || process.env.EGRESS_ISOLATED !== 'true' || !process.env.EGRESS_PROXY)) {
    throw new Error('Production requires HTTPS origins and a network-isolated worker with EGRESS_PROXY and EGRESS_ISOLATED=true');
  }
  let localProxy;
  const proxy = process.env.EGRESS_PROXY || 'http://127.0.0.1:8091';
  if (!process.env.EGRESS_PROXY) { localProxy = createEgressProxy(); await new Promise(r => localProxy.listen(8091, '127.0.0.1', r)); }
  const verifyAdmin = supabaseVerifier({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY,
    admins: new Set((process.env.SCREEN_VIEW_ADMIN_IDS || '').split(',').filter(Boolean)), proxy });
  const worker = createWorker({ origins, proxy, verifyAdmin, production, trustProxy: production,
    maxSessions: Number(process.env.MAX_SESSIONS || 4) });
  worker.server.listen(Number(process.env.PORT || 8090), production ? '0.0.0.0' : '127.0.0.1', () => console.log('Screen View worker ready'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await worker.close(); await localProxy?.shutdown(); process.exit(0); });
}
