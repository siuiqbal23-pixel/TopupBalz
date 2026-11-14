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
  const [configured, setConfigured] = useState({});
  const [busyKey, setBusyKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  function goToSection(id) { setActiveSection(id); setMenuOpen(false); setNotice(''); }

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
    setLogged(true);
  }
  useEffect(() => { loadDashboard().catch(() => {}); }, []);

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

  return <div className="admin-page"><header className="admin-top"><div className="admin-top-left"><button className="admin-menu-button" aria-label="Buka menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>☰</button><a className="admin-brand" href="/"> <span>B</span> IBalz <small>ADMIN</small></a></div><button className="admin-logout" onClick={logout}>Log keluar</button></header>{menuOpen&&<><button className="admin-menu-backdrop" aria-label="Tutup menu" onClick={()=>setMenuOpen(false)}></button><nav className="admin-drawer"><div className="admin-drawer-head"><b>IBalz Control</b><button onClick={()=>setMenuOpen(false)}>×</button></div><button onClick={()=>goToSection('overview')}>⌂ <span>Dashboard</span></button><button onClick={()=>goToSection('users')}>♙ <span>Akaun Pengguna</span></button><button onClick={()=>goToSection('activity')}>◷ <span>Aktiviti & Login</span></button><button onClick={()=>goToSection('settings')}>⚙ <span>Tetapan AI</span></button></nav></>}
    <main className="admin-wrap">{notice&&<div className="admin-notice">{notice}</div>}{activeSection === 'overview' && <><div className="admin-heading"><div><p className="admin-kicker">CONTROL CENTER</p><h1>Dashboard</h1><p className="admin-muted">Ringkasan pengurusan IBalz AI.</p></div></div><div className="admin-overview-grid"><article className="admin-panel admin-overview-card"><span>Jumlah akaun</span><strong>{users.length}</strong><small>Akaun berdaftar</small></article><article className="admin-panel admin-overview-card"><span>Sejarah chat</span><strong>{sessions.length}</strong><small>Perbualan tersimpan</small></article><article className="admin-panel admin-overview-card"><span>Penyedia AI</span><strong>{provider.toUpperCase()}</strong><small>{configured[provider] ? 'API tersedia' : 'Belum dikonfigurasi'}</small></article></div><section className="admin-panel"><div className="admin-panel-title"><div><h2>Selamat datang ke IBalz Control Center</h2><p>Pilih bahagian melalui menu tiga garis di atas. Setiap bahagian akan dibuka di ruang ini.</p></div></div></section></>}{activeSection === 'settings' && (<>    <section className="admin-panel" id="settings"><div className="admin-panel-title"><div><h2>Penyedia AI & API Key</h2><p>Satu ruangan API Key untuk Groq, OpenAI atau Gemini. Cloudflare Workers AI menggunakan token Cloudflare yang disimpan di bawah.</p></div></div><form className="admin-api-card" onSubmit={saveKey}><div className="admin-panel-title"><div><h3>Pilih penyedia AI</h3><p>IBalz AI akan menggunakan penyedia yang dipilih untuk chat.</p></div><span className={configured[provider]?'admin-status on':'admin-status'}>{configured[provider]?'Key tersedia':'Belum ada key'}</span></div><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="cloudflare">Cloudflare Workers AI</option></select>{provider !== 'cloudflare' && <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={'Masukkan API Key '+provider.toUpperCase()} autoComplete="off"/>}<button disabled={busyKey || (provider !== 'cloudflare' && apiKey.trim().length < 12)}>{busyKey?'Menyimpan...':provider === 'cloudflare' ? 'Aktifkan Cloudflare Workers AI' : 'Simpan & Aktifkan AI'}</button></form><div className="admin-api-card"><div className="admin-panel-title"><div><h3>Cloudflare — Penjana Gambar</h3><p>Masukkan Cloudflare API Token sahaja. Account ID akan dicari secara automatik.</p></div><span className={configured.cloudflare?"admin-status on":"admin-status"}>{configured.cloudflare?"Ditetapkan":"Belum ditetapkan"}</span></div><form onSubmit={saveCloudflare}><input type="password" value={cloudflareToken} onChange={e=>setCloudflareToken(e.target.value)} placeholder="Cloudflare API Token" autoComplete="off"/><button disabled={busyKey || cloudflareToken.trim().length < 12}>{busyKey?"Mengesahkan & menyimpan...":"Simpan Cloudflare Token"}</button></form></div><div className="admin-api-card"><div className="admin-panel-title"><div><h3>Google Search — Carian Web</h3><p>Sambungkan Gemini Google Search Grounding supaya IBalz AI boleh mencari maklumat web terkini apabila diperlukan.</p></div><span className={googleSearchConfigured?"admin-status on":"admin-status"}>{googleSearchConfigured?"Disambungkan":"Belum disambungkan"}</span></div><form onSubmit={saveGoogleSearch}><input type="password" value={googleSearchApiKey} onChange={e=>setGoogleSearchApiKey(e.target.value)} placeholder="Gemini API Key untuk Google Search" autoComplete="off"/><button disabled={busyKey || googleSearchApiKey.trim().length < 12}>{busyKey?"Mengesahkan & menyimpan...":"Simpan Gemini Key & Sambungkan Google Search"}</button></form></div><p className="admin-footnote">API Key chat dan Cloudflare Token ialah dua servis berasingan. Account ID Cloudflare akan dikesan automatik menggunakan token yang mempunyai kebenaran membaca akaun.</p></section>
</>)}{activeSection === 'users' && (<>    <section className="admin-panel admin-users-panel" id="users"><div className="admin-panel-title"><div><h2>Akaun Pengguna</h2><p>{users.length} akaun berdaftar · e-mel dan username sahaja, kata laluan tidak boleh dilihat.</p></div><button className="admin-refresh" onClick={()=>loadDashboard().catch(e=>setNotice(e.message))}>Muat semula</button></div><div className="admin-user-list">{users.length===0?<p className="admin-empty">Belum ada akaun berdaftar.</p>:users.map(user=><article className="admin-user-row" key={user.id}><div><b>{user.username || 'Tanpa username'}</b><small>{user.email}</small><small>Daftar: {user.created_at?new Date(user.created_at).toLocaleString('ms-MY'):'-'}</small><small>Login terakhir: {user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString('ms-MY'):'Belum pernah login'}</small><small>Status: {user.banned_until && new Date(user.banned_until)>new Date()?'Digantung':'Aktif'} · E-mel: {user.email_confirmed_at?'Disahkan':'Belum disahkan'}</small></div><div className="admin-user-actions"><button className="admin-refresh" onClick={()=>openUserHistory(user)}>Lihat akaun & chat</button><button className="admin-delete-user" disabled={busy} onClick={()=>deleteUser(user)}>Padam</button></div></article>)}</div></section>
</>)}{activeSection === 'activity' && (<>    <section className="admin-panel" id="activity"><div className="admin-panel-title"><div><h2>Aktiviti & Login Pengguna</h2><p>Senarai aktiviti login berdasarkan rekod login terakhir yang disediakan oleh sistem akaun.</p></div></div><div className="admin-activity-list">{users.length===0?<p className="admin-empty">Belum ada aktiviti pengguna.</p>:[...users].sort((a,b)=>new Date(b.last_sign_in_at||0)-new Date(a.last_sign_in_at||0)).map(user=><button className="admin-activity-row" key={user.id} onClick={()=>openUserHistory(user)}><span className="admin-activity-avatar">{(user.username||user.email||'U').slice(0,1).toUpperCase()}</span><span className="admin-activity-info"><b>{user.username||user.email}</b><small>{user.email}</small><small>Login terakhir: {user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString('ms-MY'):'Belum pernah login'}</small></span><span className="admin-activity-status">{user.banned_until && new Date(user.banned_until)>new Date()?'Digantung':'Aktif'}</span></button>)}</div></section>
</>)}
      {selectedUser && <div className="admin-user-history-screen">
        <header className="admin-history-top"><button className="admin-history-back" onClick={()=>{if(historyChatOpen){setHistoryChatOpen(false);setSelected(null);setMessages([]);}else{setSelectedUser(null);setUserSessions([]);setSelected(null);setMessages([]);}}}>← Kembali</button><div><b>{historyChatOpen ? (selected?.title || 'Perbualan') : (selectedUser.username || 'Akaun Pengguna')}</b><small>{selectedUser.email}</small></div><button className="admin-refresh" onClick={()=>openUserHistory(selectedUser)}>Muat semula</button></header>
        {!historyChatOpen ? <div className="admin-user-history-content"><div className="admin-history-user-card"><span className="admin-activity-avatar">{(selectedUser.username||selectedUser.email||'U').slice(0,1).toUpperCase()}</span><div><b>{selectedUser.username || 'Tanpa username'}</b><small>{selectedUser.email}</small><small>Daftar: {selectedUser.created_at?new Date(selectedUser.created_at).toLocaleString('ms-MY'):'-'}</small></div></div><div className="admin-history-section-title"><h2>Semua Sejarah Chat</h2><span>{userSessions.length} perbualan</span></div>{userHistoryLoading ? <p className="admin-empty">Memuatkan sejarah chat...</p> : userSessions.length===0 ? <p className="admin-empty">Akaun ini belum mempunyai sejarah chat.</p> : <div className="admin-user-session-grid">{userSessions.map(s=><button key={s.id} className="admin-user-session-card" onClick={()=>openChat(s)}><b>{s.title || 'Perbualan baharu'}</b><small>{new Date(s.updated_at).toLocaleString('ms-MY')}</small><span>Buka perbualan →</span></button>)}</div>}</div> : <div className="admin-full-chat"><div className="admin-full-chat-heading"><div><h2>{selected?.title || 'Perbualan baharu'}</h2><p>{selected ? new Date(selected.created_at || selected.updated_at).toLocaleString('ms-MY') : ''}</p></div><span>{messages.length} mesej</span></div><div className="admin-full-chat-messages">{messages.length===0 ? <p className="admin-empty">Tiada mesej dalam perbualan ini.</p> : messages.map(m=><article key={m.id} className={'admin-message '+(m.role==='user'?'user':'assistant')}><b>{m.role==='user'?'Pengguna':'IBalz AI'}</b><p>{m.content}</p><small>{m.created_at?new Date(m.created_at).toLocaleString('ms-MY'):''}</small></article>)}</div></div>}
      </div>}
</main></div>;
}
