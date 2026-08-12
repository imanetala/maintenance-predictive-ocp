// =============================================================
// pages.js — All page logic (SPA-compatible)
// =============================================================

// ---- ACCUEIL ----
let accueilDonutInstance = null;
let accueilBarInstance = null;
let accueilEvolutionInstance = null;
let accueilRefreshInterval = null;
let accueilClockInterval = null;
let accueilEvolutionPeriod = "7j";
let accueilHistorique = [];

function initAccueil() {
  setupAccueilGreeting();
  chargerAccueilAll();
  setupEvolutionFilter();
  if (lucide) lucide.createIcons();
  if (accueilRefreshInterval) clearInterval(accueilRefreshInterval);
  accueilRefreshInterval = setInterval(() => {
    if (!document.getElementById("accueilPage")) { clearInterval(accueilRefreshInterval); return; }
    chargerAccueilAll();
  }, 25000);
}

function setupAccueilGreeting() {
  const el = document.getElementById("welcomeText");
  const dtEl = document.getElementById("welcomeDateTime");
  if (!el) return;

  const h = new Date().getHours();
  const greeting = (h >= 6 && h < 18) ? t("accueil.bonjour", "Bonjour") : t("accueil.bonsoir", "Bonsoir");

  fetch(`${API_URL}/session`, { credentials: "include" })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const name = (data && data.nom_utilisateur) ? ", " + data.nom_utilisateur : "";
      el.textContent = greeting + name + ".";
    })
    .catch(() => { el.textContent = greeting + "."; });

  function updateClock() {
    if (!dtEl) return;
    if (!document.getElementById("accueilPage")) { clearInterval(accueilClockInterval); return; }
    const now = new Date();
    const opts = { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" };
    dtEl.textContent = now.toLocaleDateString(getLocale(), opts);
  }
  if (accueilClockInterval) clearInterval(accueilClockInterval);
  updateClock();
  accueilClockInterval = setInterval(updateClock, 1000);
}

function animateValue(el, end, suffix, duration) {
  if (!el) return;
  const numEnd = parseFloat(end) || 0;
  const isInt = Number.isInteger(numEnd);
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = numEnd * eased;
    el.textContent = (isInt ? Math.round(current) : current.toFixed(1)) + (suffix || "");
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

async function chargerAccueilAll() {
  try {
    const [histResp, eqResp, alertResp, modeleResp] = await Promise.all([
      fetch(`${API_URL}/historique`, { credentials: "include" }),
      fetch(`${API_URL}/equipements`),
      fetch(`${API_URL}/alertes`),
      fetch(`${API_URL}/monitoring/modele`)
    ]);

    const histData = await histResp.json();
    const equipements = await eqResp.json();
    const alertes = await alertResp.json();
    const modeleData = await modeleResp.json();

    const historique = histData.donnees || histData;
    const arr = Array.isArray(historique) ? historique : [];
    accueilHistorique = arr;
    const eqArr = Array.isArray(equipements) ? equipements : [];
    const alertArr = Array.isArray(alertes) ? alertes : [];

    const total = arr.length;
    const pannes = arr.filter(h => h.panne_predite).length;
    const normales = total - pannes;

    const eqRisks = {};
    arr.forEach(h => {
      if (!eqRisks[h.equipement]) eqRisks[h.equipement] = { sum: 0, count: 0 };
      eqRisks[h.equipement].sum += h.probabilite_panne;
      eqRisks[h.equipement].count++;
    });
    const eqARisque = Object.values(eqRisks).filter(v => (v.sum / v.count) > 0.5).length;

    const f1Score = (modeleData && modeleData.performance_initiale && modeleData.performance_initiale.f1_score)
      ? (modeleData.performance_initiale.f1_score * 100).toFixed(1) : "--";

    animateValue(document.getElementById("kpiEquipements"), eqArr.length, "", 800);
    animateValue(document.getElementById("kpiNormales"), normales, "", 800);
    animateValue(document.getElementById("kpiPannes"), pannes, "", 800);
    animateValue(document.getElementById("kpiRisqueEleve"), eqARisque, "", 800);
    animateValue(document.getElementById("kpiTotal"), total, "", 800);
    const f1El = document.getElementById("kpiF1");
    if (f1El) f1El.textContent = f1Score !== "--" ? f1Score + "%" : "--";

    const pannesCard = document.getElementById("kpiPannesCard");
    if (pannesCard) pannesCard.classList.toggle("alert-pulse", pannes > 0);

    const risqueMoyenGlobal = total > 0 ? arr.reduce((s, h) => s + h.probabilite_panne, 0) / total * 100 : 0;
    const healthPct = Math.max(0, Math.min(100, Math.round(100 - risqueMoyenGlobal)));
    updateHealthGauge(healthPct);

    chargerEquipementsTable(eqArr, arr);
    chargerAccueilEvolution(accueilEvolutionPeriod);
    chargerAccueilPanneCharts(arr);
    chargerAccueilAlertes(alertArr);
  } catch (e) {
    console.error("Erreur accueil all:", e);
  }
}

function updateHealthGauge(pct) {
  const circumference = 2 * Math.PI * 85;
  const offset = circumference - (pct / 100) * circumference;
  const fill = document.getElementById("healthGaugeFill");
  const txt = document.getElementById("healthGaugePct");
  if (fill) {
    fill.style.strokeDashoffset = offset;
    fill.style.stroke = pct > 80 ? "var(--accent-primary)" : pct > 50 ? "var(--warning)" : "var(--danger)";
  }
  if (txt) txt.textContent = pct + "%";
}

function chargerEquipementsTable(eqArr, histArr) {
  const tbody = document.getElementById("equipementsTbody");
  if (!tbody) return;

  const eqData = {};
  histArr.forEach(h => {
    if (!eqData[h.equipement]) eqData[h.equipement] = { nom: h.equipement, sum: 0, count: 0 };
    eqData[h.equipement].sum += h.probabilite_panne;
    eqData[h.equipement].count++;
  });

  const equipment = eqArr.map(e => {
    const d = eqData[e.nom] || { sum: 0, count: 0 };
    const avgRisk = d.count > 0 ? (d.sum / d.count * 100) : 0;
    return { nom: e.nom, localisation: e.localisation, risque: avgRisk, type: e.type_produit };
  });

  if (equipment.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table__empty">${t("accueil.aucun_equipement", "Aucun équipement trouvé")}</td></tr>`;
    return;
  }

  tbody.innerHTML = equipment.map(eq => {
    const risk = eq.risque.toFixed(1);
    let cls, label;
    if (eq.risque >= 50) { cls = "danger"; label = t("accueil.critique", "Critique"); }
    else if (eq.risque >= 25) { cls = "warning"; label = t("accueil.a_surveiller", "À surveiller"); }
    else { cls = "safe"; label = t("accueil.normal", "Normal"); }
    return `<tr>
      <td><strong>${eq.nom}</strong><br><span style="font-size:0.75rem;color:var(--text-dim);">${eq.type || ""}</span></td>
      <td>${eq.localisation || "-"}</td>
      <td class="risk-value">${risk}%</td>
      <td><span class="status-pill ${cls}">${label}</span></td>
      <td><button class="action-btn" onclick="loadPage('prediction')"><i data-lucide="eye" style="width:14px;height:14px;"></i> ${t("accueil.detail", "Détail")}</button></td>
    </tr>`;
  }).join("");
  if (lucide) lucide.createIcons();
}

function setupEvolutionFilter() {
  const container = document.getElementById("evolutionFilter");
  if (!container) return;
  container.querySelectorAll(".time-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".time-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      accueilEvolutionPeriod = btn.dataset.period;
      chargerAccueilEvolution(accueilEvolutionPeriod);
    });
  });
}

