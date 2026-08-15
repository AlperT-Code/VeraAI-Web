/* ═══════════════════════════════════════════════════════════
   Vera Web — dil sistemi (Türkçe / İngilizce)
   • data-i18n         → element metni
   • data-i18n-ph      → placeholder
   • data-i18n-title   → title (tooltip)
   • {name} gibi yer tutucular window.VERA_USER ile doldurulur
   • VeraI18n.t(key)   → JS içindeki dinamik metinler için
   ═══════════════════════════════════════════════════════════ */
(() => {
  const DICT = {
    tr: {
      "brand.tagline.login": "seninle konuşmaya hazır",
      "brand.tagline.register": "yeni bir başlangıç",
      "feature.chat": "Doğal, akıcı sohbet",
      "feature.voice": "Sesli konuşma desteği",
      "feature.memory": "Sohbetlerini hatırlar",
      "login.h1": "Hoş geldin",
      "login.sub": "Hesabına giriş yap ve Vera ile sohbete devam et.",
      "register.h1": "Hesap oluştur",
      "register.sub": "Birkaç saniyede kaydol, Vera seni bekliyor.",
      "field.email": "E-POSTA",
      "field.password": "ŞİFRE",
      "field.username": "KULLANICI ADI",
      "login.btn": "Giriş Yap",
      "auth.or": "veya",
      "auth.google": "Google ile devam et",
      "login.alt": "Hesabın yok mu?",
      "login.alt.link": "Kayıt ol",
      "register.btn": "Kayıt Ol",
      "register.alt": "Zaten hesabın var mı?",
      "register.alt.link": "Giriş yap",
      "ph.email": "ornek@gmail.com",
      "ph.username": "Adın",
      "ph.password.min": "En az 4 karakter",
      "sb.newchat": "Yeni sohbet",
      "sb.previous": "Önceki sohbetler",
      "sb.logout": "Çıkış",
      "welcome.eyebrow": "HOŞ GELDİN",
      "welcome.h2": "Merhaba, {name}",
      "welcome.p": "Ben Vera. Sorularını yanıtlar, fotoğraflarını analiz eder, seninle sesli sohbet ederim. Ne konuşmak istersin?",
      "chip.1": "Bana ilginç bir bilgi ver",
      "chip.2": "Bir hikâye yaz",
      "chip.3": "Kod yazmama yardım et",
      "chip.4": "Bugün ne yapsam?",
      "composer.ph": "Vera'ya bir mesaj yaz...",
      "composer.hint": "Vera hata yapabilir. Önemli bilgileri doğrula. · Enter ile gönder, Shift+Enter yeni satır",
      "voice.close": "Sohbeti bitir",
      "title.attach": "Fotoğraf / video ekle",
      "title.dictate": "Sesle yaz",
      "title.live": "Canlı sesli sohbet",
      "title.send": "Gönder",
      "title.del": "Sil",
      "settings.title": "Ayarlar & Profil",
      "settings.name": "İsim",
      "settings.language": "Dil",
      "settings.changePhoto": "Fotoğrafı değiştir",
      "settings.removePhoto": "Kaldır",
      "settings.save": "Kaydet",
      "settings.saved": "Kaydedildi",
      "settings.savefail": "Kaydedilemedi.",
      "code.copy": "Kopyala",
      "code.copied": "Kopyalandı",
      "msg.copy": "Kopyala",
      "msg.reply": "Yanıtla",
      "confirm.yes": "Evet",
      "confirm.no": "Vazgeç",
      "confirm.delete.title": "Sohbeti sil",
      "confirm.delete": "Bu sohbeti silmek istediğine emin misin? Bu işlem geri alınamaz.",
      "confirm.delete.ok": "Sil",
      "confirm.logout.title": "Çıkış yap",
      "confirm.logout": "Çıkış yapmak istediğine emin misin?",
      "toast.deleted": "Sohbet silindi",
      "err.connection": "Bağlantı hatası: ",
      "voice.thinking": "Vera düşünüyor...",
      "voice.speaking": "Vera konuşuyor...",
      "voice.listening": "Dinliyorum, konuş...",
      "voice.hello.status": "Merhaba! Seni dinliyorum...",
      "voice.hello.speak": "Merhaba, seni dinliyorum.",
      "voice.needchrome": "Canlı sesli sohbet için Chrome veya Edge tarayıcısı gerekir.",
      "voice.micfail": "Mikrofona erişilemedi: ",
      "voice.decodefail": "Ses çözümlenemedi: ",
      "voice.error": "Hata: ",
      "voice.connerr": "Bağlantı hatası oldu.",
      "voice.serror": "Ses hatası: ",
    },
    en: {
      "brand.tagline.login": "ready to talk with you",
      "brand.tagline.register": "a fresh start",
      "feature.chat": "Natural, flowing conversation",
      "feature.voice": "Voice conversation support",
      "feature.memory": "Remembers your chats",
      "login.h1": "Welcome back",
      "login.sub": "Sign in to your account and keep chatting with Vera.",
      "register.h1": "Create account",
      "register.sub": "Sign up in seconds — Vera is waiting for you.",
      "field.email": "EMAIL",
      "field.password": "PASSWORD",
      "field.username": "USERNAME",
      "login.btn": "Sign In",
      "auth.or": "or",
      "auth.google": "Continue with Google",
      "login.alt": "Don't have an account?",
      "login.alt.link": "Sign up",
      "register.btn": "Sign Up",
      "register.alt": "Already have an account?",
      "register.alt.link": "Sign in",
      "ph.email": "example@gmail.com",
      "ph.username": "Your name",
      "ph.password.min": "At least 4 characters",
      "sb.newchat": "New chat",
      "sb.previous": "Previous chats",
      "sb.logout": "Log out",
      "welcome.eyebrow": "WELCOME BACK",
      "welcome.h2": "Hello, {name}",
      "welcome.p": "I'm Vera. I answer your questions, analyze your photos and talk with you by voice. What would you like to talk about?",
      "chip.1": "Tell me an interesting fact",
      "chip.2": "Write me a story",
      "chip.3": "Help me write some code",
      "chip.4": "What should I do today?",
      "composer.ph": "Write a message to Vera...",
      "composer.hint": "Vera can make mistakes. Verify important information. · Enter to send, Shift+Enter for a new line",
      "voice.close": "End conversation",
      "title.attach": "Add photo / video",
      "title.dictate": "Dictate",
      "title.live": "Live voice chat",
      "title.send": "Send",
      "title.del": "Delete",
      "settings.title": "Settings & Profile",
      "settings.name": "Name",
      "settings.language": "Language",
      "settings.changePhoto": "Change photo",
      "settings.removePhoto": "Remove",
      "settings.save": "Save",
      "settings.saved": "Saved",
      "settings.savefail": "Could not save.",
      "code.copy": "Copy",
      "code.copied": "Copied",
      "msg.copy": "Copy",
      "msg.reply": "Reply",
      "confirm.yes": "Yes",
      "confirm.no": "Cancel",
      "confirm.delete.title": "Delete conversation",
      "confirm.delete": "Are you sure you want to delete this conversation? This cannot be undone.",
      "confirm.delete.ok": "Delete",
      "confirm.logout.title": "Log out",
      "confirm.logout": "Are you sure you want to log out?",
      "toast.deleted": "Conversation deleted",
      "err.connection": "Connection error: ",
      "voice.thinking": "Vera is thinking...",
      "voice.speaking": "Vera is speaking...",
      "voice.listening": "Listening, go ahead...",
      "voice.hello.status": "Hello! I'm listening...",
      "voice.hello.speak": "Hi, I'm listening.",
      "voice.needchrome": "Live voice chat requires Chrome or Edge.",
      "voice.micfail": "Could not access the microphone: ",
      "voice.decodefail": "Could not transcribe audio: ",
      "voice.error": "Error: ",
      "voice.connerr": "A connection error occurred.",
      "voice.serror": "Voice error: ",
    },
  };

  const SPEECH_LANG = { tr: "tr-TR", en: "en-US" };

  let lang = localStorage.getItem("vera_lang") ||
             (navigator.language && navigator.language.startsWith("en") ? "en" : "tr");
  if (!DICT[lang]) lang = "tr";

  function fill(str) {
    return (str || "").replace(/\{name\}/g, window.VERA_USER || "");
  }

  function t(key, replace) {
    let s = (DICT[lang] && DICT[lang][key]) || (DICT.tr[key]) || key;
    s = fill(s);
    if (replace) {
      for (const k in replace) s = s.replace(new RegExp("\\{" + k + "\\}", "g"), replace[k]);
    }
    return s;
  }

  function apply(next) {
    if (next && DICT[next]) {
      lang = next;
      localStorage.setItem("vera_lang", lang);
    }
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      el.placeholder = t(el.getAttribute("data-i18n-ph"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      el.title = t(el.getAttribute("data-i18n-title"));
    });

    document.querySelectorAll(".lang-switch [data-lang]").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-lang") === lang);
    });

    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }

  function injectSwitch() {
    if (document.querySelector(".lang-switch")) return;
    const wrap = document.createElement("div");
    wrap.className = "lang-switch";
    wrap.innerHTML =
      '<button type="button" data-lang="tr">TR</button>' +
      '<button type="button" data-lang="en">EN</button>';
    wrap.querySelectorAll("[data-lang]").forEach(b => {
      b.addEventListener("click", () => apply(b.getAttribute("data-lang")));
    });
    document.body.appendChild(wrap);
  }

  window.VeraI18n = {
    t,
    apply,
    get lang() { return lang; },
    speechLang() { return SPEECH_LANG[lang] || "tr-TR"; },
  };

  document.addEventListener("DOMContentLoaded", () => {
    injectSwitch();
    apply(lang);
  });
})();
