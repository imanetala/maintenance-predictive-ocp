// =============================================================
// app.js — Dashboard & Prediction logic (SPA-compatible)
// =============================================================

// --- TOAST ---
function showToast(message, type = "success", duration = 3500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { success: "✓", error: "✕", info: "i", warning: "!" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.style.position = "relative";
  toast.innerHTML = `
    <div class="toast__icon">${icons[type] || "✓"}</div>
    <div class="toast__text">${message}</div>
    <button class="toast__close" type="button">&times;</button>
    <div class="toast__progress" style="animation-duration:${duration}ms"></div>
  `;
  toast.querySelector(".toast__close").addEventListener("click", () => removeToast(toast));
  container.appendChild(toast);
  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  if (toast.classList.contains("removing")) return;
  toast.classList.add("removing");
  setTimeout(() => toast.remove(), 300);
}

// --- HISTORY ---
let historiqueComplet = [];

// --- EVOLUTION CHART ---
let graphiqueEvolutionInstance = null;

// =============================================================
// initDashboard — called when user navigates to "dashboard"
// =============================================================
function initDashboard() {
  chargerHistoriqueDashboard();
  chargerGraphiqueEvolution();

  const filtreEq = document.getElementById("filtreEquipement");
  const filtreStatut = document.getElementById("filtreStatut");
  if (filtreEq) filtreEq.addEventListener("change", afficherHistoriqueFiltre);
  if (filtreStatut) filtreStatut.addEventListener("change", afficherHistoriqueFiltre);

  const btnCSV = document.getElementById("btnExportCSV");
  const btnPDF = document.getElementById("btnExportPDF");
  if (btnCSV) btnCSV.addEventListener("click", exporterHistoriqueCSV);
  if (btnPDF) btnPDF.addEventListener("click", exporterHistoriquePDF);
}

async function chargerHistoriqueDashboard() {
  const tbody = document.getElementById("tbodyHistorique");
  try {
    const reponse = await fetch(`${API_URL}/historique?limite=10000`);
    if (!reponse.ok) throw new Error("Réponse API invalide");
    const data = await reponse.json();
    historiqueComplet = data.donnees || data;

    remplirFiltreEquipements(historiqueComplet);
    afficherHistoriqueFiltre();
  } catch (erreur) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="table__empty">${t("commun.erreur", "Impossible de charger l'historique.")}</td></tr>`;
    console.error("Erreur chargement historique :", erreur);
  }
}

function remplirFiltreEquipements(lignes) {
  const select = document.getElementById("filtreEquipement");
  if (!select) return;
  const equipementsUniques = [...new Set(lignes.map(l => l.equipement))];
  if (select.options.length > 1) return;
  equipementsUniques.forEach(eq => {
    const option = document.createElement("option");
    option.value = eq;
    option.textContent = eq;
    select.appendChild(option);
  });
}

function afficherHistoriqueFiltre() {
  const tbody = document.getElementById("tbodyHistorique");
  const filtreEq = document.getElementById("filtreEquipement");
  const filtreStatut = document.getElementById("filtreStatut");
  if (!tbody) return;

  let lignesFiltrees = historiqueComplet;
  if (filtreEq && filtreEq.value) lignesFiltrees = lignesFiltrees.filter(l => l.equipement === filtreEq.value);
  if (filtreStatut && filtreStatut.value === "normal") lignesFiltrees = lignesFiltrees.filter(l => !l.panne_predite);
  if (filtreStatut && filtreStatut.value === "panne") lignesFiltrees = lignesFiltrees.filter(l => l.panne_predite);

  if (lignesFiltrees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="table__empty">${t("dashboard.aucun_resultat", "Aucun résultat pour ces filtres.")}</td></tr>`;
    return;
  }

  tbody.innerHTML = lignesFiltrees.map(ligne => {
    const risquePct = Math.round(ligne.probabilite_panne * 100);
    const enPanne = !!ligne.panne_predite;
    const [date, heure] = ligne.date_prediction.split(" ");
    return `<tr>
      <td>${ligne.equipement}</td>
      <td class="risk-value">${risquePct}%</td>
      <td><span class="status-pill ${enPanne ? "danger" : "safe"}">${enPanne ? t("prediction.risque_detecte", "Risque détecté") : t("historique.normal", "Normal")}</span></td>
      <td class="risk-value">${heure}</td>
    </tr>`;
  }).join("");
}

