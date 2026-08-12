"""Vera Web — MySQL veritabanı katmanı.

Uygulama açılışında veritabanını ve tabloları otomatik oluşturur.
"""
import mysql.connector
from mysql.connector import pooling
from werkzeug.security import generate_password_hash, check_password_hash

import config

_pool = None


# ─────────────────────────────────────────────────────────
#  Kurulum
# ─────────────────────────────────────────────────────────
def init_db():
    """vera_db veritabanını ve tabloları yoksa oluşturur, bağlantı havuzunu kurar."""
    # 1) Sunucuya (veritabanı seçmeden) bağlan ve veritabanını oluştur
    server = mysql.connector.connect(
        host=config.DB_HOST, port=config.DB_PORT,
        user=config.DB_USER, password=config.DB_PASSWORD,
    )
    cur = server.cursor()
    cur.execute(
        f"CREATE DATABASE IF NOT EXISTS {config.DB_NAME} "
        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    )
    server.commit()
    cur.close()
    server.close()

    # 2) Bağlantı havuzunu vera_db üzerinde kur
    global _pool
    _pool = pooling.MySQLConnectionPool(
        pool_name="vera_pool", pool_size=8,
        host=config.DB_HOST, port=config.DB_PORT,
        user=config.DB_USER, password=config.DB_PASSWORD,
        database=config.DB_NAME, charset="utf8mb4",
    )

    # 3) Tabloları oluştur
    conn = _pool.get_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            username     VARCHAR(80)  NOT NULL,
            email        VARCHAR(160) NOT NULL UNIQUE,
            password     VARCHAR(255) NOT NULL,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    # users tablosuna avatar sütunu (sonradan eklendi) — yoksa ekle
    cur.execute("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = %s AND table_name = 'users' AND column_name = 'avatar'
    """, (config.DB_NAME,))
    if cur.fetchone()[0] == 0:
        cur.execute("ALTER TABLE users ADD COLUMN avatar VARCHAR(500) DEFAULT NULL")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_id      INT NOT NULL,
            title        VARCHAR(255) DEFAULT 'Yeni sohbet',
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id  INT NOT NULL,
            role             ENUM('user','assistant') NOT NULL,
            content          MEDIUMTEXT,
            media_path       VARCHAR(500) DEFAULT NULL,
            media_type       VARCHAR(20)  DEFAULT NULL,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    # messages tablosuna reply_to sütunu (WhatsApp tarzı yanıt alıntısı) — yoksa ekle
    cur.execute("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = %s AND table_name = 'messages' AND column_name = 'reply_to'
    """, (config.DB_NAME,))
    if cur.fetchone()[0] == 0:
        cur.execute("ALTER TABLE messages ADD COLUMN reply_to VARCHAR(500) DEFAULT NULL")

    conn.commit()
    cur.close()
    conn.close()
    print("[DB] vera_db hazir - tablolar olusturuldu/dogrulandi.")


def _conn():
    return _pool.get_connection()


# ─────────────────────────────────────────────────────────
#  Kullanıcılar
# ─────────────────────────────────────────────────────────
def create_user(username, email, password):
    """Yeni kullanıcı oluşturur. Başarılıysa user_id döner, e-posta varsa None."""
    conn = _conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
            (username, email, generate_password_hash(password)),
        )
        conn.commit()
        return cur.lastrowid
    except mysql.connector.IntegrityError:
        return None
    finally:
        cur.close()
        conn.close()


def get_user_by_email(email):
    conn = _conn()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def verify_login(email, password):
    """E-posta + şifre doğruysa kullanıcı satırını döner, yoksa None."""
    user = get_user_by_email(email)
    if user and check_password_hash(user["password"], password):
        return user
    return None


def get_user(user_id):
    """Profil için gereken alanları döner (şifre hariç)."""
    conn = _conn()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT id, username, email, avatar FROM users WHERE id = %s",
        (user_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def update_profile(user_id, username=None, avatar=None):
    """İsim ve/veya avatar günceller. avatar='' ise fotoğrafı kaldırır."""
    fields, vals = [], []
    if username:
        fields.append("username = %s")
        vals.append(username[:80])
    if avatar is not None:
        fields.append("avatar = %s")
        vals.append(avatar or None)
    if not fields:
        return
    vals.append(user_id)
    conn = _conn()
    cur = conn.cursor()
    cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", vals)
    conn.commit()
    cur.close()
    conn.close()


# ─────────────────────────────────────────────────────────
#  Sohbetler
# ─────────────────────────────────────────────────────────
def create_conversation(user_id, title="Yeni sohbet"):
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO conversations (user_id, title) VALUES (%s, %s)",
        (user_id, title),
    )
    conn.commit()
    cid = cur.lastrowid
    cur.close()
    conn.close()
    return cid


def list_conversations(user_id):
    conn = _conn()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT id, title, updated_at FROM conversations "
        "WHERE user_id = %s ORDER BY updated_at DESC",
        (user_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def rename_conversation(conv_id, user_id, title):
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE conversations SET title = %s WHERE id = %s AND user_id = %s",
        (title[:255], conv_id, user_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def delete_conversation(conv_id, user_id):
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM conversations WHERE id = %s AND user_id = %s",
        (conv_id, user_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def owns_conversation(conv_id, user_id):
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM conversations WHERE id = %s AND user_id = %s",
        (conv_id, user_id),
    )
    ok = cur.fetchone() is not None
    cur.close()
    conn.close()
    return ok


# ─────────────────────────────────────────────────────────
#  Mesajlar
# ─────────────────────────────────────────────────────────
def add_message(conv_id, role, content, media_path=None, media_type=None, reply_to=None):
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO messages (conversation_id, role, content, media_path, media_type, reply_to) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (conv_id, role, content, media_path, media_type, (reply_to or None)),
    )
    # sohbetin updated_at'ini tazele
    cur.execute(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = %s",
        (conv_id,),
    )
    conn.commit()
    mid = cur.lastrowid
    cur.close()
    conn.close()
    return mid


def get_messages(conv_id):
    conn = _conn()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT role, content, media_path, media_type, reply_to, created_at "
        "FROM messages WHERE conversation_id = %s ORDER BY id ASC",
        (conv_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows
