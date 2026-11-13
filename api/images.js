export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  }
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) return res.status(400).json({ error: 'Arahan gambar tidak sah atau terlalu panjang.' });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(503).json({ error: 'Penjana gambar belum diaktifkan. Admin perlu tetapkan OPENAI_API_KEY dalam Vercel Environment Variables.' });
    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare',
        prompt,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'png',
        n: 1
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const detail = data?.error?.message || 'Servis penjana gambar tidak dapat memproses permintaan.';
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: detail });
    }
    const encoded = data?.data?.[0]?.b64_json;
    if (!encoded) return res.status(502).json({ error: 'Servis tidak memulangkan imej.' });
    return res.status(200).json({ image: 'data:image/png;base64,' + encoded });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Ralat semasa menjana gambar.' });
  }
}
