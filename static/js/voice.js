/* ═══════════════════════════════════════════════════════════
   Vera Web — ses modülü
     • dictate()   : Groq Whisper ile tek seferlik dikte (mikrofon butonu)
     • startLive() : canlı sesli sohbet (tarayıcı STT + sesli yanıt)
   ═══════════════════════════════════════════════════════════ */
(() => {
  const $ = (id) => document.getElementById(id);
  const T = (k, fb) => (window.VeraI18n ? window.VeraI18n.t(k) : fb);
  const speechLang = () => (window.VeraI18n ? window.VeraI18n.speechLang() : 'tr-TR');

  // ─────────────────────────────────────────────
  //  1) DİKTE — MediaRecorder → /api/transcribe (Whisper)
  // ─────────────────────────────────────────────
  let recorder = null, chunks = [], recording = false;

  async function dictate(btn, onText) {
    if (recording) { recorder && recorder.stop(); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      alert(T('voice.micfail', 'Mikrofona erişilemedi: ') + e.message);
      return;
    }
    recorder = new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      btn.classList.remove('recording');
      recording = false;
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      btn.classList.add('processing');
      try {
        const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
        const data = await r.json();
        if (data.text) onText(data.text);
        else if (data.error) alert(T('voice.decodefail', 'Ses çözümlenemedi: ') + data.error);
      } catch (e) {
        alert(T('voice.error', 'Hata: ') + e.message);
      } finally {
        btn.classList.remove('processing');
      }
    };
    recorder.start();
    recording = true;
    btn.classList.add('recording');
  }

  // ─────────────────────────────────────────────
  //  2) CANLI SESLİ SOHBET
  // ─────────────────────────────────────────────
  const overlay = $('voiceOverlay');
  const statusEl = $('voiceStatus');
  const transcriptEl = $('voiceTranscript');
  const closeBtn = $('voiceClose');
  let liveBlob = null, recog = null, liveOn = false, cfg = null;

  function ensureBlob() {
    if (!liveBlob && window.VeraBlob) {
      liveBlob = new VeraBlob($('voiceBlob'), { size: 340 });
      liveBlob.start();
    }
  }

  // kadın / erkek ses ipuçları (isim bazlı) — hem TR hem EN motorları için
  const FEMALE_RE = /female|woman|kad[ıi]n|google|zira|samantha|filiz|yelda|seda|aria|jenny|sonia|emma|nur|elif|ay[sş]e|hazal|karen|tessa|victoria|susan|linda|amelie|helena|zeynep|defne/i;
  const MALE_RE = /male|erkek|tolga|david|mark|george|paul|daniel|ahmet|mehmet|burak|onur/i;

  // sesler bazen geç yüklenir → önbelleğe al
  let _voices = [];
  function loadVoices() {
    if ('speechSynthesis' in window) _voices = speechSynthesis.getVoices() || [];
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }

  function pickVoice() {
    const code = speechLang().slice(0, 2).toLowerCase();
    const voices = _voices.length ? _voices : (speechSynthesis.getVoices() || []);
    const langMatch = voices.filter(v => new RegExp('^' + code + '(-|_)?', 'i').test(v.lang));
    const pool = langMatch.length ? langMatch : voices;
    // 1) dile uygun kadın sesi  2) erkek olmayan bir ses  3) herhangi biri
    return pool.find(v => FEMALE_RE.test(v.name)) ||
           pool.find(v => !MALE_RE.test(v.name)) ||
           pool[0] ||
           null;
  }

  // emoji ve süs sembollerini sesten önce temizle (AI okurken kötü duruyordu)
  function stripEmoji(text) {
    return (text || '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, '')
      .replace(/[`*_#>]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // yedek: tarayıcı TTS (edge-tts başarısız olursa)
  function browserSpeak(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang();
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 1.0; u.pitch = 1.5;
      u.onend = resolve;
      u.onerror = resolve;
      speechSynthesis.speak(u);
    });
  }

  // ana seslendirme: sunucudan edge-tts (tr-TR-EmelNeural) sesini al, çal
  let currentAudio = null;
  function speak(text) {
    const clean = stripEmoji(text);
    return new Promise((resolve) => {
      if (!clean) return resolve();
      const lang = window.VeraI18n ? window.VeraI18n.lang : 'tr';
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, lang }),
      })
        .then(r => { if (!r.ok) throw new Error('tts'); return r.blob(); })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudio = audio;
          const done = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; resolve(); };
          audio.onended = done;
          audio.onerror = done;
          audio.play().catch(() => done());
        })
        .catch(() => { browserSpeak(clean).then(resolve); });  // yedeğe düş
    });
  }

  function stopAudio() {
    if (currentAudio) { try { currentAudio.pause(); } catch (_) {} currentAudio = null; }
  }

  function setStatus(s, state) {
    statusEl.textContent = s;
    if (liveBlob) liveBlob.setState(state);
  }

  // ── animasyonlu "düşünüyor" göstergesi ──
  let thinkTimer = null;
  function startThinking() {
    transcriptEl.textContent = '';               // Vera'nın söyleyeceği metni yazma
    if (liveBlob) liveBlob.setState('thinking');
    const base = T('voice.thinking', 'Vera düşünüyor...').replace(/[.\s]+$/, '');
    let n = 0;
    statusEl.textContent = base + '...';
    clearInterval(thinkTimer);
    thinkTimer = setInterval(() => {
      n = (n + 1) % 4;
      statusEl.textContent = base + '.'.repeat(n);
    }, 400);
  }
  function stopThinking() { clearInterval(thinkTimer); thinkTimer = null; }

  // ── cümle sınırında bölüp sırayla seslendiren kuyruk ──
  function makeSpeaker(onFirst) {
    let queue = [], playing = false, buf = '', ended = false, spoke = false, onDone = null;

    const finishMaybe = () => {
      if (ended && !queue.length && !playing && onDone) onDone();
    };
    const playNext = async () => {
      if (!queue.length) { playing = false; finishMaybe(); return; }
      playing = true;
      if (!spoke) { spoke = true; onFirst && onFirst(); }
      const s = queue.shift();
      await speak(s);
      if (!liveOn) { playing = false; return; }
      playNext();
    };
    const enqueue = (s) => { s = (s || '').trim(); if (!s) return; queue.push(s); if (!playing) playNext(); };
    const flush = (final) => {
      const re = /[^.!?…\n]*[.!?…\n]+/g;
      let m, consumed = 0;
      while ((m = re.exec(buf)) !== null) { enqueue(m[0]); consumed = re.lastIndex; }
      buf = buf.slice(consumed);
      if (final && buf.trim()) { enqueue(buf); buf = ''; }
    };
    return {
      push: (t) => { buf += t; flush(false); },
      end: (cb) => { onDone = cb; flush(true); ended = true; finishMaybe(); },
      say: (t) => enqueue(t),
    };
  }

  async function handleUserSpeech(text) {
    if (!text.trim()) { listenOnce(); return; }
    startThinking();

    const fd = new FormData();
    fd.append('message', text);
    const conv = cfg.getConv();
    if (conv) fd.append('conversation_id', conv);

    const speaker = makeSpeaker(() => {
      stopThinking();
      setStatus(T('voice.speaking', 'Vera konuşuyor...'), 'speaking');
    });

    try {
      const r = await fetch('/api/stream', { method: 'POST', body: fd });
      if (!r.ok || !r.body) throw new Error('stream');
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let sse = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!liveOn) { try { reader.cancel(); } catch (_) {} return; }
        sse += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = sse.indexOf('\n\n')) !== -1) {
          const raw = sse.slice(0, idx); sse = sse.slice(idx + 2);
          let evt = 'message', dataStr = '';
          raw.split('\n').forEach(line => {
            if (line.startsWith('event:')) evt = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          });
          if (!dataStr) continue;
          let data; try { data = JSON.parse(dataStr); } catch (_) { continue; }
          if (evt === 'meta') { if (data.conversation_id) cfg.setConv(data.conversation_id); }
          else if (evt === 'delta') speaker.push(data.text);
        }
      }
    } catch (e) {
      speaker.say(T('voice.connerr', 'Bağlantı hatası oldu.'));
    }

    stopThinking();
    cfg.onExchange && cfg.onExchange();
    speaker.end(() => { if (liveOn) listenOnce(); });
  }

  function listenOnce() {
    if (!liveOn) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recog = new SR();
    recog.lang = speechLang();
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    setStatus(T('voice.listening', 'Dinliyorum, konuş...'), 'listening');
    transcriptEl.textContent = '';

    let finalText = '';
    recog.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      transcriptEl.textContent = '"' + (finalText + interim) + '"';
    };
    recog.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') { if (liveOn) listenOnce(); }
      else setStatus(T('voice.serror', 'Ses hatası: ') + e.error, 'idle');
    };
    recog.onend = () => {
      if (!liveOn) return;
      if (finalText.trim()) handleUserSpeech(finalText.trim());
      else listenOnce();
    };
    try { recog.start(); } catch (_) {}
  }

  function startLive(config) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert(T('voice.needchrome', 'Canlı sesli sohbet için Chrome veya Edge tarayıcısı gerekir.'));
      return;
    }
    cfg = config;
    liveOn = true;
    overlay.classList.add('show');
    ensureBlob();
    setStatus(T('voice.hello.status', 'Merhaba! Seni dinliyorum...'), 'listening');
    loadVoices();   // sesler hazırsa önbelleği tazele
    speak(T('voice.hello.speak', 'Merhaba, seni dinliyorum.')).then(() => { if (liveOn) listenOnce(); });
  }

  function stopLive() {
    liveOn = false;
    overlay.classList.remove('show');
    try { recog && recog.abort(); } catch (_) {}
    try { speechSynthesis.cancel(); } catch (_) {}
    stopAudio();
  }

  closeBtn && (closeBtn.onclick = stopLive);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && liveOn) stopLive(); });

  window.VeraVoice = { dictate, startLive };
})();
