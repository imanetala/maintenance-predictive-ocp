// =============================================================
// auth-guard.js — Session check + user info + logout (SPA)
// =============================================================
(async function verifierAcces() {
  try {
    const reponse = await fetch(`${window.location.origin}/session`, {
      credentials: "include"
    });

    if (!reponse.ok) {
      window.location.href = "/login";
      return;
    }

    const donnees = await reponse.json();

    const el = (id) => document.getElementById(id);
    if (el("userName")) el("userName").textContent = donnees.nom_utilisateur;
    if (el("userRole")) el("userRole").textContent = donnees.role;
    if (el("userAvatar")) el("userAvatar").textContent = donnees.nom_utilisateur.slice(0, 2).toUpperCase();
    if (el("userNameTop")) el("userNameTop").textContent = donnees.nom_utilisateur;
    if (el("userRoleTop")) el("userRoleTop").textContent = donnees.role;
    if (el("userAvatarTop")) el("userAvatarTop").textContent = donnees.nom_utilisateur.slice(0, 2).toUpperCase();
    if (el("welcomeText")) el("welcomeText").textContent = t("accueil.bienvenue_utilisateur", "Bonjour") + ", " + donnees.nom_utilisateur + ".";

    // Populate dropdown
    if (el("dropdownAvatar")) el("dropdownAvatar").textContent = donnees.nom_utilisateur.slice(0, 2).toUpperCase();
    if (el("dropdownName")) el("dropdownName").textContent = donnees.nom_utilisateur;
    if (el("dropdownRole")) el("dropdownRole").textContent = donnees.role;
    if (el("dropdownRoleFull")) el("dropdownRoleFull").textContent = donnees.role;

    // Fetch full profile for date/email
    try {
      const profileResp = await fetch(`${window.location.origin}/profile`, { credentials: "include" });
      const profile = await profileResp.json();
      if (!profile.erreur) {
        if (el("dropdownDate")) el("dropdownDate").textContent = profile.date_creation || "—";
        if (el("dropdownEmail")) el("dropdownEmail").textContent = profile.nom_utilisateur + "@ocp.ma";
      }
    } catch (e) {}

    // Language is handled by i18n.js from localStorage on page load.
    // Don't override from backend settings to avoid reload loops.

    if (typeof initKPIs === "function") initKPIs();

  } catch (erreur) {
    window.location.href = "/login";
  }
})();

// ---- User dropdown toggle ----
(function () {
  const wrapper = document.querySelector(".user-dropdown-wrapper");
  const trigger = document.getElementById("topbarUser");
  const dropdown = document.getElementById("userDropdown");

  if (trigger && dropdown) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      document.querySelectorAll(".user-dropdown.open, .notif-dropdown.open").forEach(d => d.classList.remove("open"));
      if (!isOpen) dropdown.classList.add("open");
    });
  }

  document.addEventListener("click", (e) => {
    if (dropdown && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });
})();

// ---- Logout buttons (sidebar + topbar) ----
async function doLogout() {
  await fetch(`${window.location.origin}/logout`, {
    method: "POST",
    credentials: "include"
  });
  window.location.href = "/login";
}

document.getElementById("btnLogout").addEventListener("click", doLogout);
const btnLogoutTopbar = document.getElementById("btnLogoutTopbar");
if (btnLogoutTopbar) btnLogoutTopbar.addEventListener("click", doLogout);
