'use strict';

import { EN } from './en.js';
import { EN_PATTERNS } from './patterns.js';

const STORAGE_KEY = "lavunio.lang";
const LEGAL_BASE = "https://lavunio.pro/legal";

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
let LANG = "ru";
let observer = null;
const trackedText = new Set();
const trackedElements = new Set();

function hasCyrillic(value) {
  return /[А-Яа-яЁё]/.test(value);
}

function exact(text) {
  return Object.prototype.hasOwnProperty.call(EN, text) ? EN[text] : null;
}

function applyPatterns(text) {
  for (const pair of EN_PATTERNS) {
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

function translateText(raw) {
  if (LANG !== "en") return raw;
  const text = String(raw);
  const trimmed = text.trim();
  if (!trimmed || !hasCyrillic(trimmed)) return text;
  const translated = translatePhrase(trimmed);
  if (translated === trimmed) return text;
  const start = text.indexOf(trimmed);
  return text.slice(0, start) + translated + text.slice(start + trimmed.length);
}

function shouldSkip(element) {
  if (!element || element.nodeType !== 1) return false;
  if (element.closest("[data-i18n-skip]")) return true;
  const tag = element.tagName;
  return tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA";
}

function translateTextNode(node) {
  if (!node || node.nodeType !== 3) return;
  if (node.parentElement && shouldSkip(node.parentElement)) return;
  const current = node.nodeValue;
  let source = node.__i18nSrc;
  if (source !== undefined) {
    const previous = translateText(source);
    if (current !== previous) {
      source = current;
      node.__i18nSrc = source;
    }
  } else {
    source = current;
    node.__i18nSrc = source;
  }
  if (!hasCyrillic(source)) return;
  const translated = translateText(source);
  if (translated !== node.nodeValue) node.nodeValue = translated;
  if (translated !== source) trackedText.add(node);
}

function translateAttribute(element, attr) {
  if (!element.hasAttribute(attr)) return;
  const current = element.getAttribute(attr);
  let store = element.__i18nAttrs;
  if (!store) {
    store = {};
    element.__i18nAttrs = store;
  }
  let source = store[attr];
  if (source !== undefined) {
    const previous = translateText(source);
    if (current !== previous) {
      source = current;
      store[attr] = source;
    }
  } else {
    source = current;
    store[attr] = source;
  }
  if (!hasCyrillic(source)) return;
  const translated = translateText(source);
  if (translated !== current) element.setAttribute(attr, translated);
  if (translated !== source) trackedElements.add(element);
}

function translateElement(element) {
  if (!element) return;
  if (element.closest("[data-i18n-skip]")) return;
  for (const attr of ATTRS) translateAttribute(element, attr);
  const children = element.childNodes;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.nodeType === 3) translateTextNode(child);
    else if (child.nodeType === 1) translateElement(child);
  }
}

function restoreTextNode(node) {
  if (node.__i18nSrc !== undefined) {
    node.nodeValue = node.__i18nSrc;
  }
}

function restoreElement(element) {
  const store = element.__i18nAttrs;
  if (!store) return;
  for (const attr of Object.keys(store)) element.setAttribute(attr, store[attr]);
}

function translateAll() {
  if (!document.body) return;
  if (LANG === "en") translateElement(document.body);
  else {
    trackedText.forEach(restoreTextNode);
    trackedElements.forEach(restoreElement);
  }
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
  if (document.body && LANG === "en") translateElement(document.body);

  if (!observer && document.body) {
    observer = new MutationObserver((mutations) => {
      if (LANG !== "en") return;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 3) translateTextNode(node);
            else if (node.nodeType === 1) translateElement(node);
          });
        } else if (mutation.type === "characterData") {
          translateTextNode(mutation.target);
        } else if (mutation.type === "attributes") {
          translateAttribute(mutation.target, mutation.attributeName);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  document.querySelectorAll(".modal-close").forEach((button) => {
    if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", "Закрыть");
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
