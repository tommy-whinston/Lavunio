'use strict';

let toastTimer = null;
function toast(msg, type = 'info') {
  document.getElementById('toast').textContent = window.I18n ? window.I18n.t(msg) : msg;
  document.getElementById('toast').className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (document.getElementById('toast').className = ''), 3200);
}
export { toast };
