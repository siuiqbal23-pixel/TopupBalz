import { sbFetch } from '../lib/supabase.js';
import { decryptSecret } from '../lib/secret-box.js';
import { currentUser } from '../lib/user-auth.js';

function buildDetailedImagePrompt(idea, conversation) {
  const cleanIdea = String(idea || '').replace(/\s+/g, ' ').trim();
  const recent = (Array.isArray(conversation) ? conversation : [])
    .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-30)
    .map(item => ({
      role: item.role,
      content: String(item.content || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    }))
    .filter(item => item.content);

  const refersBack = /\b(tadi|sebelum ini|yang tadi|macam tadi|gambar tadi|gambar itu|yang itu|sama macam|ubah|tukar|edit|jadikan|buat lagi|previous|earlier|that one|same|this image)\b/i.test(cleanIdea);
  const context = refersBack
    ? recent.slice(-6).map(item => (item.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + item.content).join('\n').slice(-240)
    : '';

  const rules = [
    'Write a clear English image prompt. Understand Malay colloquial wording and typos accurately.',
    'The latest request is authoritative. Name its exact subject and action first; never substitute another subject.',
    'Example: “harimau nyanyi” = a tiger singing. Show the tiger as the singer, not a father, child, or human.',
    'Use only requested subjects and quantities. Do not add people, family members, animals, or extra characters unless requested.',
    'Use old chat only for a clear follow-up reference; ignore it for a new standalone request. Latest request overrides older details.',
    'Add fitting style, background, lighting, and camera details without changing the requested subject/action. No unrequested text or watermark.',
  ].join(' ');
  const suffix = ' Return only the final image prompt.';

  // Keep the complete payload under Cloudflare FLUX's 2048-character prompt limit.
  const prefix = rules + (context ? ' Relevant earlier context: ' + context : '') + ' Latest user request: ';
  const available = Math.max(1, 2048 - prefix.length - suffix.length);
  const requestText = cleanIdea.length > available
    ? cleanIdea.slice(0, available - 1).trimEnd() + '…'
    : cleanIdea;
  return prefix + requestText + suffix;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  }
  try {
    const user = await currentUser(req, res);
    if (!user?.id) return res.status(401).json({ error: 'Sila daftar atau Sign In dahulu untuk menggunakan IBalz AI.', code: 'AUTH_REQUIRED' });
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const conversation = Array.isArray(req.body?.conversation) ? req.body.conversation : [];
    if (!prompt || prompt.length > 4000) return res.status(400).json({ error: 'Arahan gambar tidak sah atau terlalu panjang.' });
    const detailedPrompt = buildDetailedImagePrompt(prompt, conversation);

    const rows = await sbFetch('ibalz_settings?select=key,value&key=in.(cloudflare_api_token,cloudflare_account_id)');
    const values = Object.fromEntries((rows || []).map(row => [row.key, decryptSecret(row.value)]));
    const token = values.cloudflare_api_token;
    const accountId = values.cloudflare_account_id;

    if (token && accountId) {
      const upstream = await fetch('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId) + '/ai/run/@cf/black-forest-labs/flux-1-schnell', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ prompt: detailedPrompt }),
      });
      const data = await upstream.json();
      if (!upstream.ok || data?.success === false) {
        const detail = data?.errors?.[0]?.message || data?.messages?.[0]?.message || 'Cloudflare Workers AI tidak dapat menjana gambar. Semak permission token dan kuota akaun.';
        return res.status(upstream.status >= 500 ? 502 : upstream.status || 502).json({ error: detail });
      }
      const encoded = data?.result?.image || data?.result?.data?.[0]?.b64_json;
      if (!encoded) return res.status(502).json({ error: 'Cloudflare tidak memulangkan data imej yang dijangka.' });
      return res.status(200).json({ image: 'data:image/png;base64,' + encoded });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      const upstream = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + openAiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare',
          prompt: detailedPrompt, size: '1024x1024', quality: 'medium', output_format: 'png', n: 1,
        }),
      });
      const data = await upstream.json();
      if (!upstream.ok) return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: data?.error?.message || 'OpenAI tidak dapat menjana gambar.' });
      const encoded = data?.data?.[0]?.b64_json;
      if (!encoded) return res.status(502).json({ error: 'OpenAI tidak memulangkan imej.' });
      return res.status(200).json({ image: 'data:image/png;base64,' + encoded });
    }

    return res.status(503).json({ error: 'Tetapkan Cloudflare API Token dan Cloudflare Account ID di Admin → API Keys & Integrasi untuk mengaktifkan penjana gambar.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Ralat semasa menjana gambar.' });
  }
}
