CREATE DATABASE IF NOT EXISTS maintenance_predictive;
USE maintenance_predictive;

-- Table des utilisateurs (authentification)
CREATE TABLE utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom_utilisateur VARCHAR(50) NOT NULL UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'technicien',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des équipements/machines suivies
CREATE TABLE equipements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    type_produit CHAR(1) NOT NULL,  -- L, M ou H (comme dans le dataset)
    localisation VARCHAR(150),
    date_ajout TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de l'historique des mesures capteurs envoyées
CREATE TABLE mesures_capteurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipement_id INT NOT NULL,
    air_temperature FLOAT NOT NULL,
    process_temperature FLOAT NOT NULL,
    rotational_speed INT NOT NULL,
    torque FLOAT NOT NULL,
    tool_wear INT NOT NULL,
    date_mesure TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipement_id) REFERENCES equipements(id)
);

-- Table des prédictions faites par le modèle
CREATE TABLE predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mesure_id INT NOT NULL,
    probabilite_panne FLOAT NOT NULL,
    panne_predite BOOLEAN NOT NULL,
    seuil_utilise FLOAT NOT NULL,
    date_prediction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mesure_id) REFERENCES mesures_capteurs(id)
);

-- Équipements de départ (mêmes id/types que dans backend/simulateur/simulateur_capteurs.py)
INSERT INTO equipements (id, nom, type_produit, localisation) VALUES
    (1, 'Pompe P-101', 'M', 'Atelier Extraction — Zone A'),
    (2, 'Convoyeur C-203', 'L', 'Ligne de Transport — Zone B'),
    (3, 'Broyeur B-05', 'H', 'Unité de Broyage — Zone C');