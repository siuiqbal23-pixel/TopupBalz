import { useEffect, useRef, useState } from 'react';
import Admin from './Admin.jsx';
import Auth from './Auth.jsx';

const starter = [];
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
  const raw = String(first?.content || '').replace(/\[Gambar dilampirkan\]/g, '').trim();
  if (!raw) return 'Pertanyaan tentang gambar';
  const q = raw.toLowerCase();
  const topics = [
    [/\b(resit|receipt|semakan|check resit)\b/, 'Semakan resit'],
    [/\b(refund|pulangkan|duit balik|bayaran balik)\b/, 'Permintaan refund'],
    [/\b(top ?up|topup|tambah nilai|reload)\b/, 'Pertanyaan topup'],
    [/\b(harga|berapa|price|kos|rm\s*\d)\b/, 'Pertanyaan harga'],
    [/\b(bayar|payment|pembayaran|transaksi|duit|tng|touch ?n ?go)\b/, 'Masalah pembayaran'],
    [/\b(login|log masuk|kata laluan|password|akaun|account)\b/, 'Masalah akaun'],
    [/\b(daftar|register|sign ?up|buat akaun)\b/, 'Pendaftaran akaun'],
    [/\b(promo|promosi|diskaun|voucher|kupon)\b/, 'Pertanyaan promosi'],
    [/\b(free fire|ff|mobile legends|mlbb|pubg|efootball|hok|honor of kings)\b/, 'Pertanyaan game'],
    [/\b(error|ralat|tak boleh|tidak boleh|gagal|problem|masalah|bug)\b/, 'Bantuan masalah teknikal'],
    [/\b(website|web|laman|link|pautan)\b/, 'Pertanyaan laman web']
  ];
  const match = topics.find(([pattern]) => pattern.test(q));
  if (match) return match[1];
  const cleaned = raw.replace(/^(hai|hi|hello|assalamualaikum)[,!. ]*/i, '').replace(/[?!.]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Pertanyaan pelanggan';
  const words = cleaned.split(' ').slice(0, 5).join(' ');
  return words.length > 38 ? words.slice(0, 35).trimEnd() + '…' : words;
}
function ActionIcon({ name }) {
  const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
    like: <><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Z"/><path d="M7 10 12 3a2 2 0 0 1 2 2l-1 5h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7"/></>,
    dislike: <><path d="M7 14V3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3Z"/><path d="m7 14 5 7a2 2 0 0 0 2-2l-1-5h6a2 2 0 0 0 2-2l-2-7a2 2 0 0 0-2-2H7"/></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></>,
    share: <><path d="M12 16V3"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    retry: <><path d="M20 7v5h-5"/><path d="M20 12a8 8 0 1 0 2 5"/></>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const CODE_LANGUAGES = ['text','html','css','javascript','typescript','jsx','tsx','json','python','java','c','cpp','csharp','php','sql','bash','shell','yaml','xml','markdown','go','rust','ruby','swift','kotlin'];
function renderInline(content, keyPrefix = 'inline') {
  const parts = String(content || '').split(/(\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\n]+?\*|_[^_\n]+?_)/g);
  return parts.map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) return <strong key={keyPrefix + index}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) return <em key={keyPrefix + index}>{part.slice(1, -1)}</em>;
    return part;
  });
}
function renderMessage(content, copyCode) {
  const source = String(content || '');
  const pattern = /\x60{3}([^\n]*)\n([\s\S]*?)\n\x60{3}/g;
  const output = [];
  let last = 0;
  let match;
  let index = 0;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) output.push(<span key={'text-' + index++}>{renderInline(source.slice(last, match.index), 'p' + index)}</span>);
    const language = String(match[1] || 'text').trim().toLowerCase().split(/\s+/)[0] || 'text';
    const code = match[2] || '';
    output.push(<div className="code-card" key={'code-' + index++}>
      <div className="code-card-head">
        <span className="code-language"><span className="code-dot"/>{CODE_LANGUAGES.includes(language) ? language : 'text'}</span>
        <button className="copy-code" onClick={() => copyCode(code)} type="button"><ActionIcon name="copy"/> <span>Copy Code</span></button>
      </div>
      <pre><code>{code}</code></pre>
    </div>);
    last = pattern.lastIndex;
  }
  if (last < source.length) output.push(<span key={'text-' + index}>{renderInline(source.slice(last), 'tail')}</span>);
  return output.length ? output : renderInline(source, 'plain');
}

