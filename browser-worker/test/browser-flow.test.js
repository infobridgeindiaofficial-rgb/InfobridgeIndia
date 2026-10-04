import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { createWorker } from '../server.js';
import { createEgressProxy } from '../proxy.js';

// Runs real Chromium and two independent UI contexts. The auth fixture replaces
// Supabase only inside this test; production has no development auth bypass.
test('real Chromium: two clients, controls, responsive layouts, synchronization and cleanup', { timeout: 120000 }, async t => {
  const root = resolve('../tmp/screen-view-build'), artifacts = resolve('../tmp/screen-view-evidence');
  await mkdir(artifacts, { recursive: true });
  const proxy = createEgressProxy(); await new Promise(r => proxy.listen(0, '127.0.0.1', r));
  t.after(() => proxy.shutdown());
  let workerURL;
  const staticServer = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === '/screen-view-config.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(`globalThis.INFOBRIDGE_SCREEN_VIEW={workerUrl:${JSON.stringify(workerURL)}};`); return; }
      let target = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!target.startsWith(root + sep)) throw new Error('Denied');
      let data = await readFile(target);
      if (target.endsWith('.html')) data = Buffer.from(data.toString().replaceAll('localhost:8090', new URL(workerURL).host));
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' })[extname(target)] || 'application/octet-stream');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => staticServer.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => staticServer.close(r)));
  const origin = `http://localhost:${staticServer.address().port}`;
  const worker = createWorker({ origins: [origin], proxy: `http://127.0.0.1:${proxy.address().port}`,
    verifyAdmin: async token => { if (token !== 'test-admin') throw new Error('Denied'); return { id: 'test-admin' }; }, audit: () => {} });
  await new Promise(r => worker.server.listen(0, '127.0.0.1', r)); t.after(() => worker.close());
  workerURL = `http://localhost:${worker.server.address().port}`;
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const adminContext = await browser.newContext();
  await adminContext.route('**/supabase/client.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function currentSession(){return {access_token:"test-admin"}}' }));
  const admin = await adminContext.newPage(); const errors = [];
  admin.on('pageerror', error => errors.push(error.message));
  await admin.goto(origin + '/screen-view/admin/');
  await admin.getByRole('button', { name: 'Create Session', exact: true }).click();
  const code = await admin.locator('.sv-card strong').first().textContent({ timeout: 10000 });
  await admin.getByRole('button', { name: 'View Browser' }).first().click();
  const participantContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const participant = await participantContext.newPage(); participant.on('pageerror', error => errors.push(error.message));
  await participant.goto(origin + '/screen-view/');
  await participant.getByLabel('Session ID', { exact: true }).fill(code);
  await participant.getByRole('button', { name: 'Join Session', exact: true }).click();
  await participant.locator('#frame[src]').waitFor({ timeout: 30000 });
  await admin.locator('#frame[src]').waitFor();
  assert.equal(await admin.locator('#permission').textContent(), 'VIEW ONLY');
  assert.equal(await admin.locator('#control-bar').isVisible(), false);
  const session = [...worker.sessions.values()][0], remote = session.remote;
  assert.ok(remote.browser.isConnected());
  await remote.context.route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="font:20px system-ui;margin:20px;height:2500px"><h1>Remote test ${new URL(route.request().url()).pathname}</h1><input id="field" aria-label="Test field"><button id="button" onclick="document.querySelector('#result').textContent='Clicked'">Click me</button><p id="result">Ready</p><a href="https://example.com/two">Next page</a></body></html>` }));
  await participant.getByLabel('URL or search query').fill('https://example.com/one');
  await participant.getByRole('button', { name: 'Go', exact: true }).click();
  await remote.page.waitForURL('https://example.com/one'); await remote.page.locator('#field').waitFor();
  // Wait for the real streamed frame and responsive viewport to settle.
  await participant.waitForTimeout(700);
  async function remoteTap(selector) {
    const bounds = await remote.page.locator(selector).boundingBox(), frame = await participant.locator('#frame').boundingBox();
    await participant.touchscreen.tap(frame.x + (bounds.x + bounds.width / 2) * frame.width / remote.width,
      frame.y + (bounds.y + bounds.height / 2) * frame.height / remote.height);
  }
  // Immersive: the remote page fills the area under one compact toolbar at the participant's size, at HiDPI.
  const layout = await participant.evaluate(() => {
    const frame = document.querySelector('#frame'), r = frame.getBoundingClientRect(), bar = document.querySelector('#control-bar').getBoundingClientRect();
    return { top: r.top, width: r.width, height: r.height, bottom: r.bottom, bar: bar.height, natural: [frame.naturalWidth, frame.naturalHeight] };
  });
  assert.ok(layout.bar <= 52 && layout.top <= layout.bar + 1, `toolbar ${layout.bar}, image top ${layout.top}`);
  assert.ok(layout.width >= 389 && layout.bottom >= 843, `image ${layout.width}x${layout.height}`);
  assert.equal(remote.scale, 2); assert.equal(remote.width, Math.round(layout.width));
  assert.ok(Math.abs(layout.natural[0] / layout.natural[1] - layout.width / layout.height) < 0.01, 'frame is not stretched');
  assert.equal(layout.natural[0], remote.width * 2, 'frames are rendered at device scale');
  await remoteTap('#field');
  await participant.getByRole('button', { name: 'Open keyboard' }).click();
  await participant.locator('#typing').fill('hello remote');
  await remote.page.waitForFunction(() => document.querySelector('#field').value === 'hello remote');
  await participant.getByRole('button', { name: 'Close keyboard' }).click();
  await remoteTap('#button'); await remote.page.waitForFunction(() => document.querySelector('#result').textContent === 'Clicked');
  const adminImage = await admin.locator('#frame').getAttribute('src');
  await participant.locator('[data-command=refresh]').click();
  await remote.page.waitForFunction(() => document.querySelector('#result').textContent === 'Ready');
  await admin.waitForFunction(previous => document.querySelector('#frame').src !== previous, adminImage);
  await admin.locator('#viewport').click({ position: { x: 30, y: 30 } });
  await admin.locator('#viewport').press('a'); await admin.locator('#viewport').dispatchEvent('wheel', { deltaY: 500 });
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await remote.page.locator('#result').textContent(), 'Ready');
  assert.equal(await remote.page.evaluate(() => scrollY), 0, 'admin wheel must not scroll');
  await remoteTap('a'); await remote.page.waitForURL('https://example.com/two');
  await participant.getByRole('button', { name: 'Back', exact: true }).click(); await remote.page.waitForURL('https://example.com/one');
  await participant.getByRole('button', { name: 'Forward', exact: true }).click(); await remote.page.waitForURL('https://example.com/two');
  await participant.locator('#viewport').dispatchEvent('wheel', { deltaY: 500, deltaX: 0, clientX: 100, clientY: 250 });
  await remote.page.waitForFunction(() => scrollY > 0);
  await participant.locator('#viewport').dispatchEvent('wheel', { deltaY: -2000, deltaX: 0, clientX: 100, clientY: 250 });
  await remote.page.waitForFunction(() => scrollY === 0);
  for (const width of [390, 430, 768, 1024, 1440]) {
    await participant.setViewportSize({ width, height: 900 }); await participant.waitForTimeout(700);
    assert.equal(await participant.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    // Remote viewport follows the participant (scaled down only if over the pixel budget).
    const box = await participant.locator('#viewport').boundingBox();
    assert.ok(Math.abs(remote.width / remote.height - box.width / box.height) < 0.02, `remote ${remote.width}x${remote.height} vs ${box.width}x${box.height}`);
    await participant.screenshot({ path: resolve(artifacts, `participant-${width}.png`), fullPage: true });
  }
  await admin.screenshot({ path: resolve(artifacts, 'admin-view-only.png'), fullPage: true });
  await participant.reload(); await participant.locator('#frame[src]').waitFor();
  const oldContext = remote.context;
  participant.once('dialog', dialog => dialog.accept());
  await participant.getByRole('button', { name: 'End Session', exact: true }).click();
  await participant.waitForFunction(() => document.querySelector('#viewer').hidden);
  assert.equal(worker.sessions.size, 0);
  // Teardown returns after browser close; UI may process its WS event first.
  await new Promise(r => setTimeout(r, 400));
  assert.equal(remote.browser.isConnected(), false); assert.equal(oldContext.pages().length, 0);
  assert.deepEqual(errors, []);
  await writeFile(resolve(artifacts, 'flow-result.json'), JSON.stringify({ passed: true, widths: [390, 430, 768, 1024, 1440], auth: 'injected test verifier, real Supabase login not tested', pageErrors: errors }, null, 2));
});
