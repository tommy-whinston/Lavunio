'use strict';

import { playUiSound } from '../core/sound.js';

let toastTimer = null;
function toast(msg, type = 'info') {
  document.getElementById('toast').textContent = window.I18n ? window.I18n.t(msg) : msg;
  document.getElementById('toast').className = 'show ' + type;
  if (type === 'ok') playUiSound('success');
  else if (type === 'error') playUiSound('error');
  else if (type === 'warn') playUiSound('warn');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (document.getElementById('toast').className = ''), 3200);
}
export { toast };
