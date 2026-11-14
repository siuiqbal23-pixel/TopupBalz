import { sbFetch } from '../lib/supabase.js';
import { decryptSecret } from '../lib/secret-box.js';
import { currentUser } from '../lib/user-auth.js';

const SYSTEM_PROMPT = 'Anda ialah IBalz AI, pembantu AI yang mesra, jelas dan membantu. Guna gaya bahasa yang sama dengan pengguna. Jika pengguna guna bahasa Melayu santai, slanga Malaysia atau bahasa pasar seperti wei, weh, bro, kau, aku, balas secara santai dan semula jadi; jangan tiba-tiba guna bahasa baku atau gaya ensiklopedia. Untuk sapaan ringkas seperti wei/hi/hello, balas ringkas dan mesra, contohnya: Weii, ada apa? Jangan huraikan maksud perkataan sapaan. Jangan beri senarai makna yang tidak diminta. Balas dalam bahasa yang digunakan pengguna. Identiti rasmi: IBalz AI dibangunkan di bawah jenama IBalz Technologies. Akronim IBALZ bermaksud Intelligent, Brilliant, Advanced, Leading dan Zenith. Jika pengguna bertanya siapa yang membangunkan IBalz AI, siapa penciptanya, dibuat oleh siapa, berasal dari mana, atau maksud IBALZ, terangkan identiti ini dengan jelas dan konsisten. Dalam Bahasa Melayu, boleh jawab: IBalz AI dibangunkan oleh IBalz Technologies. IBALZ membawa maksud Intelligent (kecerdasan), Brilliant (idea hebat), Advanced (teknologi maju), Leading (peneraju) dan Zenith (tahap kecemerlangan tertinggi). Jangan mendakwa nama individu tertentu, alamat pejabat, atau status syarikat berdaftar jika perkara itu tidak diberikan. Jangan masukkan penerangan identiti ini dalam jawapan yang tidak berkaitan.';

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
    const signedInUser = await currentUser(req, res);
    if (!signedInUser?.id) return res.status(401).json({ error: 'Sila daftar atau Sign In dahulu untuk menggunakan IBalz AI.', code: 'AUTH_REQUIRED' });
    let sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!message || message.length > 10000 || !visitorId) return res.status(400).json({ error: 'Mesej tidak sah atau kosong.' });
    if (image && (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(image) || image.length > 3500000)) {
      return res.status(400).json({ error: 'Gambar tidak sah atau terlalu besar. Cuba gambar yang lebih kecil.' });
    }

    if (!sessionId) {
      const created = await sbFetch('ibalz_chat_sessions', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ visitor_id: visitorId, user_id: signedInUser.id, user_email: signedInUser.email, title: message.replace(/\[Gambar dilampirkan\]/g, '').slice(0, 70) || 'Perbualan bergambar' }),
      });
      sessionId = created?.[0]?.id;
      if (!sessionId) throw new Error('Tidak dapat mencipta sesi chat.');
    } else if (sessionId) {
      const existingSession = await sbFetch('ibalz_chat_sessions?select=id,visitor_id,user_id&id=eq.' + encodeURIComponent(sessionId)).catch(() => []);
      const owned = existingSession?.[0];
      if (!owned) return res.status(404).json({ error: 'Sesi chat tidak dijumpai.' });
      if (owned.user_id !== signedInUser.id) return res.status(403).json({ error: 'Sesi chat ini bukan milik akaun anda.' });
    }
    await sbFetch('ibalz_chat_messages', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ session_id: sessionId, role: 'user', content: message }),
    });

    const history = await sbFetch('ibalz_chat_messages?select=role,content&session_id=eq.' + encodeURIComponent(sessionId) + '&order=created_at.desc&limit=20');
    const messages = (history || []).reverse();
    const settings = await sbFetch('ibalz_settings?select=key,value&key=in.(active_ai_provider,groq_api_key,openai_api_key,gemini_api_key,cloudflare_api_token,cloudflare_account_id,google_grounding_api_key)');
    const values = Object.fromEntries((settings || []).map(row => [row.key, row.value]));
    const provider = values.active_ai_provider || 'groq';
    const keyName = { groq: 'groq_api_key', openai: 'openai_api_key', gemini: 'gemini_api_key' }[provider];
    if (!['groq', 'openai', 'gemini', 'cloudflare'].includes(provider)) return res.status(500).json({ error: 'Penyedia AI aktif tidak sah. Semak tetapan admin.', sessionId });
    const key = keyName && values[keyName] ? decryptSecret(values[keyName]) : '';
    const cloudflareToken = values.cloudflare_api_token ? decryptSecret(values.cloudflare_api_token) : '';
    const cloudflareAccountId = values.cloudflare_account_id ? decryptSecret(values.cloudflare_account_id) : '';
    if (provider === 'cloudflare' && (!cloudflareToken || !cloudflareAccountId)) return res.status(503).json({ error: 'Cloudflare Workers AI belum ditetapkan. Simpan Cloudflare Token di Admin dahulu.', sessionId });
    if (provider !== 'cloudflare' && !key) return res.status(503).json({ error: 'API Key untuk ' + provider.toUpperCase() + ' belum ditetapkan. Admin perlu pilih penyedia dan simpan key di /admin.', sessionId });
    if (provider === 'cloudflare' && image) return res.status(400).json({ error: 'Cloudflare Workers AI chat buat masa ini menerima teks sahaja. Gunakan fungsi penjanaan gambar untuk imej.', sessionId });

    // Elakkan carian untuk sapaan, sembang ringkas dan mesej sosial biasa.
    const normalizedMessage = message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const casualMessages = new Set(['wei','weii','weh','woi','oi','bro','hello','helo','hai','hi','hey','yo','assalamualaikum','salam','ok','okay','oke','baik','haha','hahaha','lol','test','testing','terima kasih','thanks','tq','bye','jumpa lagi']);
    const isCasualMessage = normalizedMessage.length <= 35 && (casualMessages.has(normalizedMessage) || /^(wei+|weh+|woi+|oi+|bro+|hai+|hello+|hi+|hey+)[ ]*$/i.test(normalizedMessage));
    const asksForSearch = /\b(cari|search|google|sumber|rujukan|terkini|terbaru|sekarang|hari ini|minggu ini|tahun ini|202[5-9]|harga|berapa harga|jadual|keputusan|berita|update|status terkini)\b/i.test(normalizedMessage);
    const asksFactualQuestion = /\b(apa maksud|maksud|makna|erti|apa itu|siapa|kenapa|mengapa|bila|tarikh|di mana|kat mana|bagaimana|macam mana|berapa|adakah|betul ke|benarkah)\b/i.test(normalizedMessage);
    const shouldUseGoogleSearch = !isCasualMessage && (asksForSearch || asksFactualQuestion || message.length > 100);

    // Let Gemini decide whether Google Search can improve this answer.
    let searchContext = '';
    let searchSources = [];
    let searchQueries = [];
    const googleGroundingKey = values.google_grounding_api_key ? decryptSecret(values.google_grounding_api_key) : '';
    if (googleGroundingKey && !image && shouldUseGoogleSearch) {
      try {
        const groundingResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': googleGroundingKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Jawab soalan pengguna dengan maklumat web terkini jika carian diperlukan. Berikan jawapan ringkas dan tepat dalam bahasa pengguna. Soalan: ' + message.slice(0, 5000) }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
          }),
        });
        const groundingData = await groundingResponse.json().catch(() => ({}));
        if (groundingResponse.ok) {
          const candidate = groundingData.candidates?.[0];
          const groundedText = candidate?.content?.parts?.map(part => part.text || '').join('').trim() || '';
          const grounding = candidate?.groundingMetadata || {};
          const chunks = grounding.groundingChunks || [];
          searchSources = [...new Map(chunks.map(chunk => chunk.web).filter(source => source?.uri || source?.url)
            .map(source => { const url = source.uri || source.url; return [url, { title: source.title || url, url }]; })).values()];
          searchQueries = Array.isArray(grounding.webSearchQueries) ? grounding.webSearchQueries : [];
          if (groundedText) {
            searchContext = '\n\nMAKLUMAT GOOGLE SEARCH TERKINI (rujuk jika berkaitan, jangan ubah fakta atau cipta sumber). Jangan senaraikan URL atau bahagian sumber dalam jawapan teks; sumber akan dipaparkan secara berasingan oleh aplikasi:\n' + groundedText;
          }
        } else {
          console.error('Gemini Google Search grounding error:', groundingData?.error?.message || groundingResponse.status);
        }
      } catch (searchError) {
        console.error('Gemini Google Search grounding failed:', searchError?.message || searchError);
      }
    }
    const systemPrompt = SYSTEM_PROMPT + searchContext
      + '\n\nIkut gaya bahasa pengguna. Jika pengguna bercakap santai atau menggunakan slanga Malaysia, balas dengan gaya santai yang sepadan, bukan bahasa baku. Untuk sapaan ringkas, jawab ringkas seperti perbualan biasa.'
      + (googleGroundingKey ? '\n\nJika maklumat Google Search disertakan, gunakan maklumat itu apabila relevan. Jangan tulis senarai sumber, URL, pautan atau ayat seperti “sumber yang dirujuk”; aplikasi memaparkan sumber secara berasingan. Jika tiada hasil carian, jawab berdasarkan pengetahuan sedia ada dan nyatakan jika tidak pasti.' : '');

    const lastUser = [...messages].map((m, i) => ({ ...m, i })).reverse().find(m => m.role === 'user');
    if (image && lastUser) messages[lastUser.i] = {
      role: 'user',
      content: [
        { type: 'text', text: message.replace(/\[Gambar dilampirkan\]/g, '').trim() || 'Terangkan gambar ini.' },
        { type: 'image_url', image_url: { url: image } },
      ],
    };

    let upstream, data, reply = '';
    if (provider === 'cloudflare') {
      upstream = await fetch('https://api.cloudflare.com/client/v4/accounts/' + cloudflareAccountId + '/ai/run/@cf/meta/llama-3.1-8b-instruct', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + cloudflareToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, ...messages], max_tokens: 1200 }),
      });
      data = await upstream.json();
      reply = data.result?.response || data.result?.output || '';
    } else if (provider === 'gemini') {
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
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1200 } }),
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
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          temperature: 0.7, max_tokens: 1200,
        }),
      });
      data = await upstream.json();
      reply = data.choices?.[0]?.message?.content || '';
    }

    if (!upstream.ok || data?.success === false) {
      const detail = upstream.status === 401 || upstream.status === 403
        ? (provider === 'cloudflare' ? 'Cloudflare Token ditolak atau tiada kebenaran Workers AI. Semak permission token.' : 'API Key ' + provider.toUpperCase() + ' ditolak. Buka Admin, pilih penyedia yang sama dan simpan API Key yang sah.')
        : (data?.errors?.[0]?.message || data?.error?.message || data?.error?.status || (provider.toUpperCase() + ' tidak dapat memproses permintaan.'));
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
    return res.status(200).json({ reply, sessionId, provider, searchSources, searchQueries });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Ralat pelayan semasa menyimpan chat.' });
  }
}
