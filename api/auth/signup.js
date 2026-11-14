import { authRequest } from '../../lib/user-auth.js';
import { sbFetch } from '../../lib/supabase.js';
const URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_HEADERS = KEY?.startsWith('sb_secret_') ? { apikey: KEY } : { apikey: KEY, Authorization: 'Bearer ' + KEY };
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  try {
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (username.length <= 8 || username.length > 32) return res.status(400).json({ error: 'Username mesti lebih daripada 8 aksara.' });
    if (!/^[\p{L}\p{N}_.-]+$/u.test(username)) return res.status(400).json({ error: 'Username hanya boleh mengandungi huruf, nombor, titik, garis dan sempang.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Alamat e-mel tidak sah.' });
    if (password.length < 8) return res.status(400).json({ error: 'Kata laluan mesti sekurang-kurangnya 8 aksara.' });
    const existing = await sbFetch('ibalz_user_profiles?select=id&username=ilike.' + encodeURIComponent(username) + '&limit=1');
    if (existing?.length) return res.status(409).json({ error: 'Username ini sudah digunakan.' });
    const usersResponse = await fetch(URL + '/auth/v1/admin/users?page=1&per_page=1000', { headers: ADMIN_HEADERS });
    const usersData = await usersResponse.json().catch(() => ({}));
    if (!usersResponse.ok) throw new Error(usersData.message || usersData.msg || 'Tidak dapat menyemak e-mel.');
    if ((usersData.users || []).some(u => String(u.email || '').toLowerCase() === email)) return res.status(409).json({ error: 'E-mel ini sudah pernah didaftarkan. Sila Sign In.' });
    await authRequest('otp', { method: 'POST', body: JSON.stringify({ email, create_user: true, data: { username } }) });
    return res.status(200).json({ ok: true, needsOtp: true, email, message: 'Kod pengesahan dihantar. Semak Gmail anda.' });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Gagal menghantar kod pengesahan.' });
  }
}