async function chargerAccueilEvolution(period) {
  try {
    const resp = await fetch(`${API_URL}/stats/evolution`, { credentials: "include" });
    if (!resp.ok) throw new Error("API error");
    const data = await resp.json();
    const canvas = document.getElementById("graphiqueEvolution");
    if (!canvas) return;
    const container = canvas.parentElement;

    if (accueilEvolutionInstance) { accueilEvolutionInstance.destroy(); accueilEvolutionInstance = null; }
    const existingEmpty = container.querySelector(".chart-empty-state");
    if (existingEmpty) existingEmpty.remove();

    if (!data || data.length === 0) {
      canvas.style.display = "none";
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "chart-empty-state";
      emptyDiv.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 16px;color:var(--text-dim);text-align:center;gap:12px;";
      emptyDiv.innerHTML = '<i data-lucide="bar-chart-2" style="width:48px;height:48px;opacity:0.3;"></i><span style="font-size:0.9rem;font-weight:500;">' + t("accueil.aucune_donnee_evolution", "Aucune donnée d'évolution disponible") + '</span><span style="font-size:0.78rem;opacity:0.7;">' + t("accueil.effectuer_predictions", "Effectuez des prédictions pour générer des données") + '</span>';
      container.appendChild(emptyDiv);
      if (lucide) lucide.createIcons();
      return;
    }

    canvas.style.display = "";
    const now = new Date();
    let cutoff;
    if (period === "24h") cutoff = new Date(now - 24 * 60 * 60 * 1000);
    else if (period === "30j") cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    else cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const filtered = data.filter(d => new Date(d.jour) >= cutoff);
    const labels = filtered.map(d => d.jour);
    const risques = filtered.map(d => d.risque_moyen_pct);
    const pannesData = filtered.map(d => d.nombre_pannes || 0);

    const tc = typeof getChartThemeColors === "function" ? getChartThemeColors() : { accent: "#10B981", danger: "#EF4444", textColor: "#64748B", gridColor: "#F1F5F9", accentSoft: "rgba(16,185,129,0.1)" };

    accueilEvolutionInstance = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: t("chart.risque_moyen_pct", "Risque moyen (%)"),
            data: risques, borderColor: tc.accent, backgroundColor: tc.accentSoft,
            fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2.5,
            yAxisID: "y"
          },
          {
            label: t("chart.pannes", "Pannes"),
            data: pannesData, borderColor: tc.danger || "#EF4444", backgroundColor: "transparent",
            borderDash: [5, 5], tension: 0.3, pointRadius: 2, pointHoverRadius: 4, borderWidth: 2,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: true, position: "top", labels: { boxWidth: 12, padding: 16, color: tc.textColor, font: { size: 12 } } } },
        scales: {
          y: { beginAtZero: true, max: 100, position: "left", ticks: { callback: v => v + "%", color: tc.textColor }, grid: { color: tc.gridColor } },
          y1: { beginAtZero: true, position: "right", ticks: { color: tc.textColor }, grid: { drawOnChartArea: false } },
          x: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor, maxRotation: 45 } }
        },
        animation: { duration: 800, easing: "easeInOutQuart" }
      }
    });
  } catch (e) {
    console.error("Erreur chargement évolution accueil:", e);
  }
}

function chargerAccueilPanneCharts(arr) {
  if (!arr || arr.length === 0) return;

  const equipementCounts = {};
  let normal = 0, panneCount = 0;
  arr.forEach(d => {
    if (d.panne_predite) {
      panneCount++;
      equipementCounts[d.equipement] = (equipementCounts[d.equipement] || 0) + 1;
    } else {
      normal++;
    }
  });

  const tc = typeof getChartThemeColors === "function" ? getChartThemeColors() : { accent: "#10B981", warning: "#F59E0B", danger: "#EF4444", textColor: "#64748B", gridColor: "#F1F5F9" };

  const donutCanvas = document.getElementById("accueilDonutChart");
  if (donutCanvas) {
    if (accueilDonutInstance) { accueilDonutInstance.destroy(); accueilDonutInstance = null; }
    accueilDonutInstance = new Chart(donutCanvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: [t("chart.normal", "Normal"), t("chart.panne", "Panne")],
        datasets: [{ data: [normal, panneCount], backgroundColor: [tc.accent || "#10B981", tc.danger || "#EF4444"], borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "65%",
        plugins: { legend: { display: true, position: "bottom", labels: { padding: 16, boxWidth: 12, color: tc.textColor, font: { size: 12 } } } },
        animation: { animateRotate: true, duration: 1000 }
      }
    });
    const centerVal = document.getElementById("donutCenterValue");
    if (centerVal) centerVal.textContent = arr.length;
  }

  const barCanvas = document.getElementById("accueilBarChart");
  if (barCanvas) {
    if (accueilBarInstance) { accueilBarInstance.destroy(); accueilBarInstance = null; }
    const eqLabels = Object.keys(equipementCounts);
    const eqValues = Object.values(equipementCounts);
    if (eqLabels.length === 0) return;
    const barColors = eqValues.map(v => {
      const max = Math.max(...eqValues, 1);
      const ratio = v / max;
      if (ratio > 0.7) return tc.danger || "#EF4444";
      if (ratio > 0.3) return tc.warning || "#F59E0B";
      return tc.accent || "#10B981";
    });
    accueilBarInstance = new Chart(barCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: eqLabels,
        datasets: [{ label: t("chart.pannes", "Pannes"), data: eqValues, backgroundColor: barColors, borderRadius: 6, maxBarThickness: 40 }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: tc.textColor, stepSize: 1 }, grid: { color: tc.gridColor } },
          y: { ticks: { color: tc.textColor, font: { size: 12 } }, grid: { display: false } }
        },
        animation: { duration: 800, easing: "easeInOutQuart" }
      }
    });
  }
}

async function chargerAccueilAlertes(alertArr) {
  const container = document.getElementById("accueilTimeline");
  if (!container) return;

  const arr = Array.isArray(alertArr) ? alertArr.slice(0, 5) : [];
  if (arr.length === 0) {
    container.innerHTML = '<div class="timeline-empty"><i data-lucide="bell-off"></i><span>' + t("accueil.aucune_alerte", "Aucune alerte pour le moment") + '</span></div>';
    if (lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = '<div class="timeline">' + arr.map(a => {
    const prob = a.probabilite_panne_pct;
    const dotClass = prob >= 70 ? "red" : "orange";
    const probClass = prob >= 70 ? "high" : "mid";
    const timeStr = a.date_prediction ? formatDateTime(a.date_prediction) : "";
    const desc = prob >= 70 ? t("accueil.risque_critique_detecte", "Risque critique détecté") : t("accueil.risque_eleve_detecte", "Risque élevé détecté");
    return `<div class="timeline-item">
      <div class="timeline-dot ${dotClass}"></div>
      <div class="timeline-equip">${a.equipement}</div>
      <div class="timeline-meta">
        <span class="timeline-prob ${probClass}">${prob.toFixed(1)}%</span>
        <span>${desc}</span>
        <span>${timeStr}</span>
      </div>
    </div>`;
  }).join("") + '</div>';
  if (lucide) lucide.createIcons();
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("commun.a_l_instant", "à l'instant");
  if (diffMin < 60) return t("commun.il_y_a", "il y a") + " " + diffMin + " " + t("commun.min_suffix", "min");
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t("commun.il_y_a", "il y a") + " " + diffH + t("commun.h_suffix", "h");
  const diffJ = Math.floor(diffH / 24);
  return t("commun.il_y_a", "il y a") + " " + diffJ + t("commun.j_suffix", "j");
}

// ---- HISTORIQUE FULL PAGE ----
let histData = [];
let histPage = 1;
let histLimite = 20;
let histTri = "date_prediction";
let histSens = "DESC";

async function initHistoriqueFull() {
  await chargerHistoriqueFull();
  const pageSelect = document.getElementById("histPageSize");
  if (pageSelect) pageSelect.addEventListener("change", () => { histLimite = parseInt(pageSelect.value); histPage = 1; chargerHistoriqueFull(); });
  const prev = document.getElementById("histPrev");
  const next = document.getElementById("histNext");
  if (prev) prev.addEventListener("click", () => { if (histPage > 1) { histPage--; chargerHistoriqueFull(); } });
  if (next) next.addEventListener("click", () => { histPage++; chargerHistoriqueFull(); });

  document.querySelectorAll(".sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (histTri === col) { histSens = histSens === "ASC" ? "DESC" : "ASC"; }
      else { histTri = col; histSens = "DESC"; }
      chargerHistoriqueFull();
    });
  });

  const btnExcel = document.getElementById("btnHistExcel");
  const btnPDF = document.getElementById("btnHistPDF");
  if (btnExcel) btnExcel.addEventListener("click", exporterHistoriqueExcel);
  if (btnPDF) btnPDF.addEventListener("click", exporterHistoriquePDFPro);

  chargerStatsHistorique();
}

