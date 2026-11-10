'use strict';

import { tKey } from '../i18n/index.js';

import { S } from './state.js';

export function lavunioLoggedIn() {
  return !!(S.lavunio && S.lavunio.user);
}

export function lavunioName(user) {
  if (!user) return tKey("guest");
  return user.displayName || user.username || tKey("player.2");
}

export function lavunioLetter(user) {
  const name = lavunioName(user);
  return name ? name[0].toUpperCase() : '?';
}

export function applyLavunioAvatar(el, user) {
  if (!el) return;
  el.classList.remove('loaded', 'skin-head', 'lavunio-avatar');
  const url = user && user.skinUrl;
  if (url) {
    el.textContent = '';
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add('loaded', 'skin-head');
  } else {
    el.style.backgroundImage = '';
    el.textContent = lavunioLetter(user);
    el.classList.add('lavunio-avatar');
  }
}

