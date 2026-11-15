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
