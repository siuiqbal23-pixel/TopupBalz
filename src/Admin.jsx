import { useEffect, useState } from 'react';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [logged, setLogged] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
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

  async function loadDashboard() {
    const [a, b, u] = await Promise.all([
      fetch('/api/admin/chats').then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
    ]);
    if (a.error || b.error) throw new Error(a.error || b.error);
    setSessions(a.sessions || []);
    setUsers(u.users || []);
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
    setSelectedUser(user); setSelected(null); setMessages([]);
    try {
      const r = await fetch('/api/admin/chats?userId=' + encodeURIComponent(user.id));
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal membaca sejarah akaun.');
      setSessions(d.sessions || []);
      setNotice('Sejarah chat untuk ' + (user.email || user.username) + '.');
    } catch (e) { setNotice(e.message); }
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
    await fetch('/api/admin/logout', {method:'POST'});
    setLogged(false); setSelected(null); setMessages([]);
  }

  if (!logged) return <div className="admin-page"><div className="admin-login"><div className="admin-logo">B</div><p className="admin-kicker">IBALZ CONTROL CENTER</p><h1>Admin Login</h1><p className="admin-muted">Masukkan kata laluan pentadbir.</p><form onSubmit={login}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Kata laluan admin" autoComplete="current-password"/><button disabled={busy || !password}>{busy?'Memeriksa...':'Log masuk'}</button></form>{notice&&<p className="admin-notice">{notice}</p>}<a href="/">← Kembali ke IBalz AI</a></div></div>;

  return <div className="admin-page"><header className="admin-top"><a className="admin-brand" href="/"> <span>B</span> IBalz <small>ADMIN</small></a><button className="admin-logout" onClick={logout}>Log keluar</button></header>
    <main className="admin-wrap"><div className="admin-heading"><div><p className="admin-kicker">CONTROL CENTER</p><h1>Dashboard</h1><p className="admin-muted">Urus sejarah perbualan dan semua tetapan API IBalz AI.</p></div><div className="admin-stat"><strong>{sessions.length}</strong><span>Sejarah chat</span></div></div>
    {notice&&<div className="admin-notice">{notice}</div>}
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Penyedia AI & API Key</h2><p>Satu ruangan API Key untuk Groq, OpenAI atau Gemini. Cloudflare Workers AI menggunakan token Cloudflare yang disimpan di bawah.</p></div></div><form className="admin-api-card" onSubmit={saveKey}><div className="admin-panel-title"><div><h3>Pilih penyedia AI</h3><p>IBalz AI akan menggunakan penyedia yang dipilih untuk chat.</p></div><span className={configured[provider]?'admin-status on':'admin-status'}>{configured[provider]?'Key tersedia':'Belum ada key'}</span></div><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="cloudflare">Cloudflare Workers AI</option></select>{provider !== 'cloudflare' && <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={'Masukkan API Key '+provider.toUpperCase()} autoComplete="off"/>}<button disabled={busyKey || (provider !== 'cloudflare' && apiKey.trim().length < 12)}>{busyKey?'Menyimpan...':provider === 'cloudflare' ? 'Aktifkan Cloudflare Workers AI' : 'Simpan & Aktifkan AI'}</button></form><div className="admin-api-card"><div className="admin-panel-title"><div><h3>Cloudflare — Penjana Gambar</h3><p>Masukkan Cloudflare API Token sahaja. Account ID akan dicari secara automatik.</p></div><span className={configured.cloudflare?"admin-status on":"admin-status"}>{configured.cloudflare?"Ditetapkan":"Belum ditetapkan"}</span></div><form onSubmit={saveCloudflare}><input type="password" value={cloudflareToken} onChange={e=>setCloudflareToken(e.target.value)} placeholder="Cloudflare API Token" autoComplete="off"/><button disabled={busyKey || cloudflareToken.trim().length < 12}>{busyKey?"Mengesahkan & menyimpan...":"Simpan Cloudflare Token"}</button></form></div><div className="admin-api-card"><div className="admin-panel-title"><div><h3>Google Search — Carian Web</h3><p>Sambungkan Gemini Google Search Grounding supaya IBalz AI boleh mencari maklumat web terkini apabila diperlukan.</p></div><span className={googleSearchConfigured?"admin-status on":"admin-status"}>{googleSearchConfigured?"Disambungkan":"Belum disambungkan"}</span></div><form onSubmit={saveGoogleSearch}><input type="password" value={googleSearchApiKey} onChange={e=>setGoogleSearchApiKey(e.target.value)} placeholder="Gemini API Key untuk Google Search" autoComplete="off"/><button disabled={busyKey || googleSearchApiKey.trim().length < 12}>{busyKey?"Mengesahkan & menyimpan...":"Simpan Gemini Key & Sambungkan Google Search"}</button></form></div><p className="admin-footnote">API Key chat dan Cloudflare Token ialah dua servis berasingan. Account ID Cloudflare akan dikesan automatik menggunakan token yang mempunyai kebenaran membaca akaun.</p></section>
    <section className="admin-panel admin-users-panel"><div className="admin-panel-title"><div><h2>Akaun Pengguna</h2><p>{users.length} akaun berdaftar · e-mel dan username sahaja, kata laluan tidak boleh dilihat.</p></div><button className="admin-refresh" onClick={()=>loadDashboard().catch(e=>setNotice(e.message))}>Muat semula</button></div><div className="admin-user-list">{users.length===0?<p className="admin-empty">Belum ada akaun berdaftar.</p>:users.map(user=><article className="admin-user-row" key={user.id}><div><b>{user.username || 'Tanpa username'}</b><small>{user.email}</small><small>Daftar: {user.created_at?new Date(user.created_at).toLocaleString('ms-MY'):'-'}</small></div><div className="admin-user-actions"><button className="admin-refresh" onClick={()=>openUserHistory(user)}>Sejarah chat</button><button className="admin-delete-user" disabled={busy} onClick={()=>deleteUser(user)}>Padam</button></div></article>)}</div></section>
    <div className="admin-columns"><section className="admin-panel"><div className="admin-panel-title"><div><h2>{selectedUser?'Sejarah Chat — '+(selectedUser.username || selectedUser.email):'Sejarah Chat'}</h2><p>{selectedUser?'Perbualan yang dikaitkan dengan akaun ini.':'Semua perbualan yang dihantar ke IBalz.'}</p></div><button className="admin-refresh" onClick={()=>loadDashboard().catch(e=>setNotice(e.message))}>Muat semula</button></div><div className="admin-session-list">{sessions.length===0?<p className="admin-empty">Belum ada perbualan.</p>:sessions.map(s=><button key={s.id} className={'admin-session '+(selected?.id===s.id?'active':'')} onClick={()=>openChat(s)}><b>{s.title || 'Perbualan baharu'}</b><small>{new Date(s.updated_at).toLocaleString('ms-MY')} · {s.visitor_id.slice(0,12)}</small></button>)}</div></section>
    <section className="admin-panel admin-conversation"><div className="admin-panel-title"><div><h2>{selected?.title || 'Kandungan chat'}</h2><p>{selected?'ID sesi: '+selected.id:'Pilih perbualan di sebelah.'}</p></div></div><div className="admin-message-list">{!selected?<p className="admin-empty">Pilih satu chat untuk melihat mesej.</p>:messages.length===0?<p className="admin-empty">Tiada mesej.</p>:messages.map(m=><article key={m.id} className={'admin-message '+m.role}><b>{m.role==='user'?'Pengguna':'IBalz AI'}</b><p>{m.content}</p><small>{new Date(m.created_at).toLocaleString('ms-MY')}</small></article>)}</div></section></div>
    <p className="admin-footnote">Sejarah chat disimpan untuk fungsi kesinambungan dan semakan pentadbir. Kata laluan pengguna tidak pernah dipaparkan kepada admin.</p></main></div>;
}
