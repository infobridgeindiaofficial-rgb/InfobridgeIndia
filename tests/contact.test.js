import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contactPage } from '../src/pages/marketing/contact.js';
import { marketingPage } from '../src/components/layout.js';
import { initContactForm } from '../src/scripts/contact.js';

function fixture() {
  const button = {}, status = {}, attributes = {};
  let submit;
  const fields = { name: { value: 'Test Visitor' }, email: { value: 'visitor@example.com' }, message: { value: 'Please help.' } };
  const form = {
    querySelector: (selector) => selector.startsWith('button') ? button : status,
    elements: { namedItem: (name) => fields[name] },
    reportValidity: () => true,
    addEventListener: (_, handler) => { submit = handler; },
    setAttribute: (name, value) => { attributes[name] = value; },
    reset: () => { for (const field of Object.values(fields)) field.value = ''; },
  };
  return { form, fields, button, status, attributes, submit: () => submit({ preventDefault() {} }) };
}
const endpoint = 'https://formspree.io/f/testid';

test('Contact page has exactly three fields, private contact details and correct SEO', () => {
  const page = contactPage();
  assert.deepEqual([...page.body.matchAll(/<(?:input|textarea)\b[^>]*name="([^"]+)"/g)].map(m => m[1]), ['name', 'email', 'message']);
  assert.doesNotMatch(page.body, /mailto:|gmail\.com|\+971/);
  assert.equal((page.body.match(/971521185821/g) || []).length, 1);
  const href = page.body.match(/href="(https:\/\/wa.me\/[^"]+)"/)[1];
  assert.equal(new URL(href).searchParams.get('text'), 'Hello InfoBridgeIndia, I need help with InfoBridgeIndia.');
  assert.match(page.body, /<svg[^>]*[\s\S]*Message us on WhatsApp/);
  assert.match(marketingPage(page), /rel="canonical" href="https:\/\/infobridgeindia.online\/contact.html"/);
  assert.match(readFileSync('public/sitemap.xml', 'utf8'), /https:\/\/infobridgeindia.online\/contact.html/);
});

test('Successful submission sends only the three fields and then clears the form', async () => {
  const f = fixture(); let request;
  initContactForm(f.form, endpoint, async (url, options) => { request = { url, options }; return { ok: true }; });
  await f.submit();
  assert.equal(request.url, endpoint);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'omit');
  assert.deepEqual(JSON.parse(request.options.body), { name: 'Test Visitor', email: 'visitor@example.com', message: 'Please help.' });
  assert.equal(f.status.textContent, 'Thank you. Your message has been sent.');
  assert.equal(f.fields.message.value, '');
  assert.equal(f.button.disabled, false);
});

for (const [label, fetcher] of [
  ['server rejection', async () => ({ ok: false })],
  ['network failure', async () => { throw new Error('offline'); }],
  ['timeout', async () => { throw new DOMException('Timed out', 'AbortError'); }],
]) test(`${label} preserves the message and allows retry`, async () => {
  const f = fixture(); initContactForm(f.form, endpoint, fetcher); await f.submit();
  assert.equal(f.fields.message.value, 'Please help.');
  assert.match(f.status.textContent, /could not confirm/);
  assert.equal(f.button.disabled, false);
  assert.equal(f.attributes['aria-busy'], 'false');
});

test('Missing or invalid endpoint does not submit or claim success', async () => {
  for (const value of ['', 'https://example.com/f/testid']) {
    const f = fixture(); initContactForm(f.form, value, () => assert.fail('must not send')); await f.submit();
    assert.equal(f.button.disabled, true); assert.match(f.status.textContent, /currently unavailable/);
  }
});

test('Duplicate submission is blocked while a request is pending', async () => {
  const f = fixture(); let finish, calls = 0;
  initContactForm(f.form, endpoint, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = f.submit(); await f.submit(); assert.equal(calls, 1); assert.equal(f.button.disabled, true);
  finish({ ok: true }); await first;
});

test('Invalid or whitespace-only fields never submit', async () => {
  const f = fixture(); initContactForm(f.form, endpoint, () => assert.fail('must not send'));
  f.form.reportValidity = () => false; await f.submit();
  f.form.reportValidity = () => true; f.fields.message.value = '   '; await f.submit();
  assert.match(f.status.textContent, /complete all three fields/);
});


test('Default configuration enables the form and posts to the verified endpoint without an unavailable notice', async () => {
  const f = fixture(); let request;
  initContactForm(f.form, undefined, async (url, options) => { request = { url, options }; return { ok: true }; });
  assert.equal(f.button.disabled, false);
  assert.doesNotMatch(f.status.textContent || '', /unavailable|not configured/i);
  await f.submit();
  assert.equal(request.url, 'https://formspree.io/f/mwlkwbov');
  assert.equal(request.options.method, 'POST');
  assert.equal(f.status.textContent, 'Thank you. Your message has been sent.');
});

test('Published Contact assets keep the recipient private and Security and Privacy link to Contact', () => {
  for (const prefix of ['', 'dist/']) {
    for (const asset of ['contact.html', 'scripts/contact.js', 'scripts/contact-config.js']) {
      assert.doesNotMatch(readFileSync(prefix + asset, 'utf8'), /infobridgeindia\.official|gmail\.com/i);
    }
    for (const page of ['security.html', 'privacy.html']) {
      assert.match(readFileSync(prefix + page, 'utf8'), /href="\/contact\.html"/);
    }
    assert.match(readFileSync(prefix + 'scripts/contact-config.js', 'utf8'), /https:\/\/formspree\.io\/f\/mwlkwbov/);
  }
});