function isImageRequest(text) {
  return /(?:jana|hasilkan|buat(?:kan)?|cipta|lukis|generate|create|draw)\b[\s\S]{0,100}\b(?:gambar|imej|image|picture|poster|ilustrasi|illustration|logo)\b/i.test(text)
    || /\b(?:gambar|imej|image|picture|poster|ilustrasi|illustration|logo)\b[\s\S]{0,100}\b(?:jana|hasilkan|buat|cipta|lukis|generate|create|draw)\b/i.test(text);
}

function needsGoogleSearch(text) {
  const normalized = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const casual = new Set(['wei','weii','weh','woi','oi','bro','hello','helo','hai','hi','hey','yo','assalamualaikum','salam','ok','okay','oke','baik','haha','hahaha','lol','test','testing','terima kasih','thanks','tq','bye','jumpa lagi']);
  if (normalized.length <= 35 && (casual.has(normalized) || /^(wei+|weh+|woi+|oi+|bro+|hai+|hello+|hi+|hey+)\s*$/i.test(normalized))) return false;
  return /\b(cari|search|google|sumber|rujukan|terkini|terbaru|sekarang|hari ini|minggu ini|tahun ini|202[5-9]|harga|berapa harga|jadual|keputusan|berita|update|status terkini|apa maksud|maksud|makna|erti|apa itu|siapa|kenapa|mengapa|bila|tarikh|di mana|kat mana|bagaimana|macam mana|berapa|adakah|betul ke|benarkah)\b/i.test(normalized) || String(text || '').length > 100;
}

