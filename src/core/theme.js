'use strict';

const STORAGE_KEY = 'lavunio.theme';
const CHOICES = new Set(['light', 'dark', 'system']);
let bound = false;

export function getThemeChoice() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return CHOICES.has(value) ? value : 'system';
  } catch (_) {
    return 'system';
  }
}

function resolveTheme(choice) {
  if (choice === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return choice === 'dark' ? 'dark' : 'light';
}

export function applyTheme(choice = getThemeChoice(), options = {}) {
  const value = CHOICES.has(choice) ? choice : 'system';
  const { persist = true } = options;
  const resolved = resolveTheme(value);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeChoice = value;
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    const active = button.dataset.themeChoice === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
  }
}

export function initTheme() {
  applyTheme(getThemeChoice(), { persist: false });
  if (bound) return;
  bound = true;
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => applyTheme(button.dataset.themeChoice));
  });
  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (media.addEventListener) {
      media.addEventListener('change', () => {
        if (getThemeChoice() === 'system') applyTheme('system', { persist: false });
      });
    }
  }
}
