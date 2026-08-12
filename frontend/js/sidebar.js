// =============================================================
// sidebar.js — Sidebar toggle (single hamburger) + theme toggle
// =============================================================

(function () {
  const shell = document.querySelector(".shell");
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");

  if (!shell || !sidebar || !toggleBtn) return;

  // ---- TOOLTIP DATA ATTRIBUTES ----
  const TOOLTIP_KEYS = {
    "accueil": "nav.accueil",
    "dashboard": "nav.dashboard",
    "prediction": "nav.prediction",
    "analytics": "nav.analytics",
    "historique": "nav.historique",
    "monitoring": "nav.monitoring",
    "alertes": "nav.alertes",
    "rapports": "nav.rapports",
    "parametres": "nav.parametres",
    "apropos": "nav.apropos"
  };

  function applySidebarTooltips() {
    sidebar.querySelectorAll(".nav-item[data-page]").forEach(item => {
      const page = item.getAttribute("data-page");
      const key = TOOLTIP_KEYS[page];
      if (key) item.setAttribute("data-tooltip", t(key, page));
    });
    const logoutBtn = document.getElementById("btnLogout");
    if (logoutBtn) logoutBtn.setAttribute("data-tooltip", t("commun.deconnexion", "Déconnexion"));
  }

  applySidebarTooltips();
  window.applySidebarTooltips = applySidebarTooltips;

  // ---- HELPERS ----
  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function isTablet() {
    return window.matchMedia("(max-width: 1024px)").matches;
  }

  function getCollapsed() {
    return localStorage.getItem("sidebarCollapsed") === "true";
  }

  function setCollapsed(val) {
    localStorage.setItem("sidebarCollapsed", val);
  }

  // ---- DESKTOP COLLAPSE ----
  function toggleDesktop() {
    const willCollapse = !shell.classList.contains("collapsed");
    shell.classList.toggle("collapsed");
    setCollapsed(willCollapse);
  }

  // ---- MOBILE OPEN / CLOSE ----
  function openMobile() {
    sidebar.classList.add("mobile-open");
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeMobile() {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  // ---- MAIN TOGGLE HANDLER ----
  function handleToggle() {
    if (isMobile()) {
      if (sidebar.classList.contains("mobile-open")) {
        closeMobile();
      } else {
        openMobile();
      }
    } else {
      toggleDesktop();
    }
  }

  // ---- EVENT LISTENERS ----
  toggleBtn.addEventListener("click", handleToggle);

  if (backdrop) {
    backdrop.addEventListener("click", closeMobile);
  }

  // Close mobile sidebar on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("mobile-open")) {
      closeMobile();
    }
  });

  // Close mobile sidebar when navigating to a page
  sidebar.querySelectorAll(".nav-item[data-page]").forEach(item => {
    item.addEventListener("click", () => {
      if (isMobile() && sidebar.classList.contains("mobile-open")) {
        closeMobile();
      }
    });
  });

  // ---- RESPONSIVE HANDLING ON RESIZE ----
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!isMobile()) {
        closeMobile();
        sidebar.classList.remove("mobile-open");
      }
    }, 100);
  });

  // ---- INITIAL STATE ----
  function applyInitialState() {
    if (isMobile()) {
      shell.classList.remove("collapsed");
    } else if (isTablet()) {
      shell.classList.add("collapsed");
      setCollapsed(true);
    } else {
      if (getCollapsed()) {
        shell.classList.add("collapsed");
      } else {
        shell.classList.remove("collapsed");
      }
    }
  }

  applyInitialState();
})();


// =============================================================
// Theme toggle
// =============================================================
const boutonTheme = document.getElementById("toggleThemeTopbar");

function appliquerThemeSauvegarde() {
  const themeSauvegarde = localStorage.getItem("theme");
  if (themeSauvegarde === "light") {
    document.body.classList.remove("dark");
    if (boutonTheme) {
      boutonTheme.innerHTML = '';
      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", "moon");
      boutonTheme.appendChild(icon);
    }
  } else {
    document.body.classList.add("dark");
    localStorage.setItem("theme", "dark");
    if (boutonTheme) {
      boutonTheme.innerHTML = '';
      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", "sun");
      boutonTheme.appendChild(icon);
    }
  }
}

if (boutonTheme) {
  boutonTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const estSombre = document.body.classList.contains("dark");
    localStorage.setItem("theme", estSombre ? "dark" : "light");
    boutonTheme.innerHTML = '';
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", estSombre ? "sun" : "moon");
    boutonTheme.appendChild(icon);
    if (typeof lucide !== "undefined") lucide.createIcons();
  });
}

appliquerThemeSauvegarde();
