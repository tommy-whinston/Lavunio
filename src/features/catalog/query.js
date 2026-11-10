'use strict';

import { S } from '../../core/state.js';
import { isInstalled, modeAuthors, sortByTitle, modeUpdatedAt, modeInstalledAt, modePlaytime, sortModes } from '../../core/modes.js';
import { parseDownloadSize } from '../../core/units.js';

export function syncFilterButtons(container, attr, active) {
  if (!container) return;
  container.querySelectorAll(`[data-${attr}]`).forEach((button) => {
    button.classList.toggle('active', button.getAttribute(`data-${attr}`) === active);
  });
}

export function modePassesFilter(mode, filter) {
  if (filter === 'installed') return isInstalled(mode);
  if (filter === 'following') return modeAuthorIds(mode).some((id) => S.follows.includes(id));
  if (filter === 'hidden') {
    const st = S.state[mode.id];
    return !!(st && st.hidden);
  }
  if (filter === 'development') return mode.status === 'development';
  if (filter === 'crowdfunding') return mode.status === 'crowdfunding';
  return true;
}

export function modeAuthorIds(mode) {
  const ids = [];
  if (mode && mode.author && mode.author.id) ids.push(mode.author.id);
  if (mode && Array.isArray(mode.authors)) {
    mode.authors.forEach((author) => {
      if (author && author.id) ids.push(author.id);
    });
  }
  return [...new Set(ids)];
}

export function sortCatalog(list, sort) {
  if (sort === 'title') return sortByTitle(list);
  if (sort === 'date' || sort === 'updated') {
    return [...list].sort((a, b) => modeUpdatedAt(b).localeCompare(modeUpdatedAt(a)));
  }
  if (sort === 'installed') {
    return [...list].sort((a, b) => modeInstalledAt(b) - modeInstalledAt(a));
  }
  if (sort === 'size') {
    return [...list].sort((a, b) => parseDownloadSize(b.size) - parseDownloadSize(a.size));
  }
  if (sort === 'playtime') {
    return [...list].sort((a, b) => modePlaytime(b) - modePlaytime(a));
  }
  return sortModes(list);
}

export function matchesSearch(mode) {
  if (!S.search) return true;
  const haystack = [
    mode.title,
    mode.description,
    mode.shortDescription,
    mode.mcVersion,
    mode.loader,
    ...modeAuthors(mode),
    ...(Array.isArray(mode.tags) ? mode.tags : [])
  ].join(' ').toLowerCase();
  return haystack.includes(S.search);
}

export function filterModes() {
  return S.modes.filter(matchesSearch);
}

