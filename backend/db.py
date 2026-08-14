from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String,Text
from typing import Optional
from dotenv import load_dotenv
import os

load_dotenv()
class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)

# PostgreSQL Connection String Handling (Supports Railway's DATABASE_URL or individual env vars)
db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
else:
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "encrypter")
    db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Define Models
class Encryptedmessage(db.Model):
    __tablename__ = "encrypted_message"
    id: Mapped[int] = mapped_column(primary_key=True)
    emessage: Mapped[str] = mapped_column(Text)


# Create tables
with app.app_context():
    db.create_all()
