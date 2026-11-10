'use strict';

function growTextarea(el) {
  if (!el || el.tagName !== 'TEXTAREA' || !el.offsetParent) return;
  const max = Math.max(80, Math.round(window.innerHeight * 0.45));
  el.style.height = 'auto';
  const height = Math.min(el.scrollHeight, max);
  el.style.height = `${height}px`;
  el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  el.dataset.growValue = el.value;
  el.dataset.growWidth = String(el.clientWidth);
}

function growAllTextareas(root = document) {
  root.querySelectorAll('textarea').forEach(growTextarea);
}

function initAutoGrowTextareas() {
  document.addEventListener('input', (event) => {
    if (event.target && event.target.tagName === 'TEXTAREA') growTextarea(event.target);
  });
  document.addEventListener('focusin', (event) => {
    if (event.target && event.target.tagName === 'TEXTAREA') growTextarea(event.target);
  });
  window.addEventListener('resize', () => growAllTextareas());
  growAllTextareas();
  setInterval(() => {
    document.querySelectorAll('textarea').forEach((el) => {
      if (document.activeElement === el) return;
      if (!el.offsetParent) return;
      if (el.dataset.growValue === el.value && el.dataset.growWidth === String(el.clientWidth)) return;
      growTextarea(el);
    });
  }, 900);
}



export { growAllTextareas, initAutoGrowTextareas };
