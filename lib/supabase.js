const SUPABASE_URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function sbFetch(path, options = {}) {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY belum ditetapkan dalam Vercel.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const message = data?.message || data?.hint || 'Ralat Supabase.';
    throw new Error(message);
  }
  return data;
}
