import { useEffect, useRef, useState } from 'react';
import Admin from './Admin.jsx';

const starter = [{ role: 'assistant', content: 'Hai! Saya IBalz AI. Apa yang boleh saya bantu hari ini?' }];
const HISTORY_KEY = 'ibalz-chat-history';
const uid = () => globalThis.crypto?.randomUUID?.() || ('chat-' + Date.now() + '-' + Math.random().toString(36).slice(2));
function getVisitorId() {
  let id = localStorage.getItem('ibalz-visitor-id');
  if (!id) { id = uid(); localStorage.setItem('ibalz-visitor-id', id); }
  return id;
}
function readHistory() {
  try { const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function titleFor(messages) {
  const first = messages.find(m => m.role === 'user');
  return (first?.content || 'Perbualan baharu').replace(/^\[Gambar dilampirkan\]\s*/, '').slice(0, 48) || 'Perbualan bergambar';
}
function renderMessage(content) {
  const parts = String(content || '').split(/(\\*\\*[^*]+?\\*\\*|__[^_]+?__|\\*[^*\\n]+?\\*|_[^_\\n]+?_)/g);
  return parts.map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') || part.startsWith('_') && part.endsWith('_')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/admin') return <Admin />;
  const [dark, setDark] = useState(() => localStorage.getItem('ibalz-theme') === 'dark');
  const [chats, setChats] = useState(readHistory);
  const [activeId, setActiveId] = useState(() => localStorage.getItem('ibalz-active-chat') || '');
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ibalz-chat')) || starter; } catch { return starter; }
  });
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('ibalz-chat-session') || '');
  const [input, setInput] = useState('');
  const [image, setImage] = useState('');
  const [imageName, setImageName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('ibalz-chat', JSON.stringify(messages));
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  useEffect(() => {
    if (!activeId || messages.length <= 1) return;
    const current = { id: activeId, sessionId, title: titleFor(messages), messages, updatedAt: new Date().toISOString() };
    setChats(old => {
      const next = [current, ...old.filter(c => c.id !== activeId)].slice(0, 80);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    localStorage.setItem('ibalz-active-chat', activeId);
  }, [messages, sessionId, activeId]);

  function startNew() {
    setMessages(starter); setSessionId(''); setActiveId(''); setInput(''); setImage(''); setImageName(''); setError('');
    localStorage.removeItem('ibalz-chat-session'); localStorage.removeItem('ibalz-active-chat');
    localStorage.setItem('ibalz-chat', JSON.stringify(starter));
    setHistoryOpen(false);
  }
  function openChat(chat) {
    setActiveId(chat.id); setMessages(chat.messages || starter); setSessionId(chat.sessionId || '');
    if (chat.sessionId) localStorage.setItem('ibalz-chat-session', chat.sessionId); else localStorage.removeItem('ibalz-chat-session');
    localStorage.setItem('ibalz-chat', JSON.stringify(chat.messages || starter));
    localStorage.setItem('ibalz-active-chat', chat.id);
    setImage(''); setImageName(''); setError(''); setHistoryOpen(false); setMoreOpen(false); setNewMenuOpen(false);
  }
  function chooseImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Pilih fail gambar sahaja.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Saiz gambar maksimum 8MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setImage(canvas.toDataURL('image/jpeg', 0.78)); setImageName(file.name); setError('');
      };
      img.onerror = () => setError('Gambar tidak dapat dibaca.');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  async function send() {
    const text = input.trim();
    if ((!text && !image) || busy) return;
    const userMessage = { role: 'user', content: (text || (image ? 'Terangkan gambar ini.' : '')) + (image ? (text ? '\n[Gambar dilampirkan]' : '[Gambar dilampirkan]') : '') };
    const nextMessages = [...messages, userMessage];
    const currentId = activeId || uid();
    setActiveId(currentId); setMessages(nextMessages); setInput(''); setImage(''); setImageName(''); setError(''); setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, image: image || undefined, sessionId, visitorId: getVisitorId() })
      });
      const data = await res.json();
      if (data.sessionId) { setSessionId(data.sessionId); localStorage.setItem('ibalz-chat-session', data.sessionId); }
      if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
      setMessages(v => [...v, { role: 'assistant', content: data.reply }]);
    } catch (e) { setError(e.message || 'Tidak dapat menyambung.'); }
    finally { setBusy(false); }
  }
  const visibleChats = chats.filter(c => (c.title || '').toLowerCase().includes(search.toLowerCase()));
  return <div className={dark ? 'app dark' : 'app'}>
    <header className="top simple-top">
      <button className="hamburger-btn" onClick={() => { setHistoryOpen(true); setNewMenuOpen(false); }} title="Sejarah chat" aria-label="Sejarah chat"><span/><span/><span/></button>
      <div className="popup-anchor new-chat-anchor"><button className="top-action new-action" onClick={() => setNewMenuOpen(v => !v)} title="Chat baharu">＋ <span>Chat baharu</span></button>
        {newMenuOpen && <div className="top-popup new-popup"><button onClick={() => { startNew(); setNewMenuOpen(false); }}><span>＋</span><div><b>Chat baharu</b><small>Mulakan perbualan kosong</small></div></button></div>}
      </div>
    </header>
    <main className="shell">
      {messages.length <= 1 && <section className="welcome"><div className="eyebrow"><i/> IBALZ AI</div><h1>IBalz sedia<br/><em>membantu.</em></h1><p>Tanya apa sahaja yang anda perlukan.</p></section>}
      <section className="chat">
        {messages.map((m, i) => <article key={i} className={'msg ' + m.role}><div className="bubble">{renderMessage(m.content)}</div></article>)}
        {busy && <article className="msg assistant"><div className="bubble typing"><i/><i/><i/></div></article>}
        <div ref={end}/>
      </section>
      {error && <div className="error">{error}</div>}
      {image && <div className="image-preview"><img src={image} alt="Pratonton gambar"/><div><b>{imageName}</b><small>Gambar sedia dihantar</small></div><button onClick={() => { setImage(''); setImageName(''); }} aria-label="Buang gambar">×</button></div>}
      <section className="composer">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => chooseImage(e.target.files?.[0])}/>
        <button className="attach" onClick={() => fileRef.current?.click()} title="Tambah gambar" aria-label="Tambah gambar">＋</button>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Mesej IBalz..." rows="1"/>
        <button className="send" onClick={send} disabled={busy || (!input.trim() && !image)} aria-label="Hantar">↑</button>
      </section>
    </main>
    {historyOpen && <div className="history-backdrop" onClick={() => setHistoryOpen(false)}><aside className="history-drawer" onClick={e => e.stopPropagation()}>
      <div className="history-head"><div><small>IBALZ AI</small><h2>Sejarah chat</h2></div><button onClick={() => setHistoryOpen(false)}>×</button></div>
      <button className="history-new" onClick={startNew}>＋ Chat baharu</button>
      <input className="history-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari perbualan..."/>
      <div className="history-items">{visibleChats.length ? visibleChats.map(c => <button key={c.id} className={'history-item ' + (activeId === c.id ? 'selected' : '')} onClick={() => openChat(c)}><b>{c.title || 'Perbualan baharu'}</b><small>{new Date(c.updatedAt).toLocaleString('ms-MY')}</small></button>) : <p className="history-empty">Belum ada sejarah chat pada peranti ini.</p>}</div>
      <p className="history-foot">Sejarah ini disimpan dalam pelayar peranti anda.</p>
    </aside></div>}
  </div>;
}
export default App;
