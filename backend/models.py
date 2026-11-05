# Define Models
from sqlalchemy import Integer, String, Text, DateTime, Boolean, text
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from backend.db import db


class Encryptedmessage(db.Model):
    __tablename__ = "encrypted_message"
    id: Mapped[int] = mapped_column(primary_key=True)
    emessage: Mapped[str] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    burn_after_reading: Mapped[bool] = mapped_column(Boolean, default=True)
    has_password: Mapped[bool] = mapped_column(Boolean, default=False)

class EncryptedFileRecord(db.Model):
    __tablename__ = "encrypted_files"

    id = db.Column(db.String(36), primary_key=True)  # UUID
    original_filename = db.Column(db.String(255), nullable=False)
    disk_path = db.Column(db.String(512), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)