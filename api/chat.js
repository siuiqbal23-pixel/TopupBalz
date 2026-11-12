export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'GROQ_API_KEY belum ditetapkan dalam Vercel.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const messages = Array.isArray(body.messages)
      ? body.messages
          .filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
          .slice(-20)
      : [];

    if (!messages.length) {
      return res.status(400).json({ error: 'Mesej kosong.' });
    }

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Anda ialah IBalz, pembantu AI yang mesra, jelas dan membantu. Balas dalam bahasa yang digunakan pengguna.' },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(502).json({
        error: data?.error?.message || 'Groq tidak dapat memproses permintaan.',
      });
    }

    return res.status(200).json({
      reply: data.choices?.[0]?.message?.content || 'Tiada jawapan diterima.',
    });
  } catch {
    return res.status(500).json({ error: 'Ralat pelayan semasa menghubungi Groq.' });
  }
}
