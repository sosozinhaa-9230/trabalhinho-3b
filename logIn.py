import sqlite3, os, hashlib, hmac, json


db = sqlite3.connect("app.db")
db.row_factory = sqlite3.Row
db.execute("PRAGMA foreign_keys = ON")

db.executescript("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saves (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
""")

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    h = hashlib.scrypt(password.encode(), salt=salt, n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024) #valores recomendados da OWASP
    return salt.hex() + "$" + h.hex()

def check_password(password: str, stored: str) -> bool:
    salt_hex, hash_hex = stored.split("$")
    h = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024)
    return hmac.compare_digest(h.hex(), hash_hex)

def register(username, password):
    if not username:
        return False
    try:
        db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", # using "?" to help prevent sql injection
                   (username, hash_password(password)))
        db.commit()
        return True
    except sqlite3.IntegrityError: #check if username already exists
        return False

def login(username, password):
    row = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if row and check_password(password, row["password_hash"]):
        return row["id"]
    return None

def save_game(user_id, data: dict):
    db.execute("""
        INSERT INTO saves (user_id, data) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE
        SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
    """, (user_id, json.dumps(data)))
    db.commit()

def load_game(user_id):
    row = db.execute("SELECT data FROM saves WHERE user_id = ?", (user_id,)).fetchone()
    return json.loads(row["data"]) if row else None

savedata = {
    "level": 2,
    "weapon": "pistol"
}

match input("choose option:").lower():
    case "register":
        register(input("username: "), input("password: "))
    case "login":
        userId = login(input("username: "), input("password: "))
        print(userId)
    case "save":
        save_game(login(input("username: "), input("password: ")), savedata)
    case "load":
        print(load_game(login(input("username: "), input("password: "))))