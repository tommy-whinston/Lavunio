'use strict';

/* Логика кастомного меню трея. Язык и тема берутся из localStorage,
   который разделяется с основным окном лаунчера. */
(function () {
  const tauri = window.__TAURI__;
  if (!tauri) return;
  const invoke = tauri.core.invoke;

  const lang = (() => {
    try {
      return localStorage.getItem('lavunio.lang') === 'en' ? 'en' : 'ru';
    } catch (_) {
      return 'ru';
    }
  })();

  const LABELS = {
    ru: {
      show: 'Открыть Lavunio',
      hide: 'Скрыть в трей',
      updates: 'Проверить обновления',
      folder: 'Открыть папку игры',
      quit: 'Выйти'
    },
    en: {
      show: 'Open Lavunio',
      hide: 'Hide to tray',
      updates: 'Check for updates',
      folder: 'Open game folder',
      quit: 'Quit'
    }
  };

  const labels = LABELS[lang];

  const close = () => invoke('tray_hide').catch(() => {});

  document.querySelectorAll('.tray-item').forEach((button) => {
    const span = button.querySelector('span');
    if (span && labels[button.dataset.key]) span.textContent = labels[button.dataset.key];

    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      try {
        if (action === 'folder') {
          await invoke('game_open_folder');
        } else {
          await invoke('tray_action', { action });
        }
      } catch (_) {}
      close();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();
