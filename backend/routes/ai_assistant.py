from flask import Blueprint, request, jsonify, session
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

ai_assistant_bp = Blueprint('ai_assistant', __name__)


@ai_assistant_bp.route("/ai-assistant", methods=["POST"])
def poser_question():
    """Assistant IA qui repond aux questions sur les equipements et pannes."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecte"}), 401

    try:
        donnees = request.get_json()
        question = donnees.get("message", "").strip().lower()

        if not question:
            return jsonify({"erreur": "Message requis"}), 400

        connexion = obtenir_connexion()
        cursor = connexion.cursor(dictionary=True)

        cursor.execute("""
            SELECT e.nom, e.localisation, e.type_produit,
                   m.air_temperature, m.process_temperature, m.rotational_speed,
                   m.torque, m.tool_wear, p.probabilite_panne, p.panne_predite
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            ORDER BY p.date_prediction DESC LIMIT 1
        """)
        derniere = cursor.fetchone()

        cursor.execute("SELECT COUNT(*) AS total, SUM(panne_predite) AS pannes FROM predictions")
        stats_globales = cursor.fetchone()

        cursor.execute("""
            SELECT e.nom, COUNT(p.id) AS nb_alertes, ROUND(AVG(p.probabilite_panne)*100,1) AS risque_moyen
            FROM predictions p
            JOIN mesures_capteurs m ON p.mesure_id = m.id
            JOIN equipements e ON m.equipement_id = e.id
            WHERE p.panne_predite = 1
            GROUP BY e.nom ORDER BY nb_alertes DESC LIMIT 5
        """)
        machines_alertes = cursor.fetchall()

        cursor.execute("SELECT id, nom, localisation FROM equipements")
        equipements = cursor.fetchall()

        cursor.close()
        connexion.close()

        reponse = generer_reponse(question, derniere, stats_globales, machines_alertes, equipements)

        try:
            connexion2 = obtenir_connexion()
            cursor2 = connexion2.cursor()
            cursor2.execute(
                "INSERT INTO assistant_history (utilisateur_id, message_utilisateur, reponse_ia) VALUES (%s, %s, %s)",
                (session["utilisateur_id"], donnees.get("message", ""), reponse)
            )
            connexion2.commit()
            cursor2.close()
            connexion2.close()
        except Exception:
            pass

        return jsonify({"reponse": reponse})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


def generer_reponse(question, derniere, stats_globales, machines_alertes, equipements):
    """Genere une reponse contextuelle basee sur les donnees en temps reel."""

    if any(mot in question for mot in ["bonjour", "salut", "hello", "coucou"]):
        return "Bonjour ! Je suis l'assistant IA de maintenance predictive. Posez-moi des questions sur vos equipements, les pannes ou l'etat du systeme."

    if any(mot in question for mot in ["stat", "resume", "synthese", "global", "resume"]):
        total = stats_globales["total"] or 0
        pannes = stats_globales["pannes"] or 0
        taux = round(int(pannes) / max(int(total), 1) * 100, 1)
        return (f"Voici le resume du systeme :\n"
                f"- Total analyses : {total}\n"
                f"- Pannes detectees : {pannes} ({taux}%)\n"
                f"- Equipements suivis : {len(equipements)}\n"
                f"- Precision du modele : 76.6%")

    if any(mot in question for mot in ["alerte", "panne", "probleme", "critique", "risque"]):
        if machines_alertes:
            lignes = "\n".join([f"- {m['nom']} : {m['nb_alertes']} alertes (risque moyen: {m['risque_moyen']}%)" for m in machines_alertes])
            return f"Voici les equipements avec le plus d'alertes :\n{lignes}\n\nUne maintenance preventive est recommandee pour les equipements listes."
        return "Aucune alerte active pour le moment. Tous les equipements fonctionnent normalement."

    if any(mot in question for mot in ["derniere", "dernier", "recent", "derniere mesure"]):
        if derniere:
            risque = round(derniere["probabilite_panne"] * 100, 1)
            statut = "CRITIQUE" if derniere["panne_predite"] else "Normal"
            return (f"Derniere analyse : {derniere['nom']} ({derniere['localisation']})\n"
                    f"Statut : {statut}\n"
                    f"Probabilite de panne : {risque}%\n"
                    f"Temperature : {derniere['air_temperature']}K | Couple : {derniere['torque']}Nm | Usure : {derniere['tool_wear']}min")
        return "Aucune mesure enregistree pour le moment."

    if any(mot in question for mot in ["temperature", "chaud", "chauffe"]):
        if derniere:
            temp = derniere["air_temperature"]
            temp_proc = derniere["process_temperature"]
            if temp > 305 or temp_proc > 315:
                return f"Attention : La temperature est elevee ({temp}K air, {temp_proc}K process). Cela peut indiquer un probleme de refroidissement ou une surcharge."
            return f"Les temperatures sont dans la normale ({temp}K air, {temp_proc}K process)."
        return "Pas de donnees de temperature disponibles."

    if any(mot in question for mot in ["vibration", "vibrer"]):
        return "Les vibrations sont surveillees via le couple et la vitesse de rotation. Des valeurs elevees de couple (>50 Nm) associees a une vitesse basse peuvent indiquer des vibrations anormales."

    if any(mot in question for mot in ["couple", "torque"]):
        if derniere:
            couple = derniere["torque"]
            if couple > 55:
                return f"Le couple est eleve ({couple} Nm). Cela peut indiquer une surcharge mecanique ou un grippage. Inspection recommandee."
            return f"Le couple est normal ({couple} Nm)."
        return "Pas de donnees de couple disponibles."

    if any(mot in question for mot in ["usure", "outil", "tool wear"]):
        if derniere:
            usure = derniere["tool_wear"]
            if usure > 200:
                return f"L'usure outil est elevee ({usure} min). Remplacement recommande dans les plus brefs delais."
            elif usure > 140:
                return f"L'usure outil est moderee ({usure} min). Surveillez de pres."
            return f"L'usure outil est faible ({usure} min). Aucune action requise."
        return "Pas de donnees d'usure disponibles."

    if any(mot in question for mot in ["equipement", "machine", "liste", "inventaire"]):
        if equipements:
            lignes = "\n".join([f"- #{e['id']} {e['nom']} ({e['localisation']})" for e in equipements])
            return f"Voici les equipements surveilles :\n{lignes}"
        return "Aucun equipement enregistre."

    if any(mot in question for mot in ["mode", "model", "ia", "intelligence", "algorithme"]):
        return ("Le modele actuel est un Random Forest (300 arbres) entraine sur le dataset AI4I 2020 (10 069 echantillons).\n"
                "Precision : 84.5% | Recall : 70% | F1-score : 76.6%\n"
                "Seuil de decision optimise : 0.39\n"
                "Le modele est regulierement re-entraine avec les nouvelles donnees collectees.")

    if any(mot in question for mot in ["merci", "thanks"]):
        return "De rien ! N'hesitez pas si vous avez d'autres questions."

    if any(mot in question for mot in ["aide", "help", "comment"]):
        return ("Je peux vous aider avec :\n"
                "- Etat des equipements\n"
                "- Alertes et pannes\n"
                "- Statistiques globales\n"
                "- Derniere mesure\n"
                "- Temperatures, couples, usure\n"
                "- Informations sur le modele IA\n"
                "Posez votre question simplement !")

    return (f"Pour votre question '{question}', voici ce que je sais :\n"
            f"- {len(equipements)} equipement(s) suivi(s)\n"
            f"- {stats_globales['total'] or 0} analyse(s) effectuee(s)\n"
            f"- {stats_globales['pannes'] or 0} panne(s) detectee(s)\n"
            f"Essayez de poser une question sur les alertes, les temperatures, l'usure ou les statistiques.")
