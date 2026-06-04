const THEME_KEY = "theme";
const THEMES = ["light", "dark"];

function isValidTheme(theme) {
  return THEMES.includes(theme);
}

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return isValidTheme(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function getSystemTheme() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

export function applyTheme(theme) {
  const safeTheme = isValidTheme(theme) ? theme : "light";
  document.documentElement.classList.toggle("dark", safeTheme === "dark");
  document.documentElement.dataset.theme = safeTheme;
}

export function initTheme() {
  const theme = getSavedTheme() || getSystemTheme();
  applyTheme(theme);
  return theme;
}

export function setTheme(theme) {
  const safeTheme = isValidTheme(theme) ? theme : "light";

  try {
    localStorage.setItem(THEME_KEY, safeTheme);
  } catch {
    // no-op
  }

  applyTheme(safeTheme);
  return safeTheme;
}

export function toggleTheme() {
  const current = getSavedTheme() || getSystemTheme();
  return setTheme(current === "dark" ? "light" : "dark");
}