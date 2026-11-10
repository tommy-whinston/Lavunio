'use strict';

import { S } from './state.js';

export function ownUsername() {
  return S.lavunio && S.lavunio.user ? S.lavunio.user.username : null;
}

export function isOwnUsername(username) {
  const own = ownUsername();
  return !!own && String(own).toLowerCase() === String(username || '').toLowerCase();
}

export function friendByUsername(username) {
  const target = String(username || '').toLowerCase();
  return (S.friends || []).find(
    (friend) => String(friend.username || '').toLowerCase() === target
  ) || null;
}

