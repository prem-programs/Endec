from pypdf import PdfReader, PdfWriter
import os
out_file_path = "out-encrypt.pdf"
password = "my-secret-password"

def encrypt_pdf(out_file_path:str,password:str):
    reader = PdfReader("/home/premjha/Projects/Endec/backend/clean_code.pdf")
    writer = PdfWriter(clone_from=reader)
    writer.encrypt(password, algorithm="AES-256-R5")

    # Save the new PDF to a file
    if os.path.exists(out_file_path):
        writer.write(out_file_path)
        print("file already exists! ")


def decrypt_pdf(out_file_path:str,password:str):
    reader = PdfReader(out_file_path)

    if reader.is_encrypted:
        reader.decrypt(password)  # secret password

    writer = PdfWriter(clone_from=reader)

    # Save the new PDF to a file
    writer.write("out-decrypt.pdf")

    
