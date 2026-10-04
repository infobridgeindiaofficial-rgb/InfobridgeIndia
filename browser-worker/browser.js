import { chromium } from 'playwright';
import { navigationURL, webURL } from './network.js';

const HOME = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
body{font:18px system-ui;background:#f8f9fb;color:#151f35;padding:32px}h1{color:#0d7c68}
a{display:block;background:white;border:1px solid #e2e5ec;border-radius:12px;padding:20px;margin:12px 0;color:#0a5a4d;text-decoration:none}
</style></head><body><h1>Screen View</h1><p>Your temporary shared browser</p>
<a href="https://www.google.com">Google</a><a href="https://supplier.meesho.com">Meesho Seller</a>
<a href="https://sellercentral.amazon.in">Amazon Seller</a><a href="https://seller.flipkart.com">Flipkart Seller</a>
<p>The participant controls this browser. Your admin can see it. Sessions are temporary.</p></body></html>`;

// Viewport limits in CSS pixels, and the device-pixel budget per frame. Measured on a dense
// seller table: 390x788 at 2x/q70 is ~180 KB per full-change frame, ~10 ms capture; 2.2M px lets an
// iPad Pro (1024x1366) render at 1.25x while a 1080p desktop stays 1x.
export const LIMITS = { minWidth: 240, maxWidth: 1920, minHeight: 200, maxHeight: 1400, maxPixels: 2.2e6 };
// Headless screencast ignores emulated DPR; only a browser-wide device scale yields real HiDPI frames.
export function deviceScale(requested, width = 0, height = 0) {
  let scale = Number.isFinite(requested) ? Math.min(2, Math.max(1, requested)) : 1;
  while (scale > 1 && width * height * scale * scale > LIMITS.maxPixels) scale -= 0.25;
  return Math.max(1, Math.floor(scale * 4) / 4);
}
const NAVIGATION = new Set(['navigate', 'back', 'forward', 'refresh', 'home', 'tab']);

export class RemoteBrowser {
  constructor({ proxy, frame, state, audit, ended, scale = 1 }) {
    Object.assign(this, { proxy, frame, state, audit, ended });
    this.scale = deviceScale(scale);
    this.pages = new Map(); this.nextPage = 1; this.width = 1024; this.height = 720;
    // Input never waits behind navigation; each lane stays ordered.
    this.lanes = { input: { queue: Promise.resolve(), pending: 0 }, navigation: { queue: Promise.resolve(), pending: 0 } };
    this.closed = false;
  }
  get quality() { return this.scale >= 1.5 ? 70 : 80; }
  async start() {
    this.browser = await chromium.launch({ headless: true, chromiumSandbox: true,
      proxy: { server: this.proxy, bypass: '<-loopback>' },
      args: ['--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--disable-extensions',
        `--force-device-scale-factor=${this.scale}`] });
    this.browser.on('disconnected', () => { if (!this.closed) this.ended(); });
    this.context = await this.browser.newContext({ viewport: { width: this.width, height: this.height },
      deviceScaleFactor: this.scale, acceptDownloads: false, serviceWorkers: 'block', permissions: [] });
    await this.context.route('**/*', async route => {
      try { webURL(route.request().url()); await route.continue(); }
      catch { await route.abort('blockedbyclient').catch(() => {}); }
    });
    this.context.on('page', page => {
      if (this.pages.size >= 5) { page.close().catch(() => {}); return; }
      this.pages.set(this.nextPage++, page);
      page.on('download', d => { d.cancel().catch(() => {}); this.state({ notice: 'Downloads are not enabled in this MVP (Phase 2).' }); });
      page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
      page.on('framenavigated', frame => {
        if (frame !== page.mainFrame()) return;
        try { this.audit('navigation', { domain: webURL(page.url()).hostname }); } catch {}
        this.publish();
      });
      page.on('close', () => {
        for (const [id, p] of this.pages) if (p === page) this.pages.delete(id);
        if (this.page === page && !this.closed) {
          const other = [...this.pages.values()].at(-1);
          if (other) this.enqueue(() => this.activate(other)).catch(() => {});
          else this.ended();
        }
      });
      if (this.page) this.enqueue(() => this.activate(page)).catch(() => {});
    });
    const page = await this.context.newPage();
    await this.activate(page);
    await page.setContent(HOME);
    this.publish();
  }
  async activate(page) {
    if (this.cdp) {
      await this.cdp.send('Page.stopScreencast').catch(() => {});
      await this.cdp.detach().catch(() => {});
    }
    this.page = page;
    await page.bringToFront();
    const cdp = this.cdp = await this.context.newCDPSession(page);
    cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      if (this.cdp === cdp && !this.closed) this.frame(Buffer.from(data, 'base64'));
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await this.startScreencast(cdp);
    this.publish();
  }
  startScreencast(cdp = this.cdp) {
    return cdp.send('Page.startScreencast', { format: 'jpeg', quality: this.quality,
      maxWidth: Math.ceil(LIMITS.maxWidth * this.scale), maxHeight: Math.ceil(LIMITS.maxHeight * this.scale), everyNthFrame: 1 });
  }
  publish(extra = {}) {
    if (!this.page || this.closed) return;
    const url = this.page.url();
    this.state({ url: url === 'about:blank' ? '' : url, width: this.width, height: this.height, scale: this.scale,
      tabs: [...this.pages].map(([id, page]) => ({ id, active: page === this.page,
        label: (() => { try { return new URL(page.url()).hostname || 'Home'; } catch { return 'Home'; } })() })), ...extra });
  }
  enqueue(fn, lane = 'navigation') {
    const l = this.lanes[lane];
    if (l.pending >= 60 || this.closed) return Promise.reject(new Error('Browser busy'));
    l.pending++;
    const result = l.queue.then(() => { if (this.closed) throw new Error('Session ended'); return fn(); });
    l.queue = result.catch(() => {}).finally(() => l.pending--);
    return result;
  }
  command(event) {
    const finite = (n, min, max) => { if (!Number.isFinite(n) || n < min || n > max) throw new Error('Invalid input'); return n; };
    try {
      if (event.type === 'scroll') {
        const x = finite(event.x, 0, this.width), y = finite(event.y, 0, this.height);
        const dx = finite(event.dx, -2000, 2000), dy = finite(event.dy, -2000, 2000);
        // Coalesce scroll that has not started yet so a fast swipe cannot build a backlog.
        const waiting = this.scrollWaiting;
        if (waiting) {
          waiting.dx = Math.max(-2000, Math.min(2000, waiting.dx + dx)); waiting.dy = Math.max(-2000, Math.min(2000, waiting.dy + dy));
          Object.assign(waiting, { x, y }); return waiting.done;
        }
        const s = this.scrollWaiting = { x, y, dx, dy };
        s.done = this.enqueue(async () => {
          if (this.scrollWaiting === s) this.scrollWaiting = null;
          await this.page.mouse.move(Math.min(s.x, this.width), Math.min(s.y, this.height));
          await this.page.mouse.wheel(s.dx, s.dy);
        }, 'input');
        return s.done;
      }
      if (event.type === 'resize') {
        const width = Math.round(finite(event.width, LIMITS.minWidth, LIMITS.maxWidth));
        const height = Math.round(finite(event.height, LIMITS.minHeight, LIMITS.maxHeight));
        if (width * height * this.scale * this.scale > LIMITS.maxPixels * 1.35) throw new Error('Viewport too large');
        // Only the newest pending size matters.
        if (this.resizeWaiting) { Object.assign(this.resizeWaiting, { width, height }); return this.resizeWaiting.done; }
        const r = this.resizeWaiting = { width, height };
        r.done = this.enqueue(async () => {
          if (this.resizeWaiting === r) this.resizeWaiting = null;
          if (r.width === this.width && r.height === this.height) return;
          this.width = r.width; this.height = r.height;
          await Promise.all([...this.pages.values()].map(page => page.setViewportSize({ width: this.width, height: this.height })));
          // Chromium's screencast can stall after a viewport change at high device scale; a restart
          // reliably resumes it and immediately emits a frame at the new size.
          const cdp = this.cdp;
          await cdp?.send('Page.stopScreencast').catch(() => {});
          if (cdp === this.cdp && !this.closed) await this.startScreencast(cdp).catch(() => {});
          this.publish();
        }, 'input');
        return r.done;
      }
    } catch (error) { return Promise.reject(error); }
    if (NAVIGATION.has(event.type)) {
      return this.enqueue(async () => {
        const p = this.page;
        // 'commit' returns once the new document starts; the stream shows the rest of the load.
        switch (event.type) {
          case 'navigate': await p.goto(navigationURL(event.value), { waitUntil: 'commit', timeout: 20000 }); break;
          case 'back': await p.goBack({ waitUntil: 'commit', timeout: 20000 }); break;
          case 'forward': await p.goForward({ waitUntil: 'commit', timeout: 20000 }); break;
          case 'refresh': await p.reload({ waitUntil: 'commit', timeout: 20000 }); break;
          case 'home': await p.goto('about:blank'); await p.setContent(HOME); break;
          case 'tab': if (!this.pages.has(event.id)) throw new Error('Unknown tab'); await this.activate(this.pages.get(event.id)); break;
        }
        this.publish();
      });
    }
    return this.enqueue(async () => {
      const p = this.page;
      switch (event.type) {
        case 'click': await p.mouse.click(finite(event.x, 0, this.width), finite(event.y, 0, this.height)); break;
        case 'text': if (typeof event.value !== 'string' || event.value.length > 2000) throw new Error('Invalid text');
          await p.keyboard.insertText(event.value); break;
        case 'key': if (!['Enter', 'Tab', 'Shift+Tab', 'Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'ControlOrMeta+A'].includes(event.value)) throw new Error('Invalid key');
          await p.keyboard.press(event.value); break;
        default: throw new Error('Invalid command');
      }
    }, 'input');
  }
  async close() {
    this.closed = true;
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.pages.clear(); this.cdp = null; this.page = null;
  }
}
