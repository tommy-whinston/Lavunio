'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { moderatorAllowed } from '../../core/permissions.js';
import { toast } from '../../ui/toast.js';
import { publisherDate, PUBLISHER_STATUS } from '../publisher/index.js';

let moderationActions = {
  openModal: () => {},
  askConfirm: async () => false,
  updateModerationNav: () => {},
  loadStoreNews: async () => {}
};

export function configureModeration(actions) {
  moderationActions = { ...moderationActions, ...actions };
}

export function bindModeration() {
  const refresh = $('moderation-refresh');
  if (refresh) refresh.onclick = () => loadModeration(true);

  document.querySelectorAll('[data-mod-tab]').forEach((tab) => {
    tab.onclick = () => setModerationTab(tab.getAttribute('data-mod-tab'));
  });

  const form = $('moderation-note-form');
  if (form) form.onsubmit = (event) => {
    event.preventDefault();
    submitModerationNote();
  };

  const content = $('moderation-content');
  if (content) content.onclick = (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    const title = button.dataset.title || '';
    if (action === 'approve') approveModerationRelease(id, title);
    else if (action === 'reject') openModerationNote('reject', id, title);
    else if (action === 'hide') openModerationNote('hide', id, title);
    else if (action === 'unhide') unhideModerationMode(id, title);
    else if (action === 'close-report') closeModerationReport(id);
    else if (action === 'appeal-accept') resolveModerationAppeal(id, 'accept', '');
    else if (action === 'appeal-reject') openModerationNote('appeal-reject', id, title);
    else if (action === 'author-approve') approveAuthorApplication(id, title);
    else if (action === 'author-reject') openModerationNote('author-reject', id, title);
    else if (action === 'review-approve') approveModerationReview(id);
    else if (action === 'review-reject') rejectModerationReview(id);
  };

  moderationActions.updateModerationNav();
}

export function setModerationTab(tab) {
  S.moderationTab = ['queue', 'modes', 'reviews', 'reports', 'appeals', 'applications', 'news', 'history'].includes(tab) ? tab : 'queue';
  if (S.moderationTab === 'news') moderationActions.loadStoreNews(true);
  renderModeration();
}

export async function loadModeration(force = false) {
  if (!moderatorAllowed()) {
    moderationActions.updateModerationNav();
    return;
  }
  if (S.moderationLoading) return;
  if (S.moderationLoaded && !force) {
    renderModeration();
    return;
  }

  S.moderationLoading = true;
  renderModeration();
  try {
    const [queue, modes, reports, reviews, history, appeals, applications] = await Promise.all([
      api.adminQueue(),
      api.adminModes(),
      api.adminReports(),
      api.adminReviews(),
      api.adminHistory(),
      api.adminAppeals(),
      api.adminAuthorApplications()
    ]);
    S.moderationQueue = Array.isArray(queue) ? queue : [];
    S.moderationModes = Array.isArray(modes) ? modes : [];
    S.moderationReports = Array.isArray(reports) ? reports : [];
    S.moderationReviews = Array.isArray(reviews) ? reviews : [];
    S.moderationHistory = Array.isArray(history) ? history : [];
    S.moderationAppeals = Array.isArray(appeals) ? appeals : [];
    S.moderationAuthorApplications = Array.isArray(applications) ? applications : [];
    S.moderationLoaded = true;
  } catch (err) {
    toast('Не удалось загрузить модерацию: ' + err, 'error');
  } finally {
    S.moderationLoading = false;
    renderModeration();
  }
}

