import { useState } from 'react';

export default function Auth() {
  const [mode,setMode]=useState(location.pathname==='/signup'?'signup':'signin');
  const [stage,setStage]=useState('form');
  const [username,setUsername]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [otp,setOtp]=useState('');
  const [emailVerified,setEmailVerified]=useState(false);
  const [registered,setRegistered]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');

  async function request(path,body) {
    const r=await fetch('/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw=await r.text(); let d={};
    try { d=raw ? JSON.parse(raw) : {}; }
    catch { throw new Error(r.ok ? 'Respons pelayan tidak sah. Cuba lagi.' : 'Pelayan mengalami ralat. Cuba sebentar lagi.'); }
    if(!r.ok) throw new Error(d.error||d.message||'Permintaan gagal.');
    return d;
  }
  async function sendEmailCode() {
    setBusy(true); setNotice('');
    try { const d=await request('signup',{username,email,password}); setEmail(d.email||email); setOtp(''); setStage('otp'); setNotice(d.message||'Kod OTP dihantar ke Gmail. Masukkan 8 digit.'); }
    catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function completeSignup() {
    setBusy(true); setNotice('');
    try { const d=await request('verify',{action:'complete_signup',email,username,password}); setRegistered(true); setNotice(d.message||'Akaun berjaya didaftarkan. Sila Sign In.'); }
    catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      if(mode==='signup') {
        if(!emailVerified) throw new Error('Sahkan e-mel dahulu sebelum daftar akaun.');
        await completeSignup();
      } else { await request('login',{email,password}); location.href='/'; }
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function verify(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      if(mode==='signup') {
        const d=await request('verify',{action:'verify_email',email,token:otp});
        setEmailVerified(true); setStage('form'); setOtp(''); setNotice(d.message||'E-mel berjaya disahkan. Tekan Daftar untuk cipta akaun.');
      } else {
        await request('recovery',{action:'verify',email,token:otp});
        setStage('reset'); setOtp(''); setNotice('E-mel berjaya disahkan. Tetapkan kata laluan baharu.');
      }
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function sendRecoveryCode(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try { const d=await request('recovery',{action:'send',email}); setStage('recovery-otp'); setNotice(d.message||'Kod OTP dihantar ke Gmail anda.'); }
    catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function resetPassword(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      if(password.length<8) throw new Error('Kata laluan mesti sekurang-kurangnya 8 aksara.');
      if(password!==confirmPassword) throw new Error('Pengesahan kata laluan tidak sepadan.');
      await request('recovery',{action:'reset',email,password});
      setStage('form'); setPassword(''); setConfirmPassword(''); setOtp('');
      setNotice('Kata laluan berjaya ditukar. Sila Sign In menggunakan kata laluan baharu.');
    } catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }

  const isRecovery = stage==='recovery-email'||stage==='recovery-otp'||stage==='reset';
  const title = stage==='otp'||stage==='recovery-otp'?'Sahkan e-mel':stage==='reset'?'Reset Kata Laluan':isRecovery?'Terlupa Kata Laluan?':mode==='signup'?'Cipta akaun':'Selamat kembali';
  const subtitle = stage==='otp'||stage==='recovery-otp'?'Masukkan kod 8 digit yang dihantar ke '+email:stage==='reset'?'Masukkan kata laluan baharu untuk akaun anda.':stage==='recovery-email'?'Masukkan e-mel yang pernah didaftarkan.':mode==='signup'?'Daftar akaun IBalz AI anda.':'Log masuk ke akaun IBalz AI anda.';

  return <main className="auth-page"><section className="auth-card">
    <a className="auth-brand" href="/"><span>B</span> IBalz AI</a>
    <p className="auth-kicker">IBALZ ACCOUNT</p><h1>{title}</h1><p className="auth-muted">{subtitle}</p>
    {stage==='form'&&<form onSubmit={submit}>
      {mode==='signup'&&<label>Username<input value={username} onChange={e=>setUsername(e.target.value)} minLength={9} maxLength={32} placeholder="Lebih 8 aksara" required/></label>}
      <label>Gmail / E-mel<input type="email" value={email} onChange={e=>{setEmail(e.target.value.trimStart());setEmailVerified(false);setRegistered(false);}} placeholder="nama@gmail.com" autoComplete="email" required/></label>
      <label>Kata laluan<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} placeholder="Sekurang-kurangnya 8 aksara" autoComplete={mode==='signup'?'new-password':'current-password'} required/></label>
      {mode==='signup'&&email&&<div className="auth-email-status"><span className={registered?'is-done':emailVerified?'is-verified':'is-pending'}>{registered?'✓':emailVerified?'✓':'✕'}</span><small>{registered?'Akaun telah didaftarkan':emailVerified?'E-mel telah disahkan':'E-mel belum disahkan'}</small></div>}
      {mode==='signup'?<button type="button" className={registered?'auth-status-done':emailVerified?'auth-status-ready':'auth-status-pending'} onClick={emailVerified?completeSignup:sendEmailCode} disabled={busy||registered||!email||!username||password.length<8}>{busy?'Sila tunggu...':registered?'Akaun Didaftarkan':emailVerified?'Daftar':'Sahkan Email Anda'}</button>:<><button disabled={busy}>{busy?'Sila tunggu...':'Log Masuk'}</button><button type="button" className="auth-forgot" onClick={()=>{setStage('recovery-email');setNotice('');setPassword('');}}>Terlupa Kata Laluan?</button></>}
    </form>}
    {stage==='otp'&&<form onSubmit={verify}><label>Kod OTP (8 digit)<input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="12345678" required/></label><button disabled={busy||otp.length!==8}>{busy?'Mengesahkan...':'Sahkan E-mel'}</button><button type="button" className="auth-secondary" onClick={()=>{setStage('form');setOtp('');setNotice('');}}>Kembali</button></form>}
    {stage==='recovery-email'&&<form onSubmit={sendRecoveryCode}><label>Gmail / E-mel<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mel akaun berdaftar" required/></label><button disabled={busy||!email}>{busy?'Menghantar...':'Hantar Kod OTP'}</button><button type="button" className="auth-secondary" onClick={()=>{setStage('form');setNotice('');}}>Kembali ke Sign In</button></form>}
    {stage==='recovery-otp'&&<form onSubmit={verify}><label>Kod OTP (8 digit)<input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="12345678" required/></label><button disabled={busy||otp.length!==8}>{busy?'Mengesahkan...':'Sahkan OTP'}</button><button type="button" className="auth-secondary" onClick={()=>{setStage('recovery-email');setOtp('');setNotice('');}}>Kembali</button></form>}
    {stage==='reset'&&<form onSubmit={resetPassword}><label>Kata laluan baharu<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="new-password" placeholder="Sekurang-kurangnya 8 aksara" required/></label><label>Confirm Kata Laluan<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" placeholder="Masukkan semula kata laluan" required/></label><button disabled={busy}>{busy?'Menyimpan...':'Reset Kata Laluan'}</button></form>}
    {notice&&<p className="auth-notice">{notice}</p>}
    {stage==='form'&&<p className="auth-switch">{mode==='signup'?'Dah ada akaun?':'Belum ada akaun?'} <button type="button" onClick={()=>{setMode(mode==='signup'?'signin':'signup');setNotice('');setStage('form');setEmailVerified(false);setRegistered(false);setPassword('');}}>{mode==='signup'?'Log Masuk':'Daftar Akaun'}</button></p>}
    <a className="auth-back" href="/">← Kembali ke chat</a>
  </section></main>;
}
