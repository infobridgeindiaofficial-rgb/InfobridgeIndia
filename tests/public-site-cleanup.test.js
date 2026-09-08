import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mainNav, footerColumns } from '../src/data/nav.js';
import { renderHeader, renderFooter } from '../src/components/layout.js';
import { securityPage } from '../src/pages/marketing/security.js';
import { privacyPage, termsPage } from '../src/pages/marketing/legal.js';

const headings = html => [...html.matchAll(/<h2\b[^>]*>(.*?)<\/h2>/g)].map(m => m[1]);

test('Desktop and mobile public navigation put Contact after GST and before login', () => {
  assert.deepEqual(mainNav.map(item => item.label), ['Products', 'Business Tools', 'GST Workspace', 'Contact']);
  assert.equal(mainNav.at(-1).href, '/contact.html');
  const header = renderHeader();
  assert.equal((header.match(/href="\/contact.html"/g) || []).length, 2);
  for (const area of header.split('<div class="mobile-nav"')) {
    assert.ok(area.indexOf('href="/contact.html"') < area.indexOf('href="/login.html"'));
  }
  assert.doesNotMatch(header, /Pricing|Contact sales/);
});

test('Company footer and bottom legal links match the public navigation requirements', () => {
  assert.deepEqual(footerColumns.find(c => c.title === 'Company').links, [
    {title: 'Resources', href: '/resources.html'},
    {title: 'Security', href: '/security.html'},
    {title: 'Contact', href: '/contact.html'},
  ]);
  const bottom = renderFooter().split('<div class="footer-bottom">')[1];
  assert.deepEqual([...bottom.matchAll(/<a href="[^"]+">(.*?)<\/a>/g)].map(m => m[1]), ['Privacy', 'Terms', 'Security']);
});

test('Security contains the seven public sections and acknowledges third-party services without internal details', () => {
  const {body} = securityPage();
  assert.deepEqual(headings(body), ['1. Protecting Your Information', '2. Account Security', '3. Business Data', '4. File Processing', '5. Third-Party Services', '6. Security Responsibilities', '7. Reporting a Security Issue']);
  assert.match(body, /hosting, authentication, analytics, advertising, contact forms, storage/);
  assert.match(body, /No internet-based service can guarantee absolute security\./);
  assert.match(body, /href="\/contact.html"/);
  assert.doesNotMatch(body, /Supabase|\bRLS\b|Row Level Security|publishable key|browser client|provider configuration|source.code inspection|internal architecture|what has not been built yet|DPDP|CERT-In|DPO|Consent Manager|DPIA|certification|gmail\.com/i);
});

test('Terms has thirteen sections, a contact link, and no plan or pricing language', () => {
  const {body} = termsPage();
  assert.deepEqual(headings(body), ['1. Acceptance of Terms', '2. Use of InfoBridgeIndia', '3. User Accounts', '4. Business Information and User Responsibility', '5. Acceptable Use', '6. Availability and Changes to the Service', '7. Third-Party Services', '8. Intellectual Property', '9. No Professional Advice', '10. Disclaimer and Limitation of Responsibility', '11. Suspension or Termination', '12. Changes to These Terms', '13. Contact']);
  assert.match(body, /href="\/contact.html"/);
  assert.doesNotMatch(body, /Pricing|future paid plans|\bPlus\b|\bPro\b|Contact sales|paid-plan|free features.*limits/i);
});

test('All generated public headers/footers have Contact and no outdated public-facing phrases', () => {
  let checked = 0;
  function scan(dir) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { scan(path); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = readFileSync(path, 'utf8');
      const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
      if (header) { assert.equal((header.match(/href="\/contact.html"/g) || []).length, 2, path); checked++; }
      const text = html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
      assert.doesNotMatch(text, /Pricing|Contact sales|future paid plans|Supabase Auth|Row Level Security|publishable key|no analytics|no tracking services|no verified security-reporting contact channel/i, path);
    }
  }
  scan('dist'); assert.ok(checked > 100);
  for (const page of ['security.html','terms.html','privacy.html']) assert.equal(readFileSync(page,'utf8'),readFileSync(`dist/${page}`,'utf8'));
});

test('Privacy includes all twelve topics and explicit form, analytics and advertising disclosures', () => {
  const { body } = privacyPage();
  assert.deepEqual(headings(body), ['1. Information We Collect', '2. How We Use Information', '3. Business and Workspace Data', '4. Contact Form Information', '5. Cookies, Analytics and Advertising', '6. Third-Party Services', '7. Data Security', '8. Data Retention', '9. User Choices and Requests', "10. Children's Privacy", '11. Changes to this Privacy Policy', '12. Contact']);
  assert.match(body, /name, email address and message/);
  for (const service of ['Formspree', 'Google Analytics', 'Google AdSense']) assert.ok(body.includes(service));
  assert.match(body, /cookies or similar technologies/);
  assert.match(body, /not specifically directed to children/);
  assert.doesNotMatch(body, /gmail\.com|\b(?:30|90|365) days\b|under (?:13|16|18)/);
});

test('All three pages use dated paragraph-based documents without cards, icons or CTA boxes', () => {
  for (const page of [privacyPage(), termsPage(), securityPage()]) {
    assert.match(page.body, /<main class="legal-document">/);
    assert.match(page.body, /<article class="legal-document-content"/);
    assert.ok(page.body.includes(`<h1 id="legal-title">${page.title}</h1>`));
    assert.match(page.body, /Last updated: <time datetime="2026-09-08">September 8, 2026<\/time>/);
    assert.doesNotMatch(page.body, /class="[^"]*(?:card|grid|btn)|<svg|<ul|<ol/);
    assert.match(page.extraHead, /\/styles\/legal-document.css/);
    assert.doesNotMatch(page.body, /\bPricing\b|\bPlus\b|\bPro\b|paid plans|Contact sales|Supabase Auth|Row Level Security|publishable key|no analytics|no tracking services|no verified contact channel/i);
  }
  const css = readFileSync('src/styles/legal-document.css', 'utf8');
  assert.match(css, /max-width: 900px/);
  assert.match(css, /background: #fff/);
  assert.equal(css, readFileSync('styles/legal-document.css', 'utf8'));
  assert.equal(css, readFileSync('dist/styles/legal-document.css', 'utf8'));
});