// =============================================================
// EVOLUTION CHART
// =============================================================
async function chargerGraphiqueEvolution(equipementId = null) {
  try {
    const url = equipementId
      ? `${API_URL}/stats/evolution?equipement_id=${equipementId}`
      : `${API_URL}/stats/evolution`;
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error("Réponse API invalide");
    const donnees = await reponse.json();

    const canvas = document.getElementById("graphiqueEvolution");
    if (!canvas) return;
    const container = canvas.parentElement;

    if (graphiqueEvolutionInstance) { graphiqueEvolutionInstance.destroy(); graphiqueEvolutionInstance = null; }

    const existingEmpty = container.querySelector(".chart-empty-state");
    if (existingEmpty) existingEmpty.remove();

    if (!donnees || donnees.length === 0) {
      canvas.style.display = "none";
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "chart-empty-state";
      emptyDiv.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 16px;color:var(--text-dim);text-align:center;gap:12px;";
      emptyDiv.innerHTML = '<i class="fa-solid fa-chart-line" style="font-size:2rem;opacity:0.3;"></i><span style="font-size:0.9rem;font-weight:500;">' + (typeof t === "function" ? t("accueil.aucune_donnee_evolution", "Aucune donnée d'évolution disponible") : "Aucune donnée d'évolution disponible") + '</span><span style="font-size:0.78rem;opacity:0.7;">' + (typeof t === "function" ? t("accueil.effectuer_predictions", "Effectuez des prédictions pour générer des données") : "Effectuez des prédictions pour générer des données") + '</span>';
      container.appendChild(emptyDiv);
      return;
    }

    canvas.style.display = "";
    const labels = donnees.map(d => d.jour);
    const risques = donnees.map(d => d.risque_moyen_pct);
    const ctx = canvas.getContext("2d");

    const tc = getChartThemeColors();
    graphiqueEvolutionInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: t("accueil.risque_moyen", "Risque moyen (%)"),
          data: risques,
          borderColor: tc.accent,
          backgroundColor: tc.accentSoft,
          fill: true, tension: 0.3,
          pointBackgroundColor: tc.accent, pointRadius: 4,
          pointHoverRadius: 6, borderWidth: 2.5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (val) => val + "%", color: tc.textColor }, grid: { color: tc.gridColor } },
          x: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor } }
        },
        animation: { duration: 800, easing: "easeInOutQuart" }
      }
    });
  } catch (erreur) {
    console.error("Erreur chargement graphique évolution :", erreur);
  }
}

// =============================================================
// initPrediction — called when user navigates to "prediction"
// =============================================================
function initPrediction() {
  chargerEquipementsSelect();
  setupFormPrediction();
  setupPresets();
}

async function chargerEquipementsSelect() {
  const select = document.getElementById("equipement_id");
  if (!select) return;
  try {
    const reponse = await fetch(`${API_URL}/equipements`);
    if (!reponse.ok) throw new Error("Réponse API invalide");
    const equipements = await reponse.json();
    select.innerHTML = "";
    equipements.forEach(eq => {
      const option = document.createElement("option");
      option.value = eq.id;
      option.textContent = `${eq.nom} — ${eq.localisation}`;
      select.appendChild(option);
    });
  } catch (erreur) {
    select.innerHTML = `<option value="" disabled selected>${t("commun.api_inj", "API injoignable")}</option>`;
    console.error("Erreur chargement équipements :", erreur);
  }
}

function setupFormPrediction() {
  const form = document.getElementById("formPrediction");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnAnalyser = document.getElementById("btnAnalyser");
    const payload = {
      equipement_id: parseInt(document.getElementById("equipement_id").value),
      type_produit: document.getElementById("type_produit").value,
      air_temperature: parseFloat(document.getElementById("air_temperature").value),
      process_temperature: parseFloat(document.getElementById("process_temperature").value),
      rotational_speed: parseInt(document.getElementById("rotational_speed").value),
      torque: parseFloat(document.getElementById("torque").value),
      tool_wear: parseInt(document.getElementById("tool_wear").value)
    };

    btnAnalyser.disabled = true;
    btnAnalyser.querySelector("span").textContent = t("prediction.analyse_cours", "Analyse en cours…");

    try {
      const reponse = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!reponse.ok) {
        const erreurJson = await reponse.json();
        throw new Error(erreurJson.erreur || "Erreur inconnue");
      }
      const resultat = await reponse.json();
      afficherResultatPrediction(resultat, payload);
    } catch (erreur) {
      afficherErreurPrediction(erreur.message);
    } finally {
      btnAnalyser.disabled = false;
      btnAnalyser.querySelector("span").textContent = t("prediction.lancer_analyse", "Lancer l'analyse");
    }
  });
}

// =============================================================
// GAUGE
// =============================================================
const CIRCONFERENCE = 2 * Math.PI * 85;

