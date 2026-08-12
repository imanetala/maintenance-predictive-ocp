import mysql.connector
from mysql.connector import Error
import os

def obtenir_connexion():
    """
    Crée et retourne une connexion à la base de données MySQL.
    Cette fonction sera appelée à chaque fois qu'on a besoin de lire/écrire dans la BDD.
    """
    try:
        connexion = mysql.connector.connect(
            host=os.environ.get("MYSQL_HOST", "localhost"),
            user=os.environ.get("MYSQL_USER", "root"),
            password=os.environ.get("MYSQL_PASSWORD", ""),
            database=os.environ.get("MYSQL_DATABASE", "maintenance_predictive")
        )
        return connexion
    except Error as e:
        print(f"Erreur de connexion à MySQL : {e}")
        return None


def tester_connexion():
    """Fonction de test simple pour vérifier que tout fonctionne."""
    connexion = obtenir_connexion()
    if connexion and connexion.is_connected():
        print("✅ Connexion à MySQL réussie !")
        cursor = connexion.cursor()
        cursor.execute("SELECT * FROM equipements")
        resultats = cursor.fetchall()
        print(f"\nÉquipements trouvés dans la base ({len(resultats)}) :")
        for ligne in resultats:
            print(ligne)
        cursor.close()
        connexion.close()
    else:
        print("❌ Échec de la connexion.")


if __name__ == "__main__":
    tester_connexion()