(async function() {
  const saved = localStorage.getItem("langue") || "fr";
  let translations = {};
  try {
    const resp = await fetch(`/i18n/${saved}.json`);
    translations = await resp.json();
  } catch (e) { return; }

  function flatten(obj, prefix) {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        Object.assign(result, flatten(val, full));
      } else {
        result[full] = val;
      }
    }
    return result;
  }

  const flat = flatten(translations, "");

  window.__i18n = flat;
  window.t = function(key, fallback) {
    return flat[key] || fallback || key;
  };

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (flat[key]) el.textContent = flat[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (flat[key]) el.placeholder = flat[key];
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (flat[key]) el.title = flat[key];
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (flat[key]) el.innerHTML = flat[key];
  });
})();
