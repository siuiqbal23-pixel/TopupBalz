import { authRequest, setUserCookie } from '../../lib/user-auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ error: 'Masukkan e-mel dan kata laluan.' });
    const checked = await authRequest('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!checked.access_token) return res.status(401).json({ error: 'E-mel atau kata laluan tidak betul.' });
    setUserCookie(res, checked.access_token, checked.refresh_token);
    return res.status(200).json({ ok: true, signedIn: true, email, user: { id: checked.user?.id, email: checked.user?.email || email }, message: 'Log masuk berjaya.' });
  } catch (error) {
    return res.status(401).json({ error: /invalid login credentials/i.test(error.message) ? 'E-mel atau kata laluan tidak betul.' : error.message || 'Log masuk gagal.' });
  }
}
