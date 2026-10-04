import { mkdir, writeFile } from 'node:fs/promises';
import { RemoteBrowser } from './browser.js';
import { createEgressProxy } from './proxy.js';

const proxy = createEgressProxy(); await new Promise(r => proxy.listen(0, '127.0.0.1', r));
const browser = new RemoteBrowser({ proxy: `http://127.0.0.1:${proxy.address().port}`, frame() {}, state() {}, audit() {}, ended() {} });
const results = {};
await mkdir('../tmp/screen-view-evidence', { recursive: true });
try {
  await browser.start();
  for (const [name, url] of [['google', 'https://www.google.com'], ['meesho', 'https://supplier.meesho.com']]) {
    try {
      const response = await browser.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      results[name] = { status: response?.status(), title: await browser.page.title(), text: (await browser.page.locator('body').innerText()).slice(0, 800) };
      await browser.page.screenshot({ path: `../tmp/screen-view-evidence/${name}.png` });
      if (name === 'google' && await browser.page.locator('[name=q]').count()) {
        await browser.page.locator('[name=q]').first().click();
        await browser.command({ type: 'text', value: 'InfoBridgeIndia' });
        await browser.command({ type: 'key', value: 'Enter' });
        await browser.page.waitForTimeout(2000);
        results.google.search = { title: await browser.page.title(), text: (await browser.page.locator('body').innerText()).slice(0, 800) };
      }
    } catch (error) { results[name] = { error: /net::[A-Z_]+/.exec(error.message)?.[0] || error.name, note: 'No challenge bypass attempted' }; }
  }
} finally { await browser.close(); await proxy.shutdown(); }
await writeFile('../tmp/screen-view-evidence/site-checks.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
