from flask import Blueprint, jsonify, request
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

equipements_bp = Blueprint('equipements', __name__)


@equipements_bp.route("/equipements", methods=["GET"])
def liste_equipements():
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion a la base impossible"}), 500
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT id, nom, type_produit, localisation FROM equipements")
        resultats = cursor.fetchall()
        cursor.close()
        connexion.close()
        return jsonify(resultats)
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@equipements_bp.route("/historique", methods=["GET"])
def historique_predictions():
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion a la base impossible"}), 500

        page = int(request.args.get("page", 1))
        limite = int(request.args.get("limite", 20))
        recherche = request.args.get("recherche", "")
        filtre_equipement = request.args.get("equipement", "")
        filtre_statut = request.args.get("statut", "")
        date_debut = request.args.get("date_debut", "")
        date_fin = request.args.get("date_fin", "")
        tri_colonne = request.args.get("tri", "date_prediction")
        tri_sens = request.args.get("sens", "DESC")

        colonnes_valides = {
            "id": "p.id", "date_prediction": "p.date_prediction",
            "equipement": "e.nom", "air_temperature": "m.air_temperature",
            "process_temperature": "m.process_temperature",
            "rotational_speed": "m.rotational_speed",
            "torque": "m.torque", "tool_wear": "m.tool_wear",
            "probabilite_panne": "p.probabilite_panne",
            "panne_predite": "p.panne_predite"
        }
        col_tri = colonnes_valides.get(tri_colonne, "p.date_prediction")
        sens_tri = "ASC" if tri_sens.upper() == "ASC" else "DESC"

        conditions = []
        params = []

        if recherche:
            conditions.append("(e.nom LIKE %s OR e.localisation LIKE %s)")
            params.extend([f"%{recherche}%", f"%{recherche}%"])
        if filtre_equipement:
            conditions.append("e.nom = %s")
            params.append(filtre_equipement)
        if filtre_statut == "normal":
            conditions.append("p.probabilite_panne < 0.39")
        elif filtre_statut == "risque":
            conditions.append("p.probabilite_panne >= 0.39 AND p.probabilite_panne < 0.7")
        elif filtre_statut == "critique":
            conditions.append("p.probabilite_panne >= 0.7")
        elif filtre_statut == "panne":
            conditions.append("p.panne_predite = 1")
        if date_debut:
            conditions.append("DATE(p.date_prediction) >= %s")
            params.append(date_debut)
        if date_fin:
            conditions.append("DATE(p.date_prediction) <= %s")
            params.append(date_fin)

        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

        cursor = connexion.cursor(dictionary=True)
        cursor.execute(f"SELECT COUNT(*) as total FROM predictions p JOIN mesures_capteurs m ON p.mesure_id = m.id JOIN equipements e ON m.equipement_id = e.id{where_clause}", params)
        total = cursor.fetchone()["total"]

        offset = (page - 1) * limite
        cursor.execute(f"""
            SELECT 
                p.id AS prediction_id,
                e.nom AS equipement,
                e.localisation,
                m.air_temperature,
                m.process_temperature,
                m.rotational_speed,
                m.torque,
                m.tool_wear,
                p.probabilite_panne,
                p.panne_predite,
                p.date_prediction
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            {where_clause}
            ORDER BY {col_tri} {sens_tri}
            LIMIT %s OFFSET %s
        """, params + [limite, offset])
        resultats = cursor.fetchall()
        cursor.close()
        connexion.close()

        for ligne in resultats:
            ligne["date_prediction"] = ligne["date_prediction"].strftime("%Y-%m-%d %H:%M:%S")
            prob = ligne["probabilite_panne"]
            if prob >= 0.7:
                ligne["statut"] = "critique"
            elif prob >= 0.39:
                ligne["statut"] = "risque"
            else:
                ligne["statut"] = "normal"

        return jsonify({
            "donnees": resultats,
            "total": total,
            "page": page,
            "pages": max(1, (total + limite - 1) // limite),
            "limite": limite
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@equipements_bp.route("/historique/<int:prediction_id>", methods=["DELETE"])
def supprimer_prediction(prediction_id):
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion impossible"}), 500
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("SELECT mesure_id FROM predictions WHERE id = %s", (prediction_id,))
        row = cursor.fetchone()
        if not row:
            cursor.close()
            connexion.close()
            return jsonify({"erreur": "Prediction non trouvee"}), 404
        cursor.execute("DELETE FROM predictions WHERE id = %s", (prediction_id,))
        cursor.execute("DELETE FROM mesures_capteurs WHERE id = %s", (row["mesure_id"],))
        connexion.commit()
        cursor.close()
        connexion.close()
        return jsonify({"message": "Prediction supprimee"})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@equipements_bp.route("/historique/stats", methods=["GET"])
def historique_stats():
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion impossible"}), 500
        cursor = connexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN panne_predite = 1 THEN 1 ELSE 0 END) as pannes,
                ROUND(AVG(probabilite_panne) * 100, 1) as risque_moyen,
                MIN(date_prediction) as premiere_date,
                MAX(date_prediction) as derniere_date
            FROM predictions
        """)
        stats = cursor.fetchone()
        cursor.close()
        connexion.close()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
