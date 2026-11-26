import os
import pytest
from pypdf import PdfReader, PdfWriter
from backend.pdf_endec import encrypt_pdf, decrypt_pdf


@pytest.fixture
def sample_pdf(tmp_path):
    pdf_path = tmp_path / "sample.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    with open(pdf_path, "wb") as f:
        writer.write(f)
    return str(pdf_path)


def test_encrypt_and_decrypt_pdf(sample_pdf, tmp_path):
    enc_path = str(tmp_path / "encrypted.pdf")
    dec_path = str(tmp_path / "decrypted.pdf")
    password = "secret_password"

    # Encrypt PDF
    result_enc = encrypt_pdf(sample_pdf, enc_path, password)
    assert os.path.exists(result_enc)

    # Verify that the encrypted PDF cannot be read without password
    reader = PdfReader(result_enc)
    assert reader.is_encrypted

    # Decrypt PDF
    result_dec = decrypt_pdf(result_enc, dec_path, password)
    assert os.path.exists(result_dec)

    dec_reader = PdfReader(result_dec)
    assert not dec_reader.is_encrypted


def test_upload_pdf_expiry_and_purge(sample_pdf, monkeypatch):
    import io
    from backend.app import app
    from backend.db import db
    from backend.models import EncryptedFileRecord
    from datetime import datetime, timezone, timedelta

    client = app.test_client()

    with open(sample_pdf, "rb") as f:
        pdf_bytes = f.read()

    # 1. Upload PDF with 1 hour expiry
    res = client.post('/api/upload-pdf', data={
        'file': (io.BytesIO(pdf_bytes), 'sample.pdf'),
        'password': 'test_password',
        'expiry': '1'
    }, content_type='multipart/form-data')
    assert res.status_code == 200
    data = res.get_json()
    file_id = data['id']

    disk_path = None
    with app.app_context():
        record = db.session.get(EncryptedFileRecord, file_id)
        assert record is not None
        assert record.expires_at is not None
        disk_path = record.disk_path
        assert os.path.exists(disk_path)

        # Set expires_at in the past to simulate expiration
        record.expires_at = datetime.now(timezone.utc) - timedelta(hours=2)
        db.session.commit()

    # 2. Trigger purge through secret or direct call
    from backend.app import purge_expired
    with app.app_context():
        purge_expired()
        purged_record = db.session.get(EncryptedFileRecord, file_id)
        assert purged_record is None
        assert not os.path.exists(disk_path)