async function chargerHistoriqueFull() {
  const params = new URLSearchParams({
    page: histPage, limite: histLimite, tri: histTri, sens: histSens
  });

  try {
    const resp = await fetch(`${API_URL}/historique?${params}`, { credentials: "include" });
    const data = await resp.json();
    histData = data.donnees || [];
    afficherHistoriqueFull(data);
  } catch (e) {
    const tbody = document.getElementById("histTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="table__empty">${t("historique.aucun_resultat", "Erreur de chargement")}</td></tr>`;
  }
}


function afficherHistoriqueFull(data) {
  const tbody = document.getElementById("histTbody");
  if (!tbody) return;

  document.querySelectorAll(".sortable").forEach(th => {
    th.classList.toggle("sorted", th.dataset.col === histTri);
  });

  if (!data.donnees || data.donnees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="table__empty">${t("historique.aucun_resultat", "Aucun résultat")}</td></tr>`;
    renderPagination(data);
    return;
  }

  const recommandations = (prob) => {
    if (prob >= 0.7) return t("historique.recommandation", "Inspection urgente requise");
    if (prob >= 0.39) return t("alertes.moyenne", "Surveillance renforcée");
    return t("historique.normal", "Fonctionnement normal");
  };

  tbody.innerHTML = data.donnees.map(d => {
    const probPct = (d.probabilite_panne * 100).toFixed(1);
    const statutClass = d.statut === "critique" ? "danger" : d.statut === "risque" ? "warning" : "safe";
    const statutLabel = d.statut === "critique" ? t("historique.critique", "Critique") : d.statut === "risque" ? t("historique.risque", "Risque") : t("historique.normal", "Normal");
    return `<tr>
      <td class="risk-value">#${d.prediction_id}</td>
      <td class="risk-value">${d.date_prediction}</td>
      <td>${d.equipement}</td>
      <td>${d.air_temperature} K</td>
      <td>${d.rotational_speed} rpm</td>
      <td>${d.torque} Nm</td>
      <td>${d.tool_wear} min</td>
      <td class="risk-value">${probPct}%</td>
      <td><span class="status-pill ${statutClass}">${statutLabel}</span></td>
      <td class="recommandation-text">${recommandations(d.probabilite_panne)}</td>
      <td><button class="action-btn" onclick="voirDetailPrediction(${JSON.stringify(d).replace(/"/g, '&quot;')})"><i data-lucide="eye" style="width:14px;height:14px;"></i></button></td>
      <td><button class="action-btn danger" onclick="supprimerPrediction(${d.prediction_id})"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button></td>
    </tr>`;
  }).join("");

  renderPagination(data);
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderPagination(data) {
  const info = document.getElementById("histPaginationInfo");
  const pages = document.getElementById("histPageNumbers");
  if (!info || !pages) return;
  const total = data.total || 0;
  const totalPages = data.pages || 1;
  info.textContent = `${(data.page - 1) * histLimite + 1}-${Math.min(data.page * histLimite, total)} / ${total}`;

  let html = "";
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= histPage - 2 && i <= histPage + 2)) {
      html += `<button class="page-num ${i === histPage ? 'active' : ''}" onclick="histPage=${i};chargerHistoriqueFull();">${i}</button>`;
    } else if (i === histPage - 3 || i === histPage + 3) {
      html += `<span style="color:var(--text-dim);">…</span>`;
    }
  }
  pages.innerHTML = html;
}

function voirDetailPrediction(d) {
  const overlay = document.getElementById("modalDetailOverlay");
  const body = document.getElementById("modalDetailBody");
  if (!overlay || !body) return;

  const prob = (d.probabilite_panne * 100).toFixed(1);
  const statut = d.statut === "critique" ? t("historique.critique", "CRITIQUE") : d.statut === "risque" ? t("historique.risque", "RISQUE") : t("historique.normal", "NORMAL");
  body.innerHTML = `
    <div class="modal-field"><span class="modal-field__label">ID</span><span class="modal-field__value">#${d.prediction_id}</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("historique.date_heure", "Date")}</span><span class="modal-field__value">${d.date_prediction}</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("historique.equipement", "Équipement")}</span><span class="modal-field__value">${d.equipement}</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("dashboard.localisation", "Localisation")}</span><span class="modal-field__value">${d.localisation || '—'}</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("prediction.temp_air", "Température air")}</span><span class="modal-field__value">${d.air_temperature} K</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("prediction.temp_proc", "Température process")}</span><span class="modal-field__value">${d.process_temperature} K</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("prediction.rotation", "Vitesse rotation")}</span><span class="modal-field__value">${d.rotational_speed} rpm</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("prediction.couple", "Couple")}</span><span class="modal-field__value">${d.torque} Nm</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("prediction.usure_outil", "Usure outil")}</span><span class="modal-field__value">${d.tool_wear} min</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("historique.probabilite", "Probabilité")}</span><span class="modal-field__value" style="color:${d.statut === 'critique' ? 'var(--danger)' : d.statut === 'risque' ? 'var(--warning)' : 'var(--accent-primary)'}">${prob}%</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("historique.statut", "Statut")}</span><span class="modal-field__value">${statut}</span></div>
    <div class="modal-field"><span class="modal-field__label">${t("historique.recommandation", "Recommandation")}</span><span class="modal-field__value" style="font-family:var(--font-sans);font-size:0.85rem;">${prob >= 70 ? t("historique.recommandation", "Inspection urgente requise") : prob >= 39 ? t("alertes.moyenne", "Surveillance renforcée") : t("historique.normal", "Fonctionnement normal")}</span></div>
  `;
  overlay.style.display = "flex";
  document.getElementById("fermerModalDetail").onclick = () => { overlay.style.display = "none"; };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.style.display = "none"; });
}

async function supprimerPrediction(id) {
  if (!confirm(t("historique.confirmer_suppression", "Supprimer cette prédiction ?"))) return;
  try {
    await fetch(`${API_URL}/historique/${id}`, { method: "DELETE", credentials: "include" });
    chargerHistoriqueFull();
    chargerStatsHistorique();
  } catch (e) { console.error(e); }
}

async function chargerStatsHistorique() {
  try {
    const resp = await fetch(`${API_URL}/historique/stats`, { credentials: "include" });
    const stats = await resp.json();
    const el = (id) => document.getElementById(id);
    if (el("histTotal")) el("histTotal").textContent = stats.total || 0;
    if (el("histPannes")) el("histPannes").textContent = stats.pannes || 0;
    if (el("histRisque")) el("histRisque").textContent = (stats.risque_moyen || 0) + "%";
  } catch (e) { console.error(e); }
}

// ---- ALERTES PAGE ----
async function initAlertes() {
  await chargerAlertes();
}

async function chargerAlertes() {
  const tbody = document.getElementById("tbodyAlertes");
  try {
    const resp = await fetch(`${API_URL}/alertes`, { credentials: "include" });
    let alertes = await resp.json();
    if (!Array.isArray(alertes)) alertes = [];

    const el = (id) => document.getElementById(id);
    if (el("alertesTotal")) el("alertesTotal").textContent = alertes.length;
    const today = new Date().toISOString().slice(0, 10);
    if (el("alertesAujourdhui")) el("alertesAujourdhui").textContent = alertes.filter(a => a.date_prediction && a.date_prediction.startsWith(today)).length;

    if (alertes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="table__empty">${t("alertes.aucune_alerte", "Aucune alerte active.")}</td></tr>`;
      return;
    }
    tbody.innerHTML = alertes.map(a => {
      const prob = a.probabilite_panne_pct || (a.probabilite_panne * 100).toFixed(1);
      const niveau = prob >= 70 ? "critique" : "moyen";
      return `<tr>
        <td>${a.equipement || '—'}</td>
        <td class="risk-value">${prob}%</td>
        <td><span class="status-pill ${niveau === 'critique' ? 'danger' : 'warning'}">${niveau === 'critique' ? t('historique.critique', 'CRITIQUE') : t('alertes.moyenne', 'MOYEN')}</span></td>
        <td>${a.torque || '—'} Nm</td>
        <td>${a.tool_wear || '—'} min</td>
        <td>${a.rotational_speed || '—'} rpm</td>
        <td class="risk-value">${a.date_prediction || '—'}</td>
        <td><button class="action-btn" onclick="loadPage('prediction')">${t("alertes.analyser", "Analyser")}</button></td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="table__empty">${t("historique.aucun_resultat", "Erreur de chargement.")}</td></tr>`;
  }
}

