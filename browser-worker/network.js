import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export function publicIP(value) {
  try {
    const ip = ipaddr.process(value);
    return ip.range() === 'unicast';
  } catch { return false; }
}

export function webURL(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))) throw new Error('URL blocked');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || host === 'localhost' || /\.(localhost|local|internal|test|invalid)$/.test(host) ||
      host === 'metadata.google.internal' || (ipaddr.isValid(host) && !publicIP(host))) throw new Error('URL blocked');
  return url;
}

// Resolve once, reject mixed public/private responses, then connect to the literal
// validated address. Never resolve again in the socket layer (DNS rebinding).
export async function resolvePublic(host, lookup = dns.lookup) {
  host = host.replace(/^\[|\]$/g, '');
  const results = ipaddr.isValid(host) ? [{ address: host, family: ipaddr.parse(host).kind() === 'ipv4' ? 4 : 6 }]
    : await lookup(host, { all: true, verbatim: true });
  if (!results.length || results.some(({ address }) => !publicIP(address))) throw new Error('Destination blocked');
  return results[0];
}

export function navigationURL(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('Enter a URL or search');
  const text = value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return webURL(text).href;
  if (!/\s/.test(text) && text.includes('.')) return webURL(`https://${text}`).href;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}
