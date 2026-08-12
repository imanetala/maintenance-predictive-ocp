from routes.notifications import envoyer_email
from routes.notifications_db import creer_notification
from flask import Blueprint, request, jsonify, session
import joblib
import numpy as np
import json
import os
import sys

predict_bp = Blueprint('predict', __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_DIR = os.path.join(BASE_DIR, "model")

sys.path.append(os.path.join(BASE_DIR, "database"))
from connexion_mysql import obtenir_connexion

modele = None
scaler = None
encodeur_type = None
seuil_decision = None


def charger_modele():
    global modele, scaler, encodeur_type, seuil_decision
    modele = joblib.load(os.path.join(MODEL_DIR, "modele_entraine.pkl"))
    scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
    encodeur_type = joblib.load(os.path.join(MODEL_DIR, "encodeur_type.pkl"))
    with open(os.path.join(MODEL_DIR, "config_modele.json"), "r") as f:
        config = json.load(f)
        seuil_decision = config["seuil_decision"]
    print(f"Modele charge — seuil de decision : {seuil_decision}")


charger_modele()


def get_nom_equipement(equipement_id):
    try:
        conn = obtenir_connexion()
        if conn is None:
            return f"Equipement #{equipement_id}"
        cursor = conn.cursor()
        cursor.execute("SELECT nom FROM equipements WHERE id = %s", (equipement_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        return row[0] if row else f"Equipement #{equipement_id}"
    except:
        return f"Equipement #{equipement_id}"


@predict_bp.route("/predict", methods=["POST"])
def predict():
    try:
        donnees = request.get_json()

        champs_requis = ["equipement_id", "type_produit", "air_temperature", "process_temperature",
                          "rotational_speed", "torque", "tool_wear"]
        for champ in champs_requis:
            if champ not in donnees:
                return jsonify({"erreur": f"Champ manquant : {champ}"}), 400

        type_encode = encodeur_type.transform([donnees["type_produit"]])[0]

        X = np.array([[
            type_encode,
            donnees["air_temperature"],
            donnees["process_temperature"],
            donnees["rotational_speed"],
            donnees["torque"],
            donnees["tool_wear"]
        ]])

        X_scaled = scaler.transform(X)
        probabilite = float(modele.predict_proba(X_scaled)[0][1])
        panne_predite = bool(probabilite >= seuil_decision)

        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Impossible de se connecter a la base de donnees"}), 500

        cursor = connexion.cursor()

        cursor.execute("""
            INSERT INTO mesures_capteurs 
            (equipement_id, air_temperature, process_temperature, rotational_speed, torque, tool_wear)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            donnees["equipement_id"],
            donnees["air_temperature"],
            donnees["process_temperature"],
            donnees["rotational_speed"],
            donnees["torque"],
            donnees["tool_wear"]
        ))
        mesure_id = cursor.lastrowid

        utilisateur_id = session.get("utilisateur_id")
        cursor.execute("""
            INSERT INTO predictions (mesure_id, probabilite_panne, panne_predite, seuil_utilise, utilisateur_id)
            VALUES (%s, %s, %s, %s, %s)
        """, (mesure_id, probabilite, panne_predite, seuil_decision, utilisateur_id))

        connexion.commit()
        cursor.close()
        connexion.close()

        nom_eq = get_nom_equipement(donnees["equipement_id"])

        if panne_predite:
            envoyer_email(
                sujet=f"Alerte panne detectee - {nom_eq}",
                corps=(
                    f"Une panne a ete detectee par le systeme de maintenance predictive.\n\n"
                    f"Equipement : {nom_eq} (ID: {donnees['equipement_id']})\n"
                    f"Probabilite de panne : {round(probabilite*100, 1)}%\n"
                    f"Couple : {donnees['torque']} Nm\n"
                    f"Usure outil : {donnees['tool_wear']} min\n\n"
                    f"Merci de verifier cet equipement rapidement."
                )
            )

            creer_notification(
                type_notif="alerte",
                titre="Panne detectee",
                message=f"Risque de panne de {round(probabilite*100,1)}% detecte sur {nom_eq}.",
                priorite="haute" if probabilite >= 0.7 else "moyenne",
                utilisateur_id=utilisateur_id
            )

        creer_notification(
            type_notif="prediction",
            titre="Nouvelle prediction",
            message=f"Prediction effectuee sur {nom_eq} : {round(probabilite*100,1)}% de risque.",
            priorite="normale",
            utilisateur_id=utilisateur_id
        )

        return jsonify({
            "probabilite_panne": round(probabilite, 4),
            "panne_predite": panne_predite,
            "seuil_utilise": seuil_decision,
            "mesure_id": mesure_id
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@predict_bp.route("/rul", methods=["POST"])
def estimer_rul():
    try:
        donnees = request.get_json()
        usure_actuelle = donnees["tool_wear"]
        usure_max_theorique = 253

        usure_restante = max(0, usure_max_theorique - usure_actuelle)
        vitesse_usure_par_heure = 2.5
        heures_restantes = usure_restante / vitesse_usure_par_heure
        jours_restants = round(heures_restantes / 24, 1)

        if jours_restants < 2:
            niveau = "critique"
        elif jours_restants < 7:
            niveau = "attention"
        else:
            niveau = "normal"

        return jsonify({
            "usure_actuelle_min": usure_actuelle,
            "usure_max_theorique_min": usure_max_theorique,
            "jours_restants_estimes": jours_restants,
            "niveau": niveau,
            "avertissement": "Estimation heuristique basee sur l'usure outil."
        })

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
