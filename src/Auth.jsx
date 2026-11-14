import { useState } from 'react';
export default function Auth() {
  const [mode,setMode]=useState(location.pathname==='/signup'?'signup':'signin');
  const [stage,setStage]=useState('form');
  const [username,setUsername]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [otp,setOtp]=useState('');
  const [emailVerified,setEmailVerified]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  async function request(path,body) {
    const r=await fetch('/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json(); if(!r.ok) throw new Error(d.error||'Permintaan gagal.'); return d;
  }
  async function sendEmailCode() {
    setBusy(true); setNotice('');
    try {
      const d=await request('signup',{username,email,password});
      setEmail(d.email||email); setStage('otp'); setNotice(d.message||'Kod OTP dihantar ke Gmail.');
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      if(mode==='signup') {
        if(!emailVerified) throw new Error('Sahkan email dahulu sebelum daftar akaun.');
      } else {
        const d=await request('login',{email,password});
        setEmail(d.email||email); setStage('otp'); setNotice(d.message||'Kod OTP log masuk dihantar ke e-mel.');
      }
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function verify(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      const d=await request('verify',{email,token:otp,flow:mode==='signup'?'signup':'signin',username,password});
      if(mode==='signup') { setEmailVerified(true); setStage('form'); setMode('signin'); setPassword(''); setOtp(''); setNotice(d.message||'Email disahkan. Akaun berjaya didaftarkan. Sila Sign In.'); }
      else { location.href='/'; }
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><a className="auth-brand" href="/"><span>B</span> IBalz AI</a><p className="auth-kicker">IBALZ ACCOUNT</p><h1>{stage==='otp'?'Sahkan e-mel':mode==='signup'?'Cipta akaun':'Selamat kembali'}</h1><p className="auth-muted">{stage==='otp'?'Masukkan kod 6 digit yang dihantar ke '+email:mode==='signup'?'Daftar akaun IBalz AI anda.':'Log masuk ke akaun IBalz AI anda.'}</p>
    {stage==='form'?<form onSubmit={submit}>
      {mode==='signup'&&<label>Username<input value={username} onChange={e=>setUsername(e.target.value)} minLength={9} maxLength={32} placeholder="Lebih 8 aksara" required/></label>}
      <label>Gmail / E-mel<input type="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailVerified(false);}} placeholder="nama@gmail.com" autoComplete="email" required/></label>
      {mode==='signup'&&<button type="button" onClick={sendEmailCode} disabled={busy||!email||!username||password.length<8}>{busy?'Menghantar kod...':'Confirm Email · Hantar Kod'}</button>}
      <label>Kata laluan<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} placeholder="Sekurang-kurangnya 8 aksara" autoComplete={mode==='signup'?'new-password':'current-password'} required/></label>
      {mode==='signin'?<button disabled={busy}>{busy?'Sila tunggu...':'Sign In & Hantar OTP'}</button>:<button disabled={busy||!emailVerified}>{emailVerified?'Email Disahkan':'Sahkan email dahulu untuk daftar'}</button>}
    </form>:<form onSubmit={verify}><label>Kod OTP<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" required/></label><button disabled={busy||otp.length!==6}>{busy?'Mengesahkan...':mode==='signup'?'Sahkan Email & Daftar Akaun':'Sahkan OTP'}</button><button type="button" className="auth-secondary" onClick={()=>{setStage('form');setOtp('');setNotice('');}}>Kembali</button></form>}
    {notice&&<p className="auth-notice">{notice}</p>}
    {stage==='form'&&<p className="auth-switch">{mode==='signup'?'Dah ada akaun?':'Belum ada akaun?'} <button type="button" onClick={()=>{setMode(mode==='signup'?'signin':'signup');setNotice('');setStage('form');setEmailVerified(false);}}>{mode==='signup'?'Sign In':'Sign Up'}</button></p>}
    <a className="auth-back" href="/">← Kembali ke chat</a>
  </section></main>;
}
