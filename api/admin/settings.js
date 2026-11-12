import { isAdmin } from '../../lib/admin-auth.js';
import { sbFetch } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sila log masuk sebagai admin.' });
  try {
    if (req.method === 'GET') {
      const rows = await sbFetch('ibalz_settings?select=key&key=eq.groq_api_key&limit=1');
      return res.status(200).json({ configured: Boolean(rows?.length) });
    }
    if (req.method === 'POST') {
      const key = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
      if (key.length < 20 || key.length > 500) return res.status(400).json({ error: 'API key tidak sah.' });
      await sbFetch('ibalz_settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: 'groq_api_key', value: key, updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Gagal menyimpan tetapan.' });
  }
}
