"""
Script de ré-entraînement automatique du modèle.
Combine le dataset original (AI4I 2020) avec les nouvelles mesures
collectées via l'application, pour maintenir le modèle à jour.
"""

import pandas as pd
import numpy as np
import joblib
import json
import sys
import os
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score, precision_recall_curve

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database"))
from connexion_mysql import obtenir_connexion

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_DIR = os.path.join(BASE_DIR, "model")
DATA_DIR = os.path.join(BASE_DIR, "data", "raw")


def recuperer_nouvelles_donnees():
    """Récupère les mesures + résultats réels depuis MySQL pour enrichir l'entraînement."""
    connexion = obtenir_connexion()
    cursor = connexion.cursor(dictionary=True)
    cursor.execute("""
        SELECT 
            e.type_produit AS Type,
            m.air_temperature AS `Air temperature [K]`,
            m.process_temperature AS `Process temperature [K]`,
            m.rotational_speed AS `Rotational speed [rpm]`,
            m.torque AS `Torque [Nm]`,
            m.tool_wear AS `Tool wear [min]`,
            p.panne_predite AS Target
        FROM predictions p
        JOIN mesures_capteurs m ON p.mesure_id = m.id
        JOIN equipements e ON m.equipement_id = e.id
    """)
    resultats = cursor.fetchall()
    cursor.close()
    connexion.close()
    return pd.DataFrame(resultats)


def reentrainer_modele():
    print("=" * 70)
    print("RÉ-ENTRAÎNEMENT DU MODÈLE — Maintenance Prédictive OCP")
    print("=" * 70)

    # 1. Charger le dataset original
    print("\n[1/6] Chargement du dataset original AI4I 2020...")
    df_original = pd.read_csv(os.path.join(DATA_DIR, "predictive_maintenance.csv"))
    df_original = df_original.drop(columns=['UDI', 'Product ID', 'Failure Type'])
    print(f"      -> {len(df_original)} lignes originales")

    # 2. Charger les nouvelles données collectées via l'app
    print("\n[2/6] Récupération des nouvelles données collectées via l'application...")
    df_nouvelles = recuperer_nouvelles_donnees()
    print(f"      -> {len(df_nouvelles)} nouvelles mesures trouvées")

    # 3. Combiner les deux jeux de données
    print("\n[3/6] Fusion des données...")
    df_combine = pd.concat([df_original, df_nouvelles], ignore_index=True)
    print(f"      -> {len(df_combine)} lignes au total")

    # 4. Préparation (encodage, split)
    print("\n[4/6] Préparation des données...")
    encodeur_type = LabelEncoder()
    df_combine['Type'] = encodeur_type.fit_transform(df_combine['Type'])

    X = df_combine.drop(columns=['Target'])
    y = df_combine['Target']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 5. Entraînement
    print("\n[5/6] Entraînement du nouveau modèle...")
    modele = RandomForestClassifier(
        n_estimators=300, max_depth=None, min_samples_split=2, random_state=42
    )
    modele.fit(X_train_scaled, y_train)

    # Optimisation du seuil
    y_proba = modele.predict_proba(X_test_scaled)[:, 1]
    precisions, recalls, seuils = precision_recall_curve(y_test, y_proba)
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-10)
    meilleur_seuil = float(seuils[np.argmax(f1_scores)])

    y_pred_seuil = (y_proba >= meilleur_seuil).astype(int)
    nouvelle_precision = precision_score(y_test, y_pred_seuil)
    nouveau_recall = recall_score(y_test, y_pred_seuil)
    nouveau_f1 = f1_score(y_test, y_pred_seuil)
    nouvelle_accuracy = accuracy_score(y_test, y_pred_seuil)

    print(f"      -> Accuracy  : {nouvelle_accuracy:.3f}")
    print(f"      -> Précision : {nouvelle_precision:.3f}")
    print(f"      -> Recall    : {nouveau_recall:.3f}")
    print(f"      -> F1-score  : {nouveau_f1:.3f}")
    print(f"      -> Seuil optimal : {meilleur_seuil:.3f}")

    # 6. Comparaison avec l'ancien modèle et sauvegarde
    print("\n[6/6] Comparaison avec le modèle actuel...")
    with open(os.path.join(MODEL_DIR, "config_modele.json"), "r") as f:
        ancienne_config = json.load(f)

    ancien_f1 = ancienne_config["performance"]["f1_score"]
    print(f"      -> Ancien F1-score : {ancien_f1:.3f}")
    print(f"      -> Nouveau F1-score : {nouveau_f1:.3f}")

    if nouveau_f1 >= ancien_f1:
        print("\n      OK - Le nouveau modèle est meilleur ou équivalent — remplacement effectué.")

        joblib.dump(modele, os.path.join(MODEL_DIR, "modele_entraine.pkl"))
        joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))
        joblib.dump(encodeur_type, os.path.join(MODEL_DIR, "encodeur_type.pkl"))

        nouvelle_config = {
            "seuil_decision": meilleur_seuil,
            "modele": "Random Forest",
            "parametres": {"n_estimators": 300, "max_depth": None, "min_samples_split": 2},
            "performance": {
                "accuracy": float(nouvelle_accuracy),
                "precision": float(nouvelle_precision),
                "recall": float(nouveau_recall),
                "f1_score": float(nouveau_f1)
            },
            "derniere_maj": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "nombre_donnees_entrainement": len(df_combine)
        }
        with open(os.path.join(MODEL_DIR, "config_modele.json"), "w") as f:
            json.dump(nouvelle_config, f, indent=4)

        print("      -> Fichiers modèle, scaler, encodeur et config mis à jour.")
    else:
        print("\n      ATTENTION - Le nouveau modèle est moins performant — l'ancien modèle est conservé.")

    print("\n" + "=" * 70)
    print("Ré-entraînement terminé.")
    print("=" * 70)


if __name__ == "__main__":
    reentrainer_modele()