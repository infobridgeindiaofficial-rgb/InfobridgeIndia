import test from 'node:test';
import assert from 'node:assert/strict';
import {sellquantaDownloadPage,sellquantaPrivacyPage,SELLQUANTA} from '../src/pages/marketing/sellquanta.js';
test('staged download options are the same app, optional official Ollama, no unpublished installer link',()=>{
 const page=sellquantaDownloadPage().body;
 assert.equal(SELLQUANTA.version,'1.1.0');assert.equal(SELLQUANTA.installerUrl,null);
 for(const text of ['Option A','SellQuanta Standard','Option B','SellQuanta + Ollama Setup','https://ollama.com/download/windows','3.2 GB','6.0 GB','12 GB','v1.0.2','not yet available'])assert.ok(page.includes(text),text);
 assert.ok(!page.includes('Run anyway'));assert.ok(!page.includes('v1.1.0/SellQuanta-Setup'));
 assert.match(page,/never silently installs/);assert.match(page,/Back up your data/);
});
test('update privacy discloses metadata checks without uploading business data',()=>{
 const page=sellquantaPrivacyPage().body;
 assert.match(page,/six hours/);assert.match(page,/IP address/);assert.match(page,/no business records or label images are sent/);assert.match(page,/loopback-only/);assert.ok(!page.includes('does not include an automatic update check'));
});
