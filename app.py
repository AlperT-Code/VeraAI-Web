"""Vera Web — Flask uygulaması.

Çalıştırmak için:  python app.py
Ardından tarayıcıda:  http://localhost:5000
"""
import json
import os
import time
import uuid
from functools import wraps

from flask import (Flask, render_template, request, redirect, url_for,
                   session, jsonify, flash, Response)
from werkzeug.utils import secure_filename

import config
import database as db
import vera_ai

app = Flask(__name__)
app.secret_key = config.FLASK_SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_MB * 1024 * 1024
app.config["UPLOAD_FOLDER"] = config.UPLOAD_FOLDER

os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)
db.init_db()


# ─────────────────────────────────────────────────────────
#  Yardımcılar
# ─────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "oturum yok"}), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return wrapper


def _allowed(filename):
    return "." in filename and \
        filename.rsplit(".", 1)[1].lower() in config.ALLOWED_EXTENSIONS


def _save_upload(file_storage):
    """Yüklenen dosyayı benzersiz adla kaydeder; (web_yolu, tur) döner."""
    ext = file_storage.filename.rsplit(".", 1)[1].lower()
    name = f"{uuid.uuid4().hex}.{ext}"
    abs_path = os.path.join(config.UPLOAD_FOLDER, name)
    file_storage.save(abs_path)
    web_path = f"/static/uploads/{name}"
    media_type = "video" if ext in ("mp4", "webm", "mov") else "image"
    return web_path, media_type, abs_path


# ─────────────────────────────────────────────────────────
#  Kimlik doğrulama
# ─────────────────────────────────────────────────────────
@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("chat_page"))
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        if not username or not email or len(password) < 4:
            flash("Tüm alanları doldur, şifre en az 4 karakter olmalı.")
            return render_template("register.html")
        uid = db.create_user(username, email, password)
        if uid is None:
            flash("Bu e-posta zaten kayıtlı.")
            return render_template("register.html")
        session["user_id"] = uid
        session["username"] = username
        session["avatar"] = None
        return redirect(url_for("chat_page"))
    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        user = db.verify_login(email, password)
        if not user:
            flash("E-posta veya şifre hatalı.")
            return render_template("login.html")
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["avatar"] = user.get("avatar")
        return redirect(url_for("chat_page"))
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ─────────────────────────────────────────────────────────
#  Ana sayfa
# ─────────────────────────────────────────────────────────
@app.route("/chat")
@login_required
def chat_page():
    return render_template(
        "chat.html",
        username=session.get("username"),
        avatar=session.get("avatar"),
    )


# ─────────────────────────────────────────────────────────
#  API — profil (isim + avatar)
# ─────────────────────────────────────────────────────────
_IMAGE_EXTS = {"png", "jpg", "jpeg", "gif", "webp"}


@app.route("/api/profile", methods=["GET"])
@login_required
def api_get_profile():
    u = db.get_user(session["user_id"])
    if not u:
        return jsonify({"error": "kullanıcı yok"}), 404
    return jsonify({"username": u["username"], "email": u["email"], "avatar": u["avatar"]})


@app.route("/api/profile", methods=["POST"])
@login_required
def api_update_profile():
    username = (request.form.get("username") or "").strip()
    avatar_web = None

    file = request.files.get("avatar")
    if file and file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in _IMAGE_EXTS:
            return jsonify({"error": "Sadece resim yükleyebilirsin."}), 400
        avatar_web, _, _ = _save_upload(file)
    elif request.form.get("remove_avatar") == "1":
        avatar_web = ""   # update_profile boş string'i "kaldır" olarak yorumlar

    db.update_profile(session["user_id"], username=username or None, avatar=avatar_web)
    if username:
        session["username"] = username
    if avatar_web is not None:
        session["avatar"] = avatar_web or None

    u = db.get_user(session["user_id"])
    return jsonify({"ok": True, "username": u["username"], "avatar": u["avatar"]})


