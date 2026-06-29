# Endec

Endec is a privacy-first secret sharing app for sending short confidential notes, passwords, API keys, or recovery codes through a link. The message is encrypted in the browser before it ever leaves the sender's device, and the server stores only the ciphertext.

## What it does

1. Enter a message and choose a password, or let the app generate one automatically.
2. The browser encrypts the message locally with AES-GCM using a password-derived key.
3. The backend stores the encrypted payload and returns a shareable link.
4. The recipient opens the link, and the browser decrypts the message locally.

## Security model

- Encryption and decryption happen entirely in the browser.
- The server never receives the plaintext message or password.
- The password is embedded in the URL fragment, which is not sent to the server.
- The current implementation uses a PostgreSQL database configured through environment variables.

> This is a lightweight, portfolio-friendly version of the product. It focuses on browser-side encryption and secure link-based sharing rather than advanced expiry or burn-after-read features.

## Tech stack

- Frontend: HTML, CSS, and vanilla JavaScript
- Backend: Python and Flask
- Database: PostgreSQL (configured via environment variables)
- Crypto: Web Crypto API with AES-GCM and PBKDF2

## Project structure

```text
endec/
├── backend/
│   ├── app.py
│   ├── db.py
│   ├── static/
│   │   ├── css/
│   │   ├── js/
│   │   └── templates/
│   └── templates/
├── run.py
├── requirements.txt
└── README.md
```

## Local setup

1. Create and activate a Python environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set the required environment variables before running the app:

```bash
export DB_USER=your_db_user
export DB_PASSWORD=your_db_password
export DB_HOST=localhost
export DB_NAME=your_db_name
```

4. Start the app:

```bash
python run.py
```

The app will be available at http://localhost:5000.

## Current workflow

- Open the home page to encrypt a message.
- Use the decrypt page to manually decrypt an encrypted message with the correct password.
- Share the generated link with a recipient.

## Notes

The current implementation is intentionally simple and focuses on proving the core privacy model. Future work includes stronger link security, expiry handling, one-time access, and better production deployment support.

