'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');

function parseMap(file, name) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf(`export const ${name} = {`);
  if (start < 0) throw new Error(`Locale ${name} not found in ${file}`);
  const open = text.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return new Function('return ' + text.slice(open, i + 1))();
    }
  }
  throw new Error(`Unterminated locale object in ${file}`);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'i18n' || entry.name === 'vendor') continue;
      walk(full, files);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

function checkKeys() {
  const ru = parseMap(path.join(SRC, 'i18n/locales/ru.js'), 'RU');
  const en = parseMap(path.join(SRC, 'i18n/locales/en.js'), 'EN');
  const used = new Map();
  const add = (key, where) => {
    if (!used.has(key)) used.set(key, []);
    if (used.get(key).length < 3) used.get(key).push(where);
  };

  for (const file of walk(SRC)) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const where = `${rel}:${index + 1}`;
      for (const match of line.matchAll(/tKey\(\s*["']([^"']+)["']/g)) add(match[1], where);
      for (const match of line.matchAll(/data-i18n(?:-placeholder|-title|-aria|-alt)?="([^"]+)"/g)) add(match[1], where);
    });
  }

  const missing = [];
  const empty = [];
  for (const [key, where] of used) {
    if (!(key in ru)) missing.push({ key, where });
    else if (!ru[key] || !en[key]) empty.push({ key, where });
  }

  const ruOnly = Object.keys(ru).filter((key) => !(key in en));
  const enOnly = Object.keys(en).filter((key) => !(key in ru));
  const duplicate = (text) => {
    const keys = [...text.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]);
    const seen = new Set();
    return keys.filter((key) => (seen.has(key) ? true : (seen.add(key), false)));
  };
  const duplicatesRu = duplicate(fs.readFileSync(path.join(SRC, 'i18n/locales/ru.js'), 'utf8'));
  const duplicatesEn = duplicate(fs.readFileSync(path.join(SRC, 'i18n/locales/en.js'), 'utf8'));

  return { used: used.size, ru: Object.keys(ru).length, en: Object.keys(en).length, missing, empty, ruOnly, enOnly, duplicatesRu, duplicatesEn };
}

module.exports = { checkKeys };
