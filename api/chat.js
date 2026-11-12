import { sbFetch } from '../lib/supabase.js';
import { decryptSecret } from '../lib/secret-box.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  }
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const image = typeof body.image === 'string' ? body.image : '';
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.slice(0, 80) : '';
    let sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!message || message.length > 10000 || !visitorId) {
      return res.status(400).json({ error: 'Mesej tidak sah atau kosong.' });
    }
    if (image && (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(image) || image.length > 3500000)) {
      return res.status(400).json({ error: 'Gambar tidak sah atau terlalu besar. Cuba gambar yang lebih kecil.' });
    }

    if (!sessionId) {
      const created = await sbFetch('ibalz_chat_sessions', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ visitor_id: visitorId, title: message.replace(/\[Gambar dilampirkan\]/g, '').slice(0, 70) || 'Perbualan bergambar' }),
      });
      sessionId = created?.[0]?.id;
      if (!sessionId) throw new Error('Tidak dapat mencipta sesi chat.');
    }

    await sbFetch('ibalz_chat_messages', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ session_id: sessionId, role: 'user', content: message }),
    });

    const history = await sbFetch('ibalz_chat_messages?select=role,content&session_id=eq.' + encodeURIComponent(sessionId) + '&order=created_at.desc&limit=20');
    const messages = (history || []).reverse();
    const settings = await sbFetch('ibalz_settings?select=value&key=eq.groq_api_key&limit=1');
    const key = (settings?.[0]?.value ? decryptSecret(settings[0].value) : '') || process.env.GROQ_API_KEY;
    if (!key) return res.status(503).json({ error: 'API key belum ditetapkan. Admin perlu masukkan Groq API Key di /admin.', sessionId });

    if (image) {
      const lastUser = [...messages].map((m, i) => ({ ...m, i })).reverse().find(m => m.role === 'user');
      if (lastUser) messages[lastUser.i] = {
        role: 'user',
        content: [
          { type: 'text', text: message.replace(/\[Gambar dilampirkan\]/g, '').trim() || 'Terangkan gambar ini.' },
          { type: 'image_url', image_url: { url: image } },
        ],
      };
    }
    const configuredVisionModel = process.env.GROQ_VISION_MODEL;
    const visionModel = configuredVisionModel && configuredVisionModel !== 'meta-llama/llama-4-scout-17b-16e-instruct' ? configuredVisionModel : 'qwen/qwen3.6-27b';
    const model = image ? visionModel : (process.env.GROQ_MODEL || 'openai/gpt-oss-120b');
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Anda ialah IBalz, pembantu AI yang mesra, jelas dan membantu. Balas dalam bahasa yang digunakan pengguna.' },
          ...messages,
        ],
        temperature: 0.7, max_tokens: 1200,
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(502).json({ error: data?.error?.message || 'Groq tidak dapat memproses permintaan.', sessionId });
    const reply = data.choices?.[0]?.message?.content || 'Tiada jawapan diterima.';
    await sbFetch('ibalz_chat_messages', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ session_id: sessionId, role: 'assistant', content: reply }),
    });
    await sbFetch('ibalz_chat_sessions?id=eq.' + encodeURIComponent(sessionId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ reply, sessionId });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Ralat pelayan semasa menyimpan chat.' });
  }
}