// ---- EQUIPEMENTS CRUD ----
let equipementsData = [];

async function chargerEquipementsPage() {
  try {
    const reponse = await fetch(`${API_URL}/equipements`);
    equipementsData = await reponse.json();
    afficherEquipements(equipementsData);
  } catch (e) {
    const tbody = document.getElementById("tbodyEquipements");
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="table__empty">${t("historique.aucun_resultat", "Erreur de chargement")}</td></tr>`;
  }
}

function afficherEquipements(data) {
  const tbody = document.getElementById("tbodyEquipements");
  if (!tbody) return;
  const recherche = document.getElementById("rechercheEquipement");
  const filtreType = document.getElementById("filtreTypeEquipement");
  const filtreRecherche = recherche ? recherche.value.toLowerCase() : "";
  const typeVal = filtreType ? filtreType.value : "";
  let filtres = data;
  if (filtreRecherche) filtres = filtres.filter(e => e.nom.toLowerCase().includes(filtreRecherche) || (e.localisation || "").toLowerCase().includes(filtreRecherche));
  if (typeVal) filtres = filtres.filter(e => e.type_produit === typeVal);
  if (filtres.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table__empty">${t("historique.aucun_resultat", "Aucun équipement trouvé")}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtres.map(e => `
    <tr>
      <td>#${e.id}</td>
      <td>${e.nom}</td>
      <td><span class="status-pill ${e.type_produit === 'H' ? 'danger' : e.type_produit === 'M' ? 'warning' : 'safe'}">${e.type_produit}</span></td>
      <td>${e.localisation || '-'}</td>
      <td>${e.fabricant || 'N/A'}</td>
      <td>${e.date_installation || '-'}</td>
      <td><span class="status-pill safe">${t("historique.normal", "Actif")}</span></td>
      <td>
        <button class="action-btn" onclick="modifierEquipement(${e.id})">${t("commun.modifier", "Modifier")}</button>
        <button class="action-btn danger" onclick="supprimerEquipement(${e.id})">${t("commun.supprimer", "Supprimer")}</button>
      </td>
    </tr>
  `).join("");
}

async function modifierEquipement(id) {
  try {
    const reponse = await fetch(`${API_URL}/equipements/${id}`, { credentials: "include" });
    const eq = await reponse.json();
    const editId = document.getElementById("eqEditId");
    if (editId) editId.value = eq.id;
    const el = (i) => document.getElementById(i);
    if (el("eqNom")) el("eqNom").value = eq.nom;
    if (el("eqType")) el("eqType").value = eq.type_produit;
    if (el("eqLocalisation")) el("eqLocalisation").value = eq.localisation || "";
    if (el("eqFabricant")) el("eqFabricant").value = eq.fabricant || "";
    if (el("eqDateInstall")) el("eqDateInstall").value = eq.date_installation || "";
    const modal = document.getElementById("modalEquipement");
    if (modal) modal.style.display = "flex";
  } catch (e) { showToast(t("commun.erreur", "Erreur de chargement"), "error"); }
}

async function supprimerEquipement(id) {
  if (!confirm(t("historique.confirmer_suppression", "Supprimer cet équipement ?"))) return;
  try {
    await fetch(`${API_URL}/equipements/${id}`, { method: "DELETE", credentials: "include" });
    chargerEquipementsPage();
  } catch (e) { showToast(t("commun.erreur", "Erreur de suppression"), "error"); }
}

// ---- MONITORING LIVE ----
let monitoringInterval = null;
let liveChart = null;
let livePredChart = null;
let liveData = { labels: [], temp: [], torque: [], rpm: [], pred: [] };

function demarrerMonitoring() {
  const btnStart = document.getElementById("btnDemarrerMonitoring");
  const btnStop = document.getElementById("btnArreterMonitoring");
  if (btnStart) btnStart.style.display = "none";
  if (btnStop) btnStop.style.display = "block";
  monitoringInterval = setInterval(simulerCapteur, 2000);
  initLiveCharts();
}

function arreterMonitoring() {
  clearInterval(monitoringInterval);
  monitoringInterval = null;
  const btnStart = document.getElementById("btnDemarrerMonitoring");
  const btnStop = document.getElementById("btnArreterMonitoring");
  if (btnStart) btnStart.style.display = "block";
  if (btnStop) btnStop.style.display = "none";
}

async function simulerCapteur() {
  const equipements = await fetch(`${API_URL}/equipements`).then(r => r.json()).catch(() => []);
  if (!equipements.length) return;
  const eq = equipements[Math.floor(Math.random() * equipements.length)];
  const isRisk = Math.random() < 0.15;
  const temp = isRisk ? 300 + Math.random() * 12 : 295 + Math.random() * 8;
  const tempProc = temp + 8 + Math.random() * 4;
  const rpm = isRisk ? 1100 + Math.random() * 300 : 1400 + Math.random() * 300;
  const torque = isRisk ? 50 + Math.random() * 25 : 30 + Math.random() * 20;
  const toolWear = isRisk ? 180 + Math.random() * 70 : 10 + Math.random() * 100;
  const voltage = isRisk ? 360 + Math.random() * 40 : 380 + Math.random() * 20;
  const current = isRisk ? 14 + Math.random() * 6 : 8 + Math.random() * 6;
  const humidity = 30 + Math.random() * 40;

  const el = (id) => document.getElementById(id);
  if (el("liveTemp")) el("liveTemp").textContent = temp.toFixed(1);
  if (el("liveTempProc")) el("liveTempProc").textContent = tempProc.toFixed(1);
  if (el("liveRPM")) el("liveRPM").textContent = Math.round(rpm);
  if (el("liveTorque")) el("liveTorque").textContent = torque.toFixed(1);
  if (el("liveVoltage")) el("liveVoltage").textContent = voltage.toFixed(0);
  if (el("liveCurrent")) el("liveCurrent").textContent = current.toFixed(1);
  if (el("liveHumidity")) el("liveHumidity").textContent = humidity.toFixed(0);

  try {
    const result = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        equipement_id: eq.id, type_produit: eq.type_produit,
        air_temperature: temp, process_temperature: tempProc,
        rotational_speed: Math.round(rpm), torque: torque, tool_wear: Math.round(toolWear)
      })
    }).then(r => r.json());

    const predPct = (result.probabilite_panne * 100).toFixed(1);
    if (el("livePrediction")) el("livePrediction").textContent = predPct;
    const predCard = el("livePrediction")?.closest(".live-card");
    if (predCard) predCard.className = "live-card" + (result.panne_predite ? " critical" : predPct > 35 ? " warning" : "");
    const tempCard = el("liveTemp")?.closest(".live-card");
    if (tempCard) tempCard.className = "live-card" + (temp > 305 ? " warning" : temp > 310 ? " critical" : "");

    const now = new Date().toLocaleTimeString(getLocale());
    liveData.labels.push(now);
    liveData.temp.push(temp);
    liveData.torque.push(torque);
    liveData.rpm.push(rpm);
    liveData.pred.push(result.probabilite_panne * 100);
    if (liveData.labels.length > 30) {
      liveData.labels.shift(); liveData.temp.shift();
      liveData.torque.shift(); liveData.rpm.shift(); liveData.pred.shift();
    }
    updateLiveCharts();
  } catch (e) { console.error("Erreur monitoring live:", e); }
}

function initLiveCharts() {
  const ctx1 = document.getElementById("graphiqueLive")?.getContext("2d");
  const ctx2 = document.getElementById("graphiqueLivePrediction")?.getContext("2d");
  if (!ctx1 || !ctx2) return;
  const tc = getChartThemeColors();
  liveChart = new Chart(ctx1, {
    type: "line",
    data: { labels: [], datasets: [
      { label: t("chart.temp_k", "Temp (K)"), data: [], borderColor: tc.danger, tension: 0.3, pointRadius: 2, borderWidth: 2 },
      { label: t("chart.couple_nm", "Couple (Nm)"), data: [], borderColor: tc.warning, tension: 0.3, pointRadius: 2, borderWidth: 2 },
      { label: "RPM", data: [], borderColor: tc.accent, tension: 0.3, pointRadius: 2, borderWidth: 2 }
    ] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: false, grid: { color: tc.gridColor }, ticks: { color: tc.textColor } }, x: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor } } } }
  });
  livePredChart = new Chart(ctx2, {
    type: "line",
    data: { labels: [], datasets: [{ label: t("chart.prob_panne_pct", "Prob. panne (%)"), data: [], borderColor: tc.danger, backgroundColor: tc.dangerSoft, fill: true, tension: 0.3, pointRadius: 3 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" }, grid: { color: tc.gridColor } }, x: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor } } } }
  });
}

function updateLiveCharts() {
  if (!liveChart || !livePredChart) return;
  liveChart.data.labels = liveData.labels;
  liveChart.data.datasets[0].data = liveData.temp;
  liveChart.data.datasets[1].data = liveData.torque;
  liveChart.data.datasets[2].data = liveData.rpm;
  liveChart.update("none");
  livePredChart.data.labels = liveData.labels;
  livePredChart.data.datasets[0].data = liveData.pred;
  livePredChart.update("none");
}

// ---- ANALYTICS PAGE ----
async function initAnalytics() { await chargerAnalytics(); }

async function chargerAnalytics() {
  try {
    const [distResp, corrResp, failResp, healthResp, causesResp, histResp] = await Promise.all([
      fetch(`${API_URL}/analytics/distributions`, { credentials: "include" }),
      fetch(`${API_URL}/analytics/correlations`, { credentials: "include" }),
      fetch(`${API_URL}/analytics/failure-rate`, { credentials: "include" }),
      fetch(`${API_URL}/analytics/health-distribution`, { credentials: "include" }),
      fetch(`${API_URL}/analytics/top-causes`, { credentials: "include" }),
      fetch(`${API_URL}/historique`, { credentials: "include" })
    ]);
    const el = (id) => document.getElementById(id);
    if (distResp.ok) {
      const dist = await distResp.json();
      if (!dist.erreur) {
        const stats = Object.values(dist).map(d => d.statistiques);
        if (el("anaTempMoy")) el("anaTempMoy").textContent = stats[0]?.moyenne + " K";
        if (el("anaCoupleMoy")) el("anaCoupleMoy").textContent = stats[3]?.moyenne + " Nm";
        renderHistogram("graphiqueDistribTemp", dist.air_temperature);
        renderHistogram("graphiqueDistribTorque", dist.torque);
        renderHistogram("graphiqueDistribRPM", dist.rotational_speed);
      }
    }
    if (corrResp.ok) { const c = await corrResp.json(); if (!c.erreur) renderHeatmap(c); }
    if (failResp.ok) {
      const fail = await failResp.json();
      if (!fail.erreur) {
        renderTauxPanne("graphiqueTauxPanne", fail.par_equipement);
        const totalMesures = fail.par_equipement.reduce((s, e) => s + e.total, 0);
        const totalPannes = fail.par_equipement.reduce((s, e) => s + e.pannes, 0);
        if (el("anaTotalMesures")) el("anaTotalMesures").textContent = totalMesures;
        if (el("anaTauxPanne")) el("anaTauxPanne").textContent = totalMesures > 0 ? (totalPannes / totalMesures * 100).toFixed(1) + "%" : "0%";
      }
    }
    if (healthResp.ok) { const h = await healthResp.json(); if (!h.erreur) renderHealthChart(h); }
    if (causesResp.ok) { const c = await causesResp.json(); if (!c.erreur) renderTopCauses(c); }
    if (histResp.ok) {
      const h = await histResp.json();
      const hist = h.donnees || h;
      if (Array.isArray(hist) && el("anaTotalMesures")) el("anaTotalMesures").textContent = hist.length;
    }
  } catch (e) { console.error("Erreur analytics:", e); }
}

function renderHistogram(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext("2d");
  if (!ctx) return;
  const labels = data.bins.slice(0, -1).map(b => b.toFixed(0));
  const tc = getChartThemeColors();
  new Chart(ctx, { type: "bar", data: { labels, datasets: [{ label: data.nom, data: data.histogramme, backgroundColor: tc.accentSoft, borderColor: tc.accent, borderWidth: 1 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: tc.gridColor }, ticks: { color: tc.textColor } }, x: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor } } } } });
}

function renderHealthChart(data) {
  const ctx = document.getElementById("graphiqueHealth")?.getContext("2d");
  if (!ctx) return;
  const tc = getChartThemeColors();
  new Chart(ctx, { type: "doughnut", data: { labels: [t("chart.healthy", "Healthy"), t("chart.warning", "Warning"), t("chart.critical", "Critical")], datasets: [{ data: [data.healthy, data.warning, data.critical], backgroundColor: [tc.accent, tc.warning, tc.danger], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: "bottom" } } } });
}

function renderTauxPanne(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext("2d");
  if (!ctx) return;
  const tc = getChartThemeColors();
  new Chart(ctx, { type: "bar", data: { labels: data.map(d => d.equipement), datasets: [{ label: t("chart.taux_panne_pct", "Taux de panne (%)"), data: data.map(d => d.taux_panne || 0), backgroundColor: tc.dangerSoft, borderColor: tc.danger, borderWidth: 1 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: tc.gridColor }, ticks: { color: tc.textColor } }, x: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor } } } } });
}

function renderHeatmap(data) {
  const container = document.getElementById("heatmapCorrelation");
  if (!container) return;
  const tc = getChartThemeColors();
  const posRgb = tc.dangerRgb; const negRgb = tc.accentRgb;
  let html = '<table class="heatmap-table"><thead><tr><th></th>';
  data.variables.forEach(v => { html += `<th>${v}</th>`; });
  html += '</tr></thead><tbody>';
  data.matrice.forEach((row, i) => {
    html += `<tr><th>${data.variables[i]}</th>`;
    row.forEach(val => {
      const abs = Math.abs(val);
      const r = val > 0 ? Math.round(posRgb[0] * abs) : Math.round(negRgb[0] * abs);
      const g = val > 0 ? Math.round(posRgb[1] * abs) : Math.round(negRgb[1] * abs);
      const b = val > 0 ? Math.round(posRgb[2] * abs) : Math.round(negRgb[2] * abs);
      html += `<td style="background:rgba(${r},${g},${b},${abs * 0.4 + 0.05});color:var(--text-primary);">${val.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderTopCauses(data) {
  const ctx = document.getElementById("graphiqueTopCauses")?.getContext("2d");
  if (!ctx) return;
  const tc = getChartThemeColors();
  const noms = [t("chart.temp_air", "Temp. air"), t("chart.temp_proc", "Temp. proc"), t("chart.rotation", "Rotation"), t("chart.couple", "Couple"), t("chart.usure", "Usure")];
  const valeurs = [data.moyennes.air_temperature, data.moyennes.process_temperature, data.moyennes.rotational_speed, data.moyennes.torque, data.moyennes.tool_wear];
  new Chart(ctx, { type: "bar", data: { labels: noms, datasets: [{ label: t("chart.moyenne_pannes", "Moyenne dans les pannes"), data: valeurs, backgroundColor: [tc.danger, tc.warning, tc.accent, tc.danger, tc.safe] }] }, options: { responsive: true, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor } }, y: { grid: { color: tc.gridColor }, ticks: { color: tc.textColor } } } } });
}

