'use strict';

import { tKey } from '../../i18n/index.js';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { moderatorAllowed } from '../../core/permissions.js';
import { formatBytes } from '../../core/format.js';
import { toast } from '../../ui/toast.js';
import { publisherDate } from '../../core/format.js';
import { publisherStatusLabel } from '../publisher/index.js';
import { newsCardHtml } from '../news/index.js';

let moderationActions = {
  openModal: () => {},
  askConfirm: async () => false,
  updateModerationNav: () => {},
  loadStoreNews: async () => {}
};

export function configureModeration(actions) {
  moderationActions = { ...moderationActions, ...actions };
}

const MODERATION_ACTION_KEYS = {
  approve: 'moderation.action.approve.release',
  reject: 'moderation.action.reject.release',
  hide: 'moderation.action.hide.mode',
  unhide: 'moderation.action.unhide.mode',
  report_close: 'moderation.action.close.report',
  review_approve: 'moderation.action.review.approve',
  review_reject: 'moderation.action.review.reject'
};

function moderationActionLabel(action) {
  const key = MODERATION_ACTION_KEYS[action];
  return key ? tKey(key) : action;
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
    toast(tKey("moderation.failed.load", [err]), 'error');
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
    content.innerHTML = '<div class="mod-empty">' + tKey("loading.moderation") + '</div>';
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
    const rest = suspicious.length > 5 ? tKey("moderation.and.more", [suspicious.length - 5]) : '';
    return `<div class="mod-scan warn">${tKey("moderation.suspicious.files", [shown + rest])}</div>`;
  }
  return `<div class="mod-scan ok">${tKey("moderation.archive.checked", [Number(scan.files) || 0, formatBytes(Number(scan.bytes) || 0)])}</div>`;
}

export function moderationQueueHtml() {
  const items = S.moderationQueue || [];
  if (!items.length) {
    return '<div class="mod-empty">' + tKey("the.queue.is.empty") + '</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.modeTitle)}</div>
          <div class="pub-sub">${escapeHtml(item.modeSlug)} · ${tKey("common.release.lowercase")} ${escapeHtml(item.version)}</div>
        </div>
        <span class="pub-status pending">${tKey("pending.review")}</span>
      </div>
      <div class="pub-meta">
        <span>${tKey("moderation.author", [escapeHtml(item.authorName) + ' (@' + escapeHtml(item.authorUsername) + ')'])}</span>
        <span>${tKey("submitted")} ${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.changelog || tKey("no.changelog"))}</div>
      ${moderationScanHtml(item.scan)}
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="approve" data-id="${escapeHtml(item.releaseId)}" data-title="${escapeHtml(item.modeTitle)}">${tKey("approve")}</button>
        <button class="btn btn-ghost" type="button" data-action="reject" data-id="${escapeHtml(item.releaseId)}" data-title="${escapeHtml(item.modeTitle)}">${tKey("decline")}</button>
      </div>
    </article>
  `).join('');
}

export function moderationModesHtml() {
  const modes = S.moderationModes || [];
  if (!modes.length) {
    return '<div class="mod-empty">' + tKey("moderation.no.modes") + '</div>';
  }
  return modes.map((mode) => {
    const status = publisherStatusLabel(mode.status);
    const action = mode.status === 'hidden'
      ? `<button class="btn btn-primary" type="button" data-action="unhide" data-id="${escapeHtml(mode.id)}" data-title="${escapeHtml(mode.title)}">${tKey("show")}</button>`
      : `<button class="btn btn-ghost" type="button" data-action="hide" data-id="${escapeHtml(mode.id)}" data-title="${escapeHtml(mode.title)}">${tKey("hide")}</button>`;
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
          <span>${tKey("moderation.author", [escapeHtml(mode.authorName) + ' (@' + escapeHtml(mode.authorUsername) + ')'])}</span>
          <span>${tKey("pattern.updated.x", [escapeHtml(publisherDate(mode.updatedAt))])}</span>
        </div>
        <div class="pub-release-actions">${action}</div>
      </article>
    `;
  }).join('');
}

