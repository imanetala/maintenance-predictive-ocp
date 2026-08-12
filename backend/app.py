from flask import Flask, send_from_directory, Response
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from routes.predict import predict_bp
from routes.equipements import equipements_bp
from routes.stats import stats_bp
from routes.auth import auth_bp
from routes.alerts import alerts_bp
from routes.monitoring import monitoring_bp
from routes.notifications import notifications_bp
from routes.notifications_db import notifications_db_bp
from routes.traductions import traductions_bp
from routes.explain import explain_bp
from routes.register import register_bp
from routes.profile import profile_bp
from routes.settings import settings_bp
from routes.equipements_crud import equipements_crud_bp
from routes.analytics import analytics_bp
from routes.reports import reports_bp
from routes.ai_assistant import ai_assistant_bp
from routes.forgot_password import forgot_password_bp

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
PAGES_DIR = os.path.join(FRONTEND_DIR, "pages")

ALLOWED_PAGES = [
    "accueil", "dashboard", "prediction", "analytics", "historique",
    "monitoring", "alertes", "rapports", "parametres", "apropos"
]

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change_cette_cle_secrete_en_production")
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
CORS(app, supports_credentials=True, origins=[r"http://127.0.0.1:*", r"http://localhost:*"])

bcrypt = Bcrypt(app)

app.register_blueprint(predict_bp)
app.register_blueprint(equipements_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(alerts_bp)
app.register_blueprint(monitoring_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(notifications_db_bp)
app.register_blueprint(traductions_bp)
app.register_blueprint(explain_bp)
app.register_blueprint(register_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(equipements_crud_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(ai_assistant_bp)
app.register_blueprint(forgot_password_bp)


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/login")
def login_page():
    response = send_from_directory(FRONTEND_DIR, "login.html")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.route("/register")
def register_page():
    return send_from_directory(FRONTEND_DIR, "register.html")


@app.route("/pages/<page_name>")
def serve_page(page_name):
    if page_name in ALLOWED_PAGES:
        response = send_from_directory(PAGES_DIR, f"{page_name}.html")
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        return response
    return send_from_directory(PAGES_DIR, "error.html"), 404


@app.route("/css/<path:filename>")
def serve_css(filename):
    response = send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.route("/js/<path:filename>")
def serve_js(filename):
    response = send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.route("/images/<path:filename>")
def serve_image(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "images"), filename)


@app.route("/i18n/<path:filename>")
def serve_i18n(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "i18n"), filename)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