// ---- REPORTS PAGE ----
async function initRapports() {
  const btnGenerer = document.getElementById("btnGenererRapport");
  if (btnGenerer) btnGenerer.addEventListener("click", genererRapport);
  const btnPDF = document.getElementById("btnExportRapportPDF");
  if (btnPDF) btnPDF.addEventListener("click", exporterRapportPDFPro);
  const btnExcel = document.getElementById("btnExportRapportExcel");
  if (btnExcel) btnExcel.addEventListener("click", exporterRapportExcel);
  await chargerListeRapports();

  document.querySelectorAll(".rapport-type-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".rapport-type-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("typeRapport").value = card.dataset.type;
    });
  });
}

async function genererRapport() {
  const btn = document.getElementById("btnGenererRapport");
  btn.disabled = true;
  btn.querySelector("span").textContent = t("rapports.generation", "Génération...");
  try {
    const reponse = await fetch(`${API_URL}/rapports/generer`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        type: document.getElementById("typeRapport").value,
        date_debut: document.getElementById("rapportDateDebut").value || null,
        date_fin: document.getElementById("rapportDateFin").value || null
      })
    });
    const rapport = await reponse.json();
    if (rapport.erreur) throw new Error(rapport.erreur);
    afficherRapport(rapport);
    await chargerListeRapports();
    showToast(t("rapports.rapport_genere", "Rapport généré avec succès !"), "success");
  } catch (e) { showToast(t("commun.erreur", "Erreur: ") + e.message, "error"); }
  finally { btn.disabled = false; btn.querySelector("span").textContent = t("rapports.generer", "Générer le rapport"); }
}

