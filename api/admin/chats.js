import { isAdmin } from '../../lib/admin-auth.js';
import { sbFetch } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sila log masuk sebagai admin.' });
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    if (id) {
      const rows = await sbFetch('ibalz_chat_messages?select=id,role,content,created_at&session_id=eq.' + encodeURIComponent(id) + '&order=created_at.asc&limit=1000');
      return res.status(200).json({ messages: rows || [] });
    }
    const userId = typeof req.query?.userId === 'string' ? req.query.userId : '';
    const filter = userId ? '&user_id=eq.' + encodeURIComponent(userId) : '';
    const sessions = await sbFetch('ibalz_chat_sessions?select=id,visitor_id,user_id,user_email,title,created_at,updated_at&order=updated_at.desc&limit=1000' + filter);
    return res.status(200).json({ sessions: sessions || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Gagal membaca sejarah chat.' });
  }
}
