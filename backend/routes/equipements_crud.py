from flask import Blueprint, request, jsonify, session
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

equipements_crud_bp = Blueprint('equipements_crud', __name__)


@equipements_crud_bp.route("/equipements", methods=["POST"])
def ajouter_equipement():
    """Ajoute un nouvel equipement."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        donnees = request.get_json()
        nom = donnees.get("nom", "").strip()
        type_produit = donnees.get("type_produit", "M")
        localisation = donnees.get("localisation", "").strip()
        fabricant = donnees.get("fabricant", "N/A").strip()
        date_installation = donnees.get("date_installation", None)

        if not nom:
            return jsonify({"erreur": "Le nom est requis"}), 400

        connexion = obtenir_connexion()
        cursor = connexion.cursor()
        cursor.execute(
            "INSERT INTO equipements (nom, type_produit, localisation, fabricant, date_installation) VALUES (%s, %s, %s, %s, %s)",
            (nom, type_produit, localisation, fabricant, date_installation)
        )
        connexion.commit()
        equipement_id = cursor.lastrowid
        cursor.close()
        connexion.close()

        return jsonify({"message": "Equipement ajoute", "id": equipement_id}), 201

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@equipements_crud_bp.route("/equipements/<int:equipement_id>", methods=["PUT"])
def modifier_equipement(equipement_id):
    """Modifie un equipement existant."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        donnees = request.get_json()
        connexion = obtenir_connexion()
        cursor = connexion.cursor()

        champs = []
        valeurs = []
        for champ in ["nom", "type_produit", "localisation", "fabricant", "date_installation"]:
            if champ in donnees:
                champs.append(f"{champ} = %s")
                valeurs.append(donnees[champ])

        if not champs:
            return jsonify({"erreur": "Aucun champ a modifier"}), 400

        valeurs.append(equipement_id)
        cursor.execute(f"UPDATE equipements SET {', '.join(champs)} WHERE id = %s", valeurs)
        connexion.commit()
        cursor.close()
        connexion.close()

        return jsonify({"message": "Equipement mis a jour"})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@equipements_crud_bp.route("/equipements/<int:equipement_id>", methods=["DELETE"])
def supprimer_equipement(equipement_id):
    """Supprime un equipement et ses donnees associees."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor()

        cursor.execute("DELETE FROM predictions WHERE mesure_id IN (SELECT id FROM mesures_capteurs WHERE equipement_id = %s)", (equipement_id,))
        cursor.execute("DELETE FROM mesures_capteurs WHERE equipement_id = %s", (equipement_id,))
        cursor.execute("DELETE FROM equipements WHERE id = %s", (equipement_id,))
        connexion.commit()
        cursor.close()
        connexion.close()

        return jsonify({"message": "Equipement supprime"})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@equipements_crud_bp.route("/equipements/<int:equipement_id>", methods=["GET"])
def get_equipement(equipement_id):
    """Recupere les details d'un equipement."""
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT * FROM equipements WHERE id = %s", (equipement_id,))
        equipement = cursor.fetchone()
        cursor.close()
        connexion.close()

        if not equipement:
            return jsonify({"erreur": "Equipement non trouve"}), 404

        if equipement.get("date_installation"):
            equipement["date_installation"] = equipement["date_installation"].strftime("%Y-%m-%d")
        if equipement.get("date_ajout"):
            equipement["date_ajout"] = equipement["date_ajout"].strftime("%Y-%m-%d %H:%M:%S")

        return jsonify(equipement)

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
