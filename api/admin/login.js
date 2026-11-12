import { createHmac, timingSafeEqual } from 'node:crypto';

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  const secret = process.env.IBALZ_ADMIN_PASSWORD;
  if (!secret) return res.status(503).json({ error: 'Tetapkan IBALZ_ADMIN_PASSWORD dalam Vercel dahulu.' });
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Kata laluan admin salah.' });
  }
  const payload = Buffer.from(String(Date.now())).toString('base64url');
  const token = payload + '.' + sign(payload, secret);
  res.setHeader('Set-Cookie', `ibalz_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`);
  return res.status(200).json({ ok: true });
}
