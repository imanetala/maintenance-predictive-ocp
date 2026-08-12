from flask import Blueprint, jsonify
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

traductions_bp = Blueprint('traductions', __name__)


@traductions_bp.route("/traductions/<langue>", methods=["GET"])
def get_traductions(langue):
    """Retourne toutes les traductions pour une langue donnée."""
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion impossible"}), 500
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT cle, valeur FROM traductions WHERE langue = %s", (langue,))
        resultats = cursor.fetchall()
        cursor.close()
        connexion.close()
        traductions = {r["cle"]: r["valeur"] for r in resultats}
        return jsonify(traductions)
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
