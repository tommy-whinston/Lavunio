'use strict';

export const $ = (id) => document.getElementById(id);

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

export function normalizeIdInput(input) {
  const raw = input.value;
  const caret = input.selectionStart ?? raw.length;
  const next = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (raw === next) return;
  const prefix = raw.slice(0, caret).toLowerCase().replace(/[^a-z0-9]/g, '');
  input.value = next;
  const position = Math.min(prefix.length, next.length);
  input.setSelectionRange(position, position);
}