function afficherRapport(rapport) {
  const container = document.getElementById("rapportContent");
  const resultDiv = document.getElementById("rapportResultat");
  if (!container || !resultDiv) return;
  resultDiv.style.display = "block";
  const stats = rapport.contenu?.statistiques || {};
  const machines = rapport.contenu?.machines_critiques || [];
  const topEq = rapport.contenu?.top_equipements || [];
  const evolution = rapport.contenu?.evolution_risques || [];

  let evolutionHTML = "";
  if (evolution.length > 0) {
    evolutionHTML = `<div class="rapport-section"><h4>${t("rapports.evolution_risques", "Évolution des risques")}</h4>
    <div style="display:flex;gap:4px;align-items:end;height:80px;">${evolution.map(e => {
      const h = Math.max(4, e.risque);
      return `<div style="flex:1;background:${e.risque > 39 ? 'var(--warning)' : 'var(--accent-primary)'};height:${h}%;border-radius:4px 4px 0 0;" title="${e.date}: ${e.risque}%"></div>`;
    }).join("")}</div>
    <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);margin-top:4px;"><span>${evolution[0]?.date || ''}</span><span>${evolution[evolution.length-1]?.date || ''}</span></div></div>`;
  }

  container.innerHTML = `
    <h3 style="margin-bottom:20px;">${t("rapports.rapport_titre", "Rapport")} ${rapport.type_rapport} — ${rapport.date_debut} ${t("rapports.au", "au")} ${rapport.date_fin}</h3>
    <div class="rapport-stats-grid">
      <div class="rapport-stat"><div class="rapport-stat__value">${stats.total_analyses || 0}</div><div class="rapport-stat__label">${t("rapports.nombre_predictions", "Prédictions")}</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${stats.total_pannes || 0}</div><div class="rapport-stat__label">${t("rapports.pannes_critiques", "Pannes")}</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${stats.risque_moyen || 0}%</div><div class="rapport-stat__label">${t("accueil.risque_moyen", "Risque moyen")}</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.precision_ia || '-'}</div><div class="rapport-stat__label">${t("rapports.precision", "Précision IA")}</div></div>
    </div>
    ${evolutionHTML}
    ${topEq.length > 0 ? `<div class="rapport-section"><h4>${t("rapports.top_equipements", "Top équipements")}</h4>
    <table class="table" style="font-size:0.85rem;"><thead><tr><th>${t("rapports.col_equipement", "Équipement")}</th><th>${t("rapports.col_alertes", "Alertes")}</th><th>${t("rapports.col_risque_moyen", "Risque moyen")}</th></tr></thead>
    <tbody>${topEq.map(e => `<tr><td>${e.nom}</td><td class="risk-value">${e.alertes}</td><td class="risk-value">${e.risque_moyen}%</td></tr>`).join("")}</tbody></table></div>` : ''}
    ${machines.length > 0 ? `<div class="rapport-section"><h4>${t("rapports.machines_critiques", "Machines critiques")}</h4>${machines.map(m => `<p>- ${m.nom} : ${m.alertes} ${t("rapports.n_alertes", "alerte(s)")}</p>`).join("")}</div>` : ''}
    <div class="rapport-section"><h4>${t("rapports.performance_modele", "Performance du modèle")}</h4>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.precision_ia || '84.5%'}</div><div class="rapport-stat__label">Accuracy</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.f1_score || '76.6%'}</div><div class="rapport-stat__label">F1-Score</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.recall || '78%'}</div><div class="rapport-stat__label">Recall</div></div>
    </div></div>
    <div class="rapport-section" style="margin-top:16px;padding:16px;background:var(--accent-primary-soft);border-radius:var(--radius-md);border-left:4px solid var(--accent-primary);">
      <strong>${t("rapports.resume_executif", "Résumé exécutif")}:</strong> ${stats.total_analyses || 0} ${t("rapports.analyses_effectuees", "analyses effectuées")}, ${stats.total_pannes || 0} ${t("rapports.pannes_detectees", "pannes détectées")} (${stats.taux_panne || 0}%). ${t("rapports.risque_moyen_label", "Risque moyen:")} ${stats.risque_moyen || 0}%.
    </div>
  `;
}

