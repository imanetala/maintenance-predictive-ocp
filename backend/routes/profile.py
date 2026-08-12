from flask import Blueprint, request, jsonify, session
from flask_bcrypt import Bcrypt
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

profile_bp = Blueprint('profile', __name__)
bcrypt = Bcrypt()


@profile_bp.route("/profile", methods=["GET"])
def get_profile():
    """Recupere les informations du profil utilisateur connecte."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, nom_utilisateur, role, date_creation FROM utilisateurs WHERE id = %s",
            (session["utilisateur_id"],)
        )
        utilisateur = cursor.fetchone()
        cursor.close()
        connexion.close()

        if not utilisateur:
            return jsonify({"erreur": "Utilisateur non trouve"}), 404

        utilisateur["date_creation"] = utilisateur["date_creation"].strftime("%Y-%m-%d %H:%M:%S")
        return jsonify(utilisateur)

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@profile_bp.route("/profile", methods=["PUT"])
def update_profile():
    """Met a jour le profil utilisateur."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        donnees = request.get_json()
        connexion = obtenir_connexion()
        cursor = connexion.cursor()

        if "nom_utilisateur" in donnees:
            cursor.execute(
                "UPDATE utilisateurs SET nom_utilisateur = %s WHERE id = %s",
                (donnees["nom_utilisateur"], session["utilisateur_id"])
            )
            session["nom_utilisateur"] = donnees["nom_utilisateur"]

        connexion.commit()
        cursor.close()
        connexion.close()

        return jsonify({"message": "Profil mis a jour"})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@profile_bp.route("/profile/password", methods=["PUT"])
def change_password():
    """Change le mot de passe de l'utilisateur."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        donnees = request.get_json()
        ancien_mdp = donnees.get("ancien_mot_de_passe", "")
        nouveau_mdp = donnees.get("nouveau_mot_de_passe", "")

        if not ancien_mdp or not nouveau_mdp:
            return jsonify({"erreur": "Les deux mots de passe sont requis"}), 400

        if len(nouveau_mdp) < 6:
            return jsonify({"erreur": "Le nouveau mot de passe doit contenir au moins 6 caracteres"}), 400

        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT mot_de_passe_hash FROM utilisateurs WHERE id = %s", (session["utilisateur_id"],))
        utilisateur = cursor.fetchone()

        if not utilisateur or not bcrypt.check_password_hash(utilisateur["mot_de_passe_hash"], ancien_mdp):
            cursor.close()
            connexion.close()
            return jsonify({"erreur": "Mot de passe actuel incorrect"}), 403

        nouveau_hash = bcrypt.generate_password_hash(nouveau_mdp).decode('utf-8')
        cursor.execute("UPDATE utilisateurs SET mot_de_passe_hash = %s WHERE id = %s", (nouveau_hash, session["utilisateur_id"]))
        connexion.commit()
        cursor.close()
        connexion.close()

        return jsonify({"message": "Mot de passe change avec succes"})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
