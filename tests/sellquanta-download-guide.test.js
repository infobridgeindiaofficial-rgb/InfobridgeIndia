import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sellquantaDownloadPage, SELLQUANTA } from '../src/pages/marketing/sellquanta.js';

test('Download page displays the original four screenshots in order and retains the release download', () => {
  const page = sellquantaDownloadPage().body;
  assert.match(page, /How to Download SellQuanta/);
  assert.doesNotMatch(page, /sq-install-card|sq-install-icon/);
  const images = [...page.matchAll(/src="\/images\/download-guide\/step-(\d).png"/g)];
  assert.deepEqual(images.map(image => image[1]), ['1', '2', '3', '4']);
  assert.ok(page.includes('href="' + SELLQUANTA.installerUrl + '"'));
  assert.ok(page.includes(SELLQUANTA.releaseUrl));
  assert.ok(page.includes(SELLQUANTA.installerSha256));
  for (let step = 1; step <= 4; step++) {
    const original = fs.readFileSync(new URL('../public/images/download-guide/step-' + step + '.png', import.meta.url));
    const built = fs.readFileSync(new URL('../dist/images/download-guide/step-' + step + '.png', import.meta.url));
    assert.deepEqual(built, original);
  }
});
