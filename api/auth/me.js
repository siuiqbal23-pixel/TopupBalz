import { currentUser } from '../../lib/user-auth.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method tidak dibenarkan.' }); }
  const user = await currentUser(req, res);
  if (!user?.id) return res.status(200).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, user: { id: user.id, email: user.email, username: user.user_metadata?.username || '' } });
}
