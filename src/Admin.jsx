import { useEffect, useState } from 'react';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [logged, setLogged] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSessions, setUserSessions] = useState([]);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);
  const [historyChatOpen, setHistoryChatOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [provider, setProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [cloudflareToken, setCloudflareToken] = useState('');
  const [googleSearchApiKey, setGoogleSearchApiKey] = useState('');
  const [googleSearchConfigured, setGoogleSearchConfigured] = useState(false);
  const [adminInstructions, setAdminInstructions] = useState([]);
  const [instructionDraft, setInstructionDraft] = useState('');
  const [editingInstruction, setEditingInstruction] = useState(null);
  const [editingInstructionDraft, setEditingInstructionDraft] = useState('');
  const [savingInstruction, setSavingInstruction] = useState(false);
  const [configured, setConfigured] = useState({});
  const [busyKey, setBusyKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  function goToSection(id) { setActiveSection(id); setMenuOpen(false); setNotice(''); }
  function isUserOnline(user) { return Boolean(user?.last_seen_at && Date.now() - new Date(user.last_seen_at).getTime() < 90000); }

  async function loadDashboard() {
    const [a, b, u] = await Promise.all([
      fetch('/api/admin/chats').then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()).catch(e => ({ error: e.message })),
    ]);
    if (a.error || b.error) throw new Error(a.error || b.error);
    setSessions(a.sessions || []);
    setUsers(u.users || []);
    if (u.error) setNotice('Paparan akaun belum dapat dimuatkan: ' + u.error);
    setConfigured({ ...(b.providers || { groq: Boolean(b.configured) }), cloudflare: Boolean(b.cloudflareConfigured) });
    setProvider(b.activeProvider || 'groq');
    setGoogleSearchConfigured(Boolean(b.googleSearchConfigured));
    setAdminInstructions(Array.isArray(b.adminInstructions) ? b.adminInstructions : []);
    setLogged(true);
  }
  useEffect(() => { loadDashboard().catch(() => {}); }, []);
  useEffect(() => {
    if (!logged) return;
    const refreshPresence = async () => {
      try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        if (response.ok) setUsers(data.users || []);
      } catch {}
    };
    const timer = setInterval(refreshPresence, 15000);
    return () => clearInterval(timer);
  }, [logged]);

  async function login(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      const r = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Log masuk gagal.');
      setPassword(''); await loadDashboard();
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  }
  async function openUserHistory(user) {
    setSelectedUser(user); setSelected(null); setMessages([]); setUserSessions([]);
    setHistoryChatOpen(false); setUserHistoryLoading(true); setNotice('');
    try {
      const r = await fetch('/api/admin/chats?userId=' + encodeURIComponent(user.id));
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal membaca sejarah akaun.');
      setUserSessions(d.sessions || []);
    } catch (e) { setNotice(e.message); }
    finally { setUserHistoryLoading(false); }
  }
  async function deleteUser(user) {
    if (!window.confirm('Padam akaun ' + (user.email || user.username) + ' bersama semua sejarah chatnya? Tindakan ini tidak boleh dibatalkan.')) return;
    setBusy(true); setNotice('');
    try {
      const r = await fetch('/api/admin/users', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:user.id}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal memadam akaun.');
      setUsers(old => old.filter(x => x.id !== user.id));
      if (selectedUser?.id === user.id) { setSelectedUser(null); setSessions([]); setSelected(null); setMessages([]); }
      setNotice('Akaun berjaya dipadam.');
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  }
  async function openChat(s) {
    setSelected(s); setMessages([]);
    try {
      const r = await fetch('/api/admin/chats?id=' + encodeURIComponent(s.id));
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setMessages(d.messages || []);
      if (selectedUser) setHistoryChatOpen(true);
    } catch (e) { setNotice(e.message); }
  }
  async function saveAdminInstruction(e) {
    e.preventDefault();
    const content = instructionDraft.trim();
    if (!content || savingInstruction) return;
    setSavingInstruction(true); setNotice('');
    try {
      const next = [...adminInstructions, { role: 'admin', content, created_at: new Date().toISOString() }].slice(-30);
      const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({integration:'admin_instructions', messages:next}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal menyimpan arahan AI.');
      setAdminInstructions(next); setInstructionDraft('');
      setNotice('Arahan berjaya disimpan. IBalz AI akan mengikut arahan ini dalam chat pelanggan dan penjanaan gambar.');
    } catch (e) { setNotice(e.message); }
    finally { setSavingInstruction(false); }
  }
  function startEditAdminInstruction(index) {
    setEditingInstruction(index);
    setEditingInstructionDraft(adminInstructions[index]?.content || '');
    setNotice('');
  }
  function cancelEditAdminInstruction() {
    setEditingInstruction(null);
    setEditingInstructionDraft('');
  }
  async function saveEditedAdminInstruction(index) {
    const content = editingInstructionDraft.trim();
    if (!content || savingInstruction) return;
    setSavingInstruction(true); setNotice('');
    try {
      const next = adminInstructions.map((item, i) => i === index ? { ...item, content, updated_at: new Date().toISOString() } : item);
      const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({integration:'admin_instructions', messages:next}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal mengemas kini arahan.');
      setAdminInstructions(next);
      cancelEditAdminInstruction();
      setNotice('Arahan berjaya dikemas kini dan disimpan.');
    } catch (e) { setNotice(e.message); }
    finally { setSavingInstruction(false); }
  }
  async function deleteAdminInstruction(index) {
    if (savingInstruction) return;
    if (!window.confirm('Padam arahan ini sahaja? Arahan lain akan kekal.')) return;
    setSavingInstruction(true); setNotice('');
    try {
      const next = adminInstructions.filter((_, i) => i !== index);
      const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({integration:'admin_instructions', messages:next}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal memadam arahan.');
      setAdminInstructions(next); setNotice('Arahan yang dipilih berjaya dipadam. Arahan lain dikekalkan.');
    } catch (e) { setNotice(e.message); }
    finally { setSavingInstruction(false); }
  }
  async function saveKey(e) {
    e.preventDefault();
    setBusyKey(true); setNotice('');
    try {
      const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({provider, apiKey}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal menyimpan API key.');
      setApiKey('');
      setConfigured(v => ({ ...v, [provider]: true }));
      setNotice(provider === 'cloudflare' ? 'Cloudflare Workers AI berjaya diaktifkan untuk chat.' : 'Penyedia AI dan API Key berjaya disimpan. IBalz AI kini menggunakan ' + provider.toUpperCase() + '.');
    } catch (e) { setNotice(e.message); }
    finally { setBusyKey(false); }
  }
  async function saveCloudflare(e) {
    e.preventDefault(); setBusyKey(true); setNotice('');
    try {
      const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({integration:'cloudflare', token:cloudflareToken}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal menyimpan Cloudflare Token.');
      setCloudflareToken(''); setConfigured(v => ({ ...v, cloudflare: true }));
      setProvider('cloudflare');
      setNotice('Cloudflare Workers AI berjaya disimpan dan diaktifkan untuk chatbot serta penjanaan gambar.');
    } catch (e) { setNotice(e.message); }
    finally { setBusyKey(false); }
  }
  async function saveGoogleSearch(e) {
    e.preventDefault(); setBusyKey(true); setNotice('');
    try {
      const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({integration:'google_search', apiKey:googleSearchApiKey}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal menyimpan Google Search.');
      setGoogleSearchApiKey(''); setGoogleSearchConfigured(true);
      setNotice('Google Search berjaya disambungkan. IBalz AI akan menggunakan Google Search apabila carian web diperlukan.');
    } catch (e) { setNotice(e.message); }
    finally { setBusyKey(false); }
  }
  async function logout() {
    await fetch('/api/admin/login', {method:'DELETE'});
    setLogged(false); setSelected(null); setMessages([]);
  }

  if (!logged) return <div className="admin-page"><div className="admin-login"><div className="admin-logo">B</div><p className="admin-kicker">IBALZ CONTROL CENTER</p><h1>Admin Login</h1><p className="admin-muted">Masukkan kata laluan pentadbir.</p><form onSubmit={login}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Kata laluan admin" autoComplete="current-password"/><button disabled={busy || !password}>{busy?'Memeriksa...':'Log masuk'}</button></form>{notice&&<p className="admin-notice">{notice}</p>}<a href="/">← Kembali ke IBalz AI</a></div></div>;

  return <div className="admin-page"><header className="admin-top"><div className="admin-top-left"><button className="admin-menu-button" aria-label="Buka menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>☰</button><a className="admin-brand" href="/"> <span>B</span> IBalz <small>ADMIN</small></a></div><button className="admin-logout" onClick={logout}>Log keluar</button></header>{menuOpen&&<><button className="admin-menu-backdrop" aria-label="Tutup menu" onClick={()=>setMenuOpen(false)}></button><nav className="admin-drawer"><div className="admin-drawer-head"><b>IBalz Control</b><button onClick={()=>setMenuOpen(false)}>×</button></div><button onClick={()=>goToSection('overview')}>⌂ <span>Dashboard</span></button><button onClick={()=>goToSection('users')}>♙ <span>Akaun Pengguna</span></button><button onClick={()=>goToSection('activity')}>◷ <span>Aktiviti & Login</span></button><button onClick={()=>goToSection('ai-chat')}>✎ <span>Chat Arahan AI</span></button><button onClick={()=>goToSection('settings')}>⚙ <span>Tetapan AI</span></button></nav></>}
    <main className="admin-wrap">{notice&&<div className="admin-notice">{notice}</div>}{activeSection === 'overview' && <><div className="admin-heading"><div><p className="admin-kicker">CONTROL CENTER</p><h1>Dashboard</h1><p className="admin-muted">Ringkasan pengurusan IBalz AI.</p></div></div><div className="admin-overview-grid"><article className="admin-panel admin-overview-card"><span>Jumlah akaun</span><strong>{users.length}</strong><small>Akaun berdaftar</small></article><article className="admin-panel admin-overview-card"><span>Sejarah chat</span><strong>{sessions.length}</strong><small>Perbualan tersimpan</small></article><article className="admin-panel admin-overview-card"><span>Penyedia AI</span><strong>{provider.toUpperCase()}</strong><small>{configured[provider] ? 'API tersedia' : 'Belum dikonfigurasi'}</small></article></div><section className="admin-panel"><div className="admin-panel-title"><div><h2>Selamat datang ke IBalz Control Center</h2><p>Pilih bahagian melalui menu tiga garis di atas. Setiap bahagian akan dibuka di ruang ini.</p></div></div></section></>}{activeSection === 'ai-chat' && <section className="admin-panel" id="ai-chat">
  <div className="admin-panel-title"><div><h2>Chat Arahan AI</h2><p>Tulis arahan seperti berbual. Setiap arahan disimpan dan digunakan oleh IBalz AI untuk semua pelanggan, termasuk penjanaan gambar.</p></div><span className="admin-status on">{adminInstructions.length} arahan</span></div>
  <div style={{background:'#ffffff',color:'#171717',border:'1px solid #e5e7eb',borderRadius:16,padding:16,minHeight:300,maxHeight:480,overflowY:'auto',display:'flex',flexDirection:'column',gap:14}}>
    {adminInstructions.length===0 ? <div style={{margin:'auto',maxWidth:420,textAlign:'center',padding:24,color:'#6b7280'}}><div style={{fontSize:30,marginBottom:10}}>✦</div><b style={{display:'block',color:'#171717',marginBottom:8}}>Chat Arahan AI</b><span>Hantar mesej di bawah untuk menetapkan cara IBalz AI menjawab pelanggan dan menjana gambar.</span><p style={{fontSize:13,lineHeight:1.6}}>Contoh: “Apabila pelanggan minta gambar orang bermain Rubik’s Cube, hasilkan orang yang sedang bermain kiub Rubik. Jangan tukar subjek.”</p></div> : adminInstructions.map((item,index)=><article key={item.created_at || index} style={{alignSelf:'flex-end',width:'fit-content',maxWidth:'92%',background:'#f3f4f6',color:'#171717',border:'1px solid #e5e7eb',borderRadius:'16px 16px 4px 16px',padding:'12px 14px'}}>
      <b style={{fontSize:12,color:'#6b7280'}}>ARAHAN ADMIN</b>
      {editingInstruction === index ? <><textarea value={editingInstructionDraft} onChange={e=>setEditingInstructionDraft(e.target.value)} rows={4} maxLength={4000} style={{display:'block',width:'100%',minWidth:240,boxSizing:'border-box',marginTop:8,padding:10,border:'1px solid #d1d5db',borderRadius:9,background:'#fff',color:'#111827',font:'inherit'}}/><div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:9}}><button type="button" disabled={savingInstruction} onClick={cancelEditAdminInstruction} style={{background:'#fff',color:'#374151',border:'1px solid #d1d5db',borderRadius:8,padding:'6px 10px',fontSize:12,cursor:'pointer'}}>Batal</button><button type="button" disabled={savingInstruction || !editingInstructionDraft.trim()} onClick={()=>saveEditedAdminInstruction(index)} style={{background:'#f97316',color:'#fff',border:0,borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:600,cursor:'pointer'}}>{savingInstruction?'Menyimpan...':'Simpan edit'}</button></div></> : <p style={{whiteSpace:'pre-wrap',margin:'6px 0',lineHeight:1.55}}>{item.content}</p>}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8}}><small style={{color:'#6b7280',fontSize:11}}>{item.created_at ? new Date(item.created_at).toLocaleString('ms-MY') : ''}</small><div style={{display:'flex',gap:7}}>{editingInstruction !== index && <button type="button" disabled={savingInstruction} onClick={()=>startEditAdminInstruction(index)} style={{background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa',borderRadius:8,padding:'5px 9px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Edit</button>}<button type="button" disabled={savingInstruction} onClick={()=>deleteAdminInstruction(index)} style={{background:'#fff1f2',color:'#be123c',border:'1px solid #fecdd3',borderRadius:8,padding:'5px 9px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Padam</button></div></div>
    </article>)}
  </div>
  <form onSubmit={saveAdminInstruction} style={{display:'flex',flexDirection:'column',gap:10,marginTop:14,background:'#ffffff',padding:14,border:'1px solid #e5e7eb',borderRadius:16}}>
    <label style={{fontSize:13,fontWeight:600,color:'#374151'}}>Tulis arahan untuk semua pelanggan</label>
    <textarea value={instructionDraft} onChange={e=>setInstructionDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} rows={3} maxLength={4000} placeholder="Taip mesej arahan di sini..." style={{width:'100%',boxSizing:'border-box',resize:'vertical',padding:14,borderRadius:12,border:'1px solid #d1d5db',background:'#ffffff',color:'#111827',font:'inherit',outlineColor:'#f97316'}}/>
    <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><small style={{color:'#6b7280'}}>Enter untuk hantar · Shift + Enter untuk baris baharu</small><div style={{display:'flex',gap:8}}><button type="submit" disabled={savingInstruction || !instructionDraft.trim()} style={{background:'#f97316',color:'#ffffff',border:0,borderRadius:10,padding:'10px 18px',fontWeight:700,cursor:'pointer'}}>{savingInstruction?'Menghantar...':'Hantar arahan ↑'}</button></div></div>
  </form>
  <p className="admin-footnote">Setiap mesej yang dihantar disimpan sebagai arahan tetap. Semua pelanggan menggunakan panduan ini dalam chat dan penjanaan gambar. Arahan keselamatan sistem tetap diutamakan.</p>
</section>}
{activeSection === 'settings' && (<>    <section className="admin-panel" id="settings"><div className="admin-panel-title"><div><h2>Penyedia AI & API Key</h2><p>Satu ruangan API Key untuk Groq, OpenAI atau Gemini. Cloudflare Workers AI menggunakan token Cloudflare yang disimpan di bawah.</p></div></div><form className="admin-api-card" onSubmit={saveKey}><div className="admin-panel-title"><div><h3>Pilih penyedia AI</h3><p>IBalz AI akan menggunakan penyedia yang dipilih untuk chat.</p></div><span className={configured[provider]?'admin-status on':'admin-status'}>{configured[provider]?'Key tersedia':'Belum ada key'}</span></div><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="cloudflare">Cloudflare Workers AI</option></select>{provider !== 'cloudflare' && <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={'Masukkan API Key '+provider.toUpperCase()} autoComplete="off"/>}<button disabled={busyKey || (provider !== 'cloudflare' && apiKey.trim().length < 12)}>{busyKey?'Menyimpan...':provider === 'cloudflare' ? 'Aktifkan Cloudflare Workers AI' : 'Simpan & Aktifkan AI'}</button></form><div className="admin-api-card"><div className="admin-panel-title"><div><h3>Cloudflare — Penjana Gambar</h3><p>Masukkan Cloudflare API Token sahaja. Account ID akan dicari secara automatik.</p></div><span className={configured.cloudflare?"admin-status on":"admin-status"}>{configured.cloudflare?"Ditetapkan":"Belum ditetapkan"}</span></div><form onSubmit={saveCloudflare}><input type="password" value={cloudflareToken} onChange={e=>setCloudflareToken(e.target.value)} placeholder="Cloudflare API Token" autoComplete="off"/><button disabled={busyKey || cloudflareToken.trim().length < 12}>{busyKey?"Mengesahkan & menyimpan...":"Simpan Cloudflare Token"}</button></form></div><div className="admin-api-card"><div className="admin-panel-title"><div><h3>Google Search — Carian Web</h3><p>Sambungkan Gemini Google Search Grounding supaya IBalz AI boleh mencari maklumat web terkini apabila diperlukan.</p></div><span className={googleSearchConfigured?"admin-status on":"admin-status"}>{googleSearchConfigured?"Disambungkan":"Belum disambungkan"}</span></div><form onSubmit={saveGoogleSearch}><input type="password" value={googleSearchApiKey} onChange={e=>setGoogleSearchApiKey(e.target.value)} placeholder="Gemini API Key untuk Google Search" autoComplete="off"/><button disabled={busyKey || googleSearchApiKey.trim().length < 12}>{busyKey?"Mengesahkan & menyimpan...":"Simpan Gemini Key & Sambungkan Google Search"}</button></form></div><p className="admin-footnote">API Key chat dan Cloudflare Token ialah dua servis berasingan. Account ID Cloudflare akan dikesan automatik menggunakan token yang mempunyai kebenaran membaca akaun.</p></section>
</>)}{activeSection === 'users' && (<>    <section className="admin-panel admin-users-panel" id="users"><div className="admin-panel-title"><div><h2>Akaun Pengguna</h2><p>{users.length} akaun berdaftar · e-mel dan username sahaja, kata laluan tidak boleh dilihat.</p></div><button className="admin-refresh" onClick={()=>loadDashboard().catch(e=>setNotice(e.message))}>Muat semula</button></div><div className="admin-user-list">{users.length===0?<p className="admin-empty">Belum ada akaun berdaftar.</p>:users.map(user=><article className="admin-user-row" key={user.id}><div><b className="admin-user-name"><span className={'admin-presence-dot ' + (isUserOnline(user) ? 'online' : 'offline')} title={isUserOnline(user) ? 'Online' : 'Offline'} />{user.username || 'Tanpa username'}</b><small>{user.email}</small><small>Daftar: {user.created_at?new Date(user.created_at).toLocaleString('ms-MY'):'-'}</small><small>Login terakhir: {user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString('ms-MY'):'Belum pernah login'}</small><small>Status: {user.banned_until && new Date(user.banned_until)>new Date()?'Digantung':'Aktif'} · E-mel: {user.email_confirmed_at?'Disahkan':'Belum disahkan'}</small></div><div className="admin-user-actions"><button className="admin-refresh" onClick={()=>openUserHistory(user)}>Lihat akaun & chat</button><button className="admin-delete-user" disabled={busy} onClick={()=>deleteUser(user)}>Padam</button></div></article>)}</div></section>
</>)}{activeSection === 'activity' && (<>    <section className="admin-panel" id="activity"><div className="admin-panel-title"><div><h2>Aktiviti & Login Pengguna</h2><p>Senarai aktiviti login berdasarkan rekod login terakhir yang disediakan oleh sistem akaun.</p></div></div><div className="admin-activity-list">{users.length===0?<p className="admin-empty">Belum ada aktiviti pengguna.</p>:[...users].sort((a,b)=>new Date(b.last_sign_in_at||0)-new Date(a.last_sign_in_at||0)).map(user=><button className="admin-activity-row" key={user.id} onClick={()=>openUserHistory(user)}><span className="admin-activity-avatar">{(user.username||user.email||'U').slice(0,1).toUpperCase()}</span><span className="admin-activity-info"><b className="admin-user-name"><span className={'admin-presence-dot ' + (isUserOnline(user) ? 'online' : 'offline')} title={isUserOnline(user) ? 'Online' : 'Offline'} />{user.username||user.email}</b><small>{user.email}</small><small>Login terakhir: {user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString('ms-MY'):'Belum pernah login'}</small></span><span className="admin-activity-status">{user.banned_until && new Date(user.banned_until)>new Date()?'Digantung':'Aktif'}</span></button>)}</div></section>
</>)}
      {selectedUser && <div className="admin-user-history-screen">
        <header className="admin-history-top"><button className="admin-history-back" onClick={()=>{if(historyChatOpen){setHistoryChatOpen(false);setSelected(null);setMessages([]);}else{setSelectedUser(null);setUserSessions([]);setSelected(null);setMessages([]);}}}>← Kembali</button><div><b>{historyChatOpen ? (selected?.title || 'Perbualan') : (selectedUser.username || 'Akaun Pengguna')}</b><small>{selectedUser.email}</small></div><button className="admin-refresh" onClick={()=>openUserHistory(selectedUser)}>Muat semula</button></header>
        {!historyChatOpen ? <div className="admin-user-history-content"><div className="admin-history-user-card"><span className="admin-activity-avatar">{(selectedUser.username||selectedUser.email||'U').slice(0,1).toUpperCase()}</span><div><b className="admin-user-name"><span className={'admin-presence-dot ' + (isUserOnline(selectedUser) ? 'online' : 'offline')} title={isUserOnline(selectedUser) ? 'Online' : 'Offline'} />{selectedUser.username || 'Tanpa username'}</b><small>{selectedUser.email}</small><small>Daftar: {selectedUser.created_at?new Date(selectedUser.created_at).toLocaleString('ms-MY'):'-'}</small></div></div><div className="admin-history-section-title"><h2>Semua Sejarah Chat</h2><span>{userSessions.length} perbualan</span></div>{userHistoryLoading ? <p className="admin-empty">Memuatkan sejarah chat...</p> : userSessions.length===0 ? <p className="admin-empty">Akaun ini belum mempunyai sejarah chat.</p> : <div className="admin-user-session-grid">{userSessions.map(s=><button key={s.id} className="admin-user-session-card" onClick={()=>openChat(s)}><b>{s.title || 'Perbualan baharu'}</b><small>{new Date(s.updated_at).toLocaleString('ms-MY')}</small><span>Buka perbualan →</span></button>)}</div>}</div> : <div className="admin-full-chat"><div className="admin-full-chat-heading"><div><h2>{selected?.title || 'Perbualan baharu'}</h2><p>{selected ? new Date(selected.created_at || selected.updated_at).toLocaleString('ms-MY') : ''}</p></div><span>{messages.length} mesej</span></div><div className="admin-full-chat-messages">{messages.length===0 ? <p className="admin-empty">Tiada mesej dalam perbualan ini.</p> : messages.map(m=><article key={m.id} className={'admin-message '+(m.role==='user'?'user':'assistant')}><b>{m.role==='user'?'Pengguna':'IBalz AI'}</b><p>{m.content}</p><small>{m.created_at?new Date(m.created_at).toLocaleString('ms-MY'):''}</small></article>)}</div></div>}
      </div>}
</main></div>;
}
