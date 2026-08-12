import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from connexion_mysql import obtenir_connexion
from flask_bcrypt import Bcrypt
from flask import Flask

app = Flask(__name__)
bcrypt = Bcrypt(app)

def creer_utilisateur(nom_utilisateur, mot_de_passe, role="technicien"):
    mot_de_passe_hash = bcrypt.generate_password_hash(mot_de_passe).decode('utf-8')
    
    connexion = obtenir_connexion()
    cursor = connexion.cursor()
    cursor.execute("""
        INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe_hash, role)
        VALUES (%s, %s, %s)
    """, (nom_utilisateur, mot_de_passe_hash, role))
    connexion.commit()
    cursor.close()
    connexion.close()
    print(f"✅ Utilisateur '{nom_utilisateur}' créé avec succès")

if __name__ == "__main__":
    creer_utilisateur("admin", "motdepasse123", "admin")