function majJauge(probabilite) {
  const cercle = document.getElementById("gaugeCircle");
  const pctTexte = document.getElementById("gaugePct");
  if (!cercle || !pctTexte) return;
  const offset = CIRCONFERENCE - (probabilite * CIRCONFERENCE);
  cercle.style.strokeDashoffset = offset;
  let couleur;
  if (probabilite < 0.35) couleur = getCSS('--accent-primary');
  else if (probabilite < 0.71) couleur = getCSS('--warning');
  else couleur = getCSS('--danger');
  cercle.style.stroke = couleur;
  pctTexte.textContent = `${Math.round(probabilite * 100)}%`;
}

function afficherResultatPrediction(resultat, lastPayload) {
  majJauge(resultat.probabilite_panne);

  const badge = document.getElementById("verdictBadge");
  const texte = document.getElementById("verdictText");
  if (!badge || !texte) return;

  if (resultat.panne_predite) {
    badge.textContent = t("prediction.risque_detecte", "RISQUE DÉTECTÉ");
    badge.className = "verdict__badge danger";
    texte.textContent = t("rapports.recommandations", "Le modèle estime un risque de panne au-delà du seuil de décision. Une inspection préventive est recommandée.");
  } else {
    badge.textContent = t("prediction.fonctionnement_normal", "FONCTIONNEMENT NORMAL");
    badge.className = "verdict__badge safe";
    texte.textContent = t("historique.normal", "Aucun signe de défaillance détecté sur la base des mesures fournies.");
  }

  document.getElementById("metaSeuil").textContent = parseFloat(resultat.seuil_utilise).toFixed(3);
  document.getElementById("metaMesure").textContent = `#${resultat.mesure_id}`;

  chargerExplication(lastPayload);
  chargerRUL(lastPayload);
}

function afficherErreurPrediction(message) {
  const badge = document.getElementById("verdictBadge");
  const texte = document.getElementById("verdictText");
  if (!badge || !texte) return;
  badge.textContent = t("commun.erreur", "ERREUR");
  badge.className = "verdict__badge danger";
  texte.textContent = `${t("commun.erreur", "Une erreur est survenue")} : ${message}`;
}

