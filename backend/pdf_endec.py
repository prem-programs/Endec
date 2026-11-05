from pypdf import PdfReader, PdfWriter
import os

def encrypt_pdf(input_pdf, out_file_path: str, password: str = None):
    """
    Encrypts a PDF with AES-256-R5.
    
    :param input_pdf: File path, file-like object, or Flask FileStorage
    :param out_file_path: Target path to save the encrypted PDF
    :param password: Password to protect the PDF
    """
    # If called with (input_pdf, password) positional args
    if password is None and isinstance(out_file_path, str) and not out_file_path.endswith('.pdf'):
        password = out_file_path
        out_file_path = "out-encrypt.pdf"

    # Handle Flask/Werkzeug FileStorage or file-like streams
    stream = input_pdf.stream if hasattr(input_pdf, "stream") else input_pdf
    reader = PdfReader(stream)
    writer = PdfWriter(clone_from=reader)
    writer.encrypt(password, algorithm="AES-256-R5")

    # Ensure parent directory exists and write file
    out_dir = os.path.dirname(out_file_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(out_file_path, "wb") as f:
        writer.write(f)

    return out_file_path

def decrypt_pdf(input_pdf, out_file_path: str, password: str):
    """
    Decrypts a PDF.
    
    :param input_pdf: File path, file-like object, or Flask FileStorage
    :param out_file_path: Target path to save the decrypted PDF
    :param password: Password to unlock the PDF
    """
    stream = input_pdf.stream if hasattr(input_pdf, "stream") else input_pdf
    reader = PdfReader(stream)

    if reader.is_encrypted:
        reader.decrypt(password)

    writer = PdfWriter(clone_from=reader)

    out_dir = os.path.dirname(out_file_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(out_file_path, "wb") as f:
        writer.write(f)

    return out_file_path
