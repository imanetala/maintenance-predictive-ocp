const API_URL = window.location.origin;

const TITRES = {
  accueil:    ["nav.accueil", "accueil.sous_titre"],
  dashboard:  ["nav.dashboard", "dashboard.sous_titre"],
  prediction: ["nav.prediction", "prediction.sous_titre"],
  analytics:  ["nav.analytics", "analytics.sous_titre"],
  historique: ["nav.historique", "historique.sous_titre"],
  monitoring: ["nav.monitoring", "monitoring.sous_titre"],
  alertes:    ["nav.alertes", "alertes.sous_titre"],
  rapports:   ["nav.rapports", "rapports.sous_titre"],
  parametres: ["nav.parametres", "parametres.sous_titre"],
  apropos:    ["nav.apropos", "apropos.description"]
};

let currentPage = null;
let isNavigating = false;

document.addEventListener("DOMContentLoaded", () => {
  setupNavListeners();
  majHorloge();
  setInterval(majHorloge, 1000);
  initNotifications();
  setupSearch();
  loadPage("accueil");
});

function setupNavListeners() {
  document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page !== currentPage) loadPage(page);
    });
  });
}

function setupSearch() {
  const input = document.getElementById("rechercheGlobale");
  if (!input) return;
  const PAGE_KEYWORDS = {
    "accueil": ["accueil", "home", "tableau", "kpi", "overview", "dashboard"],
    "dashboard": ["dashboard", "tableau de bord", "bord"],
    "prediction": ["prediction", "predire", "pred", "analyser", "predict"],
    "analytics": ["analytics", "analyse", "graphs", "graphiques", "charts"],
    "historique": ["historique", "history", "mesures", "logs"],
    "monitoring": ["monitoring", "surveillance", "model", "modele"],
    "alertes": ["alertes", "alerts", "alarmes"],
    "rapports": ["rapports", "rapport", "reports", "pdf", "excel"],
    "parametres": ["parametres", "settings", "configuration", "profil", "theme", "langue"],
    "apropos": ["apropos", "a propos", "about", "info"]
  };

  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const q = input.value.trim().toLowerCase();
    if (!q) return;

    for (const [page, keywords] of Object.entries(PAGE_KEYWORDS)) {
      if (keywords.some(k => q.includes(k) || k.includes(q))) {
        loadPage(page);
        input.value = "";
        return;
      }
    }

    try {
      const resp = await fetch(`${API_URL}/equipements`, { credentials: "include" });
      const equipements = await resp.json();
      if (Array.isArray(equipements)) {
        const match = equipements.find(eq =>
          eq.nom.toLowerCase().includes(q) || (eq.localisation || "").toLowerCase().includes(q)
        );
        if (match) {
          loadPage("historique");
          input.value = "";
          return;
        }
      }
    } catch (err) { /* ignore */ }

    loadPage("historique");
    input.value = "";
  });
}

function getLocale() {
  return getCurrentLang() === "en" ? "en-US" : "fr-FR";
}

function majHorloge() {
  const now = new Date();
  const h = document.getElementById("horloge");
  const d = document.getElementById("dateJour");
  const loc = getLocale();
  if (h) h.textContent = now.toLocaleTimeString(loc);
  if (d) d.textContent = now.toLocaleDateString(loc, {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  });
}

async function loadPage(pageName) {
  if (isNavigating) return;
  isNavigating = true;

  const mainContent = document.getElementById("main-content");
  const loader = document.getElementById("page-loader");

  loader.style.display = "flex";
  mainContent.classList.add("page-exit");

  await sleep(250);

  try {
    const resp = await fetch(`/pages/${pageName}?v=4`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    mainContent.innerHTML = html;
    mainContent.classList.remove("page-exit");
    mainContent.classList.add("page-enter");

    const infos = TITRES[pageName] || ["nav.accueil", "accueil.sous_titre"];
    const titleEl = document.querySelector(".topbar__title");
    const subtitleEl = document.querySelector(".topbar__subtitle");
    if (titleEl) {
      titleEl.textContent = t(infos[0], infos[0]);
      titleEl.setAttribute("data-i18n", infos[0]);
    }
    if (subtitleEl) {
      subtitleEl.textContent = t(infos[1], infos[1]);
      subtitleEl.setAttribute("data-i18n", infos[1]);
    }
    document.title = `${t(infos[0], infos[0])} — ${t("commun.app_titre", "Maintenance Prédictive")}`;

    document.querySelectorAll(".nav-item").forEach(b => {
      b.classList.toggle("active", b.dataset.page === pageName);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();

    if (typeof PAGE_INITS[pageName] === "function") {
      PAGE_INITS[pageName]();
    }

    applyTranslations();
    currentPage = pageName;
    setTimeout(() => mainContent.classList.remove("page-enter"), 300);

  } catch (err) {
    mainContent.innerHTML = errorHTML(pageName);
    mainContent.classList.remove("page-exit");
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  loader.style.display = "none";
  isNavigating = false;
}

function reloadCurrentPage() {
  if (!currentPage) return;
  isNavigating = false;
  loadPage(currentPage);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function errorHTML(page) {
  return `<section class="page-section" style="text-align:center;padding:80px 20px;">
    <div style="font-size:3rem;margin-bottom:16px;"><i data-lucide="alert-triangle"></i></div>
    <h2>${t("commun.erreur", "Page introuvable")}</h2>
    <p style="color:var(--text-dim);margin:12px 0 24px;">${t("commun.page_introuvable_detail", 'La page "')}${page}${t("commun.page_introuvable_fin", '" n\'existe pas.')}</p>
    <button class="btn" onclick="loadPage('dashboard')"><span>${t("commun.retour", "Retour")}</span></button>
  </section>`;
}

const PAGE_INITS = {
  accueil:    () => { if (typeof initAccueil === "function") initAccueil(); },
  dashboard:  () => { if (typeof initDashboard === "function") initDashboard(); },
  prediction: () => { if (typeof initPrediction === "function") initPrediction(); },
  analytics:  () => { if (typeof initAnalytics === "function") initAnalytics(); },
  historique: () => { if (typeof initHistoriqueFull === "function") initHistoriqueFull(); },
  monitoring: () => { if (typeof initMonitoring === "function") initMonitoring(); },
  alertes:    () => { if (typeof initAlertes === "function") initAlertes(); },
  rapports:   () => { if (typeof initRapports === "function") initRapports(); },
  parametres: () => { if (typeof initParametres === "function") initParametres(); },
  apropos:    null
};