# ─────────────────────────────────────────────────────────
#  API — sohbet listesi
# ─────────────────────────────────────────────────────────
@app.route("/api/conversations")
@login_required
def api_conversations():
    convs = db.list_conversations(session["user_id"])
    for c in convs:
        c["updated_at"] = c["updated_at"].strftime("%d.%m.%Y %H:%M") if c["updated_at"] else ""
    return jsonify(convs)


@app.route("/api/conversations/<int:conv_id>/messages")
@login_required
def api_conv_messages(conv_id):
    if not db.owns_conversation(conv_id, session["user_id"]):
        return jsonify({"error": "yetki yok"}), 403
    msgs = db.get_messages(conv_id)
    for m in msgs:
        m["created_at"] = m["created_at"].strftime("%H:%M") if m["created_at"] else ""
    return jsonify(msgs)


@app.route("/api/conversations/<int:conv_id>", methods=["DELETE"])
@login_required
def api_delete_conv(conv_id):
    db.delete_conversation(conv_id, session["user_id"])
    return jsonify({"ok": True})


# ─────────────────────────────────────────────────────────
#  API — mesaj gönderme (metin + opsiyonel medya)
# ─────────────────────────────────────────────────────────
@app.route("/api/send", methods=["POST"])
@login_required
def api_send():
    user_id = session["user_id"]
    message = (request.form.get("message") or "").strip()
    reply_to = (request.form.get("reply_to") or "").strip()[:500] or None
    conv_id = request.form.get("conversation_id")
    conv_id = int(conv_id) if conv_id and conv_id.isdigit() else None

    media_web = media_type = media_abs = None
    file = request.files.get("media")
    if file and file.filename:
        if not _allowed(file.filename):
            return jsonify({"error": "Bu dosya türü desteklenmiyor."}), 400
        media_web, media_type, media_abs = _save_upload(file)

    if not message and not media_web:
        return jsonify({"error": "Boş mesaj."}), 400

    # Sohbet yoksa oluştur
    new_conv = False
    if conv_id is None or not db.owns_conversation(conv_id, user_id):
        title = vera_ai.suggest_title(message) if message else "Görsel sohbeti"
        conv_id = db.create_conversation(user_id, title)
        new_conv = True

    # Kullanıcı mesajını kaydet (varsa yanıtlanan mesajın alıntısıyla)
    db.add_message(conv_id, "user", message, media_web, media_type, reply_to)

    # Yanıtlanan mesaj varsa AI'ya bağlam olarak ver
    ai_message = message
    if reply_to:
        ai_message = f'(Şu mesaja yanıt veriyorum: "{reply_to}")\n\n{message}'

    # Yanıt üret
    try:
        if media_type == "image":
            answer = vera_ai.chat_with_image(media_abs, ai_message)
        elif media_type == "video":
            answer = ("Video yükledin ama şu an videoların içeriğini analiz "
                      "edemiyorum. İstersen ne hakkında olduğunu anlat, yardımcı olayım.")
        else:
            history = _build_history(conv_id)
            answer = vera_ai.chat(history, ai_message)
    except Exception as e:
        answer = f"Bir hata oluştu: {e}"

    db.add_message(conv_id, "assistant", answer)

    return jsonify({
        "conversation_id": conv_id,
        "new_conversation": new_conv,
        "answer": answer,
        "media_path": media_web,
        "media_type": media_type,
    })


