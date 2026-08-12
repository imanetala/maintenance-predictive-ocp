const API_URL = window.location.origin;

const form = document.getElementById("loginForm");
const btnLogin = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const togglePassword = document.getElementById("togglePassword");
const champMotDePasse = document.getElementById("password");

if (togglePassword && champMotDePasse) {
  togglePassword.addEventListener("click", () => {
    const icon = togglePassword.querySelector("i");
    if (champMotDePasse.type === "password") {
      champMotDePasse.type = "text";
      icon.classList.remove("fa-regular", "fa-eye");
      icon.classList.add("fa-regular", "fa-eye-slash");
    } else {
      champMotDePasse.type = "password";
      icon.classList.remove("fa-regular", "fa-eye-slash");
      icon.classList.add("fa-regular", "fa-eye");
    }
  });
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom_utilisateur = document.getElementById("username").value;
    const mot_de_passe = champMotDePasse.value;

    btnLogin.disabled = true;
    const btnText = btnLogin.querySelector(".login-btn__text");
    if (btnText) btnText.textContent = t("commun.connexion_en_cours", "Connexion en cours\u2026");
    loginError.classList.remove("visible");

    try {
      const reponse = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom_utilisateur, mot_de_passe })
      });
      if (!reponse.ok) throw new Error(t("commun.erreur_nom_utilisateur", "Nom d'utilisateur ou mot de passe incorrect."));
      const donnees = await reponse.json();
      sessionStorage.setItem("utilisateur", JSON.stringify(donnees));
      window.location.href = "/";
    } catch (erreur) {
      loginError.textContent = erreur.message;
      loginError.classList.add("visible");
    } finally {
      btnLogin.disabled = false;
      if (btnText) btnText.textContent = t("login.se_connecter", "Se connecter");
    }
  });
}

/* =============================================================
   FORGOT PASSWORD — 3-step flow (login page only)
   ============================================================= */
const fpOverlay = document.getElementById("fpOverlay");

