import { sbFetch } from '../lib/supabase.js';
import { decryptSecret } from '../lib/secret-box.js';

const SYSTEM_PROMPT = 'Anda ialah IBalz AI, pembantu AI yang mesra, jelas dan membantu. Balas dalam bahasa yang digunakan pengguna. Identiti rasmi: IBalz AI dibangunkan di bawah jenama IBalz Technologies. Akronim IBALZ bermaksud Intelligent, Brilliant, Advanced, Leading dan Zenith. Jika pengguna bertanya siapa yang membangunkan IBalz AI, siapa penciptanya, dibuat oleh siapa, berasal dari mana, atau maksud IBALZ, terangkan identiti ini dengan jelas dan konsisten. Dalam Bahasa Melayu, boleh jawab: IBalz AI dibangunkan oleh IBalz Technologies. IBALZ membawa maksud Intelligent (kecerdasan), Brilliant (idea hebat), Advanced (teknologi maju), Leading (peneraju) dan Zenith (tahap kecemerlangan tertinggi). Jangan mendakwa nama individu tertentu, alamat pejabat, atau status syarikat berdaftar jika perkara itu tidak diberikan. Jangan masukkan penerangan identiti ini dalam jawapan yang tidak berkaitan.';

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
    if (!message || message.length > 10000 || !visitorId) return res.status(400).json({ error: 'Mesej tidak sah atau kosong.' });
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
    const settings = await sbFetch('ibalz_settings?select=key,value&key=in.(active_ai_provider,groq_api_key,openai_api_key,gemini_api_key)');
    const values = Object.fromEntries((settings || []).map(row => [row.key, row.value]));
    const provider = values.active_ai_provider || 'groq';
    const keyName = { groq: 'groq_api_key', openai: 'openai_api_key', gemini: 'gemini_api_key' }[provider];
    if (!keyName) return res.status(500).json({ error: 'Penyedia AI aktif tidak sah. Semak tetapan admin.', sessionId });
    const key = values[keyName] ? decryptSecret(values[keyName]) : '';
    if (!key) return res.status(503).json({ error: 'API Key untuk ' + provider.toUpperCase() + ' belum ditetapkan. Admin perlu pilih penyedia dan simpan key di /admin.', sessionId });

    const lastUser = [...messages].map((m, i) => ({ ...m, i })).reverse().find(m => m.role === 'user');
    if (image && lastUser) messages[lastUser.i] = {
      role: 'user',
      content: [
        { type: 'text', text: message.replace(/\[Gambar dilampirkan\]/g, '').trim() || 'Terangkan gambar ini.' },
        { type: 'image_url', image_url: { url: image } },
      ],
    };

    let upstream, data, reply = '';
    if (provider === 'gemini') {
      const contents = messages.map(item => {
        const parts = typeof item.content === 'string' ? [{ text: item.content }] : item.content.map(part => {
          if (part.type === 'text') return { text: part.text };
          const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(part.image_url?.url || '');
          return match ? { inlineData: { mimeType: match[1], data: match[2] } } : { text: '[Imej tidak dapat dibaca]' };
        });
        return { role: item.role === 'assistant' ? 'model' : 'user', parts };
      });
      upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1200 } }),
      });
      data = await upstream.json();
      reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    } else {
      const model = provider === 'groq'
        ? (image ? 'qwen/qwen3.8-27b' : (process.env.GROQ_MODEL || 'openai/gpt-oss-120b'))
        : (image ? 'gpt-4o-mini' : 'gpt-4o-mini');
      upstream = await fetch(provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          temperature: 0.7, max_tokens: 1200,
        }),
      });
      data = await upstream.json();
      reply = data.choices?.[0]?.message?.content || '';
    }

    if (!upstream.ok) {
      const detail = data?.error?.message || data?.error?.status || (provider.toUpperCase() + ' tidak dapat memproses permintaan.');
      return res.status(502).json({ error: detail, sessionId });
    }
    if (!reply) return res.status(502).json({ error: 'Penyedia AI tidak memulangkan jawapan teks.', sessionId });
    await sbFetch('ibalz_chat_messages', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ session_id: sessionId, role: 'assistant', content: reply }),
    });
    await sbFetch('ibalz_chat_sessions?id=eq.' + encodeURIComponent(sessionId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ reply, sessionId, provider });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Ralat pelayan semasa menyimpan chat.' });
  }
}
