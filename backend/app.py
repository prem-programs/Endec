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
    """Purge expired records from the database."""
    try:
        now = datetime.now(timezone.utc)
        # Handle both PostgreSQL (aware) and SQLite (naive string/timestamp)
        now_naive = now.replace(tzinfo=None)
        db.session.query(Encryptedmessage).filter(
            Encryptedmessage.expires_at.isnot(None),
            (Encryptedmessage.expires_at < now) | (Encryptedmessage.expires_at < now_naive)
        ).delete(synchronize_session=False)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Purge expired records warning: {e}")

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

@app.route('/api/secret/<int:uid>', methods=['GET'])
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

@app.route('/api/secret/<int:uid>/burn', methods=['POST', 'DELETE'])
@app.route('/api/del/<int:uid>', methods=['DELETE', 'POST'])
def cleanup(uid):
    msg_to_delete = db.session.get(Encryptedmessage, uid)
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

# image + message => image & message enc => 
@app.route("/api/steg/enc", methods=['POST'])
def ste_image():
    s_img = request.files.get("image") or request.files.get("s_img")
    s_message = request.form.get("message") or request.form.get("s_message")

    if not s_message and request.is_json:
        data = request.get_json(silent=True) or {}
        s_message = data.get("s_message") or data.get("message")

    if not s_message:
        return jsonify({"error": "Provide message"}), 400

    # encrypting using /secret endpoint
    with app.test_client() as client:
        response = client.post(
            "/secret",
            json={
                "message": s_message,
                "expiry": 1,
                "burn": True,
                "has_password": False
            }
        )
        result = response.get_json()

    
    uid_payload = result.get("id")

    if s_img:
        input_image_path = os.path.join(STORAGE_DIR, f"temp_{uuid.uuid4().hex}.png")
        s_img.save(input_image_path)
    else:
        input_image_path = "image.png"

    output_image_path = os.path.join(STORAGE_DIR, f"encoded_{uid_payload}.png")
    encode_message(input_image_path, f"{uid_payload}", output_image_path)

    # Clean up input file to free disk space
    if os.path.exists(input_image_path):
        os.remove(input_image_path)

    return jsonify({
        "success": True,
        "id": uid_payload,
        "encoded_image": output_image_path,
        "result": result
    }), 200


# image => extract hidden message => return decoded message
@app.route("/api/steg/dec", methods=['POST'])
def ste_message():
    
    img = request.files.get("image") or request.files.get("img")

    if img:
        temp_path = os.path.join(STORAGE_DIR, f"dec_input_{uuid.uuid4().hex}.png")
        img.save(temp_path)
        image_path = temp_path
    elif uid:
        image_path = os.path.join(STORAGE_DIR, f"encoded_{uid}.png")
        temp_path = None
    else:
        return jsonify({"error": "Provide an image file or a valid uid"}), 400

    if not os.path.exists(image_path):
        return jsonify({"error": "Image file not found"}), 404

    try:
        decoded_message = decode_message(image_path)
    except Exception as e:
        return jsonify({"error": f"Failed to decode image: {e}"}), 400
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

    secret_data = None
    if uid:
        with app.test_client() as client:
            res = client.get(f"/api/secret/{uid}")
            if res.status_code == 200:
                secret_data = res.get_json()

    return jsonify({
        "success": True,
        "decoded_message": decoded_message,
        "secret": secret_data
    }), 200