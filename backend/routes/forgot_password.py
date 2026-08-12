from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
import secrets
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

forgot_password_bp = Blueprint('forgot_password', __name__)
bcrypt = Bcrypt()


@forgot_password_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    try:
        donnees = request.get_json(silent=True)
        if not donnees:
            return jsonify({"erreur": "Donnees invalides"}), 400

        nom_utilisateur = (donnees.get("nom_utilisateur") or "").strip()

        if not nom_utilisateur:
            return jsonify({"erreur": "Nom d'utilisateur requis"}), 400

        connexion = obtenir_connexion()
        if not connexion:
            return jsonify({"erreur": "Erreur de connexion a la base de donnees"}), 500

        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT id FROM utilisateurs WHERE nom_utilisateur = %s", (nom_utilisateur,))
        utilisateur = cursor.fetchone()

        if not utilisateur:
            cursor.close()
            connexion.close()
            return jsonify({"message": "Si ce compte existe, un code de reinitialisation a ete genere."})

        token = secrets.token_hex(32)
        expiry = datetime.now() + timedelta(minutes=15)

        cursor.execute(
            "UPDATE utilisateurs SET reset_token = %s, reset_token_expiry = %s WHERE id = %s",
            (token, expiry, utilisateur["id"])
        )
        connexion.commit()
        cursor.close()
        connexion.close()

        return jsonify({
            "message": "Code de reinitialisation genere.",
            "token": token
        })

    except Exception as e:
        return jsonify({"erreur": f"Erreur serveur: {str(e)}"}), 500


@forgot_password_bp.route("/reset-password", methods=["POST"])
def reset_password():
    try:
        donnees = request.get_json(silent=True)
        if not donnees:
            return jsonify({"erreur": "Donnees invalides"}), 400

        token = (donnees.get("token") or "").strip()
        nouveau_mdp = donnees.get("nouveau_mot_de_passe") or ""

        if not token or not nouveau_mdp:
            return jsonify({"erreur": "Le token et le nouveau mot de passe sont requis"}), 400

        if len(nouveau_mdp) < 6:
            return jsonify({"erreur": "Le mot de passe doit contenir au moins 6 caracteres"}), 400

        connexion = obtenir_connexion()
        if not connexion:
            return jsonify({"erreur": "Erreur de connexion a la base de donnees"}), 500

        cursor = connexion.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, reset_token_expiry FROM utilisateurs WHERE reset_token = %s",
            (token,)
        )
        utilisateur = cursor.fetchone()

        if not utilisateur:
            cursor.close()
            connexion.close()
            return jsonify({"erreur": "Code invalide ou deja utilise"}), 400

        if utilisateur["reset_token_expiry"] and utilisateur["reset_token_expiry"] < datetime.now():
            cursor.execute("UPDATE utilisateurs SET reset_token = NULL, reset_token_expiry = NULL WHERE id = %s", (utilisateur["id"],))
            connexion.commit()
            cursor.close()
            connexion.close()
            return jsonify({"erreur": "Ce code a expire. Demandez un nouveau code."}), 400

        nouveau_hash = bcrypt.generate_password_hash(nouveau_mdp).decode('utf-8')
        cursor.execute(
            "UPDATE utilisateurs SET mot_de_passe_hash = %s, reset_token = NULL, reset_token_expiry = NULL WHERE id = %s",
            (nouveau_hash, utilisateur["id"])
        )
        connexion.commit()
        cursor.close()
        connexion.close()

        return jsonify({"message": "Mot de passe reinitialise avec succes."})

    except Exception as e:
        return jsonify({"erreur": f"Erreur serveur: {str(e)}"}), 500
