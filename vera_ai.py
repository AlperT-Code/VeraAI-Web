"""Vera Web — Groq yapay zeka katmanı.

Sağladıkları:
  • chat()          → metin sohbeti (geçmişle birlikte)
  • chat_with_image → görsel + metin (vision modeli)
  • transcribe()    → ses dosyası → metin (Whisper)
  • suggest_title() → sohbet başlığı üretir
"""
import asyncio
import base64
import re

import edge_tts
from groq import Groq

import config
import weather

_client = Groq(api_key=config.GROQ_API_KEY)

# Modelin kullanabileceği araçlar (hava durumu vb.)
_TOOLS = [weather.WEATHER_TOOL]


# ─────────────────────────────────────────────────────────
#  Seslendirme (edge-tts — tr-TR-EmelNeural gibi Neural sesler)
# ─────────────────────────────────────────────────────────
_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002190-\U000021FF"
    "\U00002B00-\U00002BFF️‍]",
    flags=re.UNICODE,
)


def _clean_for_tts(text):
    """Emoji ve markdown süslerini sesten önce temizler."""
    text = _EMOJI_RE.sub("", text or "")
    text = re.sub(r"[`*_#>]+", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


async def _edge_synth(text, voice):
    communicate = edge_tts.Communicate(text, voice)
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)


def synthesize(text, voice=None):
    """Metni MP3 baytlarına çevirir (edge-tts). voice verilmezse Türkçe kadın sesi."""
    voice = voice or config.TTS_VOICE_TR
    clean = _clean_for_tts(text)
    if not clean:
        return b""
    return asyncio.run(_edge_synth(clean, voice))


def _b64_data_uri(file_path):
    with open(file_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    ext = file_path.rsplit(".", 1)[-1].lower()
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    return f"data:{mime};base64,{data}"


def _tool_calls_to_dict(tool_calls):
    """Groq mesaj nesnesindeki tool_calls'u geçmişe eklenebilir dict'e çevirir."""
    return [
        {
            "id": tc.id,
            "type": "function",
            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
        }
        for tc in tool_calls
    ]


def chat(history, user_message):
    """history: [{'role': 'user'/'assistant', 'content': str}, ...]
    Groq metin modelinden yanıt döner. Gerekirse hava durumu aracını çağırır."""
    messages = [{"role": "system", "content": config.VERA_SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    resp = _client.chat.completions.create(
        model=config.GROQ_TEXT_MODEL,
        messages=messages,
        tools=_TOOLS,
        tool_choice="auto",
        temperature=0.7,
        max_tokens=1024,
    )
    msg = resp.choices[0].message

    # Model bir araç çağırmak istediyse: çalıştır, sonucu ver, tekrar sor.
    if msg.tool_calls:
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": _tool_calls_to_dict(msg.tool_calls),
        })
        for tc in msg.tool_calls:
            result = weather.run_tool(tc.function.name, tc.function.arguments)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })
        resp = _client.chat.completions.create(
            model=config.GROQ_TEXT_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        msg = resp.choices[0].message

    return (msg.content or "").strip()


def chat_stream(history, user_message):
    """chat() ile aynı, ama cevabı kelime kelime (parça parça) yield eder.

    Akış sırasında modelin araç (hava durumu) çağrısı yapıp yapmadığını izler:
      • Model doğrudan cevap yazarsa → delta'lar canlı akar (tek çağrı).
      • Model araç çağırırsa → araç çalıştırılır, sonuç modele verilir ve
        nihai cevap ikinci bir akışla yayınlanır.
    """
    messages = [{"role": "system", "content": config.VERA_SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    stream = _client.chat.completions.create(
        model=config.GROQ_TEXT_MODEL,
        messages=messages,
        tools=_TOOLS,
        tool_choice="auto",
        temperature=0.7,
        max_tokens=1024,
        stream=True,
    )

    tool_calls = {}   # index -> {"id", "name", "args"}
    content_seen = False
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            content_seen = True
            yield delta.content
        for tc in (delta.tool_calls or []):
            slot = tool_calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
            if tc.id:
                slot["id"] = tc.id
            if tc.function and tc.function.name:
                slot["name"] = tc.function.name
            if tc.function and tc.function.arguments:
                slot["args"] += tc.function.arguments

    # Model doğrudan yazdıysa iş bitti.
    if content_seen or not tool_calls:
        return

    # Araç çağrısı var: geçmişe ekle, araçları çalıştır, nihai cevabı akıt.
    ordered = [tool_calls[i] for i in sorted(tool_calls)]
    messages.append({
        "role": "assistant",
        "content": "",
        "tool_calls": [
            {"id": s["id"], "type": "function",
             "function": {"name": s["name"], "arguments": s["args"] or "{}"}}
            for s in ordered
        ],
    })
    for s in ordered:
        result = weather.run_tool(s["name"], s["args"])
        messages.append({
            "role": "tool",
            "tool_call_id": s["id"],
            "content": result,
        })

    stream2 = _client.chat.completions.create(
        model=config.GROQ_TEXT_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
        stream=True,
    )
    for chunk in stream2:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def _strip_think(text):
    """Reasoning modellerinin bıraktığı <think>...</think> bloklarını temizler."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    return text.strip()


def chat_with_image(image_path, user_message, history=None):
    """Görsel + metin. Vision modeli tek çağrıda görseli yorumlar."""
    text = user_message or "Bu görselde ne var? Detaylıca anlat."
    content = [
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": _b64_data_uri(image_path)}},
    ]
    messages = [
        {"role": "system", "content": config.VERA_SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]

    kwargs = dict(
        model=config.GROQ_VISION_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
    )
    # qwen gibi reasoning modellerinde düşünme çıktısını gizle;
    # gizli düşünme token'ları bütçeyi yediği için üst limiti yükselt
    if "qwen" in config.GROQ_VISION_MODEL.lower():
        kwargs["reasoning_format"] = "hidden"
        kwargs["max_tokens"] = 3072

    resp = _client.chat.completions.create(**kwargs)
    return _strip_think(resp.choices[0].message.content)


def transcribe(audio_path):
    """Ses dosyasını metne çevirir (Whisper)."""
    with open(audio_path, "rb") as f:
        resp = _client.audio.transcriptions.create(
            file=(audio_path, f.read()),
            model=config.GROQ_WHISPER_MODEL,
            language="tr",
            response_format="text",
        )
    # response_format='text' düz string döner
    return resp if isinstance(resp, str) else getattr(resp, "text", str(resp))


def suggest_title(user_message):
    """İlk mesajdan kısa bir sohbet başlığı üretir."""
    try:
        resp = _client.chat.completions.create(
            model=config.GROQ_TEXT_MODEL,
            messages=[
                {"role": "system", "content":
                    "Kullanıcının mesajı için en fazla 5 kelimelik, tırnaksız, kısa "
                    "bir başlık üret. Başlığı kullanıcının mesajıyla aynı dilde yaz "
                    "(mesaj İngilizceyse İngilizce, Türkçeyse Türkçe). Sadece başlığı yaz."},
                {"role": "user", "content": user_message},
            ],
            temperature=0.5,
            max_tokens=20,
        )
        return resp.choices[0].message.content.strip().strip('"')[:60]
    except Exception:
        return user_message[:40]
