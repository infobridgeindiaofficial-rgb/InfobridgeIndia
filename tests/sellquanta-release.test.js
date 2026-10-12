import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sellquantaDownloadPage,sellquantaPrivacyPage,SELLQUANTA} from '../src/pages/marketing/sellquanta.js';
test('public download offers the verified installer and optional official Ollama setup',()=>{
 const p=sellquantaDownloadPage().body;
 const {payload}=JSON.parse(fs.readFileSync(new URL('../sellquanta-updates/latest.json',import.meta.url)));
 assert.equal(SELLQUANTA.version,'1.1.1');assert.equal(SELLQUANTA.installerUrl,payload.url);assert.equal(SELLQUANTA.installerSha256,payload.sha256);
 for(const text of ['Option A','SellQuanta Standard','Option B','SellQuanta + Ollama Setup','https://ollama.com/download/windows','3.2 GB','6.0 GB','12 GB','v1.0.2',payload.url,payload.sha256])assert.ok(p.includes(text),text);
 assert.ok(!p.includes('Run anyway'));assert.ok(!p.includes('not yet available'));assert.match(p,/never silently installs/);assert.match(p,/Back up your data/);
});
test('update privacy discloses metadata checks without uploading business data',()=>{
 const p=sellquantaPrivacyPage().body;assert.match(p,/six hours/);assert.match(p,/IP address/);assert.match(p,/no business records or label images are sent/);assert.match(p,/loopback-only/);
});
