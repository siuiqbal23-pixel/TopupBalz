const SUPABASE_URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';
const API_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
export function userCookie(req) {
  const raw = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('ibalz_user='));
  return raw ? decodeURIComponent(raw.slice('ibalz_user='.length)) : '';
}
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
export async function currentUser(req) {
  const token = userCookie(req);
  if (!token) return null;
  try { return await authRequest('user', { headers: { Authorization: 'Bearer ' + token } }); }
  catch { return null; }
}
export function setUserCookie(res, accessToken) {
  res.setHeader('Set-Cookie', 'ibalz_user=' + encodeURIComponent(accessToken) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600');
}
export function clearUserCookie(res) {
  res.setHeader('Set-Cookie', 'ibalz_user=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}
