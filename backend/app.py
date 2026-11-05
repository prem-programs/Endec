from flask import render_template, request, jsonify
from backend.db import db, Encryptedmessage, app
from datetime import datetime, timezone, timedelta

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

@app.route('/api/pdf/<uid>')
def encrypt_pdf(uid:int):
        