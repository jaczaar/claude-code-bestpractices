const STORAGE_KEY = 'theme';

export function initThemeToggle(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  const btn = document.querySelector<HTMLButtonElement>('.theme-toggle');
  const icon = btn?.querySelector<HTMLElement>('.theme-toggle-icon');
  if (!btn || !icon) return;

  function updateIcon(): void {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    icon!.innerHTML = isDark ? '&#9788;' : '&#9790;';
    btn!.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  updateIcon();

  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(STORAGE_KEY, 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(STORAGE_KEY, 'dark');
    }
    updateIcon();
  });
}
