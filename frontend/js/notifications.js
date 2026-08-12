// =============================================================
// notifications.js — Notifications dropdown system
// =============================================================

let notifInterval = null;

function initNotifications() {
  chargerNotifications();
  chargerNombreNonLues();
  setupNotifListeners();
  notifInterval = setInterval(chargerNombreNonLues, 30000);
}

function setupNotifListeners() {
  const cloche = document.getElementById("btnCloche");
  const dropdown = document.getElementById("notifDropdown");
  if (cloche && dropdown) {
    cloche.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
      if (dropdown.classList.contains("open")) {
        chargerNotifications();
      }
    });
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && e.target !== cloche) {
        dropdown.classList.remove("open");
      }
    });
  }

  const btnToutLu = document.getElementById("btnToutMarquerLu");
  if (btnToutLu) btnToutLu.addEventListener("click", toutMarquerLue);

  const btnVoir = document.getElementById("btnVoirNotifs");
  if (btnVoir) btnVoir.addEventListener("click", () => {
    document.getElementById("notifDropdown").classList.remove("open");
    loadPage("alertes");
  });
}

async function chargerNotifications() {
  try {
    const resp = await fetch(`${API_URL}/notifications`, { credentials: "include" });
    if (!resp.ok) return;
    const notifs = await resp.json();
    afficherNotifications(notifs);
  } catch (e) {
    console.error("Erreur chargement notifications:", e);
  }
}

async function chargerNombreNonLues() {
  try {
    const resp = await fetch(`${API_URL}/notifications/non-lues`, { credentials: "include" });
    if (!resp.ok) return;
    const data = await resp.json();
    const badge = document.getElementById("clocheBadge");
    const navBadge = document.getElementById("navBadgeAlertes");
    if (badge) badge.textContent = data.nombre;
    if (navBadge) navBadge.textContent = data.nombre;
    if (badge) badge.style.display = data.nombre > 0 ? "flex" : "none";
  } catch (e) {
    console.error("Erreur badge notifs:", e);
  }
}

function afficherNotifications(notifs) {
  const list = document.getElementById("notifList");
  if (!list) return;
  if (!notifs || notifs.length === 0) {
    list.innerHTML = `<div class="notif-empty">${t("notif.aucune_notification", "Aucune notification")}</div>`;
    return;
  }

  const icons = {
    prediction: "zap", alerte: "alert-triangle", rapport: "file-text",
    systeme: "info", email: "mail"
  };
  const colors = {
    normale: "var(--accent-secondary)", moyenne: "var(--warning)", haute: "var(--danger)"
  };

  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.lue ? "" : "unread"}" data-id="${n.id}">
      <div class="notif-item__icon" style="color:${colors[n.priorite] || colors.normale}">
        <i data-lucide="${icons[n.type] || "bell"}"></i>
      </div>
      <div class="notif-item__content">
        <div class="notif-item__titre">${n.titre}</div>
        <div class="notif-item__message">${n.message}</div>
        <div class="notif-item__date">${n.date_creation}</div>
      </div>
      <div class="notif-item__actions">
        ${!n.lue ? `<button class="notif-btn" onclick="marquerLueNotif(${n.id})" title="${t("commun.marquer_lu", "Marquer lu")}"><i data-lucide="check"></i></button>` : ""}
        <button class="notif-btn" onclick="supprimerNotif(${n.id})" title="${t("commun.supprimer", "Supprimer")}"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  `).join("");

  if (typeof lucide !== "undefined") lucide.createIcons();
}

async function marquerLueNotif(id) {
  try {
    await fetch(`${API_URL}/notifications/${id}/lire`, { method: "PUT", credentials: "include" });
    chargerNotifications();
    chargerNombreNonLues();
  } catch (e) { console.error(e); }
}

async function toutMarquerLue() {
  try {
    await fetch(`${API_URL}/notifications/tout-lire`, { method: "PUT", credentials: "include" });
    chargerNotifications();
    chargerNombreNonLues();
  } catch (e) { console.error(e); }
}

async function supprimerNotif(id) {
  try {
    await fetch(`${API_URL}/notifications/${id}`, { method: "DELETE", credentials: "include" });
    chargerNotifications();
    chargerNombreNonLues();
  } catch (e) { console.error(e); }
}
