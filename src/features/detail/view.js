'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { formatDateTime, formatDuration, formatHistoryStamp } from '../../core/format.js';
import { changelogModel } from '../../core/changelog.js';
import { latestUpdateEntry } from '../../core/modes.js';
import { toast } from '../../ui/toast.js';
import { growAllTextareas } from '../../ui/textarea.js';

export const UPDATE_TAGS = {
  release: { label: 'Релиз', cls: 'release' },
  hotfix: { label: 'Hot-fix', cls: 'hotfix' },
  content: { label: 'Контент', cls: 'content' },
  balance: { label: 'Баланс', cls: 'balance' },
  fix: { label: 'Исправление', cls: 'fix' },
  tech: { label: 'Техническое', cls: 'tech' }
};

export function tagPill(tag) {
  const meta = UPDATE_TAGS[tag] || { label: tag, cls: 'tech' };
  return `<span class="tag-pill ${escapeHtml(meta.cls)}">${escapeHtml(meta.label)}</span>`;
}

export function renderSpotlight(mode) {
  const latest = latestUpdateEntry(mode);
  if (!latest) {
    els.detailSpotlight.hidden = true;
    return;
  }

  els.detailSpotlight.hidden = false;
  const version = latest.version ? `v${latest.version}` : '';
  const title = latest.title || '';
  els.spotlightTitle.textContent = [version, title].filter(Boolean).join(' — ') || 'Обновление режима';
  els.spotlightTag.innerHTML = latest.tags && latest.tags.length ? tagPill(latest.tags[0]) : '';
  els.spotlightDate.textContent = formatHistoryStamp(latest);
}

export function renderChangelog(mode) {
  const entries = changelogModel(mode);

  if (entries.length === 0) {
    els.detailChangelog.innerHTML = '<div class="changelog-empty">Пока нет записей об обновлениях.</div>';
    els.changelogToggle.hidden = true;
    return;
  }

  els.detailChangelog.innerHTML = entries.map((entry, index) => {
    const version = entry.version ? `v${entry.version}` : entry.title;
    const name = entry.version ? entry.title : '';
    return `
      <details class="changelog-item"${index === 0 ? ' open' : ''}>
        <summary>
          <span class="changelog-version">${escapeHtml(version)}</span>
          ${name ? `<span class="changelog-title">${escapeHtml(name)}</span>` : ''}
          ${entry.tags.length ? tagPill(entry.tags[0]) : ''}
          ${formatHistoryStamp(entry) ? `<span class="changelog-date">${escapeHtml(formatHistoryStamp(entry))}</span>` : ''}
          <svg class="changelog-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9 L12 15 L18 9"/></svg>
        </summary>
        <div class="changelog-body">
          ${entry.lines.length
            ? `<ul>${entry.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
            : '<p>Изменения не указаны.</p>'}
        </div>
      </details>`;
  }).join('');

  els.detailChangelog.classList.toggle('timeline', entries.length > 0);
  els.changelogToggle.hidden = entries.length < 2;
  updateChangelogToggle();
}

export function updateChangelogToggle() {
  if (!els.changelogToggle) return;
  const items = Array.from(els.detailChangelog.querySelectorAll('details.changelog-item'));
  if (items.length === 0) {
    els.changelogToggle.hidden = true;
    return;
  }
  const allOpen = items.every((item) => item.open);
  els.changelogToggle.textContent = allOpen ? 'Свернуть всё' : 'Развернуть всё';
  els.changelogToggle.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
}

export function trailerEmbed(url) {
  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (youtube) {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}?rel=0` };
  }
  const rutube = url.match(/rutube\.ru\/video\/([a-f0-9]{32})/i);
  if (rutube) {
    return { kind: 'iframe', src: `https://rutube.ru/play/embed/${rutube[1]}` };
  }
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(url)) {
    return { kind: 'video', src: url };
  }
  return { kind: 'iframe', src: url };
}

export function renderTrailer(mode) {
  const raw = String((mode && mode.trailerUrl) || '').trim();
  els.detailTrailerSection.hidden = !raw;
  if (!raw) {
    els.detailTrailer.innerHTML = '';
    return;
  }
  const embed = trailerEmbed(raw);
  els.detailTrailer.innerHTML = embed.kind === 'video'
    ? `<video src="${escapeHtml(embed.src)}" controls preload="metadata"></video>`
    : `<iframe src="${escapeHtml(embed.src)}" title="Трейлер" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  els.detailTrailerOpen.onclick = () => {
    api.openUrl(raw).catch((err) => toast(String(err), 'error'));
  };
}

export function selectDetailTab(tab) {
  const allowed = ['about', 'updates', 'reviews', 'requirements'];
  S.detailTab = allowed.includes(tab) ? tab : 'about';
  document.querySelectorAll('#detail-tabs .detail-tab').forEach((button) => {
    const active = button.dataset.detailTab === S.detailTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.detail-content [data-detail-tab]').forEach((section) => {
    section.classList.toggle('tab-hidden', section.dataset.detailTab !== S.detailTab);
  });
  requestAnimationFrame(() => growAllTextareas($('detail-view')));
}

export function renderSessions(mode) {
  const stats = S.state[mode.id] || {};
  const all = Array.isArray(stats.sessions) ? stats.sessions.slice().reverse() : [];
  els.detailSessionsSection.hidden = all.length === 0;
  if (!all.length) {
    els.detailSessions.innerHTML = '';
    if (els.detailSessionsMore) els.detailSessionsMore.hidden = true;
    return;
  }
  const limit = 5;
  const shown = S.sessionsExpanded ? all : all.slice(0, limit);
  els.detailSessions.innerHTML = shown.map((session) => `
    <div class="session-row">
      <span>${escapeHtml(formatDateTime(session.startedAt))}</span>
      <b>${escapeHtml(formatDuration(session.seconds))}</b>
    </div>`).join('');
  if (els.detailSessionsMore) {
    els.detailSessionsMore.hidden = all.length <= limit;
    els.detailSessionsMore.textContent = S.sessionsExpanded ? 'Скрыть' : 'Показать все';
  }
}

