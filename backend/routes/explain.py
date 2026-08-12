from flask import Blueprint, request, jsonify
import numpy as np
import shap
import sys
import os

explain_bp = Blueprint('explain', __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_DIR = os.path.join(BASE_DIR, "model")

NOMS_FEATURES = ["Type", "Température air", "Température process", "Vitesse rotation", "Couple", "Usure outil"]

explainer = None  # créé à la demande (coûteux à initialiser)


@explain_bp.route("/explain", methods=["POST"])
def expliquer_prediction():
    """
    Explique une prédiction précise : quelles variables ont le plus
    poussé le modèle vers "panne" ou "normal" pour ce cas particulier.
    """
    try:
        from routes.predict import modele, scaler, encodeur_type

        donnees = request.get_json()
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

        global explainer
        if explainer is None:
            explainer = shap.TreeExplainer(modele)

        valeurs_shap = explainer.shap_values(X_scaled)

        # Pour un RandomForestClassifier, shap_values retourne une liste [classe_0, classe_1]
        if isinstance(valeurs_shap, list):
            contributions = valeurs_shap[1][0]  # classe "panne"
        else:
            contributions = valeurs_shap[0]

        resultats = []
        for nom, contribution in zip(NOMS_FEATURES, contributions):
            resultats.append({
                "variable": nom,
                "contribution": round(float(contribution), 4),
                "impact": "augmente le risque" if contribution > 0 else "diminue le risque"
            })

        # Trie par impact absolu décroissant
        resultats.sort(key=lambda x: abs(x["contribution"]), reverse=True)

        return jsonify({"explications": resultats})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500