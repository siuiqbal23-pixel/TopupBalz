import { isAdmin } from '../../lib/admin-auth.js';
import { sbFetch } from '../../lib/supabase.js';
import { encryptSecret, decryptSecret } from '../../lib/secret-box.js';

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
      const keys = [...Object.values(PROVIDER_KEYS), 'active_ai_provider', 'cloudflare_api_token', 'cloudflare_account_id', 'google_grounding_api_key'];
      const rows = await sbFetch('ibalz_settings?select=key,value&key=in.(' + keys.join(',') + ')');
      const found = new Set((rows || []).map(row => row.key));
      const activeRow = (rows || []).find(row => row.key === 'active_ai_provider');
      return res.status(200).json({
        configured: found.has('groq_api_key'),
        providers: { ...Object.fromEntries(Object.entries(PROVIDER_KEYS).map(([name, key]) => [name, found.has(key)])), cloudflare: found.has('cloudflare_api_token') && found.has('cloudflare_account_id') },
        activeProvider: activeRow?.value || 'groq',
        cloudflareConfigured: found.has('cloudflare_api_token') && found.has('cloudflare_account_id'),
        googleSearchConfigured: found.has('google_grounding_api_key'),
      });
    }
    if (req.method === 'POST') {
      if (req.body?.integration === 'google_search') {
        const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
        if (apiKey.length < 12 || apiKey.length > 500) return res.status(400).json({ error: 'Gemini API Key tidak sah.' });
        const check = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': apiKey } });
        if (!check.ok) {
          const checkData = await check.json().catch(() => ({}));
          return res.status(400).json({ error: checkData?.error?.message || 'Gemini API Key ditolak. Semak key dan pastikan ia aktif.' });
        }
        await sbFetch('ibalz_settings?on_conflict=key', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ key: 'google_grounding_api_key', value: encryptSecret(apiKey), updated_at: new Date().toISOString() }]),
        });
        return res.status(200).json({ ok: true, integration: 'google_search' });
      }
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
            { key: 'active_ai_provider', value: 'cloudflare', updated_at: new Date().toISOString() },
          ]),
        });
        return res.status(200).json({ ok: true, integration: 'cloudflare' });
      }
      const provider = typeof req.body?.provider === 'string' ? req.body.provider : '';
      if (provider === 'cloudflare') {
        const current = await sbFetch('ibalz_settings?select=key,value&key=in.(cloudflare_api_token,cloudflare_account_id)');
        const saved = Object.fromEntries((current || []).map(row => [row.key, row.value]));
        if (!saved.cloudflare_api_token || !saved.cloudflare_account_id) return res.status(400).json({ error: 'Simpan Cloudflare Token dahulu di bahagian Cloudflare — Penjana Gambar.' });
        const token = decryptSecret(saved.cloudflare_api_token);
        const accountId = decryptSecret(saved.cloudflare_account_id);
        const test = await fetch('https://api.cloudflare.com/client/v4/accounts/' + accountId + '/ai/run/@cf/meta/llama-3.1-8b-instruct', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 8 }) });
        const testData = await test.json().catch(() => ({}));
        if (!test.ok || testData.success === false) return res.status(400).json({ error: testData?.errors?.[0]?.message || 'Cloudflare Workers AI tidak dapat diakses. Semak permission Workers AI pada token.' });
        await sbFetch('ibalz_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: 'active_ai_provider', value: 'cloudflare', updated_at: new Date().toISOString() }]) });
        return res.status(200).json({ ok: true, provider: 'cloudflare' });
      }
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
