import { currentUser, authRequest } from '../../lib/user-auth.js';
import { sbFetch } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const action = String(req.body?.action || '');
      const user = await currentUser(req, res);
      if (action === 'presence') {
        if (!user?.id) return res.status(401).json({ error: 'Sila log masuk semula.' });
        await sbFetch('ibalz_user_profiles?id=eq.' + encodeURIComponent(user.id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
        });
        return res.status(200).json({ ok: true });
      }
      if (action !== 'change_password') return res.status(400).json({ error: 'Tindakan tidak sah.' });
      if (!user?.id || !user?.email) return res.status(401).json({ error: 'Sila log masuk semula.' });
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!currentPassword || newPassword.length < 8) return res.status(400).json({ error: 'Masukkan kata laluan semasa dan kata laluan baharu sekurang-kurangnya 8 aksara.' });
      const verified = await authRequest('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: user.email, password: currentPassword }) });
      if (!verified.access_token) return res.status(401).json({ error: 'Kata laluan semasa tidak betul.' });
      await authRequest('user', { method: 'PUT', headers: { Authorization: 'Bearer ' + verified.access_token }, body: JSON.stringify({ password: newPassword }) });
      return res.status(200).json({ ok: true, message: 'Kata laluan berjaya ditukar.' });
    } catch (error) { return res.status(400).json({ error: /invalid login credentials/i.test(error.message) ? 'Kata laluan semasa tidak betul.' : error.message || 'Gagal menukar kata laluan.' }); }
  }
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method tidak dibenarkan.' }); }
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