// =============================================================
// EXPLAIN + RUL
// =============================================================
async function chargerExplication(payload) {
  try {
    const reponse = await fetch(`${API_URL}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const donnees = await reponse.json();
    const zoneExplication = document.getElementById("zoneExplication");
    if (!zoneExplication) return;
    zoneExplication.innerHTML = donnees.explications.map(e => `
      <div class="explain-row">
        <span>${e.variable}</span>
        <span class="${e.contribution > 0 ? 'danger' : 'safe'}">${e.impact}</span>
      </div>
    `).join("");
  } catch (erreur) {
    console.error("Erreur explication :", erreur);
  }
}

async function chargerRUL(payload) {
  try {
    const reponse = await fetch(`${API_URL}/rul`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const donnees = await reponse.json();
    const zone = document.getElementById("zoneRUL");
    if (zone) zone.style.display = "block";
    const jours = document.getElementById("rulJours");
    if (jours) jours.textContent = donnees.jours_restants_estimes + " " + t("prediction.jours", "jours");
  } catch (erreur) {
    console.error("Erreur RUL :", erreur);
  }
}

// =============================================================
// PRESETS
// =============================================================
const presets = {
  normal: { type_produit: "L", air_temperature: 298.0, process_temperature: 308.5, rotational_speed: 1500, torque: 40, tool_wear: 10 },
  risque: { type_produit: "H", air_temperature: 302.0, process_temperature: 311.0, rotational_speed: 1350, torque: 65, tool_wear: 220 }
};

function setupPresets() {
  document.querySelectorAll(".preset").forEach(bouton => {
    bouton.addEventListener("click", () => {
      const valeurs = presets[bouton.dataset.preset];
      const tp = document.getElementById("type_produit");
      const at = document.getElementById("air_temperature");
      const pt = document.getElementById("process_temperature");
      const rs = document.getElementById("rotational_speed");
      const tq = document.getElementById("torque");
      const tw = document.getElementById("tool_wear");
      if (tp) tp.value = valeurs.type_produit;
      if (at) at.value = valeurs.air_temperature;
      if (pt) pt.value = valeurs.process_temperature;
      if (rs) rs.value = valeurs.rotational_speed;
      if (tq) tq.value = valeurs.torque;
      if (tw) tw.value = valeurs.tool_wear;
    });
  });
}

// =============================================================
// KPI + BADGES (called once on shell load)
// =============================================================
function initKPIs() {
  chargerKPI();
  majBadgeAlertes();
}

async function chargerKPI() {
  try {
    const [reponseHistorique, reponseEquipements] = await Promise.all([
      fetch(`${API_URL}/historique`),
      fetch(`${API_URL}/equipements`)
    ]);
    const data = await reponseHistorique.json();
    const historique = data.donnees || data;
    const equipements = await reponseEquipements.json();

    const total = Array.isArray(historique) ? historique.length : 0;
    const pannes = Array.isArray(historique) ? historique.filter(h => h.panne_predite).length : 0;
    const risqueMoyen = total > 0 ? (historique.reduce((s, h) => s + h.probabilite_panne, 0) / total * 100).toFixed(1) : 0;

    const el = (id) => document.getElementById(id);
    if (el("kpiTotal")) el("kpiTotal").textContent = total;
    if (el("kpiPannes")) el("kpiPannes").textContent = pannes;
    if (el("kpiRisque")) el("kpiRisque").textContent = risqueMoyen + "%";
    if (el("kpiEquipements")) el("kpiEquipements").textContent = equipements.length;
    if (el("chipAlertes")) {
      const alertLabel = pannes > 1 ? t("accueil.alertes_actives", "alertes actives") : t("accueil.alerte_active", "alerte active");
      el("chipAlertes").textContent = `${pannes} ${alertLabel.toUpperCase()}`;
    }
  } catch (erreur) {
    console.error("Erreur chargement KPI :", erreur);
  }
}

async function majBadgeAlertes() {
  try {
    const reponse = await fetch(`${API_URL}/alertes`);
    const alertes = await reponse.json();
    const nb = alertes.length;
    const badge = document.getElementById("navBadgeAlertes");
    const cloche = document.getElementById("clocheBadge");
    if (badge) badge.textContent = nb;
    if (cloche) cloche.textContent = nb;
  } catch (erreur) {
    console.error("Erreur badge alertes :", erreur);
  }
}

// =============================================================
// CSV & PDF EXPORT
// =============================================================
function exporterHistoriqueCSV() {
  const filtreEq = document.getElementById("filtreEquipement");
  const filtreStatut = document.getElementById("filtreStatut");
  let donnees = historiqueComplet;
  if (filtreEq && filtreEq.value) donnees = donnees.filter(d => d.equipement === filtreEq.value);
  if (filtreStatut && filtreStatut.value === "normal") donnees = donnees.filter(d => !d.panne_predite);
  if (filtreStatut && filtreStatut.value === "panne") donnees = donnees.filter(d => d.panne_predite);

  if (donnees.length === 0) { showToast(t("commun.aucun_resultat", "Aucune donnée à exporter."), "warning"); return; }

  const entetes = [t("export.equipement", "Équipement"), t("export.localisation", "Localisation"), t("export.temp_air_k", "Température air (K)"), t("export.temp_proc_k", "Température process (K)"), t("export.vitesse_rotation", "Vitesse rotation (rpm)"), t("export.couple_nm", "Couple (Nm)"), t("export.usure_outil", "Usure outil (min)"), t("export.probabilite_panne", "Probabilité panne (%)"), t("export.statut", "Statut"), t("export.date", "Date")];
  const lignes = donnees.map(d => [d.equipement, d.localisation, d.air_temperature, d.process_temperature, d.rotational_speed, d.torque, d.tool_wear, (d.probabilite_panne * 100).toFixed(3), d.panne_predite ? t("commun.alerte_panne", "Panne détectée") : t("historique.normal", "Normal"), d.date_prediction]);

  let contenuCSV = entetes.join(";") + "\n";
  lignes.forEach(ligne => { contenuCSV += ligne.join(";") + "\n"; });

  const blob = new Blob(["\uFEFF" + contenuCSV], { type: "text/csv;charset=utf-8;" });
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = `historique_maintenance_${new Date().toISOString().slice(0, 10)}.csv`;
  lien.click();
}

function exporterHistoriquePDF() {
  if (historiqueComplet.length === 0) { showToast(t("commun.aucun_resultat", "Aucune donnée à exporter."), "warning"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(t("pdf.titre", "Historique de Maintenance Prédictive"), 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${t("pdf.genere_le", "Généré le")} ${new Date().toLocaleDateString(getLocale())} — OCP`, 14, 25);

  const colonnes = [t("export.equipement", "Équipement"), t("export.risque_pct", "Risque (%)"), t("export.statut", "Statut"), t("export.date", "Date")];
  const lignes = historiqueComplet.map(d => [d.equipement, (d.probabilite_panne * 100).toFixed(1) + "%", d.panne_predite ? t("commun.alerte_panne", "Panne détectée") : t("historique.normal", "Normal"), d.date_prediction]);
  doc.autoTable({
    head: [colonnes], body: lignes, startY: 32,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: hexToRgb(getCSS('--accent-primary')), textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: hexToRgb(getCSS('--bg-primary')) }
  });
  doc.save(`historique_maintenance_${new Date().toISOString().slice(0, 10)}.pdf`);
}
