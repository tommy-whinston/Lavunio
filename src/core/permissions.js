'use strict';

import { S } from './state.js';

export function publisherAllowed() {
  const user = S.lavunio && S.lavunio.user;
  return !!(S.lavunio && S.lavunio.configured && user && (user.role === 'author' || user.role === 'admin'));
}

export function moderatorAllowed() {
  const user = S.lavunio && S.lavunio.user;
  return !!(S.lavunio && S.lavunio.configured && user && (user.role === 'moderator' || user.role === 'admin'));
}

