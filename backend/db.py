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

# PostgreSQL Connection String
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{os.getenv("DB_USER")}:{os.getenv("DB_PASSWORD")}@{os.getenv("DB_HOST")}/{os.getenv("DB_NAME")}"
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
