import { currentUser } from '../../lib/user-auth.js';
import { sbFetch } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method tidak dibenarkan.' }); }
  const user = await currentUser(req, res);
  if (!user?.id) return res.status(200).json({ authenticated: false });
  if (req.query?.history === '1') {
    try {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (id) {
        const owned = await sbFetch('ibalz_chat_sessions?select=id,title,user_id&id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + encodeURIComponent(user.id) + '&limit=1');
        if (!owned?.length) return res.status(404).json({ error: 'Chat tidak dijumpai.' });
        const messages = await sbFetch('ibalz_chat_messages?select=role,content,created_at&session_id=eq.' + encodeURIComponent(id) + '&order=created_at.asc&limit=500');
        return res.status(200).json({ chat: { id, sessionId: id, title: owned[0].title || 'Perbualan baharu', messages: messages || [] } });
      }
      const sessions = await sbFetch('ibalz_chat_sessions?select=id,title,created_at,updated_at&user_id=eq.' + encodeURIComponent(user.id) + '&order=updated_at.desc&limit=80');
      return res.status(200).json({ chats: (sessions || []).map(s => ({ id: s.id, sessionId: s.id, title: s.title || 'Perbualan baharu', updatedAt: s.updated_at || s.created_at, messages: [] })) });
    } catch (error) { return res.status(500).json({ error: error.message || 'Gagal membaca sejarah chat.' }); }
  }
  return res.status(200).json({ authenticated: true, user: { id: user.id, email: user.email, username: user.user_metadata?.username || '' } });
}