export function renderModeration() {
  if (!els.moderationView || !moderatorAllowed()) return;

  const pending = S.moderationQueue.length;
  const hidden = S.moderationModes.filter((mode) => mode.status === 'hidden').length;
  const statPending = $('moderation-stat-pending');
  const statHidden = $('moderation-stat-hidden');
  if (statPending) statPending.textContent = String(pending);
  if (statHidden) statHidden.textContent = String(hidden);

  document.querySelectorAll('[data-mod-tab]').forEach((tab) => {
    tab.classList.toggle('active', tab.getAttribute('data-mod-tab') === S.moderationTab);
  });

  const content = $('moderation-content');
  if (!content) return;
  if (S.moderationLoading && !S.moderationLoaded) {
    content.innerHTML = '<div class="mod-empty">Загрузка модерации…</div>';
    return;
  }

  if (S.moderationTab === 'modes') {
    content.innerHTML = moderationModesHtml();
  } else if (S.moderationTab === 'reviews') {
    content.innerHTML = moderationReviewsHtml();
  } else if (S.moderationTab === 'reports') {
    content.innerHTML = moderationReportsHtml();
  } else if (S.moderationTab === 'appeals') {
    content.innerHTML = moderationAppealsHtml();
  } else if (S.moderationTab === 'applications') {
    content.innerHTML = moderationAuthorApplicationsHtml();
  } else if (S.moderationTab === 'news') {
    content.innerHTML = moderationNewsHtml();
    const form = content.querySelector('#mod-news-form');
    if (form) {
      form.onsubmit = (event) => {
        event.preventDefault();
        submitStoreNews();
      };
    }
  } else if (S.moderationTab === 'history') {
    content.innerHTML = moderationHistoryHtml();
  } else {
    content.innerHTML = moderationQueueHtml();
  }
}

export function moderationScanHtml(scan) {
  if (!scan || !scan.checkedAt) return '';
  const suspicious = Array.isArray(scan.suspicious) ? scan.suspicious : [];
  if (suspicious.length) {
    const shown = suspicious.slice(0, 5).map((name) => escapeHtml(name)).join(', ');
    const rest = suspicious.length > 5 ? ` и ещё ${suspicious.length - 5}` : '';
    return `<div class="mod-scan warn">Подозрительные файлы: ${shown}${rest}</div>`;
  }
  return `<div class="mod-scan ok">Архив проверен: ${Number(scan.files) || 0} файлов, ${formatBytes(Number(scan.bytes) || 0)}</div>`;
}

export function moderationQueueHtml() {
  const items = S.moderationQueue || [];
  if (!items.length) {
    return '<div class="mod-empty">Очередь пуста. Новые релизы появятся здесь после отправки автором.</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.modeTitle)}</div>
          <div class="pub-sub">${escapeHtml(item.modeSlug)} · релиз ${escapeHtml(item.version)}</div>
        </div>
        <span class="pub-status pending">На модерации</span>
      </div>
      <div class="pub-meta">
        <span>Автор: ${escapeHtml(item.authorName)} (@${escapeHtml(item.authorUsername)})</span>
        <span>Отправлен ${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.changelog || 'Без changelog')}</div>
      ${moderationScanHtml(item.scan)}
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="approve" data-id="${escapeHtml(item.releaseId)}" data-title="${escapeHtml(item.modeTitle)}">Одобрить</button>
        <button class="btn btn-ghost" type="button" data-action="reject" data-id="${escapeHtml(item.releaseId)}" data-title="${escapeHtml(item.modeTitle)}">Отклонить</button>
      </div>
    </article>
  `).join('');
}

export function moderationModesHtml() {
  const modes = S.moderationModes || [];
  if (!modes.length) {
    return '<div class="mod-empty">Режимов пока нет.</div>';
  }
  return modes.map((mode) => {
    const status = PUBLISHER_STATUS[mode.status] || mode.status;
    const action = mode.status === 'hidden'
      ? `<button class="btn btn-primary" type="button" data-action="unhide" data-id="${escapeHtml(mode.id)}" data-title="${escapeHtml(mode.title)}">Показать</button>`
      : `<button class="btn btn-ghost" type="button" data-action="hide" data-id="${escapeHtml(mode.id)}" data-title="${escapeHtml(mode.title)}">Скрыть</button>`;
    return `
      <article class="pub-card">
        <div class="pub-card-head">
          <div>
            <div class="pub-title">${escapeHtml(mode.title)}</div>
            <div class="pub-sub">${escapeHtml(mode.slug)}</div>
          </div>
          <span class="pub-status ${escapeHtml(mode.status)}">${escapeHtml(status)}</span>
        </div>
        <div class="pub-meta">
          <span>Автор: ${escapeHtml(mode.authorName)} (@${escapeHtml(mode.authorUsername)})</span>
          <span>Обновлён ${escapeHtml(publisherDate(mode.updatedAt))}</span>
        </div>
        <div class="pub-release-actions">${action}</div>
      </article>
    `;
  }).join('');
}

export function moderationReviewsHtml() {
  const items = S.moderationReviews || [];
  if (!items.length) {
    return '<div class="mod-empty">Отзывов на модерации нет.</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.modeTitle || 'Режим')}</div>
          <div class="pub-sub">${escapeHtml(item.modeSlug || '')} · ${Number(item.rating) || 0} ★</div>
        </div>
        <span class="pub-status pending">На проверке</span>
      </div>
      <div class="pub-meta">
        <span>От: ${escapeHtml(item.authorName || item.authorUsername || 'Игрок')}</span>
        <span>${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.text || 'Без текста')}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="review-approve" data-id="${escapeHtml(item.id)}">Одобрить</button>
        <button class="btn btn-ghost" type="button" data-action="review-reject" data-id="${escapeHtml(item.id)}">Отклонить</button>
      </div>
    </article>
  `).join('');
}

