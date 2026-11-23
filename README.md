# Endec 

> **Privacy-first, zero-knowledge secret sharing with client-side AES-256-GCM encryption, password-protected PDF attachments, and image steganography.**

Endec allows you to send confidential notes, passwords, API keys, and sensitive documents through self-destructing links or steganographic images. All encryption and decryption occur locally in the user's browser before data ever reaches the network. The server only ever handles encrypted ciphertext and never sees plaintext secrets or decryption keys.

---

## ✨ Features

- **🛡️ Zero-Knowledge Architecture**  
  Plaintext is encrypted and decrypted in the browser using the **Web Crypto API (AES-256-GCM)**. The decryption key is passed in the URL fragment (`#key`), which browsers never send to the server.
- **🖼️ Image Steganography**  
  Hide confidential messages inside lossless images. Drop any cover image to embed encrypted payloads or extract and decrypt hidden secrets with zero visual degradation.
- **📄 Encrypted PDF Attachments**  
  Attach and password-protect confidential PDF documents alongside messages using AES-256 encryption.
- **🔥 Burn-After-Reading**  
  Secrets self-destruct immediately after being viewed for one-time confidential handoffs.
- **⏳ Customizable Expiration (TTL)**  
  Configurable lifetime limits (1 hour, 24 hours, 7 days) with background cleanup of expired payloads and ephemeral files.
- **🗄️ Zero-Config Database**  
  Out-of-the-box local development using **SQLite** (`encrypter.db`) with zero setup, plus automatic seamless switching to **PostgreSQL** in production when `DATABASE_URL` is set.

---

## 🔒 Security Model

```
Sender Browser                         Endec Server / DB                       Recipient Browser
──────────────                         ─────────────────                       ─────────────────
Plaintext Message
       │
[PBKDF2 + AES-256-GCM]
       │
Ciphertext ───────────────────────────────► Stores only Ciphertext
Key in URL Hash (#key) ──(Never sent to server)────────────────────────────────────────► Key in Hash
                                                  │                                         │
                                                  └──────── Send Ciphertext ────────► [AES-256-GCM Decrypt]
                                                                                            │
                                                                                    Plaintext Message
```

1. **Key Derivation:** Client-side PBKDF2 with 100,000 iterations and a cryptographically random salt.
2. **Authenticated Encryption:** AES-256-GCM with a unique 96-bit Initialization Vector (IV) per message.
3. **Hash Fragment Isolation:** The decryption key is placed strictly in the URL hash fragment (`https://.../decoder#<key>`). Per RFC 3986, hash fragments are handled exclusively by the browser and are never transmitted in HTTP request headers.
4. **Encrypted Attachments:** PDFs are encrypted using AES-256 before disk storage; ephemeral files are purged immediately upon viewing or TTL expiration.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Modern dark-themed UI)
- **Cryptography:** Web Crypto API (`SubtleCrypto` — AES-GCM, PBKDF2)
- **Backend:** Python 3.12, Flask, Flask-SQLAlchemy, SQLAlchemy 2.0
- **Image Processing & Steganography:** Pillow, NumPy
- **PDF Security:** PyPDF (AES-256-R5)
- **Database:** SQLite (local fallback) / PostgreSQL (production via `psycopg` / `psycopg2`)
- **Server & Deployment:** Gunicorn WSGI, Docker, Render

---

## 📁 Project Structure

```text
Endec/
├── backend/
│   ├── app.py                # Flask application routes and API endpoints
│   ├── db.py                 # SQLAlchemy database setup and environment configuration
│   ├── models.py             # Database models (EncryptedMessage, EncryptedFileRecord)
│   ├── pdf_endec.py          # PDF encryption and decryption utilities
│   ├── stegano.py            # Image steganography (LSB encode/decode)
│   ├── static/
│   │   ├── css/style.css     # Dark mode stylesheet
│   │   └── js/
│   │       ├── crypto.js     # Client-side AES-GCM and PBKDF2 implementation
│   │       ├── encrypter.js  # Encryption UI controller
│   │       ├── decrypter.js  # Decryption UI controller
│   │       ├── pdf_encrypter.js # PDF attachment handler
│   │       ├── steg_encrypter.js# Steganography upload and preview handler
│   │       └── ui.js         # Theme and toast notifications
│   └── templates/
│       ├── index.html        # Encrypt page
│       └── decoder.html      # Decrypt & steganography dropzone page
├── tests/
│   ├── test_app.py           # API integration tests
│   ├── test_pdf_endec.py     # PDF encryption tests
│   └── test_stegano.py       # Steganography tests
├── Dockerfile                # Production container specification
├── .dockerignore             # Docker build exclusion rules
├── render.yaml               # Render Infrastructure-as-Code blueprint
├── requirements.txt          # Python dependencies
├── run.py                    # Local application entrypoint
├── pytest.ini                # Pytest configuration
└── README.md
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Python 3.10+ (Python 3.12 recommended)
- `pip` and virtual environment support

### 2. Installation

Clone the repository and set up a virtual environment:

```bash
git clone https://github.com/prem-programs/Endec.git
cd Endec

python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Running the App

Start the development server:

```bash
python run.py
```

Open **`http://localhost:5000`** in your browser.

> **Note:** By default, Endec uses a local SQLite database (`encrypter.db`). No database configuration or external server is required for local testing!

### 4. Running Tests

Run the full automated test suite:

```bash
pytest
```

---

## 🗄️ Database Configuration (Optional PostgreSQL)

To switch to PostgreSQL for production or local testing, provide a `DATABASE_URL` in an `.env` file (see `.env.example`):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/endec_db
```

Endec automatically detects the connection string and initializes all required tables and indexes.

---

## 🐳 Docker Usage

Build and run the container locally:

```bash
# Build the Docker image
docker build -t endec .

# Run with local SQLite storage
docker run -d -p 5000:5000 --name endec_app endec

# OR run connected to a PostgreSQL database
docker run -d -p 5000:5000 -e DATABASE_URL="postgresql://user:pass@host:5432/dbname" --name endec_app endec
```

Access the app at `http://localhost:5000`.

---

## ☁️ Deployment

### Deploying to Render (Recommended)

Endec includes a [`render.yaml`](render.yaml) blueprint that automatically provisions a web service and a private PostgreSQL database:

1. Push your repository to GitHub.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** &rarr; **Blueprint** and connect your `Endec` repository.
4. Render will automatically build the service with Gunicorn and configure the private PostgreSQL database.

---

## 📡 API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/secret` | Store encrypted message payload with TTL and burn preferences |
| `GET` | `/api/secret/<id>` | Retrieve encrypted payload (if not expired) |
| `POST` / `DELETE` | `/api/secret/<id>/burn` | Immediately destroy secret (burn-after-reading) |
| `POST` | `/api/upload-pdf` | Upload and encrypt an attached PDF file |
| `GET` | `/api/download/<file_id>` | Download an encrypted attachment |
| `POST` | `/api/steg/enc` | Encode a secret payload into an image |
| `POST` | `/api/steg/dec` | Extract and verify hidden payload from an image |
| `GET` | `/api/steg/download/<id>` | Download steganographic encoded image |

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
