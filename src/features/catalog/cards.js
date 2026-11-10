'use strict';

import { S } from '../../core/state.js';
import { escapeHtml } from '../../core/dom.js';
import { formatUpdateDate } from '../../core/format.js';
import { computeAction, isUpdate, isInstalled, inLibrary, modeStatusMeta, modeAuthors, cardSub, modeTags, modeShortDescription, modeUpdatedAt } from '../../core/modes.js';

export const ART_CACHE = new Map();
export const DEFAULT_ACCENT = '#e5322b';

export function cardStatus(mode) {
  if (S.running === mode.id) return { cls: 'playing', text: 'В игре' };
  if (isUpdate(mode)) return { cls: 'update', text: 'Обновление' };
  if (isInstalled(mode)) return { cls: 'installed', text: 'Установлено' };
  if (inLibrary(mode)) return { cls: 'library', text: 'Не установлено' };
  return { cls: 'new', text: 'Доступно' };
}

export function libraryStateMeta(mode) {
  if (S.busy && S.busy.modeId === mode.id) {
    const percent = Math.max(0, Math.min(100, Math.round((Number(S.progress) || 0) * 100)));
    const kind = S.busy.action === 'update' ? 'update' : S.busy.action === 'play' ? 'ready' : 'install';
    const stage = String(S.stage || '').trim();
    const prefix = stage || (kind === 'update' ? 'Обновление' : kind === 'ready' ? 'Запуск' : 'Установка');
    return {
      cls: kind,
      label: `${prefix} ${percent}%`,
      icon: kind === 'update' ? 'update' : kind === 'ready' ? 'play' : 'install',
      action: 'play',
      busy: true
    };
  }
  const action = computeAction(mode);
  if (action === 'running') return { cls: 'running', label: 'Запущено', icon: 'stop', action: 'stop' };
  if (action === 'update') return { cls: 'update', label: 'Обновить', icon: 'update', action: 'play' };
  if (action === 'play') return { cls: 'ready', label: 'Готово к игре', icon: 'play', action: 'play' };
  return { cls: 'install', label: 'Установить', icon: 'install', action: 'play' };
}

export function cardPlayIcon(kind) {
  if (kind === 'install') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10"/><path d="m7.5 10 4.5 4.5L16.5 10"/><path d="M5 19h14"/></svg>';
  }
  if (kind === 'update') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4v6h-6"/></svg>';
  }
  if (kind === 'stop') {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.8" fill="currentColor"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5a1 1 0 0 0-1.53.85Z"/></svg>';
}

export function modeCardHtml(mode, withMenu = false, playMode = false) {
  const st = cardStatus(mode);
  const installed = isInstalled(mode);
  const updated = modeUpdatedAt(mode);
  const status = modeStatusMeta(mode);
  const stateMeta = playMode ? libraryStateMeta(mode) : null;
  const screenshots = (Array.isArray(mode.screenshots) ? mode.screenshots : [])
    .filter(Boolean)
    .slice(0, 3);
  const tags = modeTags(mode, 3)
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join('');
  return `
    <article class="mode-card ${installed ? 'installed' : ''}" data-id="${escapeHtml(mode.id)}">
      <div class="card-media">
        <img src="${escapeHtml(imageSrc(mode))}" alt="" loading="lazy" data-fallback>
        ${playMode ? `<button class="card-play state-${stateMeta.cls}" data-card-action="${stateMeta.action}" type="button" aria-label="${escapeHtml(stateMeta.action === 'stop' ? 'Закрыть игру' : stateMeta.label)}: ${escapeHtml(mode.title || 'режим')}" ${stateMeta.busy ? 'disabled' : ''}>${cardPlayIcon(stateMeta.icon)}</button>` : ''}
        <div class="card-badge ${st.cls}">${st.text}</div>
        ${playMode ? `<div class="card-progress" data-card-progress role="progressbar" aria-label="Прогресс" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><span></span></div>` : ''}
        ${withMenu ? `<button class="card-menu-btn" type="button" title="Действия" aria-label="Действия">⋯</button>` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(mode.title || 'Без названия')}</div>
        <div class="card-sub">${escapeHtml(cardSub(mode))}</div>
        ${modeAuthors(mode).length ? `<div class="card-author">${escapeHtml(modeAuthors(mode).join(', '))}</div>` : ''}
        ${screenshots.length ? `
          <div class="card-shots">
            ${screenshots.map((url) => `<img src="${escapeHtml(url)}" alt="" loading="lazy">`).join('')}
          </div>` : ''}
        ${status ? `<div class="card-status-row"><span class="mode-status ${status.cls}">${status.label}</span></div>` : ''}
        ${updated ? `<div class="card-release">Обновлено ${escapeHtml(formatUpdateDate(updated))}</div>` : ''}
        <div class="card-desc">${escapeHtml(modeShortDescription(mode))}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        <div class="card-foot">
          <span class="card-installs">${Number(mode.installs) ? `${Number(mode.installs)} установок` : ''}</span>
          ${mode.rating ? `<span class="card-installs">★ ${Number(mode.rating).toFixed(1)}</span>` : ''}
          <span class="card-size">${escapeHtml(mode.size || '-')}</span>
          ${playMode
            ? `<span class="card-state state-${stateMeta.cls}" data-card-state>${escapeHtml(stateMeta.label)}</span>`
            : `<button class="btn btn-small btn-ghost" type="button" aria-label="Подробнее: ${escapeHtml(mode.title || 'режим')}">Подробнее</button>`}
        </div>
      </div>
    </article>`;
}

export function accentColor(mode) {
  const raw = String((mode && mode.accent) || '').trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : DEFAULT_ACCENT;
}

export function fallbackArt(mode) {
  const key = [mode.id, mode.title, mode.accent].join('|');
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);

  const accent = accentColor(mode);
  const words = String(mode.title || 'TM')
    .split(/\s+/)
    .map((word) => (word.match(/[A-Za-zА-Яа-я0-9]/) || [''])[0])
    .filter(Boolean);
  const initials = (words.slice(0, 2).join('') || 'T').toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#14141b"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0.5"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.76" cy="0.34" r="0.7">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="450" fill="url(#bg)"/>
    <rect width="800" height="450" fill="url(#glow)"/>
    <g stroke="#ffffff" stroke-opacity="0.07" stroke-width="1">
      <path d="M0 300 H800 M0 350 H800 M0 400 H800"/>
      <path d="M520 0 V450 M600 0 V450 M680 0 V450"/>
    </g>
    <text x="744" y="330" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="200" font-weight="800" fill="#ffffff" fill-opacity="0.9">${initials}</text>
    <text x="744" y="386" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="7" fill="#ffffff" fill-opacity="0.55">TM MODE</text>
  </svg>`;

  const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  ART_CACHE.set(key, url);
  return url;
}

export function imageSrc(mode) {
  return mode.imageUrl || mode.image || fallbackArt(mode);
}

export function wireImage(img, mode) {
  if (!img) return;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackArt(mode || { id: 'fallback', title: 'TM' });
  };
}

