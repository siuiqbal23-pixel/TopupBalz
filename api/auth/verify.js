import { authRequest, setUserCookie, clearUserCookie } from '../../lib/user-auth.js';
import { sbFetch } from '../../lib/supabase.js';
const URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_HEADERS = KEY?.startsWith('sb_secret_') ? { apikey: KEY, 'Content-Type': 'application/json' } : { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();
    const flow = req.body?.flow === 'signin' ? 'signin' : 'signup';
    if (!email || !/^\d{6}$/.test(token)) return res.status(400).json({ error: 'Masukkan kod OTP 6 digit yang betul.' });
    const verified = await authRequest('verify', { method: 'POST', body: JSON.stringify({ email, token, type: 'email' }) });
    if (!verified.access_token || !verified.user?.id) return res.status(400).json({ error: 'OTP tidak sah atau sudah tamat tempoh.' });
    if (flow === 'signup') {
      const username = String(req.body?.username || '').trim();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (username.length <= 8 || username.length > 32 || password.length < 8) return res.status(400).json({ error: 'Maklumat pendaftaran tidak sah. Sila ulang proses daftar.' });
      const existing = await sbFetch('ibalz_user_profiles?select=id&username=ilike.' + encodeURIComponent(username) + '&limit=1');
      if (existing?.length) return res.status(409).json({ error: 'Username ini sudah digunakan. Sila pilih username lain.' });
      const update = await fetch(URL + '/auth/v1/admin/users/' + encodeURIComponent(verified.user.id), {
        method: 'PUT', headers: ADMIN_HEADERS,
        body: JSON.stringify({ password, user_metadata: { username } })
      });
      const updateData = await update.json().catch(() => ({}));
      if (!update.ok) throw new Error(updateData.message || updateData.msg || 'Tidak dapat menetapkan kata laluan akaun.');
      await sbFetch('ibalz_user_profiles?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: verified.user.id, username, email }]) });
      await authRequest('logout', { method: 'POST', headers: { Authorization: 'Bearer ' + verified.access_token } }).catch(() => {});
      clearUserCookie(res);
      return res.status(200).json({ ok: true, verified: true, signedIn: false, message: 'Email disahkan dan akaun berjaya didaftarkan. Sila Sign In.' });
    }
    setUserCookie(res, verified.access_token);
    return res.status(200).json({ ok: true, verified: true, signedIn: true, user: { id: verified.user.id, email: verified.user.email } });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Pengesahan OTP gagal.' });
  }
}
