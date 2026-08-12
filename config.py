"""Vera Web — merkezi yapılandırma. .env dosyasından okur."""
import os
from dotenv import load_dotenv

load_dotenv(override=True)   # .env değerleri, bayat ortam değişkenlerini ezsin


def _get(key, default=None):
    return os.getenv(key, default)


# ── Seslendirme (edge-tts / Neural sesler) ──
TTS_VOICE_TR = _get("TTS_VOICE_TR", "tr-TR-EmelNeural")
TTS_VOICE_EN = _get("TTS_VOICE_EN", "en-US-JennyNeural")

# ── OpenWeather (hava durumu) ──
OPENWEATHER_API_KEY = _get("OPENWEATHER_API_KEY", "")

# ── Groq ──
GROQ_API_KEY = _get("GROQ_API_KEY", "")
GROQ_TEXT_MODEL = _get("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")
GROQ_VISION_MODEL = _get("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")
GROQ_WHISPER_MODEL = _get("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")

# ── MySQL ──
DB_HOST = _get("DB_HOST", "localhost")
DB_PORT = int(_get("DB_PORT", "3306"))
DB_USER = _get("DB_USER", "root")
DB_PASSWORD = _get("DB_PASSWORD", "123456789")
DB_NAME = _get("DB_NAME", "vera_db")

# ── Flask ──
FLASK_SECRET_KEY = _get("FLASK_SECRET_KEY", "degistir-beni")

# ── Yükleme klasörü ──
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "static", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "mp4", "webm", "mov"}
MAX_CONTENT_MB = 25

# Vera'nın kişiliği
VERA_SYSTEM_PROMPT = (
    "Senin adın Vera. Samimi, zeki ve yardımsever bir yapay zeka asistanısın. "
    "HER ZAMAN kullanıcının yazdığı dilde cevap ver: kullanıcı Türkçe yazarsa "
    "Türkçe, İngilizce yazarsa İngilizce cevap ver. Kullanıcının kullandığı dili "
    "aynı şekilde kullan. Doğal, akıcı ve sıcak bir dille konuş. "
    "Kısa ve öz ol ama gerektiğinde detay ver. "
    "Kullanıcı herhangi bir şehir veya ülkenin hava durumunu sorarsa, güncel "
    "veriyi almak için get_weather aracını kullan; hava durumunu asla kendin "
    "uydurma. Araçtan gelen sonucu kullanıcının diliyle doğal bir cümleye çevir. "
    "Hiçbir zaman emoji veya süslü sembol kullanma; yalnızca düz metin yaz. "
    "Kod paylaşırken kodu üç ters tırnak (```) ile işaretlenmiş kod bloğu "
    "içinde ve mümkünse dilini belirterek ver."
)
