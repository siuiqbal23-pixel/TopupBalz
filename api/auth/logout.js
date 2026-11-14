import { authRequest, userCookie, clearUserCookie } from '../../lib/user-auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  const token = userCookie(req);
  if (token) await authRequest('logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
  clearUserCookie(res);
  return res.status(200).json({ ok: true });
}
