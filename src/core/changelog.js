'use strict';

export function isChangelogHeading(line) {
  const text = String(line || '').trim();
  if (!text) return false;
  return /^(?:\[?v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?\]?)(?:\s|$|[-—:])/i.test(text)
    || /^(?:версия|обновление)\s+\d/i.test(text)
    || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(text);
}

export function cleanChangelogLine(line) {
  return String(line || '').replace(/^[-—–•*]\s*/, '').trim();
}

export function parseChangelog(mode) {
  const raw = (mode.changelog || '').trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (const line of lines) {
    if (isChangelogHeading(line)) {
      const title = line
        .replace(/^\[|\]$/g, '')
        .replace(/^(?:версия|обновление)\s+/i, '')
        .trim();
      current = { title, lines: [] };
      entries.push(current);
      continue;
    }

    if (!current) {
      current = {
        title: mode.version ? `Версия ${mode.version}` : 'Текущая версия',
        lines: []
      };
      entries.push(current);
    }

    const cleaned = cleanChangelogLine(line);
    if (cleaned) current.lines.push(cleaned);
  }

  return entries;
}

export function changelogModel(mode) {
  if (Array.isArray(mode.history) && mode.history.length) {
    return mode.history.map((entry) => ({
      version: entry.version || '',
      title: entry.title || '',
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      date: entry.date || '',
      time: entry.time || '',
      lines: Array.isArray(entry.changes) ? entry.changes : []
    }));
  }
  return parseChangelog(mode).map((entry) => ({
    version: '',
    title: entry.title,
    tags: [],
    date: '',
    time: '',
    lines: entry.lines
  }));
}

