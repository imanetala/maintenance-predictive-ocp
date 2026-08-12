// =============================================================
// chart-theme.js — Theme-aware color helpers for Chart.js
// Must be loaded BEFORE app.js and pages.js
// =============================================================

function getCSS(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
}

function getChartThemeColors() {
  const accent = getCSS('--accent-primary');
  const danger = getCSS('--danger');
  const warning = getCSS('--warning');
  const accentSoft = getCSS('--accent-primary-soft');
  const dangerSoft = getCSS('--danger-soft');
  return {
    accent, danger, warning, accentSoft, dangerSoft,
    accentRgb: hexToRgb(accent),
    dangerRgb: hexToRgb(danger),
    warningRgb: hexToRgb(warning),
    safe: accent,
    safeSoft: accentSoft,
    gridColor: getCSS('--border-subtle') || 'rgba(0,0,0,0.06)',
    textColor: getCSS('--text-secondary') || '#6B7280',
  };
}
