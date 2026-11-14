import { authRequest } from '../../lib/user-auth.js';
import { sbFetch } from '../../lib/supabase.js';
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
    const created = await authRequest('signup', { method: 'POST', body: JSON.stringify({ email, password, data: { username } }) });
    if (!created.user?.id) return res.status(400).json({ error: 'Pendaftaran tidak berjaya. Semak e-mel atau cuba lagi.' });
    if (Array.isArray(created.user.identities) && created.user.identities.length === 0) return res.status(409).json({ error: 'E-mel ini sudah pernah didaftarkan. Sila Sign In.' });
    await sbFetch('ibalz_user_profiles?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: created.user.id, username, email }]) });
    return res.status(200).json({ ok: true, needsOtp: true, email, message: 'Kod pengesahan dihantar ke e-mel. Masukkan OTP untuk sahkan akaun. Selepas itu, log masuk secara berasingan.' });
  } catch (error) {
    const message = error.message || 'Pendaftaran gagal.';
    const duplicate = /already registered|already exists|user already|duplicate/i.test(message);
    return res.status(duplicate ? 409 : 400).json({ error: duplicate ? 'E-mel ini sudah pernah didaftarkan. Sila Sign In.' : message });
  }
}
