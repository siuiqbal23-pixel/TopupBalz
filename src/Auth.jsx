import { useState } from 'react';

export default function Auth() {
  const [mode,setMode]=useState(location.pathname==='/signup'?'signup':'signin');
  const [stage,setStage]=useState('form');
  const [username,setUsername]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [otp,setOtp]=useState('');
  const [emailVerified,setEmailVerified]=useState(false);
  const [registered,setRegistered]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');

  async function request(path,body) {
    const r=await fetch('/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw=await r.text();
    let d={};
    try { d=raw ? JSON.parse(raw) : {}; }
    catch { throw new Error(r.ok ? 'Respons pelayan tidak sah. Cuba lagi.' : 'Pelayan mengalami ralat. Cuba sebentar lagi.'); }
    if(!r.ok) throw new Error(d.error||d.message||'Permintaan gagal.');
    return d;
  }

  async function sendEmailCode() {
    setBusy(true); setNotice('');
    try {
      const d=await request('signup',{username,email,password});
      setEmail(d.email||email); setOtp(''); setStage('otp');
      setNotice(d.message||'Kod OTP dihantar ke Gmail. Masukkan 8 digit.');
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function completeSignup() {
    setBusy(true); setNotice('');
    try {
      const d=await request('verify',{action:'complete_signup',email,username,password});
      setRegistered(true); setNotice(d.message||'Akaun berjaya didaftarkan. Sila Sign In.');
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      if(mode==='signup') {
        if(!emailVerified) throw new Error('Sahkan e-mel dahulu sebelum daftar akaun.');
        await completeSignup();
      } else {
        await request('login',{email,password});
        location.href='/';
      }
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      if(mode==='signup') {
        const d=await request('verify',{action:'verify_email',email,token:otp});
        setEmailVerified(true); setStage('form'); setOtp('');
        setNotice(d.message||'E-mel berjaya disahkan. Tekan Daftar untuk cipta akaun.');
      } else {
        await request('verify',{email,token:otp,flow:'signin'});
        location.href='/';
      }
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <a className="auth-brand" href="/"><span>B</span> IBalz AI</a>
    <p className="auth-kicker">IBALZ ACCOUNT</p>
    <h1>{stage==='otp'?'Sahkan e-mel':mode==='signup'?'Cipta akaun':'Selamat kembali'}</h1>
    <p className="auth-muted">{stage==='otp'?'Masukkan kod 8 digit yang dihantar ke '+email:mode==='signup'?'Daftar akaun IBalz AI anda.':'Log masuk ke akaun IBalz AI anda.'}</p>
    {stage==='form'?<form onSubmit={submit}>
      {mode==='signup'&&<label>Username<input value={username} onChange={e=>setUsername(e.target.value)} minLength={9} maxLength={32} placeholder="Lebih 8 aksara" required/></label>}
      <label>Kata laluan<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} placeholder="Sekurang-kurangnya 8 aksara" autoComplete={mode==='signup'?'new-password':'current-password'} required/></label>
      <label>Gmail / E-mel<input type="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailVerified(false);setRegistered(false);}} placeholder="nama@gmail.com" autoComplete="email" required/></label>
      {mode==='signup'&&email&&<div className="auth-email-status"><span className={registered?'is-done':emailVerified?'is-verified':'is-pending'}>{registered?'✓':emailVerified?'✓':'✕'}</span><small>{registered?'Akaun telah didaftarkan':emailVerified?'E-mel telah disahkan':'E-mel belum disahkan'}</small></div>}
      {mode==='signup'?<button type="button" className={registered?'auth-status-done':emailVerified?'auth-status-ready':'auth-status-pending'} onClick={emailVerified?completeSignup:sendEmailCode} disabled={busy||registered||!email||!username||password.length<8}>{busy?'Sila tunggu...':registered?'Akaun Didaftarkan':emailVerified?'Daftar':'Sahkan Email Anda'}</button>:<button disabled={busy}>{busy?'Sila tunggu...':'Sign In & Hantar OTP'}</button>}
    </form>:<form onSubmit={verify}>
      <label>Kod OTP (8 digit)<input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="12345678" required/></label>
      <button disabled={busy||otp.length!==8}>{busy?'Mengesahkan...':mode==='signup'?'Sahkan E-mel':'Sahkan OTP'}</button>
      <button type="button" className="auth-secondary" onClick={()=>{setStage('form');setOtp('');setNotice('');}}>Kembali</button>
    </form>}
    {notice&&<p className="auth-notice">{notice}</p>}
    {stage==='form'&&<p className="auth-switch">{mode==='signup'?'Dah ada akaun?':'Belum ada akaun?'} <button type="button" onClick={()=>{setMode(mode==='signup'?'signin':'signup');setNotice('');setStage('form');setEmailVerified(false);setRegistered(false);}}>{mode==='signup'?'Sign In':'Sign Up'}</button></p>}
    <a className="auth-back" href="/">← Kembali ke chat</a>
  </section></main>;
}
