import { currentUser } from '../../lib/user-auth.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  const user = await currentUser(req);
  return res.status(200).json({ user: user ? { id: user.id, email: user.email } : null });
}
