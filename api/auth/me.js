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
      if (!user?.id || !user?.email) return res.status(401).json({ error: 'Sila log masuk semula.' });
      if (action === 'update_training_preference') {
        const enabled = req.body?.enabled === true;
        await sbFetch('ibalz_user_profiles?id=eq.' + encodeURIComponent(user.id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ improve_model_for_everyone: enabled }),
        });
        return res.status(200).json({ ok: true, enabled });
      }
      if (action === 'delete_account') {
        const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
        if (!currentPassword) return res.status(400).json({ error: 'Masukkan kata laluan untuk mengesahkan pemadaman.' });
        const verified = await authRequest('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: user.email, password: currentPassword }) });
        if (!verified.access_token) return res.status(401).json({ error: 'Kata laluan tidak betul.' });
        await sbFetch('ibalz_chat_sessions?user_id=eq.' + encodeURIComponent(user.id), { method: 'DELETE' });
        const URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';
        const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!KEY) throw new Error('Konfigurasi Supabase tidak lengkap.');
        const headers = KEY.startsWith('sb_secret_') ? { apikey: KEY } : { apikey: KEY, Authorization: 'Bearer ' + KEY };
        const deleted = await fetch(URL + '/auth/v1/admin/users/' + encodeURIComponent(user.id), { method: 'DELETE', headers });
        const deletedData = await deleted.json().catch(() => ({}));
        if (!deleted.ok) throw new Error(deletedData.message || deletedData.msg || 'Tidak dapat memadam akaun. Sila cuba lagi.');
        await sbFetch('ibalz_user_profiles?id=eq.' + encodeURIComponent(user.id), { method: 'DELETE' });
        clearUserCookie(res);
        return res.status(200).json({ ok: true, deleted: true });
      }
      if (action !== 'change_password') return res.status(400).json({ error: 'Tindakan tidak sah.' });
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
  if (req.query?.export === '1') {
    try {
      const profiles = await sbFetch('ibalz_user_profiles?select=username,email,created_at,improve_model_for_everyone&id=eq.' + encodeURIComponent(user.id) + '&limit=1');
      const sessions = await sbFetch('ibalz_chat_sessions?select=id,title,created_at,updated_at&user_id=eq.' + encodeURIComponent(user.id) + '&order=created_at.asc&limit=500');
      const conversations = [];
      for (const session of (sessions || [])) {
        const messages = await sbFetch('ibalz_chat_messages?select=role,content,created_at&session_id=eq.' + encodeURIComponent(session.id) + '&order=created_at.asc&limit=2000');
        conversations.push({ title: session.title || 'Perbualan baharu', created_at: session.created_at, updated_at: session.updated_at, messages: messages || [] });
      }
      return res.status(200).json({ exported_at: new Date().toISOString(), account: profiles?.[0] || { email: user.email }, conversations });
    } catch (error) { return res.status(500).json({ error: error.message || 'Gagal mengeksport data.' }); }
  }
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
  try {
    const profiles = await sbFetch('ibalz_user_profiles?select=improve_model_for_everyone&id=eq.' + encodeURIComponent(user.id) + '&limit=1');
    return res.status(200).json({ authenticated: true, user: { id: user.id, email: user.email, username: user.user_metadata?.username || '', improveModelForEveryone: profiles?.[0]?.improve_model_for_everyone === true } });
  } catch (error) { return res.status(500).json({ error: error.message || 'Gagal membaca akaun.' }); }
}
