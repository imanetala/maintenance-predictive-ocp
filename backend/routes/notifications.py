from flask import Blueprint, jsonify
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sys

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

notifications_bp = Blueprint('notifications', __name__)

# Identifiants lus depuis des variables d'environnement (jamais en dur dans le code)
EXPEDITEUR_EMAIL = os.environ.get("EMAIL_EXPEDITEUR", "")
EXPEDITEUR_MOT_DE_PASSE = os.environ.get("EMAIL_MOT_DE_PASSE", "")
DESTINATAIRE_EMAIL = os.environ.get("EMAIL_DESTINATAIRE", "")


def envoyer_email(sujet, corps):
    if not EXPEDITEUR_EMAIL or not EXPEDITEUR_MOT_DE_PASSE:
        print("❌ Variables d'environnement EMAIL_EXPEDITEUR / EMAIL_MOT_DE_PASSE non définies")
        return False
    try:
        message = MIMEMultipart()
        message["From"] = EXPEDITEUR_EMAIL
        message["To"] = DESTINATAIRE_EMAIL
        message["Subject"] = sujet
        message.attach(MIMEText(corps, "plain", "utf-8"))

        with smtplib.SMTP("smtp.gmail.com", 587) as serveur:
            serveur.starttls()
            serveur.login(EXPEDITEUR_EMAIL, EXPEDITEUR_MOT_DE_PASSE)
            serveur.send_message(message)
        return True
    except Exception as e:
        print(f"❌ Erreur envoi email : {e}")
        return False


@notifications_bp.route("/notifications/tester-email", methods=["POST"])
def tester_email():
    """Route de test pour vérifier que l'envoi d'email fonctionne."""
    succes = envoyer_email(
        "Test — Maintenance Prédictive OCP",
        "Ceci est un email de test envoyé depuis l'application."
    )
    if succes:
        return jsonify({"message": "Email envoyé avec succès"})
    return jsonify({"erreur": "Échec de l'envoi de l'email"}), 500