import { isAdmin } from '../../lib/admin-auth.js';
import { sbFetch } from '../../lib/supabase.js';
import { encryptSecret } from '../../lib/secret-box.js';

const KEY_MAP = {
  groq: 'groq_api_key',
  cloudflare: 'cloudflare_api_token',
  cloudflareAccount: 'cloudflare_account_id',
  gemini: 'gemini_api_key',
  openai: 'openai_api_key',
};

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sila log masuk sebagai admin.' });
  try {
    if (req.method === 'GET') {
      const rows = await sbFetch('ibalz_settings?select=key&key=in.(' + Object.values(KEY_MAP).join(',') + ')');
      const found = new Set((rows || []).map(row => row.key));
      return res.status(200).json({
        configured: found.has('groq_api_key'),
        keys: Object.fromEntries(Object.entries(KEY_MAP).map(([name, key]) => [name, found.has(key)])),
      });
    }
    if (req.method === 'POST') {
      const keyName = typeof req.body?.keyName === 'string' ? req.body.keyName : 'groq';
      const settingKey = KEY_MAP[keyName];
      const value = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
      if (!settingKey) return res.status(400).json({ error: 'Jenis API key tidak disokong.' });
      const minLength = keyName === 'cloudflareAccount' ? 10 : 12;
      if (value.length < minLength || value.length > 2000) return res.status(400).json({ error: 'Nilai API tidak sah.' });
      await sbFetch('ibalz_settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: settingKey, value: encryptSecret(value), updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true, keyName });
    }
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Gagal menyimpan tetapan.' });
  }
}
