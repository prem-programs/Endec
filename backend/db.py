from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String, Text, DateTime, Boolean, text
from typing import Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
import os


load_dotenv()
class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static"),
)

# PostgreSQL Connection String Handling (Supports Railway, Heroku, Render, Vercel Postgres, Neon, or local SQLite)
db_url = (
    os.getenv("DATABASE_URL")
    or os.getenv("DATABASE_PRIVATE_URL")
    or os.getenv("DATABASE_PUBLIC_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRESQL_URL")
)

if not db_url and os.getenv("PGHOST"):
    pghost = os.getenv("PGHOST")
    pguser = os.getenv("PGUSER", "postgres")
    pgpass = os.getenv("PGPASSWORD", "")
    pgport = os.getenv("PGPORT", "5432")
    pgdb = os.getenv("PGDATABASE", "railway")
    db_url = f"postgresql://{pguser}:{pgpass}@{pghost}:{pgport}/{pgdb}"

if not db_url:
    db_user = os.getenv("DB_USER")
    db_pass = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST")
    db_name = os.getenv("DB_NAME")
    if db_user and db_pass and db_host and db_name:
        db_url = f"postgresql://{db_user}:{db_pass}@{db_host}/{db_name}"
    else:
        # Fallback to SQLite (use writable /tmp on serverless environments like Vercel)
        if os.getenv("VERCEL"):
            db_url = "sqlite:////tmp/encrypter.db"
        else:
            db_url = "sqlite:///encrypter.db"

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Storage directory (uses /tmp on Vercel to respect read-only serverless filesystem)
if os.getenv("VERCEL"):
    STORAGE_DIR = "/tmp/ephemeral_storage"
else:
    STORAGE_DIR = os.path.join(os.getcwd(), "ephemeral_storage")
os.makedirs(STORAGE_DIR, exist_ok=True)

db.init_app(app)

# Create tables safely and ensure new columns exist
with app.app_context():
    try:
        import backend.models  # Register models before create_all
        db.create_all()
        with db.engine.connect() as conn:
            if db.engine.name == "postgresql":
                conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
                conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;"))
                conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN IF NOT EXISTS burn_after_reading BOOLEAN DEFAULT TRUE;"))
                conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT FALSE;"))
                conn.commit()
            elif db.engine.name == "sqlite":
                columns = [row[1] for row in conn.execute(text("PRAGMA table_info(encrypted_message);")).fetchall()]
                if "created_at" not in columns:
                    conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN created_at DATETIME;"))
                if "expires_at" not in columns:
                    conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN expires_at DATETIME;"))
                if "burn_after_reading" not in columns:
                    conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN burn_after_reading BOOLEAN DEFAULT 1;"))
                if "has_password" not in columns:
                    conn.execute(text("ALTER TABLE encrypted_message ADD COLUMN has_password BOOLEAN DEFAULT 0;"))
                conn.commit()
    except Exception as e:
        print(f"Database initialization warning: {e}")

