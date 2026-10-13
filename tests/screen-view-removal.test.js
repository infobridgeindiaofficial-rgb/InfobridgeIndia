import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mainNav } from '../src/data/nav.js';

test('Screen View exclusive source, routes, configuration and backend are removed', () => {
  const root=new URL('../',import.meta.url);
  for(const path of ['src/screen-view','screen-view','browser-worker','public/screen-view-config.js','screen-view-config.js','scripts/build-screen-view.mjs','dist/screen-view','dist/screen-view-config.js'])assert.equal(fs.existsSync(new URL(path,root)),false,path);
  assert.doesNotMatch(JSON.stringify(mainNav),/screen-view|Screen View/);
  assert.doesNotMatch(fs.readFileSync(new URL('build.js',root),'utf8'),/screen-view|screenView/);
});

test('built navigation has Crop PDF and existing tools without Screen View', () => {
  const root=new URL('../dist/',import.meta.url);
  for(const path of ['index.html','resources.html','crop-pdf.html','sellquanta/download.html']) {
    const html=fs.readFileSync(new URL(path,root),'utf8');
    assert.doesNotMatch(html,/screen-view|Screen View/);
    for(const route of ['crop-pdf','split-pdf','merge-pdf','shipping-label-4in1','pdf-to-word'])assert.ok(html.includes('/'+route+'.html'),path+' '+route);
  }
  for(const path of ['src/auth/core.js','src/scripts/auth-gate.js','src/supabase/client.js'])assert.ok(fs.existsSync(new URL('../'+path,import.meta.url)),path);
});
