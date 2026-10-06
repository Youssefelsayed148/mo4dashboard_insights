import { createHash, timingSafeEqual } from 'node:crypto';
export function authorized(header: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  const { DASHBOARD_USERNAME: username, DASHBOARD_PASSWORD: password } = env;
  if (!username || !password || password.length < 20 || !header?.startsWith('Basic ') || header.length > 4096) return false;
  let value: string;
  try { value = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const expected = `${username}:${password}`;
  return timingSafeEqual(createHash('sha256').update(value).digest(), createHash('sha256').update(expected).digest());
}
export function accessFailure(): Response {
  const configured = !!process.env.DASHBOARD_USERNAME && (process.env.DASHBOARD_PASSWORD?.length || 0) >= 20;
  return new Response(configured ? 'Sign in with your dashboard credentials.' : 'Dashboard access is not configured. Set a username and a password of at least 20 characters in the hosting settings.', {
    status: configured ? 401 : 503,
    headers: { 'Cache-Control': 'private, no-store', ...(configured ? { 'WWW-Authenticate': 'Basic realm="MO4 Content Hub", charset="UTF-8"' } : {}) },
  });
}
