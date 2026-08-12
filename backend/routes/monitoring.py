from flask import Blueprint, jsonify
import sys
import os
import json
import subprocess
import numpy as np

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

monitoring_bp = Blueprint('monitoring', __name__)

# Dossier racine du projet (remonte 3 fois depuis backend/routes/monitoring.py)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Dossier backend (remonte 2 fois)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# config_modele.json et les .pkl sont dans model/ à la RACINE du projet
MODEL_DIR = os.path.join(ROOT_DIR, "model")
# reentrainement.py est dans backend/model/
SCRIPT_DIR = os.path.join(BACKEND_DIR, "model")

REFERENCE_STATS = {
    "air_temperature": {"moyenne": 300.0, "ecart_type": 2.0},
    "process_temperature": {"moyenne": 310.0, "ecart_type": 1.5},
    "rotational_speed": {"moyenne": 1538.8, "ecart_type": 179.3},
    "torque": {"moyenne": 39.99, "ecart_type": 9.97},
    "tool_wear": {"moyenne": 107.95, "ecart_type": 63.65}
}


@monitoring_bp.route("/monitoring/modele", methods=["GET"])
def monitoring_modele():
    try:
        with open(os.path.join(MODEL_DIR, "config_modele.json"), "r") as f:
            config = json.load(f)

        return jsonify({
            "modele": config.get("modele"),
            "seuil_decision": config.get("seuil_decision"),
            "performance_initiale": config.get("performance"),
            "parametres": config.get("parametres"),
            "derniere_maj": config.get("derniere_maj", "Entraînement initial"),
            "nombre_donnees_entrainement": config.get("nombre_donnees_entrainement", "N/A")
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@monitoring_bp.route("/monitoring/drift", methods=["GET"])
def monitoring_drift():
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT air_temperature, process_temperature, rotational_speed, torque, tool_wear
            FROM mesures_capteurs
            ORDER BY date_mesure DESC
            LIMIT 200
        """)
        mesures = cursor.fetchall()
        cursor.close()
        connexion.close()

        if len(mesures) == 0:
            return jsonify({"erreur": "Pas encore de données pour calculer le drift"}), 400

        resultats_drift = {}
        for champ, ref in REFERENCE_STATS.items():
            valeurs = [float(m[champ]) for m in mesures]
            moyenne_actuelle = np.mean(valeurs)
            score = abs(moyenne_actuelle - ref["moyenne"]) / ref["ecart_type"]

            resultats_drift[champ] = {
                "moyenne_reference": ref["moyenne"],
                "moyenne_actuelle": round(moyenne_actuelle, 2),
                "score_drift": round(float(score), 3),
                "statut": "alerte" if score > 1.0 else ("attention" if score > 0.5 else "stable")
            }

        score_global = np.mean([v["score_drift"] for v in resultats_drift.values()])

        return jsonify({
            "nombre_echantillons": len(mesures),
            "score_drift_global": round(float(score_global), 3),
            "statut_global": "alerte" if score_global > 1.0 else ("attention" if score_global > 0.5 else "stable"),
            "details": resultats_drift
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@monitoring_bp.route("/monitoring/performance-continue", methods=["GET"])
def performance_continue():
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT probabilite_panne, panne_predite
            FROM predictions
            ORDER BY date_prediction DESC
            LIMIT 200
        """)
        predictions = cursor.fetchall()
        cursor.close()
        connexion.close()

        if len(predictions) == 0:
            return jsonify({"erreur": "Pas encore de prédictions"}), 400

        confiances = [abs(float(p["probabilite_panne"]) - 0.5) * 2 for p in predictions]
        confiance_moyenne = np.mean(confiances)

        nb_pannes = sum(1 for p in predictions if p["panne_predite"])
        taux_pannes = nb_pannes / len(predictions) * 100

        return jsonify({
            "nombre_predictions_analysees": len(predictions),
            "confiance_moyenne_pct": round(float(confiance_moyenne) * 100, 1),
            "taux_pannes_detectees_pct": round(taux_pannes, 1)
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@monitoring_bp.route("/monitoring/reentrainer", methods=["POST"])
def reentrainer():
    try:
        script_path = os.path.join(SCRIPT_DIR, "reentrainement.py")

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        resultat = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            env=env
        )

        if resultat.returncode != 0:
            return jsonify({"erreur": resultat.stderr}), 500

        from routes.predict import charger_modele
        charger_modele()

        return jsonify({
            "message": "Ré-entraînement terminé et modèle rechargé en mémoire avec succès",
            "log": resultat.stdout
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500