'use strict';

import { S } from './state.js';
import { stripRichText } from './format.js';
import { parseChangelog } from './changelog.js';

export const LOADER_LABELS = {
  vanilla: 'Vanilla',
  forge: 'Forge',
  fabric: 'Fabric',
  quilt: 'Quilt',
  neoforge: 'NeoForge',
  paper: 'Paper',
  purpur: 'Purpur',
  spigot: 'Spigot',
  bukkit: 'Bukkit',
  folia: 'Folia',
  velocity: 'Velocity',
  bungeecord: 'BungeeCord',
  waterfall: 'Waterfall'
};

export const MODE_STATUS = {
  development: { label: 'В разработке', cls: 'development' },
  crowdfunding: { label: 'Сбор на релиз', cls: 'crowdfunding' }
};

export function modeStatusMeta(mode) {
  return MODE_STATUS[String((mode && mode.status) || '')] || null;
}

export function isInstalled(mode) {
  const st = S.state[mode.id];
  return !!(st && st.installed);
}

export function inLibrary(mode) {
  const st = S.state[mode.id];
  if (!st) return false;
  if (typeof st.library === 'boolean') return st.library;
  return !!st.installed;
}

export function isHiddenMode(mode) {
  const st = S.state[mode.id];
  return !!(st && st.hidden);
}

export function isVisibleInLibrary(mode) {
  return inLibrary(mode) && !isHiddenMode(mode);
}

export function isUpdate(mode) {
  const st = S.state[mode.id];
  return !!(
    st &&
    st.installed &&
    st.version !== mode.version &&
    st.skippedVersion !== mode.version
  );
}

export function loaderLabel(mode) {
  return LOADER_LABELS[mode.loader] || mode.loader || 'Vanilla';
}

export function modeSub(mode) {
  return `MC ${mode.mcVersion || '—'} · ${loaderLabel(mode)}`;
}

export function modeAuthors(mode) {
  const list = Array.isArray(mode.authors) && mode.authors.length
    ? mode.authors
    : (mode.author ? [mode.author] : []);
  return [...new Set(list.filter((author) => author && author.name).map((author) => author.name))];
}

export function cardSub(mode) {
  return `${modeSub(mode)}${mode.version ? ` · v${mode.version}` : ''}`;
}

export function modeShortDescription(mode) {
  const short = String((mode && mode.shortDescription) || '').trim();
  if (short) return short;
  const full = String((mode && mode.description) || '').trim();
  if (!full) return 'Описание пока не заполнено.';
  return stripRichText(full).slice(0, 260) || 'Описание пока не заполнено.';
}

export function modeFullDescription(mode) {
  return String((mode && mode.description) || '').trim() || modeShortDescription(mode);
}

export function modeTags(mode, limit = 3) {
  const tags = Array.isArray(mode.tags) ? mode.tags.filter(Boolean) : [];
  return tags.slice(0, limit);
}

export function sortByTitle(list) {
  return [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'));
}

export function sortModes(list) {
  return [...list].sort((a, b) => {
    const ar = S.running === a.id ? 0 : 1;
    const br = S.running === b.id ? 0 : 1;
    if (ar !== br) return ar - br;
    const ai = isInstalled(a) ? 0 : 1;
    const bi = isInstalled(b) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
  });
}

export function modeById(id) {
  return S.modes.find((m) => m.id === id) || null;
}

export function modeInstalledAt(mode) {
  const st = S.state[mode.id];
  return Number(st && st.installedAt) || 0;
}

export function modePlaytime(mode) {
  const st = S.state[mode.id];
  return Number(st && st.playtimeSecs) || 0;
}

export function modeReleaseDate(mode) {
  const direct = String((mode && mode.releaseDate) || '').trim();
  if (direct) return direct;
  const history = Array.isArray(mode && mode.history) ? mode.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const date = String((history[index] && history[index].date) || '').trim();
    if (date) return date;
  }
  return '';
}

export function latestUpdateEntry(mode) {
  if (Array.isArray(mode.history) && mode.history.length) {
    return mode.history[0];
  }
  const parsed = parseChangelog(mode)[0];
  if (!parsed) return null;
  const match = String(parsed.title || '').match(/^v?(\d+\.\d+(?:\.\d+)?)/i);
  return {
    version: match ? match[1] : parsed.title,
    title: '',
    tags: [],
    date: '',
    changes: parsed.lines
  };
}

export function modeUpdatedAt(mode) {
  const latest = latestUpdateEntry(mode);
  return String((latest && latest.date) || modeReleaseDate(mode) || '');
}

export function computeAction(mode) {
  if (S.running === mode.id) return 'running';
  if (!inLibrary(mode)) return 'add';
  if (isUpdate(mode)) return 'update';
  if (isInstalled(mode)) return 'play';
  return 'install';
}
