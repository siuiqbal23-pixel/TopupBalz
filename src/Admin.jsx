import { useEffect, useState } from 'react';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [logged, setLogged] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function loadDashboard() {
    const [a, b] = await Promise.all([
      fetch('/api/admin/chats').then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
    ]);
    if (a.error || b.error) throw new Error(a.error || b.error);
    setSessions(a.sessions || []);
    setConfigured(Boolean(b.configured));
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
  async function openChat(s) {
    setSelected(s); setMessages([]);
    try {
      const r = await fetch('/api/admin/chats?id=' + encodeURIComponent(s.id));
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setMessages(d.messages || []);
    } catch (e) { setNotice(e.message); }
  }
  async function saveKey(e) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({apiKey}) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal menyimpan API key.');
      setApiKey(''); setConfigured(true); setNotice('API key berjaya disimpan dengan selamat.');
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    await fetch('/api/admin/logout', {method:'POST'});
    setLogged(false); setSelected(null); setMessages([]);
  }

  if (!logged) return <div className="admin-page"><div className="admin-login"><div className="admin-logo">B</div><p className="admin-kicker">IBALZ CONTROL CENTER</p><h1>Admin Login</h1><p className="admin-muted">Masukkan kata laluan pentadbir.</p><form onSubmit={login}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Kata laluan admin" autoComplete="current-password"/><button disabled={busy || !password}>{busy?'Memeriksa...':'Log masuk'}</button></form>{notice&&<p className="admin-notice">{notice}</p>}<a href="/">← Kembali ke IBalz AI</a></div></div>;

  return <div className="admin-page"><header className="admin-top"><a className="admin-brand" href="/"> <span>B</span> IBalz <small>ADMIN</small></a><button className="admin-logout" onClick={logout}>Log keluar</button></header>
    <main className="admin-wrap"><div className="admin-heading"><div><p className="admin-kicker">CONTROL CENTER</p><h1>Dashboard</h1><p className="admin-muted">Urus sejarah perbualan dan tetapan AI.</p></div><div className="admin-stat"><strong>{sessions.length}</strong><span>Sejarah chat</span></div></div>
    {notice&&<div className="admin-notice">{notice}</div>}
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Groq API Key</h2><p>Key disimpan di server dan tidak dipaparkan semula.</p></div><span className={configured?'admin-status on':'admin-status'}>{configured?'Ditetapkan':'Belum ada'}</span></div><form className="admin-key-form" onSubmit={saveKey}><input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Tampal Groq API Key baharu" autoComplete="off"/><button disabled={busy || apiKey.trim().length<20}>{busy?'Menyimpan...':'Simpan API Key'}</button></form></section>
    <div className="admin-columns"><section className="admin-panel"><div className="admin-panel-title"><div><h2>Sejarah Chat</h2><p>Perbualan yang dihantar ke IBalz.</p></div><button className="admin-refresh" onClick={()=>loadDashboard().catch(e=>setNotice(e.message))}>Muat semula</button></div><div className="admin-session-list">{sessions.length===0?<p className="admin-empty">Belum ada perbualan.</p>:sessions.map(s=><button key={s.id} className={'admin-session '+(selected?.id===s.id?'active':'')} onClick={()=>openChat(s)}><b>{s.title || 'Perbualan baharu'}</b><small>{new Date(s.updated_at).toLocaleString('ms-MY')} · {s.visitor_id.slice(0,12)}</small></button>)}</div></section>
    <section className="admin-panel admin-conversation"><div className="admin-panel-title"><div><h2>{selected?.title || 'Kandungan chat'}</h2><p>{selected?'ID sesi: '+selected.id:'Pilih perbualan di sebelah.'}</p></div></div><div className="admin-message-list">{!selected?<p className="admin-empty">Pilih satu chat untuk melihat mesej.</p>:messages.length===0?<p className="admin-empty">Tiada mesej.</p>:messages.map(m=><article key={m.id} className={'admin-message '+m.role}><b>{m.role==='user'?'Pengguna':'IBalz AI'}</b><p>{m.content}</p><small>{new Date(m.created_at).toLocaleString('ms-MY')}</small></article>)}</div></section></div>
    <p className="admin-footnote">Sejarah chat disimpan untuk fungsi kesinambungan dan semakan pentadbir. Jangan minta pengguna berkongsi kata laluan atau maklumat sensitif.</p></main></div>;
}
