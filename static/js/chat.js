/* ═══════════════════════════════════════════════════════════
   Vera Web — ana sohbet mantığı
   ═══════════════════════════════════════════════════════════ */
(() => {
  const $ = (id) => document.getElementById(id);
  const T = (k, fb) => (window.VeraI18n ? window.VeraI18n.t(k) : fb);
  const chatScroll = $('chatScroll');
  const chatInner = $('chatInner');
  const welcome = $('welcome');
  const msgInput = $('msgInput');
  const sendBtn = $('sendBtn');
  const attachBtn = $('attachBtn');
  const fileInput = $('fileInput');
  const micBtn = $('micBtn');
  const voiceBtn = $('voiceBtn');
  const convList = $('convList');
  const newChatBtn = $('newChatBtn');
  const previewBar = $('previewBar');
  const previewImg = $('previewImg');
  const previewName = $('previewName');
  const previewX = $('previewX');
  const replyBar = $('replyBar');
  const replyBarWho = $('replyBarWho');
  const replyBarText = $('replyBarText');
  const replyBarX = $('replyBarX');

  let currentConv = null;
  let pendingFile = null;
  let sending = false;
  let replyingTo = null;   // { role, text }

  // ─── WhatsApp tarzı yanıt ───
  function startReply(role, text) {
    replyingTo = { role, text };
    if (replyBarWho) replyBarWho.textContent = whoLabel(role);
    if (replyBarText) replyBarText.textContent = text;
    if (replyBar) replyBar.classList.add('show');
    msgInput.focus();
  }
  function clearReply() {
    replyingTo = null;
    if (replyBar) replyBar.classList.remove('show');
  }

  // ─── yardımcılar ───
  function scrollBottom() { chatScroll.scrollTop = chatScroll.scrollHeight; }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function hideWelcome() { if (welcome) welcome.style.display = 'none'; }

  function mediaHtml(path, type) {
    if (!path) return '';
    if (type === 'video') return `<video src="${path}" controls></video>`;
    return `<img src="${path}" alt="görsel">`;
  }

  // ─── içerik biçimlendirme (kod blokları + hafif markdown) ───
  function inlineFmt(s) {
    s = escapeHtml(s);
    s = s.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function codeBlock(lang, code) {
    const label = lang ? escapeHtml(lang) : 'kod';
    const body = escapeHtml(code.replace(/\n$/, ''));
    const copy = (window.VeraI18n ? window.VeraI18n.t('code.copy') : 'Kopyala');
    return `<div class="code-wrap">` +
             `<div class="code-head"><span class="code-lang">${label}</span>` +
             `<button class="code-copy" type="button">${copy}</button></div>` +
             `<pre class="code-body"><code>${body}</code></pre>` +
           `</div>`;
  }

  function formatContent(raw) {
    raw = raw || '';
    const out = [];
    const re = /```([\w+#.-]*)\n?([\s\S]*?)```/g;
    let last = 0, m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) out.push(inlineFmt(raw.slice(last, m.index)));
      out.push(codeBlock(m[1] || '', m[2]));
      last = re.lastIndex;
    }
    if (last < raw.length) out.push(inlineFmt(raw.slice(last)));
    return out.join('');
  }

  function avatarInner(role) {
    if (role === 'user') {
      if (window.VERA_AVATAR) return `<img src="${window.VERA_AVATAR}" alt="">`;
      return (window.VERA_USER || 'S')[0].toUpperCase();
    }
    return 'V';
  }

  const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  const REPLY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>';

  function whoLabel(role) {
    return role === 'user' ? (window.VERA_USER || 'Sen') : 'Vera';
  }

  function copyToClipboard(text, btn) {
    const flash = () => {
      const old = btn.innerHTML;
      btn.innerHTML = CHECK_SVG;
      btn.classList.add('done');
      setTimeout(() => { btn.innerHTML = old; btn.classList.remove('done'); }, 1300);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); flash(); } catch (_) {}
      document.body.removeChild(ta);
    }
  }

  // ─── onay kutusu (evet / hayır) & bildirim (toast) ───
  const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
  const LOGOUT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';

  function askConfirm(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'confirm-overlay';
      const danger = opts.danger ? ' danger' : '';
      ov.innerHTML =
        `<div class="confirm-box" role="dialog" aria-modal="true">` +
          `<div class="confirm-icon${danger}">${opts.icon || ''}</div>` +
          `<h3>${escapeHtml(opts.title || '')}</h3>` +
          (opts.message ? `<p>${escapeHtml(opts.message)}</p>` : '') +
          `<div class="confirm-actions">` +
            `<button class="confirm-cancel" type="button">${escapeHtml(opts.cancelText || T('confirm.no', 'Vazgeç'))}</button>` +
            `<button class="confirm-ok${danger}" type="button">${escapeHtml(opts.okText || T('confirm.yes', 'Evet'))}</button>` +
          `</div>` +
        `</div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));

      const close = (val) => {
        ov.classList.remove('show');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => ov.remove(), 180);
        resolve(val);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') close(false);
        else if (e.key === 'Enter') close(true);
      };
      ov.querySelector('.confirm-cancel').onclick = () => close(false);
      ov.querySelector('.confirm-ok').onclick = () => close(true);
      ov.addEventListener('click', (e) => { if (e.target === ov) close(false); });
      document.addEventListener('keydown', onKey);
      ov.querySelector('.confirm-ok').focus();
    });
  }

  function showToast(message, opts) {
    opts = opts || {};
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (opts.danger ? ' danger' : '');
    el.innerHTML = (opts.icon === false ? '' : CHECK_SVG) + `<span>${escapeHtml(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, opts.duration || 2200);
  }

  function addMessage(role, content, mediaPath, mediaType, time, replyTo) {
    hideWelcome();
    const wrap = document.createElement('div');
    wrap.className = `msg ${role === 'user' ? 'user' : 'ai'}`;
    const quote = replyTo
      ? `<div class="reply-quote"><span class="rq-bar"></span><span class="rq-text">${escapeHtml(replyTo)}</span></div>`
      : '';
    wrap.innerHTML = `
      <div class="avatar">${avatarInner(role)}</div>
      <div class="bubble">
        ${quote}
        ${mediaHtml(mediaPath, mediaType)}
        <div class="text">${formatContent(content)}</div>
        ${time ? `<div class="time">${time}</div>` : ''}
      </div>
      <div class="msg-actions">
        <button class="msg-act act-copy" type="button" title="${T('msg.copy', 'Kopyala')}">${COPY_SVG}</button>
        <button class="msg-act act-reply" type="button" title="${T('msg.reply', 'Yanıtla')}">${REPLY_SVG}</button>
      </div>`;
    wrap.querySelector('.act-copy').onclick = (e) => copyToClipboard(content || '', e.currentTarget);
    wrap.querySelector('.act-reply').onclick = () => startReply(role, content || '');
    chatInner.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function addTyping() {
    hideWelcome();
    const wrap = document.createElement('div');
    wrap.className = 'msg ai typing';
    wrap.innerHTML = `
      <div class="avatar">V</div>
      <div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
    chatInner.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  // ─── sohbet listesi ───
  async function loadConversations() {
    const r = await fetch('/api/conversations');
    const convs = await r.json();
    convList.innerHTML = '';
    convs.forEach(c => {
      const item = document.createElement('div');
      item.className = 'conv-item' + (c.id === currentConv ? ' active' : '');
      item.dataset.id = c.id;
      item.innerHTML = `<span class="ci-title">${escapeHtml(c.title)}</span>
                        <button class="ci-del" title="${T('title.del', 'Sil')}" aria-label="Sil">` +
                        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>` +
                        `</button>`;
      item.querySelector('.ci-title').onclick = () => openConversation(c.id);
      item.querySelector('.ci-del').onclick = (e) => { e.stopPropagation(); deleteConv(c.id); };
      convList.appendChild(item);
    });
  }

  async function openConversation(id) {
    currentConv = id;
    const r = await fetch(`/api/conversations/${id}/messages`);
    const msgs = await r.json();
    chatInner.innerHTML = '';
    if (welcome) welcome.style.display = 'none';
    msgs.forEach(m => addMessage(m.role, m.content, m.media_path, m.media_type, m.created_at, m.reply_to));
    document.querySelectorAll('.conv-item').forEach(el =>
      el.classList.toggle('active', +el.dataset.id === id));
    scrollBottom();
  }

  async function deleteConv(id) {
    const ok = await askConfirm({
      title: T('confirm.delete.title', 'Sohbeti sil'),
      message: T('confirm.delete', 'Bu sohbeti silmek istediğine emin misin?'),
      okText: T('confirm.delete.ok', 'Sil'),
      icon: TRASH_SVG,
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (currentConv === id) { currentConv = null; newChat(); }
    loadConversations();
    showToast(T('toast.deleted', 'Sohbet silindi'));
  }

  function newChat() {
    currentConv = null;
    chatInner.innerHTML = '';
    if (welcome) { chatInner.appendChild(welcome); welcome.style.display = 'flex'; }
    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
    msgInput.focus();
  }

  // ─── gönderme ───
  async function send() {
    const text = msgInput.value.trim();
    if ((!text && !pendingFile) || sending) return;
    sending = true;

    const localMediaUrl = pendingFile ? URL.createObjectURL(pendingFile) : null;
    const localMediaType = pendingFile
      ? (pendingFile.type.startsWith('video') ? 'video' : 'image') : null;
    const replySnippet = replyingTo ? replyingTo.text : null;
    addMessage('user', text, localMediaUrl, localMediaType, null, replySnippet);

    const fd = new FormData();
    fd.append('message', text);
    if (currentConv) fd.append('conversation_id', currentConv);
    if (pendingFile) fd.append('media', pendingFile);
    if (replySnippet) fd.append('reply_to', replySnippet);

    const hasMedia = !!pendingFile;

    msgInput.value = '';
    autoResize();
    clearPreview();
    clearReply();
    const typing = addTyping();

    try {
      if (hasMedia) {
        // Görsel/video akışsız — eski yol
        const r = await fetch('/api/send', { method: 'POST', body: fd });
        const data = await r.json();
        typing.remove();
        if (data.error) { addMessage('ai', '⚠️ ' + data.error); }
        else {
          currentConv = data.conversation_id;
          addMessage('ai', data.answer);
          if (data.new_conversation) loadConversations();
        }
      } else {
        await streamSend(fd, typing);
      }
    } catch (e) {
      typing.remove();
      addMessage('ai', '⚠️ ' + T('err.connection', 'Bağlantı hatası: ') + e.message);
    } finally {
      sending = false;
    }
  }

  // ─── akışlı gönderme (SSE — cevap kelime kelime gelir) ───
  async function streamSend(fd, typing) {
    const r = await fetch('/api/stream', { method: 'POST', body: fd });
    if (!r.ok || !r.body) {
      typing.remove();
      let msg = T('err.connection', 'Bağlantı hatası');
      try { const d = await r.json(); if (d.error) msg = d.error; } catch (_) {}
      addMessage('ai', '⚠️ ' + msg);
      return;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', answer = '', newConv = false;
    let bubbleWrap = null, bubbleText = null;

    const ensureBubble = () => {
      if (bubbleWrap) return;
      typing.remove();
      bubbleWrap = addMessage('ai', '');
      bubbleText = bubbleWrap.querySelector('.text');
    };

    const handle = (evt, data) => {
      if (evt === 'meta') {
        currentConv = data.conversation_id;
        newConv = data.new_conversation;
      } else if (evt === 'delta') {
        ensureBubble();
        answer += data.text;
        bubbleText.innerHTML = formatContent(answer);
        scrollBottom();
      } else if (evt === 'error') {
        ensureBubble();
        answer += '\n⚠️ ' + data.message;
        bubbleText.innerHTML = formatContent(answer);
      } else if (evt === 'done') {
        if (newConv) loadConversations();
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let evt = 'message', dataStr = '';
        raw.split('\n').forEach(line => {
          if (line.startsWith('event:')) evt = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        });
        if (!dataStr) continue;
        let data;
        try { data = JSON.parse(dataStr); } catch (_) { continue; }
        handle(evt, data);
      }
    }

    if (!bubbleWrap) {
      typing.remove();
      addMessage('ai', '⚠️ ' + T('err.connection', 'Bağlantı hatası'));
      return;
    }
    // Kopyala/Yanıtla düğmeleri nihai metni kullansın
    bubbleWrap.querySelector('.act-copy').onclick =
      (e) => copyToClipboard(answer, e.currentTarget);
    bubbleWrap.querySelector('.act-reply').onclick =
      () => startReply('ai', answer);
  }

  // ─── dosya önizleme ───
  function showPreview(file) {
    pendingFile = file;
    previewName.textContent = file.name;
    if (file.type.startsWith('image')) {
      previewImg.style.display = 'block';
      previewImg.src = URL.createObjectURL(file);
    } else {
      previewImg.style.display = 'none';
    }
    previewBar.classList.add('show');
  }
  function clearPreview() {
    pendingFile = null;
    fileInput.value = '';
    previewBar.classList.remove('show');
  }

  // ─── auto-resize textarea ───
  function autoResize() {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 160) + 'px';
  }

  // ─── kod kopyalama ───
  chatInner.addEventListener('click', (e) => {
    const btn = e.target.closest('.code-copy');
    if (!btn) return;
    const codeEl = btn.closest('.code-wrap').querySelector('code');
    const text = codeEl ? codeEl.textContent : '';
    const done = () => {
      const old = btn.textContent;
      btn.textContent = (window.VeraI18n ? window.VeraI18n.t('code.copied') : 'Kopyalandı');
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (_) {}
      document.body.removeChild(ta);
    }
  });

  // ─── olaylar ───
  sendBtn.onclick = send;
  msgInput.addEventListener('input', autoResize);
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    else if (e.key === 'Escape' && replyingTo) { clearReply(); }
  });
  attachBtn.onclick = () => fileInput.click();
  fileInput.onchange = () => { if (fileInput.files[0]) showPreview(fileInput.files[0]); };
  previewX.onclick = clearPreview;
  if (replyBarX) replyBarX.onclick = clearReply;
  newChatBtn.onclick = newChat;

  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => { msgInput.value = chip.textContent.trim(); autoResize(); send(); };
  });

  // sesle yaz (tek seferlik dikte — Groq Whisper)
  micBtn.onclick = () => window.VeraVoice.dictate(micBtn, (text) => {
    msgInput.value = (msgInput.value + ' ' + text).trim();
    autoResize();
    msgInput.focus();
  });

  // canlı sesli sohbet
  voiceBtn.onclick = () => window.VeraVoice.startLive({
    getConv: () => currentConv,
    setConv: (id) => { currentConv = id; },
    onExchange: () => loadConversations(),
  });

  // ─── ayarlar & profil ───
  const settingsOverlay = $('settingsOverlay');
  const settingsClose = $('settingsClose');
  const profileBtn = $('profileBtn');
  const profileName = $('profileName');
  const avatarInput = $('avatarInput');
  const avatarPreview = $('avatarPreview');
  const avatarRemove = $('avatarRemove');
  const profileSave = $('profileSave');
  const settingsMsg = $('settingsMsg');
  const langChoice = $('langChoice');
  let pendingAvatar = null;   // File | null
  let removeAvatar = false;

  function renderAvatarPreview(url) {
    avatarPreview.innerHTML = url ? `<img src="${url}" alt="">` : '<span>V</span>';
  }
  const PERSON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>';
  function setMiniAvatar(url) {
    const mini = $('miniAvatar');
    if (mini) mini.innerHTML = url ? `<img src="${url}" alt="">` : PERSON_SVG;
  }

  function markActiveLang() {
    const cur = window.VeraI18n ? window.VeraI18n.lang : 'tr';
    langChoice.querySelectorAll('[data-lang]').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-lang') === cur));
  }

  function openSettings() {
    settingsMsg.textContent = '';
    pendingAvatar = null; removeAvatar = false;
    profileName.value = window.VERA_USER || '';
    renderAvatarPreview(window.VERA_AVATAR || null);
    markActiveLang();
    settingsOverlay.classList.add('show');
  }
  function closeSettings() { settingsOverlay.classList.remove('show'); }

  if (profileBtn) profileBtn.onclick = openSettings;
  if (settingsClose) settingsClose.onclick = closeSettings;

  // çıkış — önce onay kutusu
  const logoutLink = document.querySelector('.modal-logout');
  if (logoutLink) logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const ok = await askConfirm({
      title: T('confirm.logout.title', 'Çıkış yap'),
      message: T('confirm.logout', 'Çıkış yapmak istediğine emin misin?'),
      okText: T('sb.logout', 'Çıkış'),
      icon: LOGOUT_SVG,
      danger: true,
    });
    if (ok) window.location.href = logoutLink.href;
  });
  if (settingsOverlay) settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  if (avatarInput) avatarInput.onchange = () => {
    const f = avatarInput.files[0];
    if (!f) return;
    pendingAvatar = f; removeAvatar = false;
    renderAvatarPreview(URL.createObjectURL(f));
  };
  if (avatarRemove) avatarRemove.onclick = () => {
    pendingAvatar = null; removeAvatar = true;
    renderAvatarPreview(null);
  };

  if (langChoice) langChoice.querySelectorAll('[data-lang]').forEach(b => {
    b.onclick = () => {
      if (window.VeraI18n) window.VeraI18n.apply(b.getAttribute('data-lang'));
      markActiveLang();
    };
  });

  if (profileSave) profileSave.onclick = async () => {
    const fd = new FormData();
    const name = profileName.value.trim();
    if (name) fd.append('username', name);
    if (pendingAvatar) fd.append('avatar', pendingAvatar);
    else if (removeAvatar) fd.append('remove_avatar', '1');

    profileSave.disabled = true;
    try {
      const r = await fetch('/api/profile', { method: 'POST', body: fd });
      const data = await r.json();
      if (data.error) { settingsMsg.textContent = data.error; return; }
      window.VERA_USER = data.username;
      window.VERA_AVATAR = data.avatar || null;
      // arayüzü tazele
      setMiniAvatar(window.VERA_AVATAR);
      const pfName = document.querySelector('.pf-name');
      if (pfName) pfName.textContent = data.username;
      document.querySelectorAll('.msg.user .avatar').forEach(a => {
        a.innerHTML = avatarInner('user');
      });
      if (window.VeraI18n) window.VeraI18n.apply();   // {name} içeren metinleri güncelle
      closeSettings();
      showToast(T('settings.saved', 'Kaydedildi'));
    } catch (e) {
      showToast(T('settings.savefail', 'Kaydedilemedi.'), { danger: true, icon: false });
    } finally {
      profileSave.disabled = false;
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsOverlay.classList.contains('show')) closeSettings();
  });

  // başlat
  loadConversations();
  msgInput.focus();
})();
