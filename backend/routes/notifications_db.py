from flask import Blueprint, request, jsonify, session
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

notifications_db_bp = Blueprint('notifications_db', __name__)


def creer_notification(type_notif, titre, message, priorite="normale", utilisateur_id=None):
    """Fonction utilitaire pour créer une notification dans MySQL."""
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return False
        cursor = connexion.cursor()
        cursor.execute(
            "INSERT INTO notifications (utilisateur_id, type, titre, message, priorite) VALUES (%s, %s, %s, %s, %s)",
            (utilisateur_id, type_notif, titre, message, priorite)
        )
        connexion.commit()
        cursor.close()
        connexion.close()
        return True
    except Exception as e:
        print(f"Erreur création notification: {e}")
        return False


@notifications_db_bp.route("/notifications", methods=["GET"])
def lister_notifications():
    """Liste les notifications de l'utilisateur connecté."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecté"}), 401
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"erreur": "Connexion impossible"}), 500
        cursor = connexion.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM notifications WHERE utilisateur_id = %s ORDER BY date_creation DESC LIMIT 50",
            (session["utilisateur_id"],)
        )
        notifs = cursor.fetchall()
        cursor.close()
        connexion.close()
        for n in notifs:
            n["date_creation"] = n["date_creation"].strftime("%Y-%m-%d %H:%M:%S")
        return jsonify(notifs)
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@notifications_db_bp.route("/notifications/non-lues", methods=["GET"])
def nombre_non_lues():
    """Retourne le nombre de notifications non lues."""
    if "utilisateur_id" not in session:
        return jsonify({"nombre": 0})
    try:
        connexion = obtenir_connexion()
        if connexion is None:
            return jsonify({"nombre": 0})
        cursor = connexion.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM notifications WHERE utilisateur_id = %s AND lue = 0",
            (session["utilisateur_id"],)
        )
        count = cursor.fetchone()[0]
        cursor.close()
        connexion.close()
        return jsonify({"nombre": count})
    except Exception as e:
        return jsonify({"nombre": 0})


@notifications_db_bp.route("/notifications/<int:notif_id>/lire", methods=["PUT"])
def marquer_lue(notif_id):
    """Marque une notification comme lue."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecté"}), 401
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor()
        cursor.execute(
            "UPDATE notifications SET lue = 1 WHERE id = %s AND utilisateur_id = %s",
            (notif_id, session["utilisateur_id"])
        )
        connexion.commit()
        cursor.close()
        connexion.close()
        return jsonify({"message": "Notification marquée comme lue"})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@notifications_db_bp.route("/notifications/tout-lire", methods=["PUT"])
def tout_marquer_lue():
    """Marque toutes les notifications comme lues."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecté"}), 401
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor()
        cursor.execute(
            "UPDATE notifications SET lue = 1 WHERE utilisateur_id = %s AND lue = 0",
            (session["utilisateur_id"],)
        )
        connexion.commit()
        cursor.close()
        connexion.close()
        return jsonify({"message": "Toutes les notifications marquées comme lues"})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@notifications_db_bp.route("/notifications/<int:notif_id>", methods=["DELETE"])
def supprimer_notification(notif_id):
    """Supprime une notification."""
    if "utilisateur_id" not in session:
        return jsonify({"erreur": "Non connecté"}), 401
    try:
        connexion = obtenir_connexion()
        cursor = connexion.cursor()
        cursor.execute(
            "DELETE FROM notifications WHERE id = %s AND utilisateur_id = %s",
            (notif_id, session["utilisateur_id"])
        )
        connexion.commit()
        cursor.close()
        connexion.close()
        return jsonify({"message": "Notification supprimée"})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500
