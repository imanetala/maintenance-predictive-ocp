-- Schema V2 — Ajouts pour les nouvelles fonctionnalites
USE maintenance_predictive;

-- Table des parametres utilisateur
CREATE TABLE IF NOT EXISTS parametres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    seuil_alerte FLOAT DEFAULT 0.71,
    langue VARCHAR(10) DEFAULT 'fr',
    theme VARCHAR(20) DEFAULT 'light',
    email_notifications BOOLEAN DEFAULT 1,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Table des rapports generes
CREATE TABLE IF NOT EXISTS rapports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    type_rapport VARCHAR(20) NOT NULL, -- quotidien, hebdomadaire, mensuel, annuel
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    contenu JSON,
    date_generation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Table historique assistant IA
CREATE TABLE IF NOT EXISTS assistant_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    message_utilisateur TEXT NOT NULL,
    reponse_ia TEXT NOT NULL,
    date_echange TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Ajouter colonnes manquantes (ignorer les erreurs si deja existantes)
-- Si les colonnes existent deja, ces commandes seront ignorees
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'maintenance_predictive' AND TABLE_NAME = 'equipements' AND COLUMN_NAME = 'fabricant') = 0,
    'ALTER TABLE equipements ADD COLUMN fabricant VARCHAR(100) DEFAULT ''N/A''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'maintenance_predictive' AND TABLE_NAME = 'equipements' AND COLUMN_NAME = 'date_installation') = 0,
    'ALTER TABLE equipements ADD COLUMN date_installation DATE DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'maintenance_predictive' AND TABLE_NAME = 'predictions' AND COLUMN_NAME = 'utilisateur_id') = 0,
    'ALTER TABLE predictions ADD COLUMN utilisateur_id INT DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