@app.route("/api/stream", methods=["POST"])
@login_required
def api_stream():
    """Yalnızca metin sohbeti için akışlı (SSE) yanıt. Cevap kelime kelime döner.
    Görsel/video içeren mesajlar /api/send üzerinden gider (akış yok)."""
    user_id = session["user_id"]
    message = (request.form.get("message") or "").strip()
    reply_to = (request.form.get("reply_to") or "").strip()[:500] or None
    conv_id = request.form.get("conversation_id")
    conv_id = int(conv_id) if conv_id and conv_id.isdigit() else None

    if not message:
        return jsonify({"error": "Boş mesaj."}), 400

    # Sohbet yoksa oluştur (başlık şimdilik mesajdan; akış bitince güzelleştirilir)
    new_conv = False
    if conv_id is None or not db.owns_conversation(conv_id, user_id):
        conv_id = db.create_conversation(user_id, (message[:40] or "Yeni sohbet"))
        new_conv = True

    db.add_message(conv_id, "user", message, None, None, reply_to)

    ai_message = message
    if reply_to:
        ai_message = f'(Şu mesaja yanıt veriyorum: "{reply_to}")\n\n{message}'

    history = _build_history(conv_id)

    def _sse(event, payload):
        return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

    def generate():
        # Önce sohbet kimliğini gönder — arayüz durumu hemen güncellesin
        yield _sse("meta", {"conversation_id": conv_id, "new_conversation": new_conv})

        parts = []
        try:
            for delta in vera_ai.chat_stream(history, ai_message):
                parts.append(delta)
                yield _sse("delta", {"text": delta})
        except Exception as e:
            yield _sse("error", {"message": str(e)})

        answer = "".join(parts).strip()
        if answer:
            db.add_message(conv_id, "assistant", answer)

        # Yeni sohbette başlığı akış bittikten sonra üret (ilk cevabı geciktirmesin)
        title = None
        if new_conv:
            title = vera_ai.suggest_title(message)
            db.rename_conversation(conv_id, user_id, title)

        yield _sse("done", {"conversation_id": conv_id, "title": title})

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _build_history(conv_id, limit=20):
    """Son N mesajı Groq formatında döner (son eklenen kullanıcı mesajı hariç)."""
    msgs = db.get_messages(conv_id)
    hist = []
    for m in msgs[:-1][-limit:]:  # son eklenen user mesajını dışarıda bırak
        if m["content"]:
            hist.append({"role": m["role"], "content": m["content"]})
    return hist


# ─────────────────────────────────────────────────────────
#  API — sesli sohbet (ses → metin)
# ─────────────────────────────────────────────────────────
@app.route("/api/transcribe", methods=["POST"])
@login_required
def api_transcribe():
    file = request.files.get("audio")
    if not file:
        return jsonify({"error": "ses yok"}), 400
    tmp = os.path.join(config.UPLOAD_FOLDER, f"voice_{uuid.uuid4().hex}.webm")
    file.save(tmp)
    try:
        text = vera_ai.transcribe(tmp)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    return jsonify({"text": (text or "").strip()})


# ─────────────────────────────────────────────────────────
#  API — seslendirme (metin → ses, edge-tts / EmelNeural)
# ─────────────────────────────────────────────────────────
@app.route("/api/tts", methods=["POST"])
@login_required
def api_tts():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    lang = (data.get("lang") or "tr").lower()
    if not text:
        return jsonify({"error": "metin yok"}), 400
    voice = config.TTS_VOICE_EN if lang.startswith("en") else config.TTS_VOICE_TR
    try:
        audio = vera_ai.synthesize(text, voice)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    if not audio:
        return jsonify({"error": "ses üretilemedi"}), 500
    return Response(audio, mimetype="audio/mpeg")


def _open_browser():
    """Sunucu ayağa kalktıktan kısa süre sonra tarayıcıyı açar."""
    import threading
    import webbrowser

    def _launch():
        time.sleep(1.2)
        webbrowser.open("http://localhost:5000")

    threading.Thread(target=_launch, daemon=True).start()


if __name__ == "__main__":
    print("\n  Vera Web basliyor ->  http://localhost:5000\n")
    # debug reloader iki kez calisir; tarayiciyi yalnizca ana surecte ac
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        _open_browser()
    # threaded=True: akış (SSE) açıkken /api/tts gibi diğer istekler de aynı anda
    # yanıtlanabilsin; aksi halde sesli mod kilitlenir.
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
