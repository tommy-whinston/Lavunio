'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { formatUpdateDate, publisherDate, renderRichText } from '../../core/format.js';
import { lavunioLoggedIn } from '../../core/lavunio.js';
import { computeAction, inLibrary, isHiddenMode, isInstalled, isUpdate, latestUpdateEntry, loaderLabel, modeAuthors, modeById, modeFullDescription, modeReleaseDate, modeStatusMeta, modeSub, sortByTitle } from '../../core/modes.js';
import { tKey } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { renderChangelog, renderSessions, renderSpotlight, renderTrailer, selectDetailTab, updateChangelogToggle } from './view.js';
import { loadModeNews, renderModeNews } from '../news/index.js';
import { renderModeGrid } from '../catalog/grid.js';
import { imageSrc, wireImage } from '../catalog/cards.js';
import { renderLibrary } from '../library/view.js';
import { activeDownloadTask, cancelDownload, downloadTaskForMode, enqueueDownload, resumeDownload } from '../downloads/queue.js';
import { openProfile } from '../profile/actions.js';
import { openTeamPage } from '../teams/index.js';
import { loadFollows } from '../store/view.js';

let detailActions = {
  showSection: () => {},
  renderStore: () => {},
  openModal: () => {},
  askConfirm: async () => false,
  handleCardAction: () => {}
};

export function configureDetailActions(actions) {
  detailActions = { ...detailActions, ...actions };
}