export function moderationReviewsHtml() {
  const items = S.moderationReviews || [];
  if (!items.length) {
    return '<div class="mod-empty">' + tKey("no.reviews.pending.moderation") + '</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.modeTitle || tKey("mode"))}</div>
          <div class="pub-sub">${escapeHtml(item.modeSlug || '')} · ${Number(item.rating) || 0} ★</div>
        </div>
        <span class="pub-status pending">${tKey("under.review")}</span>
      </div>
      <div class="pub-meta">
        <span>${tKey("moderation.from", [escapeHtml(item.authorName || item.authorUsername || tKey("player.2"))])}</span>
        <span>${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.text || tKey("no.text"))}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="review-approve" data-id="${escapeHtml(item.id)}">${tKey("approve")}</button>
        <button class="btn btn-ghost" type="button" data-action="review-reject" data-id="${escapeHtml(item.id)}">${tKey("decline")}</button>
      </div>
    </article>
  `).join('');
}

export async function approveModerationReview(reviewId) {
  const item = (S.moderationReviews || []).find((review) => review.id === reviewId);
  try {
    await api.adminApproveReview(reviewId);
    if (item && item.modeSlug) delete S.reviews[item.modeSlug];
    toast(tKey("review.published"), 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast(tKey("failed.to.approve.review") + " " + err, 'error');
  }
}

export async function rejectModerationReview(reviewId) {
  const item = (S.moderationReviews || []).find((review) => review.id === reviewId);
  const ok = await moderationActions.askConfirm(
    tKey("reject.review"),
    tKey("the.review.will.not"),
    tKey("decline")
  );
  if (!ok) return;
  try {
    await api.adminRejectReview(reviewId);
    if (item && item.modeSlug) delete S.reviews[item.modeSlug];
    toast(tKey("review.rejected"), 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast(tKey("failed.to.reject.review") + " " + err, 'error');
  }
}

export function moderationAuthorApplicationsHtml() {
  const items = S.moderationAuthorApplications || [];
  if (!items.length) {
    return '<div class="mod-empty">' + tKey("no.author.applications") + '</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.displayName || item.username)}</div>
          <div class="pub-sub">@${escapeHtml(item.username)}</div>
        </div>
        <span class="pub-status pending">${tKey("moderation.application")}</span>
      </div>
      <div class="pub-meta">
        <span>${tKey("submitted.2")} ${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.message)}</div>
      ${item.links ? `<div class="hint">${escapeHtml(item.links)}</div>` : ''}
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="author-approve" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.displayName || item.username)}">${tKey("moderation.grant.author")}</button>
        <button class="btn btn-ghost" type="button" data-action="author-reject" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.displayName || item.username)}">${tKey("decline")}</button>
      </div>
    </article>
  `).join('');
}

export async function approveAuthorApplication(id, title) {
  const confirmed = await moderationActions.askConfirm(
    tKey("grant.author.access"),
    tKey("moderation.author.application.reject", [title]),
    tKey("grant")
  );
  if (!confirmed) return;
  try {
    await api.adminApproveAuthorApplication(id);
    toast(tKey("author.access.granted"), 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast(tKey("moderation.failed.grant", [err]), 'error');
  }
}

export function moderationAppealsHtml() {
  const items = S.moderationAppeals || [];
  if (!items.length) {
    return '<div class="mod-empty">' + tKey("no.appeals") + '</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.modeTitle)}</div>
          <div class="pub-sub">${escapeHtml(item.modeSlug)} · ${tKey("common.release.lowercase")} ${escapeHtml(item.version)}</div>
        </div>
        <span class="pub-status pending">${tKey("moderation.appeal")}</span>
      </div>
      <div class="pub-meta">
        <span>${tKey("moderation.author", [escapeHtml(item.authorName) + ' (@' + escapeHtml(item.authorUsername) + ')'])}</span>
        <span>${tKey("submitted.2")} ${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-reject-note">${tKey("rejection.reason")} ${escapeHtml(item.rejectionNote || '—')}</div>
      <div class="mod-changelog">${escapeHtml(item.message)}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="appeal-accept" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.modeTitle)}">${tKey("accept.and.publish")}</button>
        <button class="btn btn-ghost" type="button" data-action="appeal-reject" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.modeTitle)}">${tKey("decline")}</button>
      </div>
    </article>
  `).join('');
}

export async function resolveModerationAppeal(id, action, note) {
  if (action === 'accept') {
    const confirmed = await moderationActions.askConfirm(
      tKey("accept.appeal"),
      tKey("the.release.will.be"),
      tKey("publish")
    );
    if (!confirmed) return;
  }
  try {
    await api.adminResolveAppeal(id, action, note);
    toast(action === 'accept' ? tKey("release.published") : tKey("appeal.rejected"), 'ok');
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast(tKey("failed.to.resolve.appeal") + " " + err, 'error');
  }
}

export function moderationReportsHtml() {  const items = S.moderationReports || [];
  if (!items.length) {
    return '<div class="mod-empty">' + tKey("no.open.reports") + '</div>';
  }
  return items.map((item) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(item.targetTitle || tKey("mode"))}</div>
          <div class="pub-sub">${escapeHtml(item.targetSlug || item.targetId || '')}</div>
        </div>
        <span class="pub-status rejected">${tKey("moderation.report")}</span>
      </div>
      <div class="pub-meta">
        <span>${tKey("moderation.from", [escapeHtml(item.reporterName || item.reporterUsername || tKey("player.2"))])}</span>
        <span>${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(item.reason)}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-action="close-report" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.targetTitle || tKey("moderation.report"))}">${tKey("moderation.close.report")}</button>
      </div>
    </article>
  `).join('');
}

