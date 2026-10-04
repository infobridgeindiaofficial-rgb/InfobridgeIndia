import { fetch, ProxyAgent } from 'undici';

export function supabaseVerifier({ url, key, admins, proxy }) {
  if (!url || new URL(url).protocol !== 'https:' || !key || !admins.size) throw new Error('Configure Supabase and SCREEN_VIEW_ADMIN_IDS');
  const dispatcher = new ProxyAgent(proxy);
  return async token => {
    if (!token || token.length > 8192) throw new Error('Sign in required');
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }, dispatcher, signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw new Error('Sign in required');
    const user = await response.json();
    if (!user.id || !admins.has(user.id)) throw new Error('Screen View admin access required');
    return { id: user.id };
  };
}
