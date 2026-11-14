import { isAdmin } from '../../lib/admin-auth.js';
import { sbFetch } from '../../lib/supabase.js';
const URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sila log masuk sebagai admin.' });
  if (!KEY) return res.status(503).json({ error: 'SUPABASE_SECRET_KEY belum ditetapkan.' });
  try {
    if (req.method === 'GET') {
      const response = await fetch(URL + '/auth/v1/admin/users?page=1&per_page=500', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.msg || 'Tidak dapat membaca akaun pengguna.');
      const profiles = await sbFetch('ibalz_user_profiles?select=id,username,email,created_at&limit=500');
      const byId = new Map((profiles || []).map(p => [p.id, p]));
      const users = (data.users || []).map(u => ({ id: u.id, email: u.email, username: byId.get(u.id)?.username || u.user_metadata?.username || '', created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at, banned_until: u.banned_until }));
      return res.status(200).json({ users });
    }
    if (req.method === 'DELETE') {
      const id = String(req.body?.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'ID akaun tidak sah.' });
      const sessions = await sbFetch('ibalz_chat_sessions?select=id&user_id=eq.' + encodeURIComponent(id));
      for (const session of (sessions || [])) await sbFetch('ibalz_chat_messages?session_id=eq.' + encodeURIComponent(session.id), { method: 'DELETE' });
      await sbFetch('ibalz_chat_sessions?user_id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      const response = await fetch(URL + '/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.msg || 'Gagal memadam akaun.');
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Ralat mengurus akaun.' });
  }
}