export async function closeModerationReport(reportId) {
  const ok = await moderationActions.askConfirm(
    tKey("close.report"),
    tKey("the.report.will.be"),
    tKey("topbar.close")
  );
  if (!ok) return;
  try {
    await api.adminCloseReport(reportId, '');
    toast(tKey("report.closed"), 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast(tKey("failed.to.close.report") + " " + err, 'error');
  }
}

export function moderationNewsHtml() {
  const items = S.storeNews || [];
  return `
    <form id="mod-news-form" class="mod-news-form" autocomplete="off">
      <div class="field">
        <label for="mod-news-title">${tKey("title")}</label>
        <input id="mod-news-title" type="text" maxlength="120" placeholder="${tKey("moderation.news.title.placeholder")}">
      </div>
      <div class="field">
        <label for="mod-news-body">${tKey("text")}</label>
        <textarea id="mod-news-body" rows="4" placeholder="${tKey("moderation.news.body.placeholder")}"></textarea>
      </div>
      <div class="form-error" id="mod-news-error" hidden></div>
      <button class="btn btn-primary" id="mod-news-submit" type="submit">${tKey("publish")}</button>
    </form>
    <div class="mod-news-list">
      ${items.length ? items.map(newsCardHtml).join('') : '<div class="mod-empty">' + tKey("no.store.news.yet") + '</div>'}
    </div>
  `;
}

export async function submitStoreNews() {
  const title = $('mod-news-title').value.trim();
  const body = $('mod-news-body').value.trim();
  const error = $('mod-news-error');
  const button = $('mod-news-submit');
  if (title.length < 3) {
    error.textContent = tKey("enter.the.news.title");
    error.hidden = false;
    return;
  }
  if (body.length < 3) {
    error.textContent = tKey("write.the.news.text");
    error.hidden = false;
    return;
  }
  error.hidden = true;
  button.disabled = true;
  button.textContent = tKey("publishing");
  try {
    await api.newsCreateStore(title, body);
    $('mod-news-title').value = '';
    $('mod-news-body').value = '';
    toast(tKey("store.news.published"), 'ok');
    await moderationActions.loadStoreNews(true);
    renderModeration();
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.publish.news"));
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = tKey("publish");
  }
}

export function moderationHistoryHtml() {
  const items = S.moderationHistory || [];  if (!items.length) {
    return '<div class="mod-empty">' + tKey("the.log.is.empty") + '</div>';
  }
  return items.map((item) => {
    const action = moderationActionLabel(item.action);
    const target = item.targetType === 'mode'
      ? `${tKey("common.mode.lowercase")} ${String(item.targetId).slice(0, 8)}`
      : `${tKey("common.release.lowercase")} ${String(item.targetId).slice(0, 8)}`;
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
    ? tKey("reject.application")
    : appeal
      ? tKey("reject.appeal")
      : reject
        ? tKey("reject.release")
        : tKey("hide.mode");
  $('moderation-note-hint').textContent = author
    ? tKey("moderation.author.application.reject", [title])
    : appeal
      ? tKey("moderation.appeal.reject", [title])
      : reject
        ? tKey("moderation.release.reject", [title])
        : tKey("moderation.mode.hide", [title]);
  $('moderation-note-text').value = '';
  $('moderation-note-error').hidden = true;
  $('moderation-note-submit').textContent = author || appeal || reject ? tKey("decline") : tKey("hide");
  moderationActions.openModal('modal-moderation-note');
  setTimeout(() => $('moderation-note-text').focus(), 50);
}

export async function submitModerationNote() {
  const action = S.moderationNoteAction;
  if (!action) return;
  const note = $('moderation-note-text').value.trim();
  const error = $('moderation-note-error');
  if (!note) {
    error.textContent = tKey("enter.a.reason");
    error.hidden = false;
    return;
  }

  const button = $('moderation-note-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    if (action.kind === 'reject') {
      await api.adminReject(action.id, note);
      toast(tKey("release.rejected"), 'ok');
    } else if (action.kind === 'appeal-reject') {
      await api.adminResolveAppeal(action.id, 'reject', note);
      toast(tKey("appeal.rejected"), 'ok');
    } else if (action.kind === 'author-reject') {
      await api.adminRejectAuthorApplication(action.id, note);
      toast(tKey("request.declined"), 'ok');
    } else {
      await api.adminHideMode(action.id, note);
      toast(tKey("mode.hidden"), 'ok');
    }
    $('modal-moderation-note').hidden = true;
    S.moderationNoteAction = null;
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.perform.action"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function approveModerationRelease(id, title) {
  const ok = await moderationActions.askConfirm(
    tKey("approve.release"),
    tKey("moderation.release.approved", [title || tKey("release")]),
    tKey("approve")
  );
  if (!ok) return;
  try {
    await api.adminApprove(id);
    toast(tKey("release.published"), 'ok');
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast(tKey("failed.to.approve.release") + " " + err, 'error');
  }
}

export async function unhideModerationMode(id, title) {
  const ok = await moderationActions.askConfirm(
    tKey("show.mode"),
    tKey("moderation.mode.restored", [title || tKey("mode")]),
    tKey("show")
  );
  if (!ok) return;
  try {
    await api.adminUnhideMode(id);
    toast(tKey("mode.is.back.in"), 'ok');
    S.moderationLoaded = false;
    S.publisherLoaded = false;
    await loadModeration(true);
  } catch (err) {
    toast(tKey("failed.to.show.mode") + " " + err, 'error');
  }
}

