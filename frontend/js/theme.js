// =============================================================
// Theme toggle (login/register pages — Font Awesome)
// =============================================================
const boutonTheme = document.getElementById("themeToggle");

function appliquerThemeSauvegarde() {
  const themeSauvegarde = localStorage.getItem("theme");
  if (themeSauvegarde === "dark") {
    document.body.classList.add("dark");
    if (boutonTheme) {
      const icon = boutonTheme.querySelector("i");
      if (icon) { icon.classList.remove("fa-moon"); icon.classList.add("fa-sun"); }
    }
  }
}

if (boutonTheme) {
  boutonTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const estSombre = document.body.classList.contains("dark");
    localStorage.setItem("theme", estSombre ? "dark" : "light");
    const icon = boutonTheme.querySelector("i");
    if (icon) {
      if (estSombre) { icon.classList.remove("fa-moon"); icon.classList.add("fa-sun"); }
      else { icon.classList.remove("fa-sun"); icon.classList.add("fa-moon"); }
    }
  });
}

appliquerThemeSauvegarde();
