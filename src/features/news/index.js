'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { els } from '../../core/elements.js';
import { escapeHtml } from '../../core/dom.js';
import { publisherDate } from '../../core/format.js';
import { tKey } from '../../i18n/index.js';

export function newsCardHtml(item) {
  return `
    <article class="news-card">
      <div class="news-head">
        <div class="news-title">${escapeHtml(item.title || tKey("common.news"))}</div>
        <span class="news-date">${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="news-body">${escapeHtml(item.body || '')}</div>
      <div class="news-author">${escapeHtml(item.authorName || item.authorUsername || 'Lavunio')}</div>
    </article>`;
}

export async function loadModeNews(mode) {
  if (!mode || !api.newsMode) return;
  const key = mode.id;
  if (S.modeNews[key] || S.modeNewsLoading[key]) {
    renderModeNews(mode);
    return;
  }
  S.modeNewsLoading[key] = true;
  try {
    const items = await api.newsMode(key);
    S.modeNews[key] = Array.isArray(items) ? items : [];
  } catch (_) {
    S.modeNews[key] = [];
  } finally {
    delete S.modeNewsLoading[key];
    if (S.selectedId === key) renderModeNews(mode);
  }
}

export function renderModeNews(mode) {
  if (!els.detailNewsSection || !els.detailNewsList) return;
  const items = (S.modeNews[mode.id] || []).slice(0, 6);
  els.detailNewsSection.hidden = items.length === 0;
  els.detailNewsList.innerHTML = items.map(newsCardHtml).join('');
}