if (fpOverlay) {
  const fpStep1 = document.getElementById("fpStep1");
  const fpStep2 = document.getElementById("fpStep2");
  const fpStep3 = document.getElementById("fpStep3");
  const fpClose = document.getElementById("fpClose");
  const fpError1 = document.getElementById("fpError1");
  const fpError3 = document.getElementById("fpError3");
  const fpSuccess3 = document.getElementById("fpSuccess3");
  const fpUsername = document.getElementById("fpUsername");
  const fpSendBtn = document.getElementById("fpSendBtn");
  const fpTokenDisplay = document.getElementById("fpTokenDisplay");
  const fpCopyToken = document.getElementById("fpCopyToken");
  const fpNextToReset = document.getElementById("fpNextToReset");
  const fpTokenInput = document.getElementById("fpTokenInput");
  const fpNewPassword = document.getElementById("fpNewPassword");
  const fpResetBtn = document.getElementById("fpResetBtn");
  const fpBackToLogin1 = document.getElementById("fpBackToLogin1");
  const fpBackToLogin3 = document.getElementById("fpBackToLogin3");
  const toggleFpPassword = document.getElementById("toggleFpPassword");

  function fpShowStep(step) {
    fpStep1.style.display = step === 1 ? "flex" : "none";
    fpStep2.style.display = step === 2 ? "flex" : "none";
    fpStep3.style.display = step === 3 ? "flex" : "none";
  }

  function fpCloseModal() {
    fpOverlay.classList.remove("active");
  }

  function fpOpen() {
    fpError1.classList.remove("visible");
    fpError3.classList.remove("visible");
    fpSuccess3.classList.remove("visible");
    fpUsername.value = "";
    fpTokenInput.value = "";
    fpNewPassword.value = "";
    fpShowStep(1);
    fpOverlay.classList.add("active");
    setTimeout(() => fpUsername.focus(), 200);
  }

  const forgotLink = document.getElementById("forgotPasswordLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => { e.preventDefault(); fpOpen(); });
  }
  if (fpClose) fpClose.addEventListener("click", fpCloseModal);
  if (fpBackToLogin1) fpBackToLogin1.addEventListener("click", fpCloseModal);
  if (fpBackToLogin3) fpBackToLogin3.addEventListener("click", fpCloseModal);
  fpOverlay.addEventListener("click", (e) => { if (e.target === fpOverlay) fpCloseModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && fpOverlay.classList.contains("active")) fpCloseModal(); });

  if (fpSendBtn) {
    fpSendBtn.addEventListener("click", async () => {
      const username = fpUsername.value.trim();
      if (!username) { fpError1.textContent = t("commun.connexion_requise", "Veuillez saisir votre nom d'utilisateur."); fpError1.classList.add("visible"); return; }
      fpError1.classList.remove("visible");
      fpSendBtn.disabled = true;
      const btnText = fpSendBtn.querySelector(".login-btn__text");
      if (btnText) btnText.textContent = t("commun.generation", "Generation\u2026");

      try {
        const resp = await fetch(`${API_URL}/forgot-password`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ nom_utilisateur: username })
        });
        const data = await resp.json();
        if (!resp.ok) {
          fpError1.textContent = data.erreur || t("commun.erreur", "Une erreur est survenue.");
          fpError1.classList.add("visible");
        } else if (data.token) {
          fpTokenDisplay.value = data.token;
          fpShowStep(2);
        } else {
          fpError1.textContent = t("commun.mdp_non_trouve", "Ce nom d'utilisateur n'existe pas. Creez d'abord un compte.");
          fpError1.classList.add("visible");
        }
      } catch (err) {
        fpError1.textContent = t("commun.erreur_serveur", "Erreur de connexion au serveur.");
        fpError1.classList.add("visible");
      } finally {
        fpSendBtn.disabled = false;
        if (btnText) btnText.textContent = t("commun.generer_code", "Generer le code");
      }
    });
  }

  if (fpCopyToken) {
    fpCopyToken.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(fpTokenDisplay.value);
        fpCopyToken.classList.add("copied");
        fpCopyToken.querySelector("i").className = "fa-solid fa-check";
        setTimeout(() => { fpCopyToken.classList.remove("copied"); fpCopyToken.querySelector("i").className = "fa-regular fa-copy"; }, 2000);
      } catch { fpTokenDisplay.select(); document.execCommand("copy"); }
    });
  }

  if (fpNextToReset) {
    fpNextToReset.addEventListener("click", () => { fpShowStep(3); fpTokenInput.value = fpTokenDisplay.value; fpNewPassword.focus(); });
  }

  if (toggleFpPassword && fpNewPassword) {
    toggleFpPassword.addEventListener("click", () => {
      const icon = toggleFpPassword.querySelector("i");
      if (fpNewPassword.type === "password") { fpNewPassword.type = "text"; icon.className = "fa-regular fa-eye-slash"; }
      else { fpNewPassword.type = "password"; icon.className = "fa-regular fa-eye"; }
    });
  }

  if (fpResetBtn) {
    fpResetBtn.addEventListener("click", async () => {
      const token = fpTokenInput.value.trim();
      const newPass = fpNewPassword.value;
      fpError3.classList.remove("visible");
      fpSuccess3.classList.remove("visible");

      if (!token) { fpError3.textContent = t("commun.code_requis", "Le code est requis."); fpError3.classList.add("visible"); return; }
      if (!newPass || newPass.length < 6) { fpError3.textContent = t("commun.mdp_requis", "Le mot de passe doit contenir au moins 6 caracteres."); fpError3.classList.add("visible"); return; }

      fpResetBtn.disabled = true;
      const btnText = fpResetBtn.querySelector(".login-btn__text");
      if (btnText) btnText.textContent = t("commun.reinitialisation", "Reinitialisation\u2026");

      try {
        const resp = await fetch(`${API_URL}/reset-password`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ token, nouveau_mot_de_passe: newPass })
        });
        const data = await resp.json();
        if (resp.ok) {
          fpSuccess3.textContent = data.message || t("commun.reinitialisation_succes", "Mot de passe reinitialise avec succes.");
          fpSuccess3.classList.add("visible");
          fpError3.classList.remove("visible");
          setTimeout(fpCloseModal, 2500);
        } else {
          fpError3.textContent = data.erreur || t("commun.erreur_reinitialisation", "Erreur lors de la reinitialisation.");
          fpError3.classList.add("visible");
        }
      } catch (err) {
        fpError3.textContent = t("commun.erreur_serveur", "Erreur de connexion au serveur.");
        fpError3.classList.add("visible");
      } finally {
        fpResetBtn.disabled = false;
        if (btnText) btnText.textContent = t("commun.reinitialiser", "Reinitialiser");
      }
    });
  }
}

/* =============================================================
   REGISTER FORM (register page only)
   ============================================================= */
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  const toggleConfirm = document.getElementById("toggleConfirmPassword");
  const confirmInput = document.getElementById("confirmPassword");

  if (toggleConfirm && confirmInput) {
    toggleConfirm.addEventListener("click", () => {
      const icon = toggleConfirm.querySelector("i");
      if (confirmInput.type === "password") {
        confirmInput.type = "text";
        icon.classList.remove("fa-regular", "fa-eye");
        icon.classList.add("fa-regular", "fa-eye-slash");
      } else {
        confirmInput.type = "password";
        icon.classList.remove("fa-regular", "fa-eye-slash");
        icon.classList.add("fa-regular", "fa-eye");
      }
    });
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirmPassword").value;
    const registerError = document.getElementById("registerError");
    const btnRegister = document.getElementById("registerBtn");

    if (password !== confirm) {
      registerError.textContent = t("commun.mdp_erreur", "Les mots de passe ne correspondent pas !");
      registerError.classList.add("visible");
      return;
    }

    btnRegister.disabled = true;
    const btnText = btnRegister.querySelector(".login-btn__text");
    if (btnText) btnText.textContent = t("commun.creation_en_cours", "Cr\u00e9ation en cours\u2026");
    registerError.classList.remove("visible");

    try {
      const reponse = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom_utilisateur: username, mot_de_passe: password })
      });
      if (!reponse.ok) {
        const data = await reponse.json().catch(() => null);
        throw new Error(data?.erreur || t("commun.erreur_inscription", "Erreur lors de l'inscription."));
      }
      window.location.href = "/login";
    } catch (erreur) {
      registerError.textContent = erreur.message;
      registerError.classList.add("visible");
    } finally {
      btnRegister.disabled = false;
      if (btnText) btnText.textContent = t("commun.creer_compte", "Cr\u00e9er mon compte");
    }
  });
}
