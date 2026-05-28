# Endec - Secure Message Encrypter & Decrypter

**Endec** is a modern, web-based encryption application that allows users to encrypt secret messages and share them securely using a link. 

Unlike traditional server-side encryption tools, Endec utilizes **Client-Side End-to-End Encryption (E2EE)**. The encryption and decryption happen entirely in the browser using the Web Crypto API (AES-GCM). The backend server only ever receives and stores the unreadable ciphertext, ensuring maximum privacy.

---

## Real-Life Use Case

Need to send a password, API key, or confidential note to a colleague or friend and can't trust your messaging app ? 
1. Type your message into the Endec Encrypter and provide a password (or let it auto-generate one).
2. Endec encrypts the text in your browser and generates a secure, shareable link.
3. Send the link to your recipient. When they open it, their browser extracts the password from the URL hash, fetches the ciphertext from the database, and decrypts the message locally.

---

## Features

- **True Client-Side Encryption:** Utilizes AES-GCM 256-bit encryption via the browser's native Web Crypto API.
- **Secure Shareable Links:** Passwords are included in the URL fragment (`#`), which is never transmitted to the server.
- **Flask & SQLite Backend:** A lightweight Python backend that acts purely as a secure pastebin for the ciphertext.
- **Modern Glassmorphism UI:** A sleek, responsive, and animated user interface.
- **One-Click Copy:** Easily copy shareable links, raw ciphertexts, and decrypted messages.

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Web Crypto API)
- **Backend:** Python, Flask, Flask-SQLAlchemy
- **Database:** SQLite

---

## Project Structure

```text
Endec/
├── app.py                 # Main Flask application and API routes
├── requirements.txt       # Python dependencies
├── instance/
│   └── messages.db        # SQLite database for storing ciphertext
├── static/
│   ├── css/
│   │   ├── style.css      # Styles for the Encrypter page
│   │   └── styleD.css     # Styles for the Decrypter page
│   └── js/
│       └── script.js      # Client-side AES-GCM encryption/decryption logic
└── templates/
    ├── index.html         # Encrypter UI
    └── decoder.html       # Decrypter UI
```

