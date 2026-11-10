'use strict';

import { $ } from '../core/dom.js';
import { els } from '../core/elements.js';
import { tKey } from '../i18n/index.js';
import { closeSelectMenu, syncSelectLabels } from './select.js';
import { growAllTextareas } from './textarea.js';
import { fillSettingsForm } from '../features/settings/view.js';
import { renderAccountModal, refreshLavunioStatus } from '../features/account/index.js';

let lastFocusedElement = null;

function openModals() {
  return [...document.querySelectorAll('.modal-overlay:not([hidden])')];
}

function focusableIn(root) {
  if (!root) return [];
  return [...root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => element.offsetParent !== null && !element.closest('[hidden]'));
}

function focusFirstIn(modal) {
  const items = focusableIn(modal).filter((element) => !element.classList.contains('modal-close'));
  const target = items[0] || focusableIn(modal)[0];
  if (target) target.focus();
}

function rememberFocus() {
  if (!openModals().length) lastFocusedElement = document.activeElement;
}

function restoreFocus() {
  if (openModals().length) return;
  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    try { lastFocusedElement.focus(); } catch (_) {}
  }
  lastFocusedElement = null;
}

export function openModal(id) {
  if (document.getElementById(id).hidden) rememberFocus();
  closeSelectMenu();
  if (id === 'modal-settings') {
    fillSettingsForm();
  }
  if (id === 'modal-account') {
    renderAccountModal();
    refreshLavunioStatus();
  }
  $(id).hidden = false;
  requestAnimationFrame(() => {
    syncSelectLabels();
    growAllTextareas($(id));
  });
  setTimeout(() => focusFirstIn($(id)), 30);
}

export function closeModals() {
  closeSelectMenu();
  document.querySelectorAll('.modal-overlay').forEach((m) => (m.hidden = true));
  if (confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(false);
  }
  restoreFocus();
}

let confirmResolve = null;

export function askConfirm(title, text, okLabel = tKey("delete")) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    if (!openModals().length) lastFocusedElement = document.activeElement;
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.btnConfirmOk.textContent = okLabel;
    els.confirmModal.hidden = false;
    els.btnConfirmOk.focus();
  });
}

function closeConfirm(value) {
  els.confirmModal.hidden = true;
  if (confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(value);
  }
  restoreFocus();
}

function closeTopModal() {
  const opened = openModals();
  if (!opened.length) return false;
  const top = opened[opened.length - 1];
  if (top.id === 'modal-confirm') {
    closeConfirm(false);
  } else {
    top.hidden = true;
    restoreFocus();
  }
  return true;
}

export function bindModals() {
  els.btnConfirmOk.onclick = () => closeConfirm(true);
  els.btnConfirmCancel.onclick = () => closeConfirm(false);
  els.btnConfirmX.onclick = () => closeConfirm(false);
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.close === 'modal-confirm') {
        closeConfirm(false);
      } else {
        const target = $(btn.dataset.close);
        if (target) target.hidden = true;
        restoreFocus();
      }
    };
  });
  document.querySelectorAll('.modal-overlay').forEach((ov) => {
    ov.addEventListener('mousedown', (e) => {
      if (e.target !== ov) return;
      if (ov.id === 'modal-confirm') closeConfirm(false);
      else { ov.hidden = true; restoreFocus(); }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (closeTopModal()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const opened = openModals();
    if (!opened.length) return;
    const items = focusableIn(opened[opened.length - 1]);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}
