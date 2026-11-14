import { sbFetch } from '../lib/supabase.js';
import { decryptSecret } from '../lib/secret-box.js';
import { currentUser } from '../lib/user-auth.js';

function buildDetailedImagePrompt(idea) {
  return [
    'Create a polished, highly detailed image based on the user\'s original idea below.',
    'Treat the original idea as the source of truth; preserve its main subject, requested objects, relationships, and intent. Do not replace or contradict them.',
    'Professionally expand the concept using these four elements:',
    '1. MAIN SUBJECT: clearly define the central subject, its appearance, pose, action, important features, materials, textures, and composition.',
    '2. ART STYLE / MEDIUM: choose a coherent professional style and medium that best fits the idea (for example photorealistic photography, cinematic 3D render, digital illustration, watercolor, anime, or editorial design).',
    '3. DETAILED ENVIRONMENT / BACKGROUND: create a fitting, layered setting with relevant foreground, midground, background, atmospheric depth, and small contextual details. Keep the subject visually clear.',
    '4. LIGHTING / CAMERA: specify a fitting light source and direction, soft or dramatic shadows, color palette, mood, camera angle, framing, depth of field, and a suitable lens/look. Aim for crisp high-resolution detail and professional visual quality.',
    'Use creative judgment for any unspecified details. Avoid asking questions during image rendering; choose tasteful defaults that support the original idea. Avoid clutter, random text, watermarks, logos, and unnecessary extra subjects.',
    'Original user idea: ' + idea,
  ].join('\\n');
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
    if (!prompt || prompt.length > 4000) return res.status(400).json({ error: 'Arahan gambar tidak sah atau terlalu panjang.' });
    const detailedPrompt = buildDetailedImagePrompt(prompt);

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
