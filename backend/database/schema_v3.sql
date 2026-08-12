CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT,
    type VARCHAR(50) NOT NULL,
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priorite VARCHAR(20) DEFAULT 'normale',
    lue TINYINT(1) DEFAULT 0,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS traductions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cle VARCHAR(100) NOT NULL,
    langue VARCHAR(10) NOT NULL,
    valeur TEXT NOT NULL,
    UNIQUE KEY unique_cle_langue (cle, langue)
);

INSERT IGNORE INTO notifications (utilisateur_id, type, titre, message, priorite, lue) VALUES
(1, 'systeme', 'Bienvenue', 'Bienvenue sur la plateforme de maintenance prédictive OCP.', 'normale', 0);
