const SUPABASE_URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';
const API_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
function cookie(req, name) {
  const raw = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : '';
}
export function userCookie(req) { return cookie(req, 'ibalz_user'); }
export function refreshCookie(req) { return cookie(req, 'ibalz_refresh'); }
export async function authRequest(path, options = {}) {
  if (!API_KEY) throw new Error('SUPABASE_SECRET_KEY belum ditetapkan di Vercel.');
  const response = await fetch(SUPABASE_URL + '/auth/v1/' + path, {
    ...options,
    headers: { apikey: API_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Permintaan akaun gagal.');
  return data;
}
export async function currentUser(req, res) {
  const token = userCookie(req);
  if (token) {
    try { return await authRequest('user', { headers: { Authorization: 'Bearer ' + token } }); }
    catch {}
  }
  const refresh = refreshCookie(req);
  if (!refresh) return null;
  try {
    const renewed = await authRequest('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refresh }) });
    if (renewed.access_token && renewed.user?.id && res) setUserCookie(res, renewed.access_token, renewed.refresh_token || refresh);
    return renewed.user || null;
  } catch { if (res) clearUserCookie(res); return null; }
}
export function setUserCookie(res, accessToken, refreshToken) {
  res.setHeader('Set-Cookie', [
    'ibalz_user=' + encodeURIComponent(accessToken) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000',
    'ibalz_refresh=' + encodeURIComponent(refreshToken || '') + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000'
  ]);
}
export function clearUserCookie(res) {
  res.setHeader('Set-Cookie', [
    'ibalz_user=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    'ibalz_refresh=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
  ]);
}
