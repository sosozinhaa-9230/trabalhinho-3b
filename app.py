import sqlite3, os, hashlib, hmac, json
from functools import wraps
from flask import Flask, request, session, jsonify, g, send_from_directory

app = Flask(__name__)
app.secret_key = os.environ.get("12345", "change-me")

DATABASE = "app.db"
N, R, P = 2**17, 8, 1 #OWASP standard hashing
MAXMEM = 256 * 1024 * 1024

def get_db():
    if "db" not in g:                       # asks if the db is already in use in this request to avoid errors
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db

@app.teardown_appcontext
def close_db(exception):                    # has to accept exception parameter as flask expects it
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    db = sqlite3.connect(DATABASE)
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
    db.commit()
    db.close()


def hash_password(password):
    salt = os.urandom(16)
    h = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, maxmem=MAXMEM)
    return salt.hex() + "$" + h.hex()

def check_password(password, stored):
    salt_hex, hash_hex = stored.split("$")
    h = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex),
                       n=N, r=R, p=P, maxmem=MAXMEM)
    return hmac.compare_digest(h.hex(), hash_hex)

def register(username, password):
    db = get_db()
    try:
        db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, hash_password(password)))
        db.commit()
        return True
    except sqlite3.IntegrityError:
        return False

def login(username, password):
    row = get_db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if row and check_password(password, row["password_hash"]):
        return row["id"]
    return None

def save_game(user_id, data):
    db = get_db()
    db.execute("""
        INSERT INTO saves (user_id, data) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE
        SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
    """, (user_id, json.dumps(data)))
    db.commit()

def load_game(user_id):
    row = get_db().execute("SELECT data FROM saves WHERE user_id = ?", (user_id,)).fetchone()
    return json.loads(row["data"]) if row else None

def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify(error="Not logged in"), 401 #401 unauthorized
        return view(*args, **kwargs)
    return wrapper

@app.post("/register")
def register_route():
    dict = request.get_json(silent=True) or {}
    username, password = dict.get("username"), dict.get("password")
    if not isinstance(username, str) or not isinstance(password, str) or not username:
        return jsonify(error="Need a username and a password"), 400 #400 bad request
    if not register(username, password):
        return jsonify(error="Username already taken"), 409 #409 username conflict
    return jsonify(ok=True), 201 #201 user created

@app.post("/login")
def login_route():
    dict = request.get_json(silent=True) or {}
    user_id = login(dict.get("username", ""), dict.get("password", ""))
    if user_id is None:
        return jsonify(error="Wrong username or password"), 401 #401 unauthorized
    session["user_id"] = user_id
    return jsonify(ok=True)

@app.post("/logout")
def logout_route():
    session.clear()
    return jsonify(ok=True)

@app.put("/save")
@login_required
def save_route():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify(error="Send JSON data"), 400 #400 bad request
    save_game(session["user_id"], data)
    return jsonify(ok=True)

@app.get("/save")
@login_required
def load_route():
    return jsonify(load_game(session["user_id"]))

@app.get("/me")
@login_required
def me_route():
    row = get_db().execute("SELECT username FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    if row is None:              # cookie is valid but the user no longer exists
        session.clear()
        return jsonify(error="Not logged in"), 401
    return jsonify(username=row["username"])

@app.get("/")
def index():
    return send_from_directory("static", "index.html")

print(app.url_map)
if __name__ == "__main__":
    init_db()
    app.run(debug=True)