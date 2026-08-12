from flask import Blueprint, jsonify
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

stats_bp = Blueprint('stats', __name__)


@stats_bp.route("/stats/evolution", methods=["GET"])
def evolution_temporelle():
    """
    Retourne le risque moyen par jour, pour tracer un graphique d'évolution.
    Optionnel : filtrer par equipement_id avec ?equipement_id=1
    """
    try:
        from flask import request
        equipement_id = request.args.get("equipement_id")

        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion à la base impossible"}), 500

        cursor = connexion.cursor(dictionary=True)

        if equipement_id:
            cursor.execute("""
                SELECT 
                    DATE(p.date_prediction) AS jour,
                    ROUND(AVG(p.probabilite_panne) * 100, 1) AS risque_moyen_pct,
                    COUNT(p.id) AS nombre_analyses,
                    SUM(p.panne_predite) AS nombre_pannes
                FROM predictions p
                JOIN mesures_capteurs m ON p.mesure_id = m.id
                WHERE m.equipement_id = %s
                GROUP BY DATE(p.date_prediction)
                ORDER BY jour ASC
            """, (equipement_id,))
        else:
            cursor.execute("""
                SELECT 
                    DATE(p.date_prediction) AS jour,
                    ROUND(AVG(p.probabilite_panne) * 100, 1) AS risque_moyen_pct,
                    COUNT(p.id) AS nombre_analyses,
                    SUM(p.panne_predite) AS nombre_pannes
                FROM predictions p
                GROUP BY DATE(p.date_prediction)
                ORDER BY jour ASC
            """)

        resultats = cursor.fetchall()
        cursor.close()
        connexion.close()

        for ligne in resultats:
            ligne["jour"] = ligne["jour"].strftime("%Y-%m-%d")

        return jsonify(resultats)

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500