export function bindDetail() {
  els.detailBack.onclick = () => showStore();
  const detailTabs = $('detail-tabs');
  if (detailTabs) {
    detailTabs.onclick = (event) => {
      const button = event.target.closest('[data-detail-tab]');
      if (button) selectDetailTab(button.dataset.detailTab);
    };
  }
  els.sideFolder.onclick = () => {
    if (!S.selectedId) return;
    api.openModeFolder(S.selectedId).catch((err) => {
      toast(tKey("failed.to.open.folder") + " " + err, 'error');
    });
  };
  els.detailVerify.onclick = () => verifyMode(modeById(S.selectedId));
  els.spotlightLink.onclick = () => {
    const section = els.detailChangelogSection;
    if (!section) return;
    const first = section.querySelector('details.changelog-item');
    if (first) first.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  els.changelogToggle.onclick = () => {
    const items = Array.from(els.detailChangelog.querySelectorAll('details.changelog-item'));
    const expand = items.some((item) => !item.open);
    items.forEach((item) => { item.open = expand; });
    updateChangelogToggle();
  };
  els.detailChangelog.addEventListener('toggle', updateChangelogToggle, true);
  els.detailGallery.onclick = (event) => {
    const thumb = event.target.closest('[data-gallery-src]');
    if (!thumb) return;
    els.galleryImage.src = thumb.getAttribute('data-gallery-src');
    detailActions.openModal('modal-gallery');
  };
  els.detailAuthorModes.onclick = () => {
    const name = els.detailAuthorName.textContent.trim();
    if (!name) return;
    S.selectedId = null;
    S.detailFrom = null;
    els.search.value = name;
    S.search = name.toLowerCase();
    detailActions.showSection('store');
  };
  if (els.detailSessionsMore) {
    els.detailSessionsMore.onclick = () => {
      S.sessionsExpanded = !S.sessionsExpanded;
      const mode = modeById(S.selectedId);
      if (mode) renderSessions(mode);
    };
  }
  els.detailAuthorFollow.onclick = () => toggleFollowAuthor();
  if (els.detailAuthorProfile) els.detailAuthorProfile.onclick = () => {
    const mode = modeById(S.selectedId);
    if (mode && mode.author) openProfile(mode.author.username);
  };
  if (els.detailTeam) els.detailTeam.onclick = () => {
    const mode = modeById(S.selectedId);
    if (mode && mode.team) openTeamPage(mode.team);
  };
  els.detailReport.onclick = () => openReportModal(modeById(S.selectedId));
  els.reportForm.onsubmit = (event) => {
    event.preventDefault();
    submitReport();
  };
  els.reviewForm.onsubmit = (event) => {
    event.preventDefault();
    submitReview();
  };
  $('review-reply-form').onsubmit = (event) => {
    event.preventDefault();
    submitReviewReply();
  };
  els.reviewStars.querySelectorAll('[data-star]').forEach((button) => {
    button.onclick = () => {
      S.reviewRating = Number(button.getAttribute('data-star')) || 5;
      renderReviewStars();
    };
  });
  els.reviewsList.onclick = (event) => {
    const reply = event.target.closest('[data-review-reply]');
    if (reply) {
      openReviewReplyModal(reply.getAttribute('data-review-reply'));
      return;
    }
    const button = event.target.closest('[data-review-delete]');
    if (!button) return;
    deleteReview(button.getAttribute('data-review-delete'));
  };
  els.detailAction.onclick = async () => {
    const mode = modeById(S.selectedId);
    if (!mode) return;
    const task = downloadTaskForMode(mode.id);
    if (task && task.status === 'paused') {
      resumeDownload(task.id);
      return;
    }
    if (task && task.status === 'queued') {
      cancelDownload(task.id);
      return;
    }
    if (S.busy && S.busy.modeId === mode.id) {
      const active = activeDownloadTask();
      if (active) cancelDownload(active.id);
      return;
    }
    if (S.running === mode.id) {
      await api.stopGame();
      S.status = tKey("closing.the.game");
      toast(tKey("closing.the.game"), 'info');
      return;
    }
    const action = computeAction(mode);
    if (action === 'running') return;
    if (action === 'add') {
      try {
        const res = await api.setLibrary(mode.id, true);
        if (!res || !res.ok) throw new Error((res && res.error) || tKey("error"));
        const st = S.state[mode.id] || { installed: false, version: null, installedAt: 0 };
        S.state[mode.id] = { ...st, library: true, hidden: false };
        detailActions.renderStore();
        renderLibrary();
        renderDetail();
        toast(tKey("mode.added.to.library"), 'ok');
      } catch (err) {
        toast(tKey("failed.to.add.mode") + " " + err, 'error');
      }
      return;
    }
    if (!lavunioLoggedIn()) {
      detailActions.openModal('modal-account');
      toast(tKey("sign.in.to.lavunio.2"), 'warn');
      return;
    }

    if (action === 'play') enqueueDownload(mode, 'play');
    else enqueueDownload(mode, action);
  };
  els.detailDefer.onclick = () => deferModeUpdate(modeById(S.selectedId));
}

async function verifyMode(mode) {
  if (!mode || !els.detailVerify) return;
  const label = els.detailVerify.textContent;
  els.detailVerify.disabled = true;
  els.detailVerify.textContent = tKey("checking");
  try {
    const report = await api.verify(mode.id);
    if (!report) throw new Error(tKey("empty.verification.response"));
    if (report.ok) {
      toast(tKey("app.files.ok", [Number(report.checked) || 0]), 'ok');
      return;
    }
    const message = tKey("app.files.missing.corrupted", [Number(report.missing) || 0, Number(report.corrupted) || 0]);
    const fix = await detailActions.askConfirm(
      tKey("files.are.corrupted"),
      tKey("app.repair.install", [message]),
      tKey("repair")
    );
    if (fix) await repairMode(mode);
  } catch (err) {
    toast(tKey("failed.to.verify.files") + " " + err, 'error');
  } finally {
    els.detailVerify.disabled = false;
    els.detailVerify.textContent = label;
  }
}

async function repairMode(mode) {
  if (!mode) return;
  try {
    await api.prepareRepair(mode.id);
    enqueueDownload(mode, 'repair');
    toast(tKey("repair.queued"), 'info');
  } catch (err) {
    toast(tKey("failed.to.start.repair") + " " + err, 'error');
  }
}

export async function startMode(mode, autoPlay = false) {
  if (!mode) return;
  if (S.running === mode.id) return;
  let action = computeAction(mode);
  if (action === 'running') return;
  if (action === 'add') {
    try {
      const res = await api.setLibrary(mode.id, true);
      if (!res || !res.ok) throw new Error((res && res.error) || tKey("error"));
      const st = S.state[mode.id] || { installed: false, version: null, installedAt: 0 };
      S.state[mode.id] = { ...st, library: true, hidden: false };
      detailActions.renderStore();
      renderLibrary();
      toast(tKey("mode.added.to.library"), 'ok');
    } catch (err) {
      toast(tKey("failed.to.add.mode") + " " + err, 'error');
    }
    return;
  }
  if (!lavunioLoggedIn()) {
    detailActions.openModal('modal-account');
    toast(tKey("sign.in.to.lavunio.2"), 'warn');
    return;
  }

  if (action === 'play') {
    enqueueDownload(mode, 'play');
    return;
  }
  enqueueDownload(mode, action, autoPlay);
}

export function closeCardContext() {
  if (els.cardContext) els.cardContext.hidden = true;
}

export function openCardContext(card, x, y, playMode) {
  if (!els.cardContext) return;
  const mode = modeById(card.dataset.id);
  if (!mode) return;
  const action = computeAction(mode);
  const installed = isInstalled(mode);
  const inLib = inLibrary(mode);
  const actions = [];

  if (action === 'running') {
    actions.push({ action: 'stop', label: tKey("close.game"), primary: true, danger: true });
  } else {
    const label = action === 'update'
      ? tKey("messages.refresh")
      : action === 'play'
        ? tKey("play")
        : action === 'add'
          ? tKey("add.to.library")
          : tKey("install");
    actions.push({ action: 'play', label, primary: true });
  }

  if (playMode) actions.push({ action: 'page', label: tKey("mode.page") });
  if (installed) actions.push({ action: 'folder', label: tKey("open.folder") });
  if (isHiddenMode(mode)) {
    actions.push({ action: 'unhide', label: tKey("restore.to.library") });
    actions.push({ action: 'removelib', label: tKey("remove.from.library.2") });
  } else if (inLib) {
    actions.push({ action: 'removelib', label: tKey("remove.from.library.2") });
    actions.push({ action: 'hide', label: tKey("hide") });
  }
  if (installed && action !== 'running') {
    actions.push({ action: 'uninstall', label: tKey("delete.from.device"), danger: true });
  }

  els.cardContext.innerHTML = actions.map((item) => `
    <button type="button" data-context-action="${item.action}" class="${item.primary ? 'primary' : ''} ${item.danger ? 'danger' : ''}">
      ${escapeHtml(item.label)}
    </button>`).join('');
  els.cardContext.hidden = false;
  const width = 208;
  const height = els.cardContext.offsetHeight;
  els.cardContext.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  els.cardContext.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
  els.cardContext.onclick = (event) => {
    const button = event.target.closest('[data-context-action]');
    if (!button) return;
    closeCardContext();
    detailActions.handleCardAction(mode.id, button.dataset.contextAction, playMode);
  };
}

export function openDetail(id) {
  const mode = modeById(id);
  if (!mode) return;
  if (S.selectedId !== id) {
    S.detailTab = 'about';
    S.sessionsExpanded = false;
  }
  S.detailFrom = S.section || 'store';
  S.selectedId = id;
  els.storeView.hidden = true;
  els.libraryView.hidden = true;
  if (els.publisherView) els.publisherView.hidden = true;
  if (els.moderationView) els.moderationView.hidden = true;
  if (els.profileView) els.profileView.hidden = true;
  if (els.messagesView) els.messagesView.hidden = true;
  if (els.teamView) els.teamView.hidden = true;
  if (S.chatTimer) {
    clearInterval(S.chatTimer);
    S.chatTimer = null;
  }
  els.detailView.hidden = false;
  S.view = 'detail';
  els.detailBackLabel.textContent = S.detailFrom === 'library'
    ? tKey("back.to.library")
    : S.detailFrom === 'profile' ? tKey("app.back.to.profile")
      : tKey("back.to.catalog");
  renderDetail();
  $('app').scrollTop = 0;
}

export function showStore() {
  S.selectedId = null;
  const section = S.detailFrom || S.section || 'store';
  S.detailFrom = null;
  detailActions.showSection(section);
}

function actionLabel(action) {
  return {
    add: tKey("add.to.library"),
    install: tKey("install"),
    update: tKey("messages.refresh"),
    play: tKey("play"),
    running: tKey("in.game")
  }[action] || tKey("install");
}

function defaultStatus(mode) {
  if (S.running === mode.id) return tKey("game.launched");
  if (!inLibrary(mode)) return tKey("add.mode.to.library.first");
  if (isUpdate(mode)) return tKey("update.available");
  if (isInstalled(mode)) return tKey("ready.to.launch");
  return tKey("files.not.downloaded.yet");
}

export function renderDetail() {
  const mode = modeById(S.selectedId);
  if (!mode) {
    showStore();
    return;
  }

  els.detailImg.src = imageSrc(mode);
  wireImage(els.detailImg, mode);
  els.detailTitle.textContent = mode.title || tKey("untitled");
  els.detailSub.textContent = `${modeSub(mode)} · ${mode.size || '—'}`;
  els.detailTags.innerHTML = (Array.isArray(mode.tags) ? mode.tags : [])
    .filter(Boolean)
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join('');
  const modeStatus = modeStatusMeta(mode);
  if (modeStatus) {
    els.detailTags.insertAdjacentHTML('afterbegin', `<span class="mode-status ${modeStatus.cls}">${modeStatus.label}</span>`);
  }

  const latest = latestUpdateEntry(mode);
  const updated = latest && latest.date ? formatUpdateDate(latest.date) : '—';
  const released = modeReleaseDate(mode);
  els.detailMeta.innerHTML = [
    [tKey("version"), 'v' + (mode.version || '—')],
    ['Minecraft', mode.mcVersion || '—'],
    [tKey("loader"), loaderLabel(mode)],
    [tKey("size"), mode.size || '—'],
    [tKey("rating"), mode.rating ? `${Number(mode.rating).toFixed(1)} ★ (${Number(mode.reviewsCount) || 0})` : '—'],
    [tKey("installs"), String(Number(mode.installs) || 0)],
    [tKey("released"), released ? formatUpdateDate(released) : '—'],
    [tKey("updated"), updated]
  ].map(([label, value]) => `
    <div class="meta-item">
      <span class="meta-label">${label}</span>
      <span class="meta-value">${escapeHtml(value)}</span>
    </div>`).join('');

  const screenshots = Array.isArray(mode.screenshots) ? mode.screenshots.filter(Boolean) : [];
  els.detailGallerySection.hidden = screenshots.length === 0;
  els.detailGallery.innerHTML = screenshots.map((url) => `
    <button class="gallery-thumb" type="button" data-gallery-src="${escapeHtml(url)}">
      <img src="${escapeHtml(url)}" alt="" loading="lazy">
    </button>`).join('');

  renderSessions(mode);

  renderTrailer(mode);
  renderModeNews(mode);
  loadModeNews(mode);

  const apiReady = !!(S.lavunio && S.lavunio.configured);
  const author = mode.author || (Array.isArray(mode.authors) ? mode.authors[0] : null);
  const authorName = (author && (author.name || author.displayName)) || modeAuthors(mode)[0] || '';
  els.detailAuthorSection.hidden = !authorName;
  if (authorName) {
    els.detailAuthorName.textContent = authorName;
    els.detailAuthorSub.textContent = author && author.verified ? tKey("verified.author") : tKey("mode.author");
    const avatar = els.detailAuthorAvatar;
    avatar.textContent = authorName[0].toUpperCase();
    avatar.style.backgroundImage = author && author.avatar ? `url("${author.avatar}")` : '';
  }
  const canFollow = !!(apiReady && author && author.id && S.lavunio.user && S.lavunio.user.username !== author.id);
  els.detailAuthorFollow.hidden = !canFollow;
  if (els.detailAuthorProfile) els.detailAuthorProfile.hidden = !(author && author.username);
  if (canFollow) {
    const following = S.follows.includes(author.id);
    els.detailAuthorFollow.textContent = following ? tKey("following.2") : tKey("follow");
    els.detailAuthorFollow.classList.toggle('active', following);
  }
  if (els.detailTeam) {
    const team = mode.team;
    els.detailTeam.hidden = !team;
    if (team) els.detailTeam.textContent = tKey("app.team.with.verified", [team.title, team.verified ? ' ✓' : '']);
  }

  els.detailReviewsSection.hidden = !apiReady;
  if (apiReady) {
    renderReviews(mode);
    loadReviews(mode);
  }

  els.detailDesc.innerHTML = renderRichText(modeFullDescription(mode));
  renderChangelog(mode);
  els.reqSize.textContent = mode.size || '—';
  renderSpotlight(mode);
  els.sideFolder.hidden = !isInstalled(mode);
  els.detailVerify.hidden = !isInstalled(mode);

  const others = sortByTitle(S.modes.filter((m) => m.id !== mode.id)).slice(0, 3);
  els.moreSection.hidden = others.length === 0;
  renderModeGrid(els.moreGrid, others);

  updateDetailAction();
  selectDetailTab(S.detailTab || 'about');
}

async function toggleFollowAuthor() {
  const mode = modeById(S.selectedId);
  if (!mode) return;
  const author = mode.author || (Array.isArray(mode.authors) ? mode.authors[0] : null);
  if (!author || !author.id) return;
  if (!lavunioLoggedIn()) {
    detailActions.openModal('modal-account');
    toast(tKey("sign.in.to.lavunio.2"), 'warn');
    return;
  }
  if (S.lavunio.user && S.lavunio.user.username === author.id) {
    toast(tKey("you.cannot.follow.yourself"), 'warn');
    return;
  }
  const following = S.follows.includes(author.id);
  try {
    if (following) await api.unfollowAuthor(author.id);
    else await api.followAuthor(author.id);
    S.follows = following
      ? S.follows.filter((id) => id !== author.id)
      : [...S.follows, author.id];
    await loadFollows();
    toast(following ? tKey("you.unfollowed.the.author") : tKey("you.followed.the.author"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.update.follow") + " " + err, 'error');
  }
}

function openReportModal(mode) {
  if (!mode) return;
  if (!lavunioLoggedIn()) {
    detailActions.openModal('modal-account');
    toast(tKey("sign.in.to.lavunio.2"), 'warn');
    return;
  }
  S.reportModeId = mode.id;
  els.reportTarget.textContent = `${mode.title} · ${mode.id}`;
  els.reportReason.value = '';
  els.reportError.hidden = true;
  detailActions.openModal('modal-report');
  setTimeout(() => els.reportReason.focus(), 50);
}

async function submitReport() {
  const mode = modeById(S.reportModeId);
  if (!mode) return;
  const reason = els.reportReason.value.trim();
  if (reason.length < 3) {
    els.reportError.textContent = tKey("describe.the.reason.for");
    els.reportError.hidden = false;
    return;
  }
  const button = els.reportSubmit;
  button.disabled = true;
  els.reportError.hidden = true;
  try {
    await api.reportMode(mode.id, reason);
    $('modal-report').hidden = true;
    toast(tKey("report.submitted"), 'ok');
  } catch (err) {
    els.reportError.textContent = String(err || tKey("failed.to.submit.report"));
    els.reportError.hidden = false;
  } finally {
    button.disabled = false;
  }
}

function reviewStarsText(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return '★'.repeat(value) + '☆'.repeat(5 - value);
}

function renderReviewStars() {
  els.reviewStars.querySelectorAll('[data-star]').forEach((button) => {
    button.classList.toggle('active', Number(button.getAttribute('data-star')) <= S.reviewRating);
  });
}

async function loadReviews(mode) {
  if (!mode || !S.lavunio || !S.lavunio.configured) return;
  if (S.reviews[mode.id] !== undefined || S.reviewLoading[mode.id]) return;
  S.reviewLoading[mode.id] = true;
  try {
    const data = await api.reviewsGet(mode.id);
    S.reviews[mode.id] = data;
    mode.rating = data.averageRating;
    mode.reviewsCount = data.count;
  } catch (_) {
  } finally {
    S.reviewLoading[mode.id] = false;
    if (S.selectedId === mode.id && S.view === 'detail') {
      renderDetail();
      detailActions.renderStore();
    }
  }
}

function renderReviews(mode) {
  if (!mode) return;
  const data = S.reviews[mode.id];
  const items = data && Array.isArray(data.items) ? data.items : [];
  const count = data && Number.isFinite(Number(data.count)) ? Number(data.count) : (mode.reviewsCount || 0);
  const average = data && data.averageRating !== null && data.averageRating !== undefined
    ? Number(data.averageRating)
    : (mode.rating !== null && mode.rating !== undefined ? Number(mode.rating) : null);
  els.reviewsSummary.textContent = average !== null && count > 0
    ? tKey("app.reviews.summary", [average.toFixed(1), count])
    : tKey("no.reviews.yet");

  if (!items.length) {
    els.reviewsList.innerHTML = '<div class="hint">' + tKey("app.first.review") + '</div>';
  } else {
    const canReply = !!(
      S.lavunio && S.lavunio.user &&
      ((mode.author && mode.author.id === S.lavunio.user.username) || S.lavunio.user.role === 'admin')
    );
    els.reviewsList.innerHTML = items.map((item) => {
      const own = S.lavunio && S.lavunio.user && item.authorUsername === S.lavunio.user.username;
      return `
        <article class="review-item">
          <div class="review-head">
            <span class="review-author">${escapeHtml(item.authorName || item.authorUsername || tKey("player.2"))}</span>
            <span class="review-stars">${reviewStarsText(item.rating)}</span>
            <span class="review-date">${escapeHtml(publisherDate(item.createdAt))}</span>
          </div>
          ${item.text ? `<div class="review-text">${escapeHtml(item.text)}</div>` : ''}
          ${item.authorReply ? `
            <div class="review-reply">
              <div class="review-reply-label">${tKey("app.author.reply")}</div>
              <div class="review-reply-text">${escapeHtml(item.authorReply)}</div>
            </div>` : ''}
          <div class="review-actions">
            ${canReply ? `<button class="link link-btn" type="button" data-review-reply="${escapeHtml(item.id)}">${item.authorReply ? tKey("edit.reply") : tKey("reply.2")}</button>` : ''}
            ${own ? `<button class="link link-btn review-delete" type="button" data-review-delete="${escapeHtml(mode.id)}">${tKey("app.delete.my.review")}</button>` : ''}
          </div>
        </article>`;
    }).join('');
  }

  const loggedIn = lavunioLoggedIn();
  els.reviewForm.hidden = !loggedIn;
  els.reviewLoginHint.hidden = loggedIn;
  if (loggedIn) {
    renderReviewStars();
  }
}

async function submitReview() {
  const mode = modeById(S.selectedId);
  if (!mode) return;
  if (!lavunioLoggedIn()) {
    detailActions.openModal('modal-account');
    toast(tKey("sign.in.to.lavunio.2"), 'warn');
    return;
  }
  const text = els.reviewText.value.trim();
  const error = els.reviewError;
  if (text.length > 2000) {
    error.textContent = tKey("review.must.be.at");
    error.hidden = false;
    return;
  }
  const button = els.reviewSubmit;
  button.disabled = true;
  error.hidden = true;
  try {
    const data = await api.reviewSubmit(mode.id, S.reviewRating, text);
    S.reviews[mode.id] = data;
    mode.rating = data.averageRating;
    mode.reviewsCount = data.count;
    els.reviewText.value = '';
    renderDetail();
    detailActions.renderStore();
    toast(data && data.pending ? tKey("review.submitted.for.moderation") : tKey("review.saved"), 'ok');
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.save.review"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

function openReviewReplyModal(reviewId) {
  const mode = modeById(S.selectedId);
  if (!mode) return;
  const data = S.reviews[mode.id];
  const item = data && Array.isArray(data.items)
    ? data.items.find((review) => review.id === reviewId)
    : null;
  if (!item) return;
  S.reviewReplyTarget = { modeId: mode.id, reviewId };
  $('review-reply-target').textContent = `${mode.title} · ${item.authorName || item.authorUsername || tKey("player")}`;
  $('review-reply-text').value = item.authorReply || '';
  $('review-reply-error').hidden = true;
  detailActions.openModal('modal-review-reply');
  setTimeout(() => $('review-reply-text').focus(), 50);
}

async function submitReviewReply() {
  const target = S.reviewReplyTarget;
  if (!target) return;
  const mode = modeById(target.modeId);
  if (!mode) return;
  const text = $('review-reply-text').value.trim();
  const error = $('review-reply-error');
  if (!text) {
    error.textContent = tKey("write.a.reply");
    error.hidden = false;
    return;
  }
  const button = $('review-reply-submit');
  button.disabled = true;
  button.textContent = tKey("sending");
  error.hidden = true;
  try {
    await api.reviewReply(mode.id, target.reviewId, text);
    $('modal-review-reply').hidden = true;
    delete S.reviews[mode.id];
    await loadReviews(mode);
    toast(tKey("reply.published"), 'ok');
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.send.reply"));
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = tKey("send.reply");
  }
}

async function deleteReview(modeId) {
  const mode = modeById(modeId);
  if (!mode) return;
  const ok = await detailActions.askConfirm(tKey("delete.review"), tKey("your.review.will.be"), tKey("delete"));
  if (!ok) return;
  try {
    await api.reviewDelete(modeId);
    delete S.reviews[modeId];
    mode.rating = null;
    mode.reviewsCount = 0;
    await loadReviews(mode);
    if (S.view === 'detail') renderDetail();
    detailActions.renderStore();
    toast(tKey("review.deleted"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.delete.review") + " " + err, 'error');
  }
}

export function updateDetailAction() {
  if (S.view !== 'detail') return;
  const mode = modeById(S.selectedId);
  if (!mode) return;
  if (els.detailDefer) els.detailDefer.hidden = true;

  const task = downloadTaskForMode(mode.id);
  if (task && task.status === 'queued') {
    els.detailAction.textContent = tKey("cancel.2");
    els.detailAction.className = 'btn btn-danger btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = tKey("queued");
    els.detailProgress.hidden = true;
    return;
  }
  if (task && task.status === 'paused') {
    els.detailAction.textContent = tKey("resume");
    els.detailAction.className = 'btn btn-primary btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = tKey("download.paused");
    els.detailProgress.hidden = false;
    els.detailProgressBar.style.width = Math.max(0, Math.min(100, task.progress * 100)) + '%';
    return;
  }

  const busyHere = !!(S.busy && S.busy.modeId === mode.id);
  if (busyHere) {
    els.detailAction.textContent = tKey("cancel");
    els.detailAction.className = 'btn btn-danger btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = S.status || tKey("preparing.2");
    els.detailProgress.hidden = false;
    els.detailProgressBar.style.width = Math.max(0, Math.min(100, S.progress * 100)) + '%';
    return;
  }

  const action = computeAction(mode);
  if (action === 'running') {
    els.detailAction.textContent = tKey("close.game");
    els.detailAction.className = 'btn btn-danger btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = tKey("game.launched");
  } else {
    els.detailAction.textContent = actionLabel(action);
    els.detailAction.className = 'btn btn-primary btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = defaultStatus(mode);
    if (els.detailDefer) els.detailDefer.hidden = action !== 'update';
  }
  els.detailProgress.hidden = true;
  els.detailProgressBar.style.width = '0%';
}

async function deferModeUpdate(mode) {
  if (!mode) return;
  const version = mode.version || null;
  try {
    const res = api.gameSkipUpdate ? await api.gameSkipUpdate(mode.id, version) : null;
    if (res && res.ok === false) throw new Error(res.error || tKey("error"));
    const st = S.state[mode.id] || { installed: true, version: null, installedAt: 0 };
    S.state[mode.id] = { ...st, skippedVersion: version };
    detailActions.renderStore();
    renderLibrary();
    updateDetailAction();
    toast(tKey("update.postponed.until.the"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.postpone.update") + " " + err, 'error');
  }
}
