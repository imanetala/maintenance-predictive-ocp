from flask import Blueprint, jsonify
import sys
import os
import numpy as np

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route("/analytics/distributions", methods=["GET"])
def distributions():
    """Retourne les distributions des variables capteurs pour les graphiques."""
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT air_temperature, process_temperature, rotational_speed, torque, tool_wear
            FROM mesures_capteurs ORDER BY date_mesure DESC LIMIT 500
        """)
        mesures = cursor.fetchall()
        cursor.close()
        connexion.close()

        if not mesures:
            return jsonify({"erreur": "Pas encore de donnees"}), 400

        resultats = {}
        champs = ["air_temperature", "process_temperature", "rotational_speed", "torque", "tool_wear"]
        noms = {
            "air_temperature": "Temperature air (K)",
            "process_temperature": "Temperature process (K)",
            "rotational_speed": "Vitesse rotation (rpm)",
            "torque": "Couple (Nm)",
            "tool_wear": "Usure outil (min)"
        }

        for champ in champs:
            valeurs = [float(m[champ]) for m in mesures]
            arr = np.array(valeurs)
            hist, bin_edges = np.histogram(arr, bins=20)
            resultats[champ] = {
                "nom": noms[champ],
                "histogramme": hist.tolist(),
                "bins": bin_edges.tolist(),
                "statistiques": {
                    "moyenne": round(float(np.mean(arr)), 2),
                    "median": round(float(np.median(arr)), 2),
                    "ecart_type": round(float(np.std(arr)), 2),
                    "min": round(float(np.min(arr)), 2),
                    "max": round(float(np.max(arr)), 2),
                    "q25": round(float(np.percentile(arr, 25)), 2),
                    "q75": round(float(np.percentile(arr, 75)), 2)
                }
            }

        return jsonify(resultats)

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@analytics_bp.route("/analytics/correlations", methods=["GET"])
def correlations():
    """Retourne la matrice de correlation entre les variables."""
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT air_temperature, process_temperature, rotational_speed, torque, tool_wear
            FROM mesures_capteurs ORDER BY date_mesure DESC LIMIT 500
        """)
        mesures = cursor.fetchall()
        cursor.close()
        connexion.close()

        if not mesures:
            return jsonify({"erreur": "Pas encore de donnees"}), 400

        champs = ["air_temperature", "process_temperature", "rotational_speed", "torque", "tool_wear"]
        noms = ["Temp. air", "Temp. process", "Vit. rotation", "Couple", "Usure outil"]
        donnees = np.array([[float(m[c]) for c in champs] for m in mesures])
        matrice = np.corrcoef(donnees, rowvar=False)

        return jsonify({
            "variables": noms,
            "matrice": [[round(float(val), 3) for val in ligne] for ligne in matrice]
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@analytics_bp.route("/analytics/failure-rate", methods=["GET"])
def failure_rate():
    """Taux de panne par type de produit et par equipement."""
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)

        cursor.execute("""
            SELECT e.type_produit,
                   COUNT(p.id) AS total,
                   SUM(p.panne_predite) AS pannes,
                   ROUND(SUM(p.panne_predite) / COUNT(p.id) * 100, 1) AS taux_panne
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            GROUP BY e.type_produit
        """)
        par_type = cursor.fetchall()

        cursor.execute("""
            SELECT e.nom AS equipement,
                   COUNT(p.id) AS total,
                   SUM(p.panne_predite) AS pannes,
                   ROUND(SUM(p.panne_predite) / COUNT(p.id) * 100, 1) AS taux_panne
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            GROUP BY e.nom
        """)
        par_equipement = cursor.fetchall()

        cursor.close()
        connexion.close()

        for row in par_type:
            row["total"] = int(row["total"])
            row["pannes"] = int(row["pannes"])
        for row in par_equipement:
            row["total"] = int(row["total"])
            row["pannes"] = int(row["pannes"])

        return jsonify({"par_type": par_type, "par_equipement": par_equipement})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@analytics_bp.route("/analytics/top-causes", methods=["GET"])
def top_causes():
    """Top causes de pannes basees sur les mesures precedant les pannes."""
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                m.air_temperature, m.process_temperature, m.rotational_speed,
                m.torque, m.tool_wear, p.probabilite_panne
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            WHERE p.panne_predite = 1
            ORDER BY p.probabilite_panne DESC
            LIMIT 100
        """)
        pannes = cursor.fetchall()
        cursor.close()
        connexion.close()

        if not pannes:
            return jsonify({"moyennes": {}, "count": 0})

        champs = ["air_temperature", "process_temperature", "rotational_speed", "torque", "tool_wear"]
        moyennes = {}
        for c in champs:
            valeurs = [float(p[c]) for p in pannes]
            moyennes[c] = round(float(np.mean(valeurs)), 2)

        return jsonify({"moyennes": moyennes, "count": len(pannes)})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@analytics_bp.route("/analytics/health-distribution", methods=["GET"])
def health_distribution():
    """Repartition Healthy vs Warning vs Critical."""
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN p.probabilite_panne < 0.35 THEN 1 ELSE 0 END) AS healthy,
                SUM(CASE WHEN p.probabilite_panne >= 0.35 AND p.probabilite_panne < 0.71 THEN 1 ELSE 0 END) AS warning,
                SUM(CASE WHEN p.probabilite_panne >= 0.71 THEN 1 ELSE 0 END) AS critical,
                COUNT(*) AS total
            FROM predictions p
        """)
        result = cursor.fetchone()
        cursor.close()
        connexion.close()

        return jsonify({
            "healthy": int(result["healthy"] or 0),
            "warning": int(result["warning"] or 0),
            "critical": int(result["critical"] or 0),
            "total": int(result["total"] or 0)
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
