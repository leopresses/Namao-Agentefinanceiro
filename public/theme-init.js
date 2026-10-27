try {
  const theme = localStorage.getItem('namao_theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#0F172A' : '#F8FAFC');
} catch { /* Storage may be unavailable in private browser contexts. */ }
