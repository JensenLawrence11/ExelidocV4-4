"""
Entrypoint. Run with:
    flask --app app run --debug
or in production behind gunicorn:
    gunicorn app:app
"""
from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from routes.ai import ai_bp
from routes.stripe_routes import stripe_bp
from routes.auth import auth_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Only the origins listed in FRONTEND_ORIGINS may call this API
    # (your Excel task pane origin, your extension's chrome-extension:// id, your website)
    CORS(app, origins=Config.FRONTEND_ORIGINS, supports_credentials=True)

    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(stripe_bp, url_prefix="/api/stripe")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", service="exelidoc-backend")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
