import { authRequest, setUserCookie, clearUserCookie } from '../../lib/user-auth.js';
import { sbFetch } from '../../lib/supabase.js';
const URL = process.env.SUPABASE_URL || 'https://evvquwzrqkmmpoeytssr.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_HEADERS = KEY?.startsWith('sb_secret_') ? { apikey: KEY, 'Content-Type': 'application/json' } : { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
function tempCookie(res, token) {
  res.setHeader('Set-Cookie', 'ibalz_signup_verify=' + encodeURIComponent(token) + '; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/; Max-Age=600');
}
function clearTempCookie(res) {
  res.setHeader('Set-Cookie', 'ibalz_signup_verify=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/; Max-Age=0');
}
function readTempCookie(req) {
  const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('ibalz_signup_verify='));
  return raw?decodeURIComponent(raw.slice('ibalz_signup_verify='.length)):'';
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak dibenarkan.' });
  try {
    const action=String(req.body?.action||'');
    const email = String(req.body?.email || '').trim().toLowerCase();
    if(action==='complete_signup') {
      const token=readTempCookie(req);
      if(!token) return res.status(401).json({error:'Pengesahan e-mel tamat tempoh. Sila sahkan semula.'});
      const verifiedUser=await authRequest('user',{headers:{Authorization:'Bearer '+token}});
      if(String(verifiedUser.email||'').toLowerCase()!==email) return res.status(403).json({error:'E-mel pengesahan tidak sepadan.'});
      const username=String(req.body?.username||'').trim();
      const password=typeof req.body?.password==='string'?req.body.password:'';
      if(username.length<=8||username.length>32||password.length<8) return res.status(400).json({error:'Maklumat pendaftaran tidak sah. Sila semak username dan kata laluan.'});
      const existing=await sbFetch('ibalz_user_profiles?select=id&username=ilike.'+encodeURIComponent(username)+'&limit=1');
      if(existing?.length) return res.status(409).json({error:'Username ini sudah digunakan. Sila pilih username lain.'});
      const update=await fetch(URL+'/auth/v1/admin/users/'+encodeURIComponent(verifiedUser.id),{method:'PUT',headers:ADMIN_HEADERS,body:JSON.stringify({password,user_metadata:{username}})});
      const updateData=await update.json().catch(()=>({}));
      if(!update.ok) throw new Error(updateData.message||updateData.msg||'Tidak dapat menetapkan kata laluan akaun.');
      await sbFetch('ibalz_user_profiles?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:verifiedUser.id,username,email}])});
      await authRequest('logout',{method:'POST',headers:{Authorization:'Bearer '+token}}).catch(()=>{});
      clearTempCookie(res); clearUserCookie(res);
      return res.status(200).json({ok:true,registered:true,signedIn:false,message:'Akaun berjaya didaftarkan. Sila Sign In.'});
    }
    const token = String(req.body?.token || '').trim();
    const flow = req.body?.flow === 'signin' ? 'signin' : 'signup';
    if (!email || !/^\d{8}$/.test(token)) return res.status(400).json({ error: 'Masukkan kod OTP 8 digit yang betul.' });
    const verified = await authRequest('verify', { method: 'POST', body: JSON.stringify({ email, token, type: 'email' }) });
    if (!verified.access_token || !verified.user?.id) return res.status(400).json({ error: 'OTP tidak sah atau sudah tamat tempoh.' });
    if(action==='verify_email') {
      tempCookie(res,verified.access_token);
      return res.status(200).json({ok:true,verified:true,message:'E-mel berjaya disahkan. Tekan Daftar untuk cipta akaun.'});
    }
    if (flow === 'signup') return res.status(400).json({error:'Sila sahkan e-mel dahulu sebelum daftar.'});
    setUserCookie(res, verified.access_token);
    return res.status(200).json({ ok: true, verified: true, signedIn: true, user: { id: verified.user.id, email: verified.user.email } });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Pengesahan OTP gagal.' });
  }
}
