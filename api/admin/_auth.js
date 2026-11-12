import { createHmac, timingSafeEqual } from 'node:crypto';

export function isAdmin(req) {
  const secret = process.env.IBALZ_ADMIN_PASSWORD;
  if (!secret) return false;
  const cookie = req.headers.cookie || '';
  const token = cookie.split(';').map(x => x.trim()).find(x => x.startsWith('ibalz_admin='))?.slice('ibalz_admin='.length);
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const issued = Number(Buffer.from(payload, 'base64url').toString());
  return Number.isFinite(issued) && Date.now() - issued < 7 * 24 * 60 * 60 * 1000 && issued <= Date.now();
}
