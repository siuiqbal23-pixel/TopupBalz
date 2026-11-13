import { isAdmin } from '../../lib/admin-auth.js';
import { sbFetch } from '../../lib/supabase.js';
import { encryptSecret } from '../../lib/secret-box.js';

const PROVIDER_KEYS = {
  groq: 'groq_api_key',
  openai: 'openai_api_key',
  gemini: 'gemini_api_key',
};
const PROVIDERS = Object.keys(PROVIDER_KEYS);

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sila log masuk sebagai admin.' });
  try {
    if (req.method === 'GET') {
      const keys = [...Object.values(PROVIDER_KEYS), 'active_ai_provider'];
      const rows = await sbFetch('ibalz_settings?select=key&key=in.(' + keys.join(',') + ')');
      const found = new Set((rows || []).map(row => row.key));
      const activeRow = (rows || []).find(row => row.key === 'active_ai_provider');
      return res.status(200).json({
        configured: found.has('groq_api_key'),
        providers: Object.fromEntries(Object.entries(PROVIDER_KEYS).map(([name, key]) => [name, found.has(key)])),
        activeProvider: activeRow?.value || 'groq',
      });
    }
    if (req.method === 'POST') {
      const provider = typeof req.body?.provider === 'string' ? req.body.provider : '';
      const settingKey = PROVIDER_KEYS[provider];
      const value = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
      if (!settingKey) return res.status(400).json({ error: 'Penyedia AI tidak disokong.' });
      if (value.length < 12 || value.length > 2000) return res.status(400).json({ error: 'API Key tidak sah.' });
      await sbFetch('ibalz_settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([
          { key: settingKey, value: encryptSecret(value), updated_at: new Date().toISOString() },
          { key: 'active_ai_provider', value: provider, updated_at: new Date().toISOString() },
        ]),
      });
      return res.status(200).json({ ok: true, provider });
    }
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Gagal menyimpan tetapan.' });
  }
}
