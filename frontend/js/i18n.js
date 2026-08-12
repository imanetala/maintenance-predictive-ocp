// =============================================================
// i18n.js — Internationalization system (no-reload, full i18n)
// =============================================================

let currentLang = localStorage.getItem("langue") || "fr";
let translations = {};

const FALLBACK_LANG = "en";
const SUPPORTED_LANGS = ["fr", "en"];

function flattenObject(obj, prefix = "") {
  const result = {};
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], fullKey));
    } else {
      result[fullKey] = obj[key];
    }
  }
  return result;
}

async function loadTranslations(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = FALLBACK_LANG;
  try {
    const resp = await fetch(`/i18n/${lang}.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();
    translations = flattenObject(raw);
    currentLang = lang;
    localStorage.setItem("langue", lang);
    document.documentElement.setAttribute("lang", lang);
    syncLangButtons();
    applyTranslations();
    return true;
  } catch (e) {
    console.error("Erreur chargement traductions:", e);
    if (lang !== FALLBACK_LANG) return loadTranslations(FALLBACK_LANG);
    return false;
  }
}

function t(key, fallback) {
  return translations[key] || fallback || key;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[key]) el.textContent = translations[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[key]) el.placeholder = translations[key];
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (translations[key]) el.title = translations[key];
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (translations[key]) el.innerHTML = translations[key];
  });
}

function syncLangButtons() {
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
  });
}

async function switchLanguage(lang) {
  if (lang === currentLang) return;
  await loadTranslations(lang);
  if (typeof applySidebarTooltips === "function") applySidebarTooltips();
  if (typeof reloadCurrentPage === "function") {
    reloadCurrentPage();
  }
  if (typeof majHorloge === "function") majHorloge();
}

function getCurrentLang() {
  return currentLang;
}

function getLocale() {
  return currentLang === "en" ? "en-US" : "fr-FR";
}

document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const lang = btn.getAttribute("data-lang");
    switchLanguage(lang);
  });
});

loadTranslations(currentLang);
