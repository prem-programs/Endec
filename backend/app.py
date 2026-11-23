from flask import render_template, request, jsonify,send_file
from backend.db import db, app, STORAGE_DIR
from backend.models import Encryptedmessage,EncryptedFileRecord
from datetime import datetime, timezone, timedelta
from backend.pdf_endec import encrypt_pdf,decrypt_pdf
from backend.stegano import  encode_message,decode_message
import uuid
import os
import requests


def _ensure_utc(dt):
    """Ensure a datetime object is timezone-aware in UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def purge_expired():
    """Purge expired records and ephemeral images from storage."""
    try:
        now = datetime.now(timezone.utc)
        # Handle both PostgreSQL (aware) and SQLite (naive string/timestamp)
        now_naive = now.replace(tzinfo=None)
        expired_msgs = db.session.query(Encryptedmessage).filter(
            Encryptedmessage.expires_at.isnot(None),
            (Encryptedmessage.expires_at < now) | (Encryptedmessage.expires_at < now_naive)
        ).all()
        for msg in expired_msgs:
            img_path = os.path.join(STORAGE_DIR, f"encoded_{msg.id}.png")
            if os.path.exists(img_path):
                try:
                    os.remove(img_path)
                except OSError:
                    pass
            db.session.delete(msg)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Purge expired records warning: {e}")

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.errorhandler(500)
def handle_500(e):
    import traceback
    return f"<h3>500 Internal Server Error</h3><pre>{traceback.format_exc()}</pre>", 500

@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html')

@app.route('/decoder', methods=['GET'])
@app.route('/decrypter', methods=['GET'])
def decoder():
    return render_template('decoder.html')

@app.route('/secret', methods=['POST'])
def secret():
    purge_expired()
    data = request.get_json(silent=True)
    
    if not data or not data.get('message'):
        return jsonify({"message": "No message found!"}), 400

    msg = data.get('message')
    exp_hours = data.get('expiry', 1)
    burn = data.get('burn', True)
    has_password = data.get('has_password', False)

    now = datetime.now(timezone.utc)
    try:
        exp_hours_float = float(exp_hours)
    except (TypeError, ValueError):
        exp_hours_float = 1.0

    expires_at = now + timedelta(hours=exp_hours_float)

    emsg = Encryptedmessage(
        emessage=msg,
        created_at=now,
        expires_at=expires_at,
        burn_after_reading=bool(burn),
        has_password=bool(has_password)
    )

    try:
        db.session.add(emsg)
        db.session.commit()
        return jsonify({
            "id": emsg.id,
            "message": emsg.emessage,
            "has_password": emsg.has_password,
            "burn_after_reading": emsg.burn_after_reading,
            "expires_at": emsg.expires_at.isoformat() if emsg.expires_at else None
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error saving secret: {e}")
        return jsonify({"message": "Failed to store secret"}), 500

@app.route('/api/secret/<string:uid>', methods=['GET'])
def get_secret(uid):
    now = datetime.now(timezone.utc)
    enc_message = db.session.get(Encryptedmessage, uid)

    if not enc_message:
        return jsonify({
            "error": "Secret not found or has already been destroyed."
        }), 404

    expires_at = _ensure_utc(enc_message.expires_at)
    created_at = _ensure_utc(enc_message.created_at)

    # Check if this secret has expired
    if expires_at and expires_at < now:
        try:
            db.session.delete(enc_message)
            db.session.commit()
        except Exception:
            db.session.rollback()
        return jsonify({
            "error": "This secret has expired and is no longer available."
        }), 410

    # Purge other expired records
    purge_expired()

    return jsonify({
        "id": enc_message.id,
        "emessage": enc_message.emessage,
        "has_password": bool(enc_message.has_password),
        "burn_after_reading": bool(enc_message.burn_after_reading),
        "created_at": created_at.isoformat() if created_at else None,
        "expires_at": expires_at.isoformat() if expires_at else None
    })

@app.route('/api/secret/<string:uid>/burn', methods=['POST', 'DELETE'])
@app.route('/api/del/<string:uid>', methods=['DELETE', 'POST'])
def cleanup(uid):
    msg_to_delete = db.session.get(Encryptedmessage, uid)

    # Purge associated steganography image if present
    img_path = os.path.join(STORAGE_DIR, f"encoded_{uid}.png")
    if os.path.exists(img_path):
        try:
            os.remove(img_path)
        except OSError:
            pass

    if msg_to_delete:
        try:
            db.session.delete(msg_to_delete)
            db.session.commit()
            return jsonify({"message": "Secret burned successfully", "success": True}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500
    return jsonify({"message": "Not found or already burned", "success": False}), 404

# User A uploads -> Server encrypts -> Saves UUID in Postgres -> Returns link
@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    file = request.files.get("file")
    password = request.form.get('password')


    if not file or not password:
        return jsonify({"error": "Both a PDF file and a password are required."}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Provide pdf file only."}), 400

    try:
        file_id = str(uuid.uuid4())
        dest_path = os.path.join(STORAGE_DIR, f"{file_id}.pdf")
        encrypt_pdf(file, dest_path, password)

        record = EncryptedFileRecord(
            id=file_id,
            original_filename=file.filename,
            disk_path=dest_path
        )
        db.session.add(record)
        db.session.commit()

        # shareable dynamic url 
        download_url = f"{request.host_url}api/download/{file_id}"

        return jsonify({
            "success": True,
            "id": file_id,
            "link": download_url
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Encryption Failed | {e}"}), 500

@app.route("/api/download/<file_id>", methods=['GET'])
def download_pdf(file_id):
    record = db.session.get(EncryptedFileRecord, file_id)

    if not record or not os.path.exists(record.disk_path):
        return jsonify({"error": "This file has already been downloaded and destroyed, or it never existed."}), 404
    
    disk_path = record.disk_path
    download_name = f"encrypted_{record.original_filename}"

    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()

    # Stream the binary to the receiver
    response = send_file(
        disk_path,
        as_attachment=True,
        download_name=download_name,
        mimetype="application/pdf"
    )

    # Delete physical file from disk as soon as the stream finishes
    @response.call_on_close
    def cleanup():
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except OSError as err:
                print(f"Error purging file: {err}")

    return response

# ── Steganography Endpoints ──────────────────────────────────────────────────
# Encoding: Embed secret UID into image pixels & store encrypted message in DB
@app.route("/api/steg/enc", methods=['POST'])
def ste_image():
    purge_expired()
    s_img = request.files.get("image") or request.files.get("s_img")
    s_message = request.form.get("message") or request.form.get("s_message")

    if not s_message and request.is_json:
        data = request.get_json(silent=True) or {}
        s_message = data.get("s_message") or data.get("message")

    if not s_message or not str(s_message).strip():
        return jsonify({"error": "Please provide a secret message to hide."}), 400

    if not s_img or not s_img.filename:
        return jsonify({"error": "Please provide a carrier image (PNG, JPG, etc.)."}), 400

    exp_hours = request.form.get("expiry", 1)
    burn_val = request.form.get("burn")
    burn = True if burn_val is None else (str(burn_val).lower() in ("true", "1", "yes", "on"))
    has_password_val = request.form.get("has_password", False)
    has_password = (str(has_password_val).lower() in ("true", "1", "yes", "on"))

    now = datetime.now(timezone.utc)
    try:
        exp_hours_float = float(exp_hours)
    except (TypeError, ValueError):
        exp_hours_float = 1.0

    expires_at = now + timedelta(hours=exp_hours_float)

    emsg = Encryptedmessage(
        emessage=str(s_message).strip(),
        created_at=now,
        expires_at=expires_at,
        burn_after_reading=bool(burn),
        has_password=bool(has_password)
    )

    try:
        db.session.add(emsg)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to store secret: {e}"}), 500

    uid = emsg.id
    output_image_path = os.path.join(STORAGE_DIR, f"encoded_{uid}.png")

    try:
        encode_message(s_img, str(uid), output_image_path)
    except Exception as e:
        # Roll back record if image encoding fails
        try:
            db.session.delete(emsg)
            db.session.commit()
        except Exception:
            db.session.rollback()
        return jsonify({"error": f"Failed to encode secret into image: {e}"}), 400

    download_url = f"/api/steg/download/{uid}"

    return jsonify({
        "success": True,
        "id": uid,
        "download_url": download_url,
        "filename": f"encoded_{uid}.png",
        "result": {
            "id": uid,
            "has_password": emsg.has_password,
            "burn_after_reading": emsg.burn_after_reading,
            "expires_at": emsg.expires_at.isoformat() if emsg.expires_at else None
        }
    }), 201


# Download encoded image
@app.route("/api/steg/download/<string:uid>", methods=['GET'])
def download_steg_image(uid):
    image_path = os.path.join(STORAGE_DIR, f"encoded_{uid}.png")
    if not os.path.exists(image_path):
        return jsonify({"error": "This encoded image has already been downloaded and destroyed, or it never existed."}), 404

    enc_message = db.session.get(Encryptedmessage, uid)
    if not enc_message:
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except OSError:
                pass
        return jsonify({"error": "The secret in this image has expired or was already destroyed."}), 404

    return send_file(
        image_path,
        as_attachment=True,
        download_name=f"encoded_{uid}.png",
        mimetype="image/png"
    )


# Decoding: Extract UID from image pixels & retrieve secret
@app.route("/api/steg/dec", methods=['POST'])
def ste_message():
    purge_expired()
    img = request.files.get("image") or request.files.get("img")

    if not img or not img.filename:
        return jsonify({"error": "Please provide an encoded image file to decode."}), 400

    try:
        decoded_payload = decode_message(img)
    except Exception as e:
        return jsonify({"error": f"Failed to extract secret from image: {e}"}), 400

    try:
        uid = str(decoded_payload).strip()
    except (ValueError, TypeError):
        return jsonify({"error": "No valid Endec secret UID found in this image."}), 400

    enc_message = db.session.get(Encryptedmessage, uid)
    if not enc_message:
        return jsonify({"error": "Secret not found or has already been burned/expired."}), 404

    now = datetime.now(timezone.utc)
    expires_at = _ensure_utc(enc_message.expires_at)
    created_at = _ensure_utc(enc_message.created_at)

    if expires_at and expires_at < now:
        try:
            db.session.delete(enc_message)
            db.session.commit()
        except Exception:
            db.session.rollback()
        # Clean up image on disk
        image_path = os.path.join(STORAGE_DIR, f"encoded_{uid}.png")
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except OSError:
                pass
        return jsonify({"error": "This secret has expired and is no longer available."}), 410

    return jsonify({
        "success": True,
        "uid": uid,
        "secret": {
            "id": enc_message.id,
            "emessage": enc_message.emessage,
            "has_password": bool(enc_message.has_password),
            "burn_after_reading": bool(enc_message.burn_after_reading),
            "created_at": created_at.isoformat() if created_at else None,
            "expires_at": expires_at.isoformat() if expires_at else None
        }
    }), 200