import { sbFetch } from '../lib/supabase.js';
import { decryptSecret } from '../lib/secret-box.js';
import { currentUser } from '../lib/user-auth.js';

function buildDetailedImagePrompt(idea, conversation) {
  const cleanIdea = String(idea || '').replace(/\\s+/g, ' ').trim();
  const recent = (Array.isArray(conversation) ? conversation : [])
    .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-30)
    .map(item => ({
      role: item.role,
      content: String(item.content || '').replace(/\\s+/g, ' ').trim().slice(0, 1000),
    }))
    .filter(item => item.content);

  // Only use older messages when the latest request clearly refers back to them.
  const refersBack = /\\b(tadi|sebelum ini|yang tadi|macam tadi|gambar tadi|gambar itu|yang itu|sama macam|ubah|tukar|edit|jadikan|buat lagi|previous|earlier|that one|same|it|this image)\\b/i.test(cleanIdea);
  const context = refersBack
    ? recent.slice(-12).map(item => (item.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + item.content).join('\\n')
    : '';

  return [
    'You are an expert image-prompt writer. The latest user request is the source of truth and has absolute priority.',
    'Understand the request in its original language, including Malay colloquial spelling, typos, and short commands. Translate its meaning accurately into a clear English image prompt; do not change the requested subject or action.',
    'SUBJECT LOCK: Identify the exact main subject explicitly named in the latest request. Keep that subject as the central and dominant subject. Never replace it with a person, family, father, mother, child, animal, object, or scene that the user did not ask for.',
    'ACTION LOCK: Preserve the exact requested action. For example, “harimau nyanyi” means a tiger singing: show a tiger as the singer. Do not reinterpret it as a father and child, a human singing, or an unrelated scene.',
    'ENTITY COUNT: Use only the number and kinds of subjects requested. If the user names one tiger, generate one tiger, not people or extra animals. Do not add humans, children, parents, couples, crowds, or extra characters unless explicitly requested.',
    'CONTEXT RULE: Use prior messages only if the latest request clearly refers to an earlier image or detail (such as “gambar tadi”, “ubah warna”, or “same character”). If the latest request describes a new standalone image, IGNORE all previous conversation content. Never let unrelated earlier chat topics alter the new image.',
    'If context is relevant, use it only to preserve details being referred to. The latest request overrides any conflicting older detail.',
    'Create a vivid, coherent image prompt with: (1) exact subject and requested action, (2) appearance and pose, (3) suitable art style, (4) fitting environment/background, and (5) lighting, camera angle, framing, and detail.',
    'Do not invent a story, relationship, extra characters, or objects. Do not add text, logos, or watermarks unless requested. Choose sensible defaults only for minor unspecified visual details.',
    context ? 'Relevant earlier conversation (use only for the explicit follow-up):\\n' + context : 'This is a standalone image request. Do not use earlier conversation.',
    'LATEST USER REQUEST (follow exactly): ' + cleanIdea,
    'Return only the final image-generation prompt in English. The first sentence must name the exact requested subject and action.',
  ].join('\\n\\n');
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
