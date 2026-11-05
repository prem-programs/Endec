import time,datetime
import threading
import os
from backend.db import db
from backend.models import EncryptedFileRecord
from backend.app import app

def sweep_expired_files():
    """Runs periodically to purge unretrieved files older than 24 hours."""
    while True:
        time.sleep(3600) 
        with app.app_context():
            cutoff = datetime.utcnow().timestamp() - (24 * 3600)
            records = EncryptedFileRecord.query.all()
            for rec in records:
                if rec.created_at.timestamp() < cutoff:
                    if os.path.exists(rec.disk_path):
                        os.remove(rec.disk_path)
                    db.session.delete(rec)
            db.session.commit()

# Start cleaner daemon
cleaner_thread = threading.Thread(target=sweep_expired_files, daemon=True)
cleaner_thread.start()