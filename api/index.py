import sys
import os

# Add root directory to sys.path so 'backend' package is discoverable
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.app import app
    application = app
except Exception as e:
    import traceback
    err_tb = traceback.format_exc()
    print("FATAL IMPORT/STARTUP ERROR:", err_tb, file=sys.stderr)
    from flask import Flask
    app = Flask(__name__)
    
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        return f"<h3>Application Startup Error</h3><pre>{err_tb}</pre>", 500
    
    application = app