export async function approveModerationReview(reviewId) {
  const item = (S.moderationReviews || []).find((review) => review.id === reviewId);
  try {
    await api.adminApproveReview(reviewId);
    if (item && item.modeSlug) delete S.reviews[item.modeSlug];
    toast('Отзыв опубликован', 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast('Не удалось одобрить отзыв: ' + err, 'error');
  }
}

export async function rejectModerationReview(reviewId) {
  const item = (S.moderationReviews || []).find((review) => review.id === reviewId);
  const ok = await moderationActions.askConfirm(
    'Отклонить отзыв?',
    'Отзыв не будет опубликован. Действие попадёт в журнал.',
    'Отклонить'
  );
  if (!ok) return;
  try {
    await api.adminRejectReview(reviewId);
    if (item && item.modeSlug) delete S.reviews[item.modeSlug];
    toast('Отзыв отклонён', 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast('Не удалось отклонить отзыв: ' + err, 'error');
  }
}

export function moderationAuthorApplicationsHtml() {
  const items = S.moderationAuthorApplications || [];
  if (!items.length) {
    return '<div class="mod-empty">Заявок на автора нет.</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.displayName || item.username)}</div>
          <div class="pub-sub">@${escapeHtml(item.username)}</div>
        </div>
        <span class="pub-status pending">Заявка</span>
      </div>
      <div class="pub-meta">
        <span>Отправлена ${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.message)}</div>
      ${item.links ? `<div class="hint">${escapeHtml(item.links)}</div>` : ''}
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="author-approve" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.displayName || item.username)}">Выдать автора</button>
        <button class="btn btn-ghost" type="button" data-action="author-reject" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.displayName || item.username)}">Отклонить</button>
      </div>
    </article>
  `).join('');
}

export async function approveAuthorApplication(id, title) {
  const confirmed = await moderationActions.askConfirm(
    'Выдать доступ автора?',
    `Пользователь «${title}» сможет создавать режимы и публиковать релизы.`,
    'Выдать'
  );
  if (!confirmed) return;
  try {
    await api.adminApproveAuthorApplication(id);
    toast('Доступ автора выдан', 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast('Не удалось выдать доступ: ' + err, 'error');
  }
}

export function moderationAppealsHtml() {
  const items = S.moderationAppeals || [];
  if (!items.length) {
    return '<div class="mod-empty">Апелляций нет.</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.modeTitle)}</div>
          <div class="pub-sub">${escapeHtml(item.modeSlug)} · релиз ${escapeHtml(item.version)}</div>
        </div>
        <span class="pub-status pending">Апелляция</span>
      </div>
      <div class="pub-meta">
        <span>Автор: ${escapeHtml(item.authorName)} (@${escapeHtml(item.authorUsername)})</span>
        <span>Отправлена ${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-reject-note">Причина отклонения: ${escapeHtml(item.rejectionNote || '—')}</div>
      <div class="mod-changelog">${escapeHtml(item.message)}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="appeal-accept" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.modeTitle)}">Принять и опубликовать</button>
        <button class="btn btn-ghost" type="button" data-action="appeal-reject" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.modeTitle)}">Отклонить</button>
      </div>
    </article>
  `).join('');
}

