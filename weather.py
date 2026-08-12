"""Vera Web — Hava durumu katmanı (OpenWeather).

Yapay zekaya bir `get_weather` aracı sağlar. Model, kullanıcı herhangi bir
şehir/ülkenin hava durumunu sorduğunda bu aracı kendisi çağırır; biz
OpenWeather'dan güncel veriyi çeker, düz bir özet döneriz. Modelin bu özeti
kullanıcının dilinde doğal bir cümleye çevirmesi beklenir.
"""
import json

import requests

import config

_CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"


# ── Groq/OpenAI uyumlu araç tanımı ──
WEATHER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": (
            "Belirtilen şehir veya konum için GÜNCEL hava durumunu getirir. "
            "Kullanıcı dünyanın herhangi bir şehri veya ülkesi için 'hava nasıl', "
            "'hava durumu', 'kaç derece', 'yağmur var mı' gibi bir şey sorduğunda "
            "MUTLAKA bu aracı çağır. Tahmin etme, aracı kullan."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": (
                        "Şehir adı; istenirse virgülle ülke kodu. "
                        "Örnekler: 'Istanbul', 'Ankara,TR', 'Paris,FR', "
                        "'New York,US', 'Tokyo,JP'. Şehir adını İngilizce/latin "
                        "harflerle yaz."
                    ),
                },
            },
            "required": ["location"],
        },
    },
}


def get_weather(location):
    """OpenWeather'dan güncel hava durumunu çeker; kısa bir özet metni döner.

    Dönen metin doğrudan modele 'tool' sonucu olarak verilir; model bunu
    kullanıcının diline çevirip cümle kurar.
    """
    if not config.OPENWEATHER_API_KEY:
        return ("HATA: OpenWeather API anahtarı ayarlı değil. .env dosyasına "
                "OPENWEATHER_API_KEY ekle.")

    location = (location or "").strip()
    if not location:
        return "HATA: Konum belirtilmedi."

    try:
        resp = requests.get(
            _CURRENT_URL,
            params={
                "q": location,
                "appid": config.OPENWEATHER_API_KEY,
                "units": "metric",   # Santigrat + m/s
                "lang": "tr",        # açıklama Türkçe gelsin
            },
            timeout=10,
        )
    except requests.RequestException as e:
        return f"HATA: Hava durumu servisine ulaşılamadı ({e})."

    if resp.status_code == 404:
        return (f"'{location}' adında bir yer bulunamadı. Kullanıcıdan şehir "
                f"adını netleştirmesini iste.")
    if resp.status_code == 401:
        return "HATA: OpenWeather API anahtarı geçersiz."
    if resp.status_code != 200:
        return f"HATA: Hava durumu alınamadı (kod {resp.status_code})."

    data = resp.json()
    try:
        name = data.get("name") or location
        country = data.get("sys", {}).get("country", "")
        weather = (data.get("weather") or [{}])[0]
        desc = weather.get("description", "")
        main = data.get("main", {})
        temp = round(main.get("temp"))
        feels = round(main.get("feels_like"))
        humidity = main.get("humidity")
        wind = data.get("wind", {}).get("speed")
    except (TypeError, ValueError):
        return "HATA: Hava durumu verisi okunamadı."

    yer = f"{name}, {country}".strip(", ")
    return (
        f"{yer} güncel hava durumu: "
        f"{desc}, sıcaklık {temp}°C (hissedilen {feels}°C), "
        f"nem %{humidity}, rüzgar {wind} m/s. "
        f"Bu bilgiyi kullanıcının diline çevirip doğal bir cümleyle aktar."
    )


# ── Model bir araç çağırdığında burada çalıştırılır ──
_TOOLS = {"get_weather": get_weather}


def run_tool(name, arguments):
    """name + JSON argüman string'i ile aracı çalıştırır; metin sonuç döner."""
    fn = _TOOLS.get(name)
    if not fn:
        return f"HATA: Bilinmeyen araç: {name}"
    try:
        args = json.loads(arguments) if isinstance(arguments, str) else (arguments or {})
    except json.JSONDecodeError:
        args = {}
    try:
        return fn(**args)
    except TypeError:
        # Beklenmeyen argümanlar gelirse en azından location'ı dene
        return fn(args.get("location", "")) if "location" in args else \
            "HATA: Araç argümanları geçersiz."
