from flask import Blueprint, jsonify
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

alerts_bp = Blueprint('alerts', __name__)


@alerts_bp.route("/alertes", methods=["GET"])
def liste_alertes():
    """Retourne toutes les prédictions où une panne a été détectée."""
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion à la base impossible"}), 500

        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                p.id AS alerte_id,
                e.nom AS equipement,
                e.localisation,
                m.torque,
                m.tool_wear,
                m.rotational_speed,
                p.probabilite_panne,
                p.date_prediction
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            WHERE p.panne_predite = 1
            ORDER BY p.date_prediction DESC
        """)
        resultats = cursor.fetchall()
        cursor.close()
        connexion.close()

        for ligne in resultats:
            ligne["date_prediction"] = ligne["date_prediction"].strftime("%Y-%m-%d %H:%M:%S")
            ligne["probabilite_panne_pct"] = round(ligne["probabilite_panne"] * 100, 1)

        return jsonify(resultats)

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500