async function chargerListeRapports() {
  try {
    const reponse = await fetch(`${API_URL}/rapports`, { credentials: "include" });
    if (!reponse.ok) {
      const tbody = document.getElementById("tbodyRapports");
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="table__empty">${t("rapports.aucun_rapport", "Aucun rapport")}</td></tr>`;
      const totalEl = document.getElementById("rapTotalRapports");
      const typeEl = document.getElementById("rapDernierType");
      if (totalEl) totalEl.textContent = "0";
      if (typeEl) typeEl.textContent = "--";
      return;
    }
    const rapports = await reponse.json();
    const tbody = document.getElementById("tbodyRapports");
    if (!tbody) return;

    const totalEl = document.getElementById("rapTotalRapports");
    const typeEl = document.getElementById("rapDernierType");
    if (totalEl) totalEl.textContent = Array.isArray(rapports) ? rapports.length : 0;
    if (typeEl && Array.isArray(rapports) && rapports.length > 0) typeEl.textContent = rapports[0].type_rapport;

    if (!Array.isArray(rapports) || rapports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="table__empty">${t("rapports.aucun_rapport", "Aucun rapport")}</td></tr>`;
      return;
    }
    tbody.innerHTML = rapports.map(r => `
      <tr><td>${r.type_rapport}</td><td>${r.date_debut || "-"} — ${r.date_fin || "-"}</td><td>${r.date_generation || "-"}</td>
      <td><button class="action-btn" onclick="voirRapport(${r.id})">${t("rapports.voir", "Voir")}</button></td></tr>
    `).join("");
  } catch (e) {
    console.error("Erreur rapports:", e);
    const tbody = document.getElementById("tbodyRapports");
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="table__empty">${t("commun.erreur", "Erreur de chargement")}</td></tr>`;
    const totalEl = document.getElementById("rapTotalRapports");
    const typeEl = document.getElementById("rapDernierType");
    if (totalEl) totalEl.textContent = "0";
    if (typeEl) typeEl.textContent = "--";
  }
}

async function voirRapport(id) {
  try {
    const reponse = await fetch(`${API_URL}/rapports/${id}`, { credentials: "include" });
    if (!reponse.ok) throw new Error("Rapport non trouvé");
    const rapport = await reponse.json();
    if (rapport.erreur) throw new Error(rapport.erreur);
    afficherModalRapport(rapport);
  } catch (e) { showToast(t("commun.erreur", "Erreur de chargement") + ": " + e.message, "error"); }
}

function afficherModalRapport(rapport) {
  const existing = document.getElementById("rapportModalOverlay");
  if (existing) existing.remove();

  const stats = rapport.contenu?.statistiques || {};
  const machines = rapport.contenu?.machines_critiques || [];
  const topEq = rapport.contenu?.top_equipements || [];
  const evolution = rapport.contenu?.evolution_risques || [];

  let evolutionHTML = "";
  if (evolution.length > 0) {
    evolutionHTML = `<div class="rapport-section"><h4>${t("rapports.evolution_risques", "Évolution des risques")}</h4>
    <div style="display:flex;gap:4px;align-items:end;height:80px;">${evolution.map(e => {
      const h = Math.max(4, e.risque);
      return `<div style="flex:1;background:${e.risque > 39 ? 'var(--warning)' : 'var(--accent-primary)'};height:${h}%;border-radius:4px 4px 0 0;" title="${e.date}: ${e.risque}%"></div>`;
    }).join("")}</div>
    <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);margin-top:4px;"><span>${evolution[0]?.date || ''}</span><span>${evolution[evolution.length-1]?.date || ''}</span></div></div>`;
  }

  const contentHTML = `
    <h3 style="margin-bottom:20px;">${t("rapports.rapport_titre", "Rapport")} ${rapport.type_rapport || ""} — ${rapport.date_debut || ""} ${t("rapports.au", "au")} ${rapport.date_fin || ""}</h3>
    <div class="rapport-stats-grid">
      <div class="rapport-stat"><div class="rapport-stat__value">${stats.total_analyses || 0}</div><div class="rapport-stat__label">${t("rapports.nombre_predictions", "Prédictions")}</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${stats.total_pannes || 0}</div><div class="rapport-stat__label">${t("rapports.pannes_critiques", "Pannes")}</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${stats.risque_moyen || 0}%</div><div class="rapport-stat__label">${t("accueil.risque_moyen", "Risque moyen")}</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.precision_ia || '-'}</div><div class="rapport-stat__label">${t("rapports.precision", "Précision IA")}</div></div>
    </div>
    ${evolutionHTML}
    ${topEq.length > 0 ? `<div class="rapport-section"><h4>${t("rapports.top_equipements", "Top équipements")}</h4>
    <table class="table" style="font-size:0.85rem;"><thead><tr><th>${t("rapports.col_equipement", "Équipement")}</th><th>${t("rapports.col_alertes", "Alertes")}</th><th>${t("rapports.col_risque_moyen", "Risque moyen")}</th></tr></thead>
    <tbody>${topEq.map(e => `<tr><td>${e.nom}</td><td class="risk-value">${e.alertes}</td><td class="risk-value">${e.risque_moyen}%</td></tr>`).join("")}</tbody></table></div>` : ''}
    ${machines.length > 0 ? `<div class="rapport-section"><h4>${t("rapports.machines_critiques", "Machines critiques")}</h4>${machines.map(m => `<p>- ${m.nom} : ${m.alertes} ${t("rapports.n_alertes", "alerte(s)")}</p>`).join("")}</div>` : ''}
    <div class="rapport-section"><h4>${t("rapports.performance_modele", "Performance du modèle")}</h4>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.precision_ia || '84.5%'}</div><div class="rapport-stat__label">Accuracy</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.f1_score || '76.6%'}</div><div class="rapport-stat__label">F1-Score</div></div>
      <div class="rapport-stat"><div class="rapport-stat__value">${rapport.contenu?.recall || '78%'}</div><div class="rapport-stat__label">Recall</div></div>
    </div></div>
    <div class="rapport-section" style="margin-top:16px;padding:16px;background:var(--accent-primary-soft);border-radius:var(--radius-md);border-left:4px solid var(--accent-primary);">
      <strong>${t("rapports.resume_executif", "Résumé exécutif")}:</strong> ${stats.total_analyses || 0} ${t("rapports.analyses_effectuees", "analyses effectuées")}, ${stats.total_pannes || 0} ${t("rapports.pannes_detectees", "pannes détectées")} (${stats.taux_panne || 0}%). ${t("rapports.risque_moyen_label", "Risque moyen:")} ${stats.risque_moyen || 0}%.
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.id = "rapportModalOverlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px);";
  overlay.innerHTML = `
    <div class="rapport-modal" style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-xl);max-width:900px;width:100%;max-height:85vh;overflow-y:auto;padding:32px;position:relative;box-shadow:0 25px 60px rgba(0,0,0,0.3);">
      <button id="closeRapportModal" type="button" style="position:absolute;top:16px;right:16px;background:var(--bg-primary);border:1px solid var(--border-soft);border-radius:var(--radius-md);width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:var(--text-secondary);transition:all 0.2s;">✕</button>
      <div id="rapportModalContent">${contentHTML}</div>
      <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-soft);">
        <button class="btn btn-outline" id="modalBtnPDF" type="button"><i data-lucide="download"></i><span>PDF</span></button>
        <button class="btn btn-outline" id="modalBtnExcel" type="button"><i data-lucide="table"></i><span>Excel</span></button>
        <button class="btn btn-outline" id="modalBtnPrint" type="button"><i data-lucide="printer"></i><span>${t("rapports.imprimer", "Imprimer")}</span></button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (typeof lucide !== "undefined") lucide.createIcons();

  document.getElementById("closeRapportModal").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener("keydown", function escHandler(e) { if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", escHandler); } });

  document.getElementById("modalBtnPDF").addEventListener("click", () => {
    exporterRapportPDFPro();
  });
  document.getElementById("modalBtnExcel").addEventListener("click", () => {
    exporterRapportExcel();
  });
  document.getElementById("modalBtnPrint").addEventListener("click", () => {
    const modalContent = document.getElementById("rapportModalContent");
    if (!modalContent) return;
    const printWindow = window.open("", "_blank");
    printWindow.document.write("<html><head><title>Rapport OCP</title><style>body{font-family:sans-serif;padding:24px;}.rapport-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}.rapport-stat{text-align:center;padding:16px;background:#f1f5f9;border-radius:8px;}.rapport-stat__value{font-size:1.4rem;font-weight:700;color:#10b981;}.rapport-stat__label{font-size:0.75rem;color:#64748b;margin-top:4px;}.rapport-section{margin-bottom:16px;}table{width:100%;border-collapse:collapse;}th,td{padding:8px;border:1px solid #e2e8f0;text-align:left;}</style></head><body>");
    printWindow.document.write(modalContent.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  });
}

// ---- SETTINGS PAGE ----
async function initParametres() {
  const formSettings = document.getElementById("formSettings");
  const formPassword = document.getElementById("formPassword");
  if (formSettings) formSettings.addEventListener("submit", sauvegarderSettings);
  if (formPassword) formPassword.addEventListener("submit", changerMotDePasse);
  const settLangue = document.getElementById("settLangue");
  const settTheme = document.getElementById("settTheme");
  if (settLangue) {
    settLangue.value = getCurrentLang();
    settLangue.addEventListener("change", () => switchLanguage(settLangue.value));
  }
  if (settTheme) {
    settTheme.value = document.body.classList.contains("dark") ? "dark" : "light";
    settTheme.addEventListener("change", () => {
      const isDark = settTheme.value === "dark";
      document.body.classList.toggle("dark", isDark);
      localStorage.setItem("theme", settTheme.value);
    });
  }
  await chargerSettings();
  await chargerProfile();
}

async function sauvegarderSettings(e) {
  e.preventDefault();
  const theme = document.getElementById("settTheme").value;
  const langue = document.getElementById("settLangue").value;
  try {
    await fetch(`${API_URL}/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        seuil_alerte: parseFloat(document.getElementById("settSeuil").value),
        langue: langue,
        theme: theme,
        email_notifications: document.getElementById("settEmailNotif").value === "1"
      })
    });
    const isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
    if (typeof switchLanguage === "function") switchLanguage(langue);
    localStorage.setItem("langue", langue);
    showToast(t("parametres.parametres_sauvegardes", "Paramètres sauvegardés !"), "success");
  } catch (e) { showToast(t("commun.erreur", "Erreur de sauvegarde"), "error"); }
}

async function chargerSettings() {
  try {
    const reponse = await fetch(`${API_URL}/settings`, { credentials: "include" });
    const params = await reponse.json();
    if (!params.erreur) {
      const el = (id) => document.getElementById(id);
      if (el("settSeuil")) el("settSeuil").value = params.seuil_alerte || 0.71;
      if (el("settLangue")) el("settLangue").value = params.langue || getCurrentLang();
      if (el("settTheme")) el("settTheme").value = params.theme || "light";
      if (el("settEmailNotif")) el("settEmailNotif").value = params.email_notifications ? "1" : "0";
    }
  } catch (e) { console.error("Erreur settings:", e); }
}

async function chargerProfile() {
  try {
    const reponse = await fetch(`${API_URL}/profile`, { credentials: "include" });
    const user = await reponse.json();
    if (!user.erreur) {
      const el = (id) => document.getElementById(id);
      if (el("profileNom")) el("profileNom").textContent = user.nom_utilisateur;
      if (el("profileRole")) el("profileRole").textContent = user.role;
      if (el("profileDate")) el("profileDate").textContent = user.date_creation;
      if (el("profileAvatar")) el("profileAvatar").textContent = user.nom_utilisateur.slice(0, 2).toUpperCase();
    }
  } catch (e) { console.error("Erreur profile:", e); }
}

async function changerMotDePasse(e) {
  e.preventDefault();
  const nouveau = document.getElementById("nouveauMdp").value;
  const confirmer = document.getElementById("confirmerMdp").value;
  if (nouveau !== confirmer) { showToast(t("commun.erreur", "Les mots de passe ne correspondent pas !"), "error"); return; }
  try {
    const reponse = await fetch(`${API_URL}/profile/password`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ ancien_mot_de_passe: document.getElementById("ancienMdp").value, nouveau_mot_de_passe: nouveau })
    });
    const data = await reponse.json();
    if (data.erreur) showToast(data.erreur, "error");
    else { showToast(t("parametres.mdp_change", "Mot de passe changé avec succès !"), "success"); document.getElementById("formPassword").reset(); }
  } catch (e) { showToast(t("commun.erreur", "Erreur lors du changement de mot de passe"), "error"); }
}

// ---- ASSISTANT IA ----
function envoyerQuestion() {
  const input = document.getElementById("assistantInput");
  const chat = document.getElementById("assistantChat");
  if (!input || !chat) return;
  const message = input.value.trim();
  if (!message) return;
  chat.innerHTML += `<div class="assistant-msg assistant-msg--user"><div class="assistant-avatar">${t("commun.vous", "Vous")}</div><div class="assistant-bubble">${message}</div></div>`;
  input.value = "";
  chat.innerHTML += `<div class="assistant-msg assistant-msg--bot" id="assistantLoading"><div class="assistant-avatar"><i data-lucide="bot"></i></div><div class="assistant-bubble">${t("monitoring.en_cours", "Analyse en cours...")}</div></div>`;
  if (typeof lucide !== "undefined") lucide.createIcons();
  chat.scrollTop = chat.scrollHeight;
  fetch(`${API_URL}/ai-assistant`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
    body: JSON.stringify({ message })
  }).then(r => r.json()).then(data => {
    const loading = document.getElementById("assistantLoading");
    if (loading) loading.remove();
    chat.innerHTML += `<div class="assistant-msg assistant-msg--bot"><div class="assistant-avatar"><i data-lucide="bot"></i></div><div class="assistant-bubble">${(data.reponse || data.erreur || t("commun.erreur", "Erreur")).replace(/\n/g, "<br>")}</div></div>`;
    if (typeof lucide !== "undefined") lucide.createIcons();
    chat.scrollTop = chat.scrollHeight;
  }).catch(() => {
    const loading = document.getElementById("assistantLoading");
    if (loading) loading.remove();
    chat.innerHTML += `<div class="assistant-msg assistant-msg--bot"><div class="assistant-avatar"><i data-lucide="bot"></i></div><div class="assistant-bubble">${t("commun.erreur", "Erreur de connexion a l'assistant.")}</div></div>`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  });
}

// ---- EXPORTS ----
function exporterHistoriqueCSVHist() {
  if (histData.length === 0) { showToast(t("commun.aucun_resultat", "Aucune donnée à exporter."), "warning"); return; }
  const entetes = ["ID", "Date", t("export.equipement", "Équipement"), t("export.localisation", "Localisation"), t("export.temp_air", "Temp air (K)"), t("export.temp_proc", "Temp proc (K)"), t("export.rotation", "Rotation (rpm)"), t("export.couple", "Couple (Nm)"), t("export.usure", "Usure (min)"), t("export.probabilite_pct", "Probabilité (%)"), t("export.statut", "Statut")];
  const lignes = histData.map(d => [d.prediction_id, d.date_prediction, d.equipement, d.localisation || '', d.air_temperature, d.process_temperature, d.rotational_speed, d.torque, d.tool_wear, (d.probabilite_panne * 100).toFixed(3), d.statut]);
  let csv = entetes.join(";") + "\n";
  lignes.forEach(l => { csv += l.join(";") + "\n"; });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = `historique_${new Date().toISOString().slice(0, 10)}.csv`;
  lien.click();
}

function exporterHistoriqueExcel() {
  if (histData.length === 0) { showToast(t("commun.aucun_resultat", "Aucune donnée à exporter."), "warning"); return; }
  const ws_data = [
    ["ID", "Date", t("export.equipement", "Équipement"), t("export.localisation", "Localisation"), t("export.temp_air", "Temp air (K)"), t("export.temp_proc", "Temp proc (K)"), t("export.rotation", "Rotation (rpm)"), t("export.couple", "Couple (Nm)"), t("export.usure", "Usure (min)"), t("export.probabilite_pct", "Probabilité (%)"), t("export.statut", "Statut")]
  ];
  histData.forEach(d => {
    ws_data.push([d.prediction_id, d.date_prediction, d.equipement, d.localisation || '', d.air_temperature, d.process_temperature, d.rotational_speed, d.torque, d.tool_wear, (d.probabilite_panne * 100).toFixed(1), d.statut]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, t("excel.feuille_historique_nom", "Historique"));
  XLSX.writeFile(wb, `historique_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exporterHistoriquePDFPro() {
  if (histData.length === 0) { showToast(t("commun.aucun_resultat", "Aucune donnée à exporter."), "warning"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(t("pdf.oct_titre", "OCP — Maintenance Prédictive"), 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(t("pdf.titre", "Rapport d'historique des prédictions"), 14, 28);
  doc.text(`${t("pdf.genere_le", "Généré le")} ${new Date().toLocaleDateString(getLocale())}`, 14, 35);
  doc.setTextColor(0);
  const colonnes = ["ID", "Date", t("export.equipement", "Équipement"), t("export.risque_pct", "Risque (%)"), t("export.statut", "Statut")];
  const lignes = histData.map(d => ["#" + d.prediction_id, d.date_prediction, d.equipement, (d.probabilite_panne * 100).toFixed(1) + "%", d.statut]);
  doc.autoTable({ head: [colonnes], body: lignes, startY: 48, styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" }, alternateRowStyles: { fillColor: [241, 245, 249] } });
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(t("commun.page_x_sur_y", "Page {x} / {y}").replace("{x}", i).replace("{y}", pageCount), 210 - 30, 290);
    doc.text(t("pdf.oct_titre", "OCP — Maintenance Prédictive"), 14, 290);
  }
  doc.save(`historique_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exporterRapportPDFPro() {
  const content = document.getElementById("rapportContent");
  if (!content) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(t("pdf.rapport_titre", "OCP — Rapport de Maintenance"), 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${t("commun.genere_le", "Généré le")} ${new Date().toLocaleDateString(getLocale())}`, 14, 28);
  doc.setTextColor(0);
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(content.innerText, 180);
  doc.text(lines, 14, 48);
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(t("commun.page_x_sur_y", "Page {x} / {y}").replace("{x}", i).replace("{y}", pageCount), 210 - 30, 290);
    doc.text(t("pdf.oct_titre", "OCP — Maintenance Prédictive"), 14, 290);
  }
  doc.save(`rapport_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exporterRapportExcel() {
  const content = document.getElementById("rapportContent");
  if (!content) return;
  const wb = XLSX.utils.book_new();
  const ws_data = [[t("excel.rapport_titre", "Rapport OCP — Maintenance Prédictive")], [""], [content.innerText]];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, t("excel.feuille_rapport_nom", "Rapport"));
  XLSX.writeFile(wb, `rapport_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
