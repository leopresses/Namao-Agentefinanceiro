const THEME_COLORS = {
  light: '#F8FAFC',
  dark: '#0F172A',
};

export function getStoredTheme() {
  try {
    return localStorage.getItem('namao_theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  const safeTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', safeTheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[safeTheme]);
  return safeTheme;
}
