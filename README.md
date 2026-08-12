# Maintenance Prédictive OCP

Plateforme web de **maintenance prédictive** pour les équipements industriels, basée sur un modèle **Random Forest** entraîné sur le dataset **AI4I 2020**. L'application permet de superviser les machines en temps réel, de prédire les pannes avant qu'elles ne surviennent, de générer des alertes et des rapports, et d'expliquer les prédictions.

## Fonctionnalités

- **Authentification sécurisée** : connexion, inscription, mot de passe oublié (réinitialisation par code), sessions Flask, rôles (admin / technicien).
- **Tableau de bord** : indicateurs clés (KPI), graphiques et tendances.
- **Prédiction IA** : probabilité de panne en temps réel à partir des mesures capteurs, avec seuil de décision optimisé.
- **Expliquabilité** : explication des prédictions (SHAP) pour comprendre les causes de défaillance.
- **Supervision en temps réel** : monitoring des capteurs et du modèle.
- **Centre d'alertes** : alertes prioritaires avec notifications.
- **Historique & analytics** : tendances, statistiques et analyses.
- **Rapports** : export PDF / Excel (quotidiens, hebdomadaires, mensuels).
- **Assistant IA** : assistant intégré pour le diagnostic.
- **Paramètres utilisateur** : langue (FR/EN), thème (clair/sombre), seuil d'alerte, notifications email.
- **Ré-entraînement automatique** du modèle avec les nouvelles données collectées.

## Stack technique

| Couche | Technologies |
|--------|--------------|
| Backend | Python, Flask, Flask-Bcrypt, Flask-CORS |
| Base de données | MySQL (`mysql-connector-python`) |
| Machine Learning | scikit-learn, Random Forest, SHAP, joblib |
| Frontend | HTML5, CSS3, JavaScript (vanilla), Chart.js, jsPDF, Lucide |
| Données | Dataset AI4I 2020 (predictive maintenance) |

## Performances du modèle

Config actuelle (seuil de décision optimisé sur le F1-score) :

| Métrique | Valeur |
|----------|--------|
| Accuracy | 0.986 |
| Précision | 0.897 |
| Recall | 0.726 |
| F1-score | 0.803 |
| Seuil de décision | 0.427 |

## Structure du projet

```
maintenance-predictive-ocp/
├── backend/
│   ├── app.py                  # Application Flask (routes + fichiers statiques)
│   ├── requirements.txt        # Dépendances Python
│   ├── database/               # Connexion MySQL, schémas, création utilisateur
│   │   ├── schema.sql          # Schéma de base (tables principales)
│   │   ├── schema_v2.sql       # Schéma v2 (paramètres, rapports, historique IA)
│   │   ├── schema_v3.sql       # Schéma v3 (notifications, traductions)
│   │   ├── connexion_mysql.py  # Connexion à MySQL
│   │   └── creer_utilisateur.py# Création d'un utilisateur (hachage bcrypt)
│   ├── model/
│   │   └── reentrainement.py   # Script de ré-entraînement du modèle
│   ├── routes/                 # Blueprints Flask (auth, prédiction, etc.)
│   └── simulateur/
│       └── simulateur_capteurs.py # Simulation de mesures capteurs
├── frontend/
│   ├── index.html              # SPA (accueil, dashboard, ...)
│   ├── login.html              # Page de connexion
│   ├── register.html           # Page d'inscription
│   ├── css/                    # Feuilles de style
│   ├── js/                     # Logique frontend (auth-guard, app, ...)
│   ├── pages/                  # Vues de l'application
│   └── i18n/                   # Traductions FR / EN
├── model/
│   ├── modele_entraine.pkl     # Modèle entraîné
│   ├── scaler.pkl              # StandardScaler
│   ├── encodeur_type.pkl       # LabelEncoder
│   └── config_modele.json      # Configuration et performances du modèle
├── data/
│   └── raw/
│       └── predictive_maintenance.csv # Dataset AI4I 2020
└── notebooks/
    ├── 01_exploration.ipynb    # Exploration des données
    └── 02_entrainement_modele.ipynb # Entraînement du modèle
```

## Prérequis

- **Python 3.12** (les dépendances ne sont pas compatibles avec Python 3.14)
- **MySQL** (8.0+ recommandé)

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/<votre-utilisateur>/maintenance-predictive-ocp.git
cd maintenance-predictive-ocp
```

### 2. Environnement Python

```bash
# Depuis la racine du projet
python -m venv .venv

# Activer l'environnement
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
# Windows (CMD)
.\.venv\Scripts\activate.bat
# Linux / macOS
source .venv/bin/activate

pip install -r backend/requirements.txt
```

> **Note** : si `pip install` échoue sur Python 3.14, utilisez Python 3.12. Sous Windows, vérifiez la version utilisée avec `python --version`.

### 3. Configuration de l'environnement

Copiez `.env.example` vers `.env` et renseignez vos valeurs :

```bash
cp .env.example .env
```

```env
SECRET_KEY=votre_cle_secrete

MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=votre_mot_de_passe_mysql
MYSQL_DATABASE=maintenance_predictive

EMAIL_EXPEDITEUR=votre@email.com
EMAIL_MOT_DE_PASSE=mot_de_passe_application
EMAIL_DESTINATAIRE=destinataire@email.com
```

> Le fichier `.env` contient des secrets et est ignoré par Git (`.gitignore`). Ne le commitez jamais.

### 4. Base de données

Créez le schéma de la base dans MySQL (Workbench, terminal ou `mysql -u root -p`), dans l'ordre :

```sql
-- 1. Schéma de base
SOURCE chemin/vers/schema.sql;

-- 2. Schéma v2 (paramètres, rapports, ...)
SOURCE chemin/vers/schema_v2.sql;

-- 3. Schéma v3 (notifications, traductions)
SOURCE chemin/vers/schema_v3.sql;
```

Créez ensuite un premier utilisateur :

```bash
cd backend/database
python creer_utilisateur.py
```

Cela crée le compte **`admin` / `motdepasse123`** (mot de passe haché avec bcrypt).

## Lancement

```bash
cd backend
python app.py
```

Puis ouvrez : **http://localhost:5000**

> **Note Windows** : si `python` pointe vers Python 3.14, lancez avec le 3.12 :
> `& "C:\Users\talim\AppData\Local\Python\pythoncore-3.12-64\python.exe" app.py`

### Identifiants de démonstration

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| `admin` | `motdepasse123` | admin |

## Ré-entraînement du modèle

Le modèle combine le dataset AI4I 2020 avec les nouvelles mesures collectées par l'application :

```bash
cd backend/model
python reentrainement.py
```

Le nouveau modèle est déployé uniquement s'il améliore (ou égale) le F1-score du modèle actuel.

## Points d'entrée API principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/register` | Créer un compte |
| POST | `/login` | Connexion |
| POST | `/logout` | Déconnexion |
| GET | `/session` | Vérifier la session |
| POST | `/forgot-password` | Générer un code de réinitialisation |
| POST | `/reset-password` | Réinitialiser le mot de passe |
| POST | `/predict` | Prédiction de panne |
| GET | `/equipements` | Liste des équipements |
| GET | `/stats` | Statistiques globales |
| GET | `/alerts` | Alertes |
| GET | `/notifications` | Notifications |
| GET | `/reports` | Rapports |
| GET | `/profile` | Profil utilisateur |
| PUT | `/settings` | Paramètres utilisateur |

## Licence

Projet pédagogique. Licence à définir selon vos besoins.
