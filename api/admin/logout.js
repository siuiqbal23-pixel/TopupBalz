export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'ibalz_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  return res.status(200).json({ ok: true });
}
