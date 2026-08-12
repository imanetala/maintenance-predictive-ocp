from flask import Blueprint, request, jsonify, session
from flask_bcrypt import Bcrypt
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()


@auth_bp.route("/login", methods=["POST"])
def login():
    donnees = request.get_json()
    nom_utilisateur = donnees.get("nom_utilisateur")
    mot_de_passe = donnees.get("mot_de_passe")

    if not nom_utilisateur or not mot_de_passe:
        return jsonify({"erreur": "Identifiants manquants"}), 400

    connexion = obtenir_connexion()
    cursor = connexion.cursor(dictionary=True)
    cursor.execute("SELECT * FROM utilisateurs WHERE nom_utilisateur = %s", (nom_utilisateur,))
    utilisateur = cursor.fetchone()
    cursor.close()
    connexion.close()

    if utilisateur and bcrypt.check_password_hash(utilisateur["mot_de_passe_hash"], mot_de_passe):
        session["utilisateur_id"] = utilisateur["id"]
        session["nom_utilisateur"] = utilisateur["nom_utilisateur"]
        session["role"] = utilisateur["role"]
        return jsonify({
            "message": "Connexion réussie",
            "nom_utilisateur": utilisateur["nom_utilisateur"],
            "role": utilisateur["role"]
        })
    else:
        return jsonify({"erreur": "Identifiants incorrects"}), 401


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Déconnexion réussie"})


@auth_bp.route("/session", methods=["GET"])
def verifier_session():
    if "utilisateur_id" in session:
        return jsonify({
            "connecte": True,
            "nom_utilisateur": session["nom_utilisateur"],
            "role": session["role"]
        })
    return jsonify({"connecte": False}), 401