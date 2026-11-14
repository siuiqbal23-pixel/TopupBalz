import { sbFetch } from '../lib/supabase.js';
import { decryptSecret } from '../lib/secret-box.js';
import { currentUser } from '../lib/user-auth.js';

function buildDetailedImagePrompt(idea, conversation) {
  const cleanIdea = String(idea || '').replace(/\\s+/g, ' ').trim();
  const recent = (Array.isArray(conversation) ? conversation : [])
    .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-12)
    .map(item => ({
      role: item.role,
      content: String(item.content || '').replace(/\\s+/g, ' ').trim().slice(0, 300),
    }))
    .filter(item => item.content);

  // Only attach prior context when the user clearly asks to continue/edit an earlier image.
  const refersBack = /\\b(tadi|sebelum ini|yang tadi|macam tadi|gambar tadi|gambar itu|yang itu|sama macam|ubah|tukar|edit|jadikan|buat lagi|previous|earlier|that one|same|this image)\\b/i.test(cleanIdea);
  const context = refersBack
    ? recent.slice(-4).map(item => (item.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + item.content).join('\\n').slice(-350)
    : '';

  // Keep the user's latest request first. Do not include illustrative examples:
  // examples can accidentally become subjects in image models.
  const instruction = 'Create an image matching the user request exactly. The latest request defines the only main subject and its action. Interpret Malay, informal Malay, spelling mistakes, and mixed-language wording by meaning. Do not replace the requested subject with anything from earlier conversation. Do not add unrelated people, animals, objects, or text. Make the requested action clearly visible. Choose a suitable realistic composition, background, and lighting. ';
  const contextText = context ? ' Earlier context, only for resolving the follow-up: ' + context + '. ' : '';
  const prefix = instruction + contextText + 'User request: ';
  const suffix = '. Follow the user request literally; no unrelated subject, no watermark.';
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
