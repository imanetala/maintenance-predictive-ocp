from flask import Blueprint, request, jsonify, session
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

settings_bp = Blueprint('settings', __name__)


@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    """Recupere les parametres de l'utilisateur."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT * FROM parametres WHERE utilisateur_id = %s", (session["utilisateur_id"],))
        params = cursor.fetchone()
        cursor.close()
        connexion.close()

        if not params:
            return jsonify({
                "seuil_alerte": 0.71,
                "langue": "fr",
                "theme": "light",
                "email_notifications": True
            })

        params["date_modification"] = params["date_modification"].strftime("%Y-%m-%d %H:%M:%S")
        return jsonify(params)

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@settings_bp.route("/settings", methods=["PUT"])
def update_settings():
    """Met a jour les parametres de l'utilisateur."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        donnees = request.get_json()
        connexion = obtenir_connexion()
        cursor = connexion.cursor()

        cursor.execute("SELECT id FROM parametres WHERE utilisateur_id = %s", (session["utilisateur_id"],))
        existe = cursor.fetchone()

        if existe:
            cursor.execute("""
                UPDATE parametres SET seuil_alerte = %s, langue = %s, theme = %s, email_notifications = %s
                WHERE utilisateur_id = %s
            """, (
                donnees.get("seuil_alerte", 0.71),
                donnees.get("langue", "fr"),
                donnees.get("theme", "light"),
                donnees.get("email_notifications", True),
                session["utilisateur_id"]
            ))
        else:
            cursor.execute("""
                INSERT INTO parametres (utilisateur_id, seuil_alerte, langue, theme, email_notifications)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                session["utilisateur_id"],
                donnees.get("seuil_alerte", 0.71),
                donnees.get("langue", "fr"),
                donnees.get("theme", "light"),
                donnees.get("email_notifications", True)
            ))

        connexion.commit()
        cursor.close()
        connexion.close()

        return jsonify({"message": "Parametres sauvegardes"})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
