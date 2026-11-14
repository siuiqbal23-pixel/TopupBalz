import { authRequest, setUserCookie, clearUserCookie } from '../../lib/user-auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();
    const flow = req.body?.flow === 'signin' ? 'signin' : 'signup';
    if (!email || !/^\d{6}$/.test(token)) return res.status(400).json({ error: 'Masukkan kod OTP 6 digit yang betul.' });
    const verified = await authRequest('verify', { method: 'POST', body: JSON.stringify({ email, token, type: flow === 'signin' ? 'email' : 'signup' }) });
    if (!verified.access_token) return res.status(400).json({ error: 'OTP tidak sah atau sudah tamat tempoh.' });
    if (flow === 'signup') {
      await authRequest('logout', { method: 'POST', headers: { Authorization: 'Bearer ' + verified.access_token } }).catch(() => {});
      clearUserCookie(res);
      return res.status(200).json({ ok: true, verified: true, signedIn: false, message: 'E-mel berjaya disahkan. Sekarang sila Sign In.' });
    }
    setUserCookie(res, verified.access_token);
    return res.status(200).json({ ok: true, verified: true, signedIn: true, user: { id: verified.user?.id, email: verified.user?.email } });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Pengesahan OTP gagal.' });
  }
}
