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
      const keys = [...Object.values(PROVIDER_KEYS), 'active_ai_provider', 'cloudflare_api_token', 'cloudflare_account_id'];
      const rows = await sbFetch('ibalz_settings?select=key,value&key=in.(' + keys.join(',') + ')');
      const found = new Set((rows || []).map(row => row.key));
      const activeRow = (rows || []).find(row => row.key === 'active_ai_provider');
      return res.status(200).json({
        configured: found.has('groq_api_key'),
        providers: Object.fromEntries(Object.entries(PROVIDER_KEYS).map(([name, key]) => [name, found.has(key)])),
        activeProvider: activeRow?.value || 'groq',
        cloudflareConfigured: found.has('cloudflare_api_token') && found.has('cloudflare_account_id'),
      });
    }
    if (req.method === 'POST') {
      if (req.body?.integration === 'cloudflare') {
        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
        if (token.length < 12 || token.length > 2000) return res.status(400).json({ error: 'Cloudflare API Token tidak sah.' });
        const accountResponse = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=1', {
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        });
        const accountData = await accountResponse.json().catch(() => ({}));
        const accountId = accountData?.result?.[0]?.id;
        if (!accountResponse.ok || !accountData?.success || !/^[a-f0-9]{32}$/i.test(accountId || '')) {
          return res.status(400).json({ error: 'Cloudflare tak dapat mengesan Account ID. Token perlu ada permission Account: Read dan Workers AI: Read/Edit.' });
        }
        await sbFetch('ibalz_settings?on_conflict=key', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([
            { key: 'cloudflare_api_token', value: encryptSecret(token), updated_at: new Date().toISOString() },
            { key: 'cloudflare_account_id', value: encryptSecret(accountId), updated_at: new Date().toISOString() },
          ]),
        });
        return res.status(200).json({ ok: true, integration: 'cloudflare' });
      }
      const provider = typeof req.body?.provider === 'string' ? req.body.provider : '';
      const settingKey = PROVIDER_KEYS[provider];
      const value = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
      if (!settingKey) return res.status(400).json({ error: 'Penyedia AI tidak disokong.' });
      if (value.length < 12 || value.length > 2000) return res.status(400).json({ error: 'API Key tidak sah.' });
      const validationUrl = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/models'
        : provider === 'openai'
          ? 'https://api.openai.com/v1/models'
          : 'https://generativelanguage.googleapis.com/v1beta/models';
      const validationHeaders = provider === 'gemini'
        ? { 'x-goog-api-key': value }
        : { Authorization: 'Bearer ' + value };
      const check = await fetch(validationUrl, { headers: validationHeaders });
      if (!check.ok) {
        if (check.status === 401 || check.status === 403) return res.status(400).json({ error: 'API Key ' + provider.toUpperCase() + ' ditolak. Semak key yang betul dan pastikan ia aktif.' });
        const checkData = await check.json().catch(() => ({}));
        return res.status(400).json({ error: checkData?.error?.message || 'Tidak dapat mengesahkan API Key ' + provider.toUpperCase() + '.' });
      }
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