export async function resolveModerationAppeal(id, action, note) {
  if (action === 'accept') {
    const confirmed = await moderationActions.askConfirm(
      'Принять апелляцию?',
      'Релиз будет опубликован и появится в каталоге.',
      'Опубликовать'
    );
    if (!confirmed) return;
  }
  try {
    await api.adminResolveAppeal(id, action, note);
    toast(action === 'accept' ? 'Релиз опубликован' : 'Апелляция отклонена', 'ok');
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast('Не удалось рассмотреть апелляцию: ' + err, 'error');
  }
}

export function moderationReportsHtml() {  const items = S.moderationReports || [];
  if (!items.length) {
    return '<div class="mod-empty">Открытых жалоб нет.</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.targetTitle || 'Режим')}</div>
          <div class="pub-sub">${escapeHtml(item.targetSlug || item.targetId || '')}</div>
        </div>
        <span class="pub-status rejected">Жалоба</span>
      </div>
      <div class="pub-meta">
        <span>От: ${escapeHtml(item.reporterName || item.reporterUsername || 'Игрок')}</span>
        <span>${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.reason)}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="close-report" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.targetTitle || 'жалобу')}">Закрыть жалобу</button>
      </div>
    </article>
  `).join('');
}

export async function closeModerationReport(reportId) {
  const ok = await moderationActions.askConfirm(
    'Закрыть жалобу?',
    'Жалоба будет убрана из очереди, действие попадёт в журнал.',
    'Закрыть'
  );
  if (!ok) return;
  try {
    await api.adminCloseReport(reportId, '');
    toast('Жалоба закрыта', 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast('Не удалось закрыть жалобу: ' + err, 'error');
  }
}

export function moderationNewsHtml() {
  const items = S.storeNews || [];
  return `
    <form id="mod-news-form" class="mod-news-form" autocomplete="off">
      <div class="field">
        <label for="mod-news-title">Заголовок</label>
        <input id="mod-news-title" type="text" maxlength="120" placeholder="Что нового в Lavunio">
      </div>
      <div class="field">
        <label for="mod-news-body">Текст</label>
        <textarea id="mod-news-body" rows="4" placeholder="Коротко о новости"></textarea>
      </div>
      <div class="form-error" id="mod-news-error" hidden></div>
      <button class="btn btn-primary" id="mod-news-submit" type="submit">Опубликовать</button>
    </form>
    <div class="mod-news-list">
      ${items.length ? items.map(newsCardHtml).join('') : '<div class="mod-empty">Новостей магазина пока нет.</div>'}
    </div>
  `;
}

export async function submitStoreNews() {
  const title = $('mod-news-title').value.trim();
  const body = $('mod-news-body').value.trim();
  const error = $('mod-news-error');
  const button = $('mod-news-submit');
  if (title.length < 3) {
    error.textContent = 'Укажи заголовок новости';
    error.hidden = false;
    return;
  }
  if (body.length < 3) {
    error.textContent = 'Напиши текст новости';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  button.disabled = true;
  button.textContent = 'Публикуем…';
  try {
    await api.newsCreateStore(title, body);
    $('mod-news-title').value = '';
    $('mod-news-body').value = '';
    toast('Новость магазина опубликована', 'ok');
    await moderationActions.loadStoreNews(true);
    renderModeration();
  } catch (err) {
    error.textContent = String(err || 'Не удалось опубликовать новость');
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Опубликовать';
  }
}

export function moderationHistoryHtml() {
  const items = S.moderationHistory || [];  if (!items.length) {
    return '<div class="mod-empty">Журнал пока пуст.</div>';
  }
  return items.map((item) => {
    const action = MODERATION_ACTIONS[item.action] || item.action;
    const target = item.targetType === 'mode'
      ? `режим ${String(item.targetId).slice(0, 8)}`
      : `релиз ${String(item.targetId).slice(0, 8)}`;
    return `
      <div class="mod-history-row">
        <span class="mod-history-action">${escapeHtml(action)}</span>
        <span class="mod-history-moderator">${escapeHtml(item.moderatorName)}</span>
        <span class="mod-history-note">${escapeHtml(item.note || target)}</span>
        <span class="mod-history-date">${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
    `;
  }).join('');
}

export function openModerationNote(kind, id, title) {
  S.moderationNoteAction = { kind, id };
  const reject = kind === 'reject';
  const appeal = kind === 'appeal-reject';
  const author = kind === 'author-reject';
  $('moderation-note-title').textContent = author
    ? 'Отклонить заявку'
    : appeal
      ? 'Отклонить апелляцию'
      : reject
        ? 'Отклонить релиз'
        : 'Скрыть режим';
  $('moderation-note-hint').textContent = author
    ? `Заявка пользователя «${title}» будет отклонена. Причина будет видна в лаунчере.`
    : appeal
      ? `Апелляция по режиму «${title}» будет отклонена. Автор увидит причину.`
      : reject
        ? `Релиз «${title}» будет отклонён. Автор увидит причину.`
        : `Режим «${title}» исчезнет из каталога.`;
  $('moderation-note-text').value = '';
  $('moderation-note-error').hidden = true;
  $('moderation-note-submit').textContent = author || appeal || reject ? 'Отклонить' : 'Скрыть';
  moderationActions.openModal('modal-moderation-note');
  setTimeout(() => $('moderation-note-text').focus(), 50);
}

export async function submitModerationNote() {
  const action = S.moderationNoteAction;
  if (!action) return;
  const note = $('moderation-note-text').value.trim();
  const error = $('moderation-note-error');
  if (!note) {
    error.textContent = 'Укажи причину';
    error.hidden = false;
    return;
  }

  const button = $('moderation-note-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    if (action.kind === 'reject') {
      await api.adminReject(action.id, note);
      toast('Релиз отклонён', 'ok');
    } else if (action.kind === 'appeal-reject') {
      await api.adminResolveAppeal(action.id, 'reject', note);
      toast('Апелляция отклонена', 'ok');
    } else if (action.kind === 'author-reject') {
      await api.adminRejectAuthorApplication(action.id, note);
      toast('Заявка отклонена', 'ok');
    } else {
      await api.adminHideMode(action.id, note);
      toast('Режим скрыт', 'ok');
    }
    $('modal-moderation-note').hidden = true;
    S.moderationNoteAction = null;
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    error.textContent = String(err || 'Не удалось выполнить действие');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function approveModerationRelease(id, title) {
  const ok = await moderationActions.askConfirm(
    'Одобрить релиз?',
    `«${title || 'Релиз'}» появится в каталоге после одобрения.`,
    'Одобрить'
  );
  if (!ok) return;
  try {
    await api.adminApprove(id);
    toast('Релиз опубликован', 'ok');
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast('Не удалось одобрить релиз: ' + err, 'error');
  }
}

export async function unhideModerationMode(id, title) {
  const ok = await moderationActions.askConfirm(
    'Показать режим?',
    `«${title || 'Режим'}» снова появится в каталоге.`,
    'Показать'
  );
  if (!ok) return;
  try {
    await api.adminUnhideMode(id);
    toast('Режим снова в каталоге', 'ok');
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast('Не удалось показать режим: ' + err, 'error');
  }
}

