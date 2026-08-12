// =============================================================
// monitoring.js — Model monitoring page (SPA-compatible)
// =============================================================
async function initMonitoring() {
  await chargerMonitoring();
  setupMonitoringLiveButtons();
  setupReentrainer();
}

async function chargerMonitoring() {
  try {
    const [reponseModele, reponseDrift, reponsePerf] = await Promise.allSettled([
      fetch(`${API_URL}/monitoring/modele`),
      fetch(`${API_URL}/monitoring/drift`),
      fetch(`${API_URL}/monitoring/performance-continue`)
    ]);

    const modele = reponseModele.status === "fulfilled" ? await reponseModele.value.json() : {};
    const drift = reponseDrift.status === "fulfilled" ? await reponseDrift.value.json() : { details: {}, score_drift_global: "--", statut_global: "inconnu" };
    const perf = reponsePerf.status === "fulfilled" ? await reponsePerf.value.json() : {};

    const el = (id) => document.getElementById(id);
    if (el("monModele")) el("monModele").textContent = modele.modele || "--";
    if (el("monSeuil")) el("monSeuil").textContent = `${t("monitoring.seuil_decision", "Seuil")} : ${parseFloat(modele.seuil_decision || 0).toFixed(3)}`;
    if (el("monF1")) el("monF1").textContent = (modele.performance_initiale?.f1_score * 100 || 0).toFixed(1) + "%";
    if (el("monConfiance")) el("monConfiance").textContent = (perf.confiance_moyenne_pct || 0) + "%";
    if (el("monDrift")) el("monDrift").textContent = drift.score_drift_global ?? "--";

    const badgeDrift = document.getElementById("monDriftBadge");
    if (badgeDrift) {
      badgeDrift.textContent = (drift.statut_global || "inconnu").toUpperCase();
      badgeDrift.className = `mon-badge ${drift.statut_global || "inconnu"}`;
    }

    const tbody = document.getElementById("tbodyDrift");
    if (tbody && drift.details) {
      const nomsLisibles = {
        air_temperature: t("prediction.temp_air", "Température air"),
        process_temperature: t("prediction.temp_proc", "Température process"),
        rotational_speed: t("prediction.rotation", "Vitesse rotation"),
        torque: t("prediction.couple", "Couple"),
        tool_wear: t("prediction.usure_outil", "Usure outil")
      };
      tbody.innerHTML = Object.entries(drift.details).map(([champ, valeurs]) => `
        <tr>
          <td>${nomsLisibles[champ] || champ}</td>
          <td class="risk-value">${valeurs.moyenne_reference}</td>
          <td class="risk-value">${valeurs.moyenne_actuelle}</td>
          <td class="risk-value">${valeurs.score_drift}</td>
          <td><span class="status-pill ${valeurs.statut === 'stable' ? 'safe' : 'danger'}">${valeurs.statut}</span></td>
        </tr>
      `).join("");
    }
  } catch (erreur) {
    console.error("Erreur chargement monitoring :", erreur);
  }
}

function setupMonitoringLiveButtons() {
  const btnStart = document.getElementById("btnDemarrerMonitoring");
  const btnStop = document.getElementById("btnArreterMonitoring");
  if (btnStart) btnStart.addEventListener("click", demarrerMonitoring);
  if (btnStop) btnStop.addEventListener("click", arreterMonitoring);
}

function setupReentrainer() {
  const bouton = document.getElementById("btnReentrainer");
  if (!bouton) return;
  bouton.addEventListener("click", async (event) => {
    event.preventDefault();
    bouton.disabled = true;
    bouton.querySelector("span").textContent = t("monitoring.en_cours", "Entraînement en cours…");
    try {
      const reponse = await fetch(`${API_URL}/monitoring/reentrainer`, { method: "POST" });
      const resultat = await reponse.json();
      if (!reponse.ok) throw new Error(resultat.erreur);
      afficherResultatReentrainement(resultat);
      chargerMonitoring();
    } catch (erreur) {
      afficherErreurReentrainement(erreur.message);
    } finally {
      bouton.disabled = false;
      bouton.querySelector("span").textContent = t("monitoring.reentrainer", "Relancer l'entraînement");
    }
  });
}

function afficherResultatReentrainement(resultat) {
  const modal = document.createElement("div");
  modal.className = "reentrainement-modal";
  modal.innerHTML = `
    <div class="reentrainement-card">
      <div class="reentrainement-icon success">✓</div>
      <h3>${t("monitoring.reentrainement_succes", "Modèle mis à jour avec succès")}</h3>
      <p>${t("rapports.recommandations", "Le modèle de prédiction a été ré-entraîné avec les dernières données collectées et est désormais actif.")}</p>
      <button class="btn" id="fermerModalReentrainement" type="button"><span>${t("commun.fermer", "Fermer")}</span></button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById("fermerModalReentrainement").addEventListener("click", () => modal.remove());
}

function afficherErreurReentrainement(message) {
  const modal = document.createElement("div");
  modal.className = "reentrainement-modal";
  modal.innerHTML = `
    <div class="reentrainement-card">
      <div class="reentrainement-icon error">✕</div>
      <h3>${t("commun.erreur", "Le ré-entraînement a échoué")}</h3>
      <p>${t("commun.reessayer", "Une erreur est survenue. Réessayez plus tard ou contactez l'administrateur du système.")}</p>
      <button class="btn" id="fermerModalReentrainement" type="button"><span>${t("commun.fermer", "Fermer")}</span></button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById("fermerModalReentrainement").addEventListener("click", () => modal.remove());
}
