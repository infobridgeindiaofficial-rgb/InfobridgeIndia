import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, cpSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const walk = dir => readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]);
const paths = root => walk(root).map(p => p.slice(root.length + 1).replaceAll('\\','/'));

test('root deployment matches every file in dist, including Contact runtime assets', () => {
  for (const file of paths('dist')) assert.deepEqual(readFileSync(file), readFileSync(join('dist',file)), file);
  for (const file of ['contact.html','scripts/contact.js','scripts/contact-config.js']) assert.ok(existsSync(file));
});

test('generated routes, assets, imports and fragment destinations resolve', () => {
  const files=paths('dist'), available=new Set(files), errors=[];
  const dynamicHrViews=new Set(['payroll','attendance','leave']);
  for (const file of files.filter(n=>n.endsWith('.html'))) {
    const html=readFileSync(join('dist',file),'utf8');
    for (const m of html.matchAll(/\b(?:href|src|action)\s*=\s*["']([^"']+)["']/gi)) {
      if (/^(?:data:|mailto:|tel:|javascript:|blob:)/i.test(m[1])) continue;
      const url=new URL(m[1].replaceAll('&amp;','&'),'https://infobridgeindia.online/'+file);
      if(url.hostname!=='infobridgeindia.online')continue;
      let target=decodeURIComponent(url.pathname).slice(1);if(!target||target.endsWith('/'))target+='index.html';
      if(!available.has(target)){errors.push(`${file}: missing ${target}`);continue;}
      const id=decodeURIComponent(url.hash.slice(1));if(!id)continue;
      if(target==='hr-payroll/index.html'&&dynamicHrViews.has(id))continue;
      const targetHtml=readFileSync(join('dist',target),'utf8');
      if(!targetHtml.includes(`id="${id}"`)&&!targetHtml.includes(`id='${id}'`)&&!targetHtml.includes(`name="${id}"`))errors.push(`${file}: missing ${target}#${id}`);
    }
  }
  for(const file of files.filter(n=>/\.(js|css)$/.test(n)&&!n.startsWith('vendor/'))){
    const content=readFileSync(join('dist',file),'utf8');
    for(const m of content.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)["']([^"']+)["']|url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)){
      const value=m[1]||m[2];if(!value.startsWith('.')&&!value.startsWith('/'))continue;
      const target=new URL(value,'https://infobridgeindia.online/'+file).pathname.slice(1);
      if(!available.has(target))errors.push(`${file}: missing asset ${target}`);
    }
  }
  assert.deepEqual(errors,[]);
});

test('approved stale wording and encoding are removed from the scoped pages', () => {
  const resources=readFileSync('dist/resources.html','utf8');
  assert.doesNotMatch(resources,/Filed on|built yet|due 11 Sep 2026/);
  for(const file of ['resources.html','products/projects-operations.html','products/reports-analytics.html','app/hr/index.html','app/hr/payroll.html','app/import-export.html','app/inventory.html','app/settings.html']){
    const text=readFileSync('dist/'+file,'utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ');
    assert.doesNotMatch(text,/\u00c3|\u00e2\u20ac|\u00c2\u00b7|\u00e2\u201a|\u00e2\u2020|\ufffd/,file);
    if(file.startsWith('products/'))assert.doesNotMatch(text,/sample data|no setup required/);
  }
});

test('source-only clean build creates both complete snapshots and preserves root-only files', () => {
  const clean=mkdtempSync(join(tmpdir(),'infobridge-phase1-'));
  for(const name of ['src','public','build.js','package.json','package-lock.json'])cpSync(name,join(clean,name),{recursive:true});
  // Reuse installed dependencies; no source or generated output is taken from the root snapshot.
  symlinkSync(resolve('node_modules'),join(clean,'node_modules'),'junction');
  writeFileSync(join(clean,'keep-root-only.txt'),'preserve');
  execFileSync(process.execPath,['build.js'],{cwd:clean,stdio:'pipe'});
  for(const file of paths(join(clean,'dist'))){
    assert.deepEqual(readFileSync(join(clean,file)),readFileSync(join(clean,'dist',file)),file);
    assert.deepEqual(readFileSync(join(clean,file)),readFileSync(join('dist',file)),`reproducible ${file}`);
  }
  for(const file of ['contact.html','dist/contact.html','scripts/contact.js','dist/scripts/contact.js'])assert.ok(existsSync(join(clean,file)),file);
  execFileSync(process.execPath,['build.js'],{cwd:clean,stdio:'pipe'});
  assert.equal(readFileSync(join(clean,'keep-root-only.txt'),'utf8'),'preserve');
});
