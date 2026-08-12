from flask import Blueprint, request, jsonify, session
from flask_bcrypt import Bcrypt
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

register_bp = Blueprint('register', __name__)
bcrypt = Bcrypt()


@register_bp.route("/register", methods=["POST"])
def register():
    """Inscription d'un nouvel utilisateur."""
    try:
        donnees = request.get_json()
        nom_utilisateur = donnees.get("nom_utilisateur", "").strip()
        mot_de_passe = donnees.get("mot_de_passe", "")
        email = donnees.get("email", "").strip()
        role = donnees.get("role", "technicien")

        if not nom_utilisateur or not mot_de_passe:
            return jsonify({"erreur": "Nom d'utilisateur et mot de passe requis"}), 400

        if len(mot_de_passe) < 6:
            return jsonify({"erreur": "Le mot de passe doit contenir au moins 6 caracteres"}), 400

        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion a la base impossible"}), 500

        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT id FROM utilisateurs WHERE nom_utilisateur = %s", (nom_utilisateur,))
        if cursor.fetchone():
            cursor.close()
            connexion.close()
            return jsonify({"erreur": "Ce nom d'utilisateur existe deja"}), 409

        mot_de_passe_hash = bcrypt.generate_password_hash(mot_de_passe).decode('utf-8')
        cursor.execute(
            "INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe_hash, role) VALUES (%s, %s, %s)",
            (nom_utilisateur, mot_de_passe_hash, role)
        )
        connexion.commit()
        utilisateur_id = cursor.lastrowid

        cursor.execute("INSERT INTO parametres (utilisateur_id) VALUES (%s)", (utilisateur_id,))
        connexion.commit()
        cursor.close()
        connexion.close()

        session["utilisateur_id"] = utilisateur_id
        session["nom_utilisateur"] = nom_utilisateur
        session["role"] = role

        return jsonify({
            "message": "Compte cree avec succes",
            "nom_utilisateur": nom_utilisateur,
            "role": role
        }), 201

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
