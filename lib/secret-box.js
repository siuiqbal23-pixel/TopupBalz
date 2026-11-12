import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

function getKey() {
  const secret = process.env.IBALZ_ADMIN_PASSWORD;
  if (!secret) throw new Error('IBALZ_ADMIN_PASSWORD belum ditetapkan.');
  return scryptSync(secret, 'ibalz-api-key-v1', 32);
}
export function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return 'enc:v1:' + iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + encrypted.toString('hex');
}
export function decryptSecret(value) {
  if (!value?.startsWith('enc:v1:')) return value || '';
  const [, , ivHex, tagHex, dataHex] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
