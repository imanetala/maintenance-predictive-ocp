from flask import Blueprint, request, jsonify, session
import sys
import os
import json
from datetime import datetime, timedelta

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

reports_bp = Blueprint('reports', __name__)


@reports_bp.route("/rapports", methods=["GET"])
def lister_rapports():
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM rapports WHERE utilisateur_id = %s ORDER BY date_generation DESC LIMIT 50",
            (session["utilisateur_id"],)
        )
        rapports = cursor.fetchall()
        cursor.close()
        connexion.close()
        for r in rapports:
            r["date_generation"] = r["date_generation"].strftime("%Y-%m-%d %H:%M:%S") if r.get("date_generation") else ""
            r["date_debut"] = r["date_debut"].strftime("%Y-%m-%d") if r.get("date_debut") else ""
            r["date_fin"] = r["date_fin"].strftime("%Y-%m-%d") if r.get("date_fin") else ""
            if r.get("contenu"):
                r["contenu"] = json.loads(r["contenu"]) if isinstance(r["contenu"], str) else r["contenu"]
        return jsonify(rapports)
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@reports_bp.route("/rapports/generer", methods=["POST"])
def generer_rapport():
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401
    try:
        donnees = request.get_json()
        type_rapport = donnees.get("type", "quotidien")
        date_debut = donnees.get("date_debut")
        date_fin = donnees.get("date_fin")

        if not date_debut or not date_fin:
            now = datetime.now()
            if type_rapport == "quotidien":
                date_debut = (now - timedelta(days=1)).strftime("%Y-%m-%d")
                date_fin = now.strftime("%Y-%m-%d")
            elif type_rapport == "hebdomadaire":
                date_debut = (now - timedelta(weeks=1)).strftime("%Y-%m-%d")
                date_fin = now.strftime("%Y-%m-%d")
            elif type_rapport == "mensuel":
                date_debut = (now - timedelta(days=30)).strftime("%Y-%m-%d")
                date_fin = now.strftime("%Y-%m-%d")
            else:
                date_debut = (now - timedelta(days=365)).strftime("%Y-%m-%d")
                date_fin = now.strftime("%Y-%m-%d")

        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)

        cursor.execute("""
            SELECT COUNT(*) AS total, SUM(p.panne_predite) AS pannes,
                   ROUND(AVG(p.probabilite_panne) * 100, 1) AS risque_moyen,
                   MAX(p.probabilite_panne) AS risque_max,
                   MIN(p.probabilite_panne) AS risque_min
            FROM predictions p
            WHERE DATE(p.date_prediction) BETWEEN %s AND %s
        """, (date_debut, date_fin))
        stats = cursor.fetchone()

        cursor.execute("""
            SELECT e.nom, COUNT(p.id) AS nb,
                   ROUND(AVG(p.probabilite_panne) * 100, 1) AS risque_moyen
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            WHERE DATE(p.date_prediction) BETWEEN %s AND %s
            GROUP BY e.nom ORDER BY risque_moyen DESC LIMIT 10
        """, (date_debut, date_fin))
        top_equipements = cursor.fetchall()

        cursor.execute("""
            SELECT e.nom, COUNT(p.id) AS nb
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            WHERE DATE(p.date_prediction) BETWEEN %s AND %s AND p.panne_predite = 1
            GROUP BY e.nom ORDER BY nb DESC LIMIT 5
        """, (date_debut, date_fin))
        machines_critiques = cursor.fetchall()

        cursor.execute("""
            SELECT DATE(p.date_prediction) as jour, 
                   ROUND(AVG(p.probabilite_panne) * 100, 1) as risque_moyen,
                   COUNT(*) as nb
            FROM predictions p
            WHERE DATE(p.date_prediction) BETWEEN %s AND %s
            GROUP BY DATE(p.date_prediction) ORDER BY jour
        """, (date_debut, date_fin))
        evolution = cursor.fetchall()

        cursor.execute("""
            SELECT m.tool_wear, p.probabilite_panne
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            WHERE DATE(p.date_prediction) BETWEEN %s AND %s
        """, (date_debut, date_fin))
        correlations_data = cursor.fetchall()

        total_analyses = int(stats["total"] or 0)
        total_pannes = int(stats["pannes"] or 0)
        taux_panne = round(total_pannes / max(total_analyses, 1) * 100, 1)

        contenu = {
            "type_rapport": type_rapport,
            "periode": {"debut": date_debut, "fin": date_fin},
            "statistiques": {
                "total_analyses": total_analyses,
                "total_pannes": total_pannes,
                "risque_moyen": float(stats["risque_moyen"] or 0),
                "risque_max": float(stats["risque_max"] or 0),
                "risque_min": float(stats["risque_min"] or 0),
                "taux_panne": taux_panne
            },
            "top_equipements": [{"nom": e["nom"], "alertes": int(e["nb"]), "risque_moyen": float(e["risque_moyen"] or 0)} for e in top_equipements],
            "machines_critiques": [{"nom": m["nom"], "alertes": int(m["nb"])} for m in machines_critiques],
            "evolution_risques": [{"date": str(e["jour"]), "risque": float(e["risque_moyen"] or 0), "nb": int(e["nb"] or 0)} for e in evolution],
            "precision_ia": "84.5%",
            "f1_score": "76.6%",
            "recall": "78%",
            "alertes_envoyees": total_pannes
        }

        cursor.execute(
            "INSERT INTO rapports (utilisateur_id, type_rapport, date_debut, date_fin, contenu) VALUES (%s, %s, %s, %s, %s)",
            (session["utilisateur_id"], type_rapport, date_debut, date_fin, json.dumps(contenu))
        )
        connexion.commit()
        rapport_id = cursor.lastrowid
        cursor.close()
        connexion.close()

        from routes.notifications_db import creer_notification
        creer_notification(
            type_notif="rapport",
            titre="Rapport genere",
            message=f"Rapport {type_rapport} genere pour la periode {date_debut} au {date_fin}.",
            priorite="normale",
            utilisateur_id=session.get("utilisateur_id")
        )

        return jsonify({
            "id": rapport_id,
            "type_rapport": type_rapport,
            "date_debut": date_debut,
            "date_fin": date_fin,
            "contenu": contenu
        }), 201

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@reports_bp.route("/rapports/<int:rapport_id>", methods=["GET"])
def get_rapport(rapport_id):
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT * FROM rapports WHERE id = %s AND utilisateur_id = %s", (rapport_id, session["utilisateur_id"]))
        rapport = cursor.fetchone()
        cursor.close()
        connexion.close()
        if not rapport:
            return jsonify({"erreur": "Rapport non trouve"}), 404
        rapport["date_generation"] = rapport["date_generation"].strftime("%Y-%m-%d %H:%M:%S") if rapport.get("date_generation") else ""
        rapport["date_debut"] = rapport["date_debut"].strftime("%Y-%m-%d") if rapport.get("date_debut") else ""
        rapport["date_fin"] = rapport["date_fin"].strftime("%Y-%m-%d") if rapport.get("date_fin") else ""
        if rapport.get("contenu"):
            rapport["contenu"] = json.loads(rapport["contenu"]) if isinstance(rapport["contenu"], str) else rapport["contenu"]
        return jsonify(rapport)
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