function App() {
  const route = window.location.pathname.replace(/\/$/, '');
  if (route === '/admin') return <Admin />;
  if (route === '/login' || route === '/signup') return <Auth />;
  const [dark, setDark] = useState(() => localStorage.getItem('ibalz-theme') === 'dark');
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { let alive = true; fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => r.json()).then(d => { if (alive) setSignedIn(Boolean(d.authenticated)); }).catch(() => { if (alive) setSignedIn(false); }).finally(() => { if (alive) setAuthChecked(true); }); return () => { alive = false; }; }, []);
  const [chats, setChats] = useState(readHistory);
  const [activeId, setActiveId] = useState(() => sessionStorage.getItem('ibalz-active-chat') || '');
  const [messages, setMessages] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('ibalz-chat')); return Array.isArray(saved) && saved[0]?.content !== 'Hai! Saya IBalz AI. Apa yang boleh saya bantu hari ini?' ? saved : starter; } catch { return starter; }
  });
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('ibalz-chat-session') || '');
  const [input, setInput] = useState('');
  const [image, setImage] = useState('');
  const [imageName, setImageName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSources, setActiveSources] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [historyMenu, setHistoryMenu] = useState('');
  const historyPressTimerRef = useRef(0);
  const historyLongPressRef = useRef(false);
  useEffect(() => {
    if (!historyMenu) return;
    const closeHistoryMenu = event => {
      if (!event.target.closest('.history-context-menu')) setHistoryMenu('');
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setHistoryMenu('');
    };
    document.addEventListener('pointerdown', closeHistoryMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeHistoryMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [historyMenu]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({});
  const [messageMenu, setMessageMenu] = useState(-1);
  const [messageMenuPos, setMessageMenuPos] = useState({ top: 12, left: 12 });
  useEffect(() => {
    if (messageMenu === -1) return;
    const closeOnOutside = event => {
      if (!event.target.closest?.('.message-more-anchor')) setMessageMenu(-1);
    };
    const closeOnEscape = event => { if (event.key === 'Escape') setMessageMenu(-1); };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [messageMenu]);
  const [speaking, setSpeaking] = useState(-1);
  const fileRef = useRef(null);
  const chatRef = useRef(null);
  const nearBottomRef = useRef(true);
  const scrollFrameRef = useRef(0);
  const scrollIdleTimerRef = useRef(0);
  const [showJumpDown, setShowJumpDown] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('ibalz-chat', JSON.stringify(messages.map(({ imageData, ...message }) => message)));
  }, [messages]);
  useEffect(() => {
    if (messages[messages.length - 1]?.role !== 'user') return;
    nearBottomRef.current = true;
    setShowJumpDown(false);
    cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const el = chatRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(scrollFrameRef.current);
  }, [messages]);
  function handleChatScroll() {
    const el = chatRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 110;
    clearTimeout(scrollIdleTimerRef.current);
    if (nearBottomRef.current) {
      setShowJumpDown(false);
      return;
    }
    scrollIdleTimerRef.current = setTimeout(() => {
      if (!nearBottomRef.current) setShowJumpDown(true);
    }, 450);
  }
  function jumpToLatest() {
    const el = chatRef.current;
    if (!el) return;
    setShowJumpDown(false);
    nearBottomRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    const savedMessages = messages.map(({ imageData, ...message }) => message);
    const current = { id: activeId, sessionId, title: titleFor(messages), messages: savedMessages, updatedAt: new Date().toISOString() };
    setChats(old => {
      const next = [current, ...old.filter(c => c.id !== activeId)].slice(0, 80);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    sessionStorage.setItem('ibalz-active-chat', activeId);
  }, [messages, sessionId, activeId]);

  function updateHistoryChat(id, patch) {
    setChats(old => {
      const next = old.map(chat => chat.id === id ? { ...chat, ...patch } : chat);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    setHistoryMenu('');
  }
  function deleteHistoryChat(chat) {
    if (!window.confirm(`Padam chat “${chat.title || 'Perbualan'}”?`)) return;
    setChats(old => {
      const next = old.filter(item => item.id !== chat.id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    if (activeId === chat.id) startNew();
    setHistoryMenu('');
  }
  function renameHistoryChat(chat) {
    const nextTitle = window.prompt('Masukkan nama baharu untuk chat ini:', chat.title || '');
    if (nextTitle === null) return;
    const title = nextTitle.trim();
    if (!title) { setError('Nama chat tidak boleh kosong.'); return; }
    updateHistoryChat(chat.id, { title: title.slice(0, 60) });
  }
  function beginHistoryPress(id) {
    historyLongPressRef.current = false;
    clearTimeout(historyPressTimerRef.current);
    historyPressTimerRef.current = setTimeout(() => {
      historyLongPressRef.current = true;
      setHistoryMenu(id);
    }, 550);
  }
  function cancelHistoryPress() { clearTimeout(historyPressTimerRef.current); }
  function startNew() {
    setMessages(starter); setSessionId(''); setActiveId(''); setInput(''); setImage(''); setImageName(''); setError('');
    sessionStorage.removeItem('ibalz-chat-session'); sessionStorage.removeItem('ibalz-active-chat');
    sessionStorage.setItem('ibalz-chat', JSON.stringify(starter));
    setHistoryOpen(false);
  }
  function openChat(chat) {
    setActiveId(chat.id); setMessages(chat.messages || starter); setSessionId(chat.sessionId || '');
    if (chat.sessionId) localStorage.setItem('ibalz-chat-session', chat.sessionId); else sessionStorage.removeItem('ibalz-chat-session');
    sessionStorage.setItem('ibalz-chat', JSON.stringify(chat.messages || starter));
    sessionStorage.setItem('ibalz-active-chat', chat.id);
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
    if (!authChecked) { setError('Sedang menyemak status akaun. Cuba sebentar lagi.'); return; }
    if (!signedIn) { setError('Sila daftar atau Sign In dahulu untuk menggunakan IBalz AI.'); return; }
    const text = input.trim();
    if ((!text && !image) || busy) return;
    const userMessage = { role: 'user', content: (text || (image ? 'Terangkan gambar ini.' : '')) + (image ? (text ? '\n[Gambar dilampirkan]' : '[Gambar dilampirkan]') : '') };
    const nextMessages = [...messages, userMessage];
    const currentId = activeId || uid();
    setActiveId(currentId); setMessages(nextMessages); setInput(''); setImage(''); setImageName(''); setError(''); setBusyLabel(!image && isImageRequest(text) ? 'Sedang menjana gambar...' : (needsGoogleSearch(text) ? 'Sedang mencari di Google...' : '')); setBusy(true);
    try {
      if (!image && isImageRequest(text)) {
        const res = await fetch('/api/images', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Tidak dapat menjana gambar.');
        setMessages(v => [...v, { role: 'assistant', content: 'Imej berjaya dijana:', imageData: data.image }]);
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage.content, image: image || undefined, sessionId, visitorId: getVisitorId() })
        });
        const data = await res.json();
        if (data.sessionId) { setSessionId(data.sessionId); localStorage.setItem('ibalz-chat-session', data.sessionId); }
        if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
        setMessages(v => [...v, { role: 'assistant', content: data.reply, searchSources: data.searchSources || [], searchQueries: data.searchQueries || [] }]);
      }
    } catch (e) { setError(e.message || 'Tidak dapat menyambung.'); }
    finally { setBusy(false); }
  }
  async function retryAnswer() {
    if (!signedIn) { setError('Sila daftar atau Sign In dahulu untuk menggunakan IBalz AI.'); return; }
    if (busy) return;
    const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
    if (lastUserIndex < 0) return;
    const lastUser = messages[lastUserIndex];
    setMessages(messages.slice(0, lastUserIndex + 1));
    setBusy(true); setBusyLabel(needsGoogleSearch(lastUser.content) ? 'Sedang mencari di Google...' : ''); setError('');
    try {
      const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message:lastUser.content, sessionId, visitorId:getVisitorId() }) });
      const data = await res.json();
      if (data.sessionId) { setSessionId(data.sessionId); localStorage.setItem('ibalz-chat-session', data.sessionId); }
      if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
      setMessages(v => [...v, { role:'assistant', content:data.reply, searchSources:data.searchSources || [], searchQueries:data.searchQueries || [] }]);
    } catch (e) { setError(e.message || 'Tidak dapat mencuba semula.'); }
    finally { setBusy(false); setMessageMenu(-1); }
  }
  async function copyMessage(text) {
    try { await navigator.clipboard.writeText(text); setError(''); }
    catch { setError('Tidak dapat menyalin. Sila benarkan akses clipboard.'); }
  }
  function speakMessage(text, index) {
    if (!('speechSynthesis' in window)) { setError('Pelayar ini tidak menyokong suara.'); return; }
    if (speaking === index) { window.speechSynthesis.cancel(); setSpeaking(-1); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ms-MY';
    utterance.onend = () => setSpeaking(-1);
    utterance.onerror = () => setSpeaking(-1);
    setSpeaking(index); window.speechSynthesis.speak(utterance);
  }
  async function shareMessage(text) {
    try {
      if (navigator.share) await navigator.share({ title:'IBalz AI', text });
      else await copyMessage(text);
    } catch (e) { if (e.name !== 'AbortError') setError('Tidak dapat berkongsi mesej.'); }
  }
  const visibleChats = chats
    .filter(c => Boolean(c.archived) === showArchived && (c.title || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return <div className={dark ? 'app dark' : 'app'}>
    <header className="top simple-top">
      <button className="hamburger-btn" onClick={() => { setHistoryOpen(true); setNewMenuOpen(false); }} title="Sejarah chat" aria-label="Sejarah chat"><span/><span/><span/></button>
      <div className="popup-anchor new-chat-anchor"><button className="top-action new-action" onClick={() => setNewMenuOpen(v => !v)} title="Chat baharu">＋ <span>Chat baharu</span></button>
        {newMenuOpen && <div className="top-popup new-popup"><button onClick={() => { startNew(); setNewMenuOpen(false); }}><span>＋</span><div><b>Chat baharu</b><small>Mulakan perbualan kosong</small></div></button></div>}
      </div>
      <a className="top-action auth-top-link" href={signedIn ? "/api/auth/logout" : "/login"}>{signedIn ? "Sign Out" : "Sign In"}</a>
    </header>
    <main className="shell">
      {messages.length === 0 && <section className="welcome"><div className="eyebrow"><i/> IBALZ AI</div><h1>IBalz sedia<br/><em>membantu.</em></h1><p>Tanya apa sahaja yang anda perlukan.</p></section>}
      <section className="chat" ref={chatRef} onScroll={handleChatScroll}>
        {messages.map((m, i) => <div className="message-unit" key={i}>
          <article className={'msg ' + m.role}><div className="bubble">{renderMessage(m.content, copyMessage)}{m.imageData && <img className="generated-image" src={m.imageData} alt="Gambar yang dijana oleh IBalz AI"/>}</div>{m.role === 'assistant' && m.searchSources?.length > 0 && <div className="search-sources" aria-label="Sumber web"><button className="source-preview" type="button" onClick={() => setActiveSources(m.searchSources)}><span className="source-favicons">{m.searchSources.slice(0,3).map((source, sourceIndex) => <img key={source.url || sourceIndex} src={source.url ? 'https://www.google.com/s2/favicons?domain_url=' + encodeURIComponent(source.url) + '&sz=64' : ''} alt="" loading="lazy"/> )}</span><span>Sumber web{m.searchSources.length > 1 ? ' +' + (m.searchSources.length - 1) : ''}</span></button></div>}</article>
          {m.role === 'assistant' && <div className="message-tools">
            <button title="Salin" aria-label="Salin" onClick={() => copyMessage(m.content)}><ActionIcon name="copy" /></button>
            <button className={feedback[i] === 'like' ? 'chosen' : ''} title="Suka" aria-label="Suka" onClick={() => setFeedback(v => ({...v,[i]:v[i] === 'like' ? '' : 'like'}))}><ActionIcon name="like" /></button>
            <button className={feedback[i] === 'dislike' ? 'chosen' : ''} title="Tidak suka" aria-label="Tidak suka" onClick={() => setFeedback(v => ({...v,[i]:v[i] === 'dislike' ? '' : 'dislike'}))}><ActionIcon name="dislike" /></button>
            <button className={speaking === i ? 'chosen' : ''} title="Baca dengan suara" aria-label="Baca dengan suara" onClick={() => speakMessage(m.content, i)}><ActionIcon name="volume" /></button>
            <button title="Kongsi" aria-label="Kongsi" onClick={() => shareMessage(m.content)}><ActionIcon name="share" /></button>
            <div className="popup-anchor message-more-anchor">
              <button title="Lagi" aria-label="Lagi" onClick={e => { if (messageMenu === i) { setMessageMenu(-1); return; } const r = e.currentTarget.getBoundingClientRect(); setMessageMenuPos({ top: Math.max(12, r.top - 88), left: Math.max(12, Math.min(r.left, window.innerWidth - 192)) }); setMessageMenu(i); }}><ActionIcon name="more" /></button>
              {messageMenu === i && <div className="top-popup message-more-popup" style={{ position: "fixed", top: messageMenuPos.top, left: messageMenuPos.left, right: "auto", bottom: "auto" }}>
                <button onClick={() => { setMessageMenu(-1); startNew(); }}><span><ActionIcon name="plus" /></span><div><b>Sembang baharu</b><small>Mulakan perbualan baharu</small></div></button>
                <button onClick={retryAnswer} disabled={busy}><span><ActionIcon name="retry" /></span><div><b>Cuba semula</b><small>Jana semula jawapan terakhir</small></div></button>
              </div>}
            </div>
          </div>}
        </div>)}
        {busy && <article className="msg assistant">{busyLabel && <div className="busy-search-label">{busyLabel}</div>}<div className="bubble typing" aria-label={busyLabel}><i/><i/><i/></div></article>}
      </section>
      {showJumpDown && <button className="jump-to-latest" onClick={jumpToLatest} aria-label="Pergi ke mesej terkini" title="Mesej terkini"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M5.5 12.5 12 19l6.5-6.5"/></svg></button>}
      {error && <div className="error">{error}</div>}
      {image && <div className="image-preview"><img src={image} alt="Pratonton gambar"/><div><b>{imageName}</b><small>Gambar sedia dihantar</small></div><button onClick={() => { setImage(''); setImageName(''); }} aria-label="Buang gambar">×</button></div>}
      <section className="composer">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => chooseImage(e.target.files?.[0])}/>
        <button className="attach" onClick={() => fileRef.current?.click()} title="Tambah gambar" aria-label="Tambah gambar">＋</button>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Mesej IBalz..." rows="1"/>
        <button className="send" onClick={send} disabled={busy || (!input.trim() && !image)} aria-label="Hantar">↑</button>
      </section>
    </main>
    {activeSources && <div className="source-sheet-backdrop" onClick={() => setActiveSources(null)}><section className="source-sheet" role="dialog" aria-modal="true" aria-label="Sumber web" onClick={e => e.stopPropagation()}><div className="source-sheet-handle"/><div className="source-sheet-head"><h2>Sumber web</h2><button type="button" onClick={() => setActiveSources(null)} aria-label="Tutup">×</button></div><div className="source-sheet-list">{activeSources.map((source, index) => { let host = ''; try { host = new URL(source.url).hostname.replace(/^www\\./, ''); } catch {} return <article className="source-sheet-item" key={source.url || index}><div className="source-sheet-site"><img src={source.url ? 'https://www.google.com/s2/favicons?domain_url=' + encodeURIComponent(source.url) + '&sz=64' : ''} alt="" loading="lazy"/><span>{host || 'Laman web'}</span></div><b>{source.title || host || 'Sumber web'}</b>{source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">Buka laman web ↗</a>}</article>; })}</div></section></div>}
    {historyOpen && <div className="history-backdrop" onClick={() => setHistoryOpen(false)}><aside className="history-drawer" onClick={e => e.stopPropagation()}>
      <div className="history-head"><div><small>IBALZ AI</small><h2>Sejarah chat</h2></div><button onClick={() => setHistoryOpen(false)}>×</button></div>
      <button className="history-new" onClick={startNew}>＋ Chat baharu</button>
      <div className="history-tabs"><button className={!showArchived ? 'active' : ''} onClick={() => { setShowArchived(false); setHistoryMenu(''); }}>Semua</button><button className={showArchived ? 'active' : ''} onClick={() => { setShowArchived(true); setHistoryMenu(''); }}>Arkib</button></div>
      <input className="history-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari perbualan..."/>
      <div className="history-items">{visibleChats.length ? visibleChats.map(c => <div key={c.id} className="history-item-wrap" onPointerDown={() => beginHistoryPress(c.id)} onPointerUp={cancelHistoryPress} onPointerLeave={cancelHistoryPress} onPointerCancel={cancelHistoryPress} onContextMenu={e => { e.preventDefault(); setHistoryMenu(c.id); }}>
        <button className={'history-item ' + (activeId === c.id ? 'selected' : '')} onClick={() => { if (historyLongPressRef.current) { historyLongPressRef.current = false; return; } if (!historyMenu) openChat(c); }}><b>{c.pinned ? '📌 ' : ''}{c.title || 'Perbualan baharu'}</b></button>
        {historyMenu === c.id && <div className="history-context-menu">
          <button onClick={() => updateHistoryChat(c.id, { pinned: !c.pinned })}>{c.pinned ? 'Nyahpin chat' : 'Pin chat'}</button>
          <button onClick={() => renameHistoryChat(c)}>Namakan semula</button>
          <button onClick={() => updateHistoryChat(c.id, { archived: !c.archived })}>{c.archived ? 'Keluarkan daripada arkib' : 'Arkibkan'}</button>
          <button className="danger" onClick={() => deleteHistoryChat(c)}>Padam</button>
        </div>}
      </div>) : <p className="history-empty">{showArchived ? 'Tiada chat dalam arkib.' : 'Belum ada sejarah chat pada peranti ini.'}</p>}</div>
      <p className="history-foot">Sejarah ini disimpan dalam pelayar peranti anda.</p>
    </aside></div>}
  </div>;
}
export default App;
