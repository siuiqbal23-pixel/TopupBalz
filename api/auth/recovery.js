import { authRequest } from '../../lib/user-auth.js';
import { sbFetch } from '../../lib/supabase.js';

function tempCookie(res, token) {
  res.setHeader('Set-Cookie','ibalz_recovery_verify='+encodeURIComponent(token)+'; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/; Max-Age=600');
}
function clearTempCookie(res) {
  res.setHeader('Set-Cookie','ibalz_recovery_verify=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/; Max-Age=0');
}
function readTempCookie(req) {
  const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('ibalz_recovery_verify='));
  return raw?decodeURIComponent(raw.slice('ibalz_recovery_verify='.length)):'';
}
export default async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({error:'Method tidak dibenarkan.'});
  try {
    const action=String(req.body?.action||'');
    const email=String(req.body?.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Alamat e-mel tidak sah.'});
    if(action==='send') {
      const profiles=await sbFetch('ibalz_user_profiles?select=id&email=eq.'+encodeURIComponent(email)+'&limit=1');
      if(!profiles?.length) return res.status(404).json({error:'E-mel ini belum pernah didaftarkan. Sila semak e-mel anda.'});
      await authRequest('otp',{method:'POST',body:JSON.stringify({email,create_user:false})});
      return res.status(200).json({ok:true,message:'Kod OTP dihantar ke Gmail yang berdaftar. Semak Inbox atau Spam.'});
    }
    if(action==='verify') {
      const token=String(req.body?.token||'').trim();
      if(!/^\d{8}$/.test(token)) return res.status(400).json({error:'Masukkan kod OTP 8 digit.'});
      const verified=await authRequest('verify',{method:'POST',body:JSON.stringify({email,token,type:'email'})});
      if(!verified.access_token||!verified.user?.id||String(verified.user.email||'').toLowerCase()!==email) return res.status(400).json({error:'OTP tidak sah atau e-mel tidak sepadan.'});
      const profiles=await sbFetch('ibalz_user_profiles?select=id&email=eq.'+encodeURIComponent(email)+'&id=eq.'+encodeURIComponent(verified.user.id)+'&limit=1');
      if(!profiles?.length) return res.status(403).json({error:'Akaun ini tidak layak untuk reset kata laluan.'});
      tempCookie(res,verified.access_token);
      return res.status(200).json({ok:true,verified:true,message:'E-mel berjaya disahkan.'});
    }
    if(action==='reset') {
      const token=readTempCookie(req);
      if(!token) return res.status(401).json({error:'Pengesahan tamat tempoh. Sila minta OTP semula.'});
      const password=typeof req.body?.password==='string'?req.body.password:'';
      if(password.length<8) return res.status(400).json({error:'Kata laluan mesti sekurang-kurangnya 8 aksara.'});
      const user=await authRequest('user',{headers:{Authorization:'Bearer '+token}});
      if(String(user.email||'').toLowerCase()!==email) return res.status(403).json({error:'E-mel tidak sepadan dengan pengesahan.'});
      await authRequest('user',{method:'PUT',headers:{Authorization:'Bearer '+token},body:JSON.stringify({password})});
      clearTempCookie(res);
      return res.status(200).json({ok:true,reset:true,message:'Kata laluan berjaya ditukar. Sila Sign In.'});
    }
    return res.status(400).json({error:'Tindakan tidak sah.'});
  } catch(error) {
    return res.status(400).json({error:error.message||'Proses reset kata laluan gagal.'});
  }
}
