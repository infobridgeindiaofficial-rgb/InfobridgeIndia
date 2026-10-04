// Publish only Screen View assets locally; preserve existing deployment snapshots.
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenViewPage } from '../src/screen-view/page.js';
import { icon } from '../src/components/icons.js';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const destination of [root, resolve(root, 'dist')]) {
  mkdirSync(join(destination, 'screen-view/admin'), { recursive: true });
  writeFileSync(join(destination, 'screen-view/index.html'), screenViewPage());
  writeFileSync(join(destination, 'screen-view/admin/index.html'), screenViewPage(true));
  for (const file of ['client.js', 'styles.css']) copyFileSync(join(root, 'src/screen-view', file), join(destination, 'screen-view', file));
  copyFileSync(join(root, 'public/screen-view-config.js'), join(destination, 'screen-view-config.js'));
  const home = join(destination, 'index.html');
  const previous = readFileSync(home, 'utf8');
  if (!previous.includes('href="/screen-view/"')) {
    const marker = /(<div class="mega-col-title">People & operations<\/div>\r?\n\s*<div class="stack-1">)/;
    if (!marker.test(previous)) throw new Error('Homepage menu changed; update Screen View link manually. Existing file preserved.');
    const desktop = `\n<!-- screen-view-nav --><a class="mega-link" href="/screen-view/"><span class="mega-link-icon">${icon('globe')}</span><span><span class="mega-link-title">Screen View</span><div class="mega-link-desc">Join a temporary shared remote browser</div></span></a><!-- /screen-view-nav -->`;
    const mobile = '<!-- screen-view-mobile --><a href="/screen-view/">Screen View</a><!-- /screen-view-mobile -->';
    const next = previous.replace(marker, `$1${desktop}`).replace('<a href="/hr-payroll/index.html">HR & Payroll</a>', `${mobile}<a href="/hr-payroll/index.html">HR & Payroll</a>`);
    if (next.replace(desktop, '').replace(mobile, '') !== previous) throw new Error('Unexpected homepage edit');
    writeFileSync(home, next);
  }
}
console.log('Screen View routes/assets and homepage links updated. Other deployment files preserved.');
