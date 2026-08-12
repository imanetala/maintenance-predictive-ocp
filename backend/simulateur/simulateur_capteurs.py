"""
Simulateur de capteurs en temps réel.
Envoie des mesures aléatoires (mais réalistes) à l'API /predict
toutes les X secondes, pour simuler un flux IoT continu.
"""

import requests
import random
import time
from datetime import datetime

API_URL = "http://127.0.0.1:5000/predict"
INTERVALLE_SECONDES = 15  # fréquence d'envoi des mesures

# Équipements existants dans la base (id, type_produit)
EQUIPEMENTS = [
    {"id": 1, "type_produit": "M", "nom": "Pompe P-101"},
    {"id": 2, "type_produit": "L", "nom": "Convoyeur C-203"},
    {"id": 3, "type_produit": "H", "nom": "Broyeur B-05"},
]


def generer_mesure_normale():
    """Génère des valeurs de capteurs plausibles pour un fonctionnement sain."""
    return {
        "air_temperature": round(random.uniform(296.5, 300.5), 1),
        "process_temperature": round(random.uniform(306.5, 310.5), 1),
        "rotational_speed": random.randint(1400, 1600),
        "torque": round(random.uniform(30, 48), 1),
        "tool_wear": random.randint(0, 90)
    }


def generer_mesure_a_risque():
    """Génère des valeurs de capteurs proches d'une panne (usure + couple élevés)."""
    return {
        "air_temperature": round(random.uniform(300, 305), 1),
        "process_temperature": round(random.uniform(309, 314), 1),
        "rotational_speed": random.randint(1250, 1400),
        "torque": round(random.uniform(55, 75), 1),
        "tool_wear": random.randint(180, 250)
    }


def envoyer_mesure():
    """Choisit un équipement au hasard, génère une mesure, et l'envoie à l'API."""
    equipement = random.choice(EQUIPEMENTS)

    # 15% de chance de générer un cas à risque, 85% de chance d'un cas normal
    if random.random() < 0.15:
        valeurs = generer_mesure_a_risque()
        type_simulation = "À RISQUE"
    else:
        valeurs = generer_mesure_normale()
        type_simulation = "normal"

    payload = {
        "equipement_id": equipement["id"],
        "type_produit": equipement["type_produit"],
        **valeurs
    }

    try:
        reponse = requests.post(API_URL, json=payload, timeout=5)
        resultat = reponse.json()

        heure = datetime.now().strftime("%H:%M:%S")
        statut = "🔴 PANNE DÉTECTÉE" if resultat.get("panne_predite") else "🟢 normal"

        print(f"[{heure}] {equipement['nom']:20s} | simulation {type_simulation:10s} | "
              f"risque={resultat.get('probabilite_panne', '?'):>5} | {statut}")

    except requests.exceptions.ConnectionError:
        print(f"❌ Impossible de contacter l'API Flask ({API_URL}). Est-elle bien lancée ?")
    except Exception as e:
        print(f"❌ Erreur : {e}")


def lancer_simulation():
    print("=" * 70)
    print("🔧 SIMULATEUR DE CAPTEURS — Maintenance Prédictive OCP")
    print(f"   Envoi d'une mesure toutes les {INTERVALLE_SECONDES} secondes")
    print("   Ctrl+C pour arrêter")
    print("=" * 70)

    try:
        while True:
            envoyer_mesure()
            time.sleep(INTERVALLE_SECONDES)
    except KeyboardInterrupt:
        print("\n\n🛑 Simulation arrêtée.")


if __name__ == "__main__":
    lancer_simulation()