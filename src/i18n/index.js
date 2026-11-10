'use strict';

/* Keyed UI translations. The phrase dictionary is a fallback for
   external/server-provided text (notifications, errors) only. */
import { EN as EXTERNAL_EN } from './en.js';
import { EN_PATTERNS as EXTERNAL_PATTERNS } from './patterns.js';
import { RU as KEYS_RU } from './locales/ru.js';
import { EN as KEYS_EN } from './locales/en.js';

const STORAGE_KEY = "lavunio.lang";
const LEGAL_BASE = "https://lavunio.pro/legal";

let LANG = "ru";

function hasCyrillic(value) {
  return /[А-Яа-яЁё]/.test(value);
}

function exact(text) {
  return Object.prototype.hasOwnProperty.call(EXTERNAL_EN, text) ? EXTERNAL_EN[text] : null;
}

function applyPatterns(text) {
  for (const pair of EXTERNAL_PATTERNS) {
    const pattern = pair[0];
    if (!pattern.includes("*")) continue;
    const parts = pattern.split("*");
    if (parts.length === 2) {
      const start = parts[0];
      const end = parts[1];
      if (!text.startsWith(start) || !text.endsWith(end)) continue;
      if (text.length < start.length + end.length) continue;
      const middle = text.slice(start.length, text.length - end.length);
      if (!middle) continue;
      return pair[1].replace("*", middle);
    }
    let index = 0;
    let ok = true;
    const captures = [];
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (i === 0) {
        if (!text.startsWith(part)) { ok = false; break; }
        index = part.length;
      } else if (i === parts.length - 1) {
        if (!text.endsWith(part)) { ok = false; break; }
        const endIndex = text.length - part.length;
        if (endIndex < index) { ok = false; break; }
        captures.push(text.slice(index, endIndex));
        index = text.length;
      } else {
        const found = text.indexOf(part, index);
        if (found < 0) { ok = false; break; }
        captures.push(text.slice(index, found));
        index = found + part.length;
      }
    }
    if (!ok) continue;
    let result = pair[1];
    captures.forEach((capture) => {
      result = result.replace("*", capture);
    });
    return result;
  }
  return null;
}

function replaceUnits(text) {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*ГБ/g, "$1 GB")
    .replace(/(\d+(?:[.,]\d+)?)\s*МБ/g, "$1 MB")
    .replace(/(\d+(?:[.,]\d+)?)\s*КБ/g, "$1 KB")
    .replace(/(\d+)\s*байт/g, "$1 bytes")
    .replace(/(\d+)\s*Б(?![А-Яа-яЁё])/g, "$1 B")
    .replace(/(\d+)\s*ч(?![А-Яа-яЁё])/g, "$1 h")
    .replace(/(\d+)\s*мин(?![А-Яа-яЁё])/g, "$1 min")
    .replace(/(\d+)\s*сек(?![А-Яа-яЁё])/g, "$1 s");
}

function translatePhrase(text) {
  let current = text;
  for (let pass = 0; pass < 5; pass += 1) {
    const direct = exact(current);
    if (direct !== null) {
      current = direct;
      if (!hasCyrillic(current)) break;
      continue;
    }
    const colon = current.indexOf(": ");
    if (colon > 0) {
      const prefix = exact(current.slice(0, colon + 1));
      if (prefix !== null) {
        current = `${prefix} ${current.slice(colon + 2)}`;
        if (!hasCyrillic(current)) break;
        continue;
      }
    }
    const patterned = applyPatterns(current);
    if (patterned !== null && patterned !== current) {
      current = patterned;
      if (!hasCyrillic(current)) break;
      continue;
    }
    const withUnits = replaceUnits(current);
    if (withUnits !== current) {
      current = withUnits;
      if (!hasCyrillic(current)) break;
      continue;
    }
    return current;
  }
  return current;
}

function tKey(key, vars) {
  const dict = LANG === "en" ? KEYS_EN : KEYS_RU;
  let value = dict[key] ?? KEYS_RU[key] ?? key;
  if (Array.isArray(vars)) {
    vars.forEach((replacement, index) => {
      value = value.replaceAll(`{${index}}`, String(replacement));
    });
  } else if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

function applyKeysToElement(element) {
  if (!element || element.nodeType !== 1) return;
  if (element.hasAttribute("data-i18n")) {
    element.textContent = tKey(element.getAttribute("data-i18n"));
  }
  if (element.hasAttribute("data-i18n-placeholder")) {
    element.setAttribute("placeholder", tKey(element.getAttribute("data-i18n-placeholder")));
  }
  if (element.hasAttribute("data-i18n-title")) {
    const value = tKey(element.getAttribute("data-i18n-title"));
    element.setAttribute("title", value);
    element.setAttribute("aria-label", value);
  }
  if (element.hasAttribute("data-i18n-aria")) {
    element.setAttribute("aria-label", tKey(element.getAttribute("data-i18n-aria")));
  }
  if (element.hasAttribute("data-i18n-alt")) {
    element.setAttribute("alt", tKey(element.getAttribute("data-i18n-alt")));
  }
}

function applyKeyTranslations(root = document) {
  if (!root) return;
  if (root.nodeType === 1) applyKeysToElement(root);
  if (!root.querySelectorAll) return;
  root.querySelectorAll("[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria], [data-i18n-alt]").forEach(applyKeysToElement);
}

function translateAll() {
  if (!document.body) return;
  applyKeyTranslations(document.body);
  document.querySelectorAll(".modal-close").forEach((button) => {
    button.setAttribute("aria-label", tKey("topbar.close"));
  });
}

function setLang(next, options) {
  const lang = String(next || "").toLowerCase() === "en" ? "en" : "ru";
  if (lang === LANG) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    return LANG;
  }
  LANG = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  document.documentElement.lang = lang;
  translateAll();
  if (!options || options.announce !== false) {
    document.dispatchEvent(new CustomEvent("lavunio:lang", { detail: { lang } }));
  }
  return LANG;
}

function t(text) {
  if (LANG !== "en") return text;
  const value = String(text);
  if (!hasCyrillic(value)) return value;
  const trimmed = value.trim();
  const translated = translatePhrase(trimmed);
  if (translated === trimmed) return value;
  const start = value.indexOf(trimmed);
  return value.slice(0, start) + translated + value.slice(start + trimmed.length);
}

function locale() {
  return LANG === "en" ? "en-US" : "ru-RU";
}

function legalUrl(kind) {
  return `${LEGAL_BASE}/${kind}?lang=${LANG}`;
}

function init() {
  let saved = "ru";
  try {
    saved = localStorage.getItem(STORAGE_KEY) || "ru";
  } catch (_) {}
  LANG = saved === "en" ? "en" : "ru";
  document.documentElement.lang = LANG;
  if (document.body) applyKeyTranslations(document.body);

  document.querySelectorAll(".modal-close").forEach((button) => {
    if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", tKey("topbar.close"));
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-legal]");
    if (!link) return;
    event.preventDefault();
    const kind = link.dataset.legal;
    const url = legalUrl(kind);
    if (window.tm && window.tm.openUrl) window.tm.openUrl(url).catch(() => {});
    else window.open(url, "_blank");
  });
}

window.I18n = {
  t,
  tKey,
  applyKeys: applyKeyTranslations,
  lang: () => LANG,
  locale,
  setLang,
  translate: translateAll,
  legalUrl,
  init
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export const I18n = window.I18n;
export { tKey };
