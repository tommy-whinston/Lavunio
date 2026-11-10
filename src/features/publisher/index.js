'use strict';

import { tKey } from '../../i18n/index.js';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { publisherAllowed } from '../../core/permissions.js';
import { LOADER_LABELS } from '../../core/modes.js';
import { formatBytes, publisherDate } from '../../core/format.js';
import { toast } from '../../ui/toast.js';
import { loadTeams } from '../teams/index.js';
import { loadModeNews } from '../news/index.js';

let publisherActions = {
  openModal: () => {},
  askConfirm: async () => false,
  updatePublisherNav: () => {}
};

export function configurePublisher(actions) {
  publisherActions = { ...publisherActions, ...actions };
}

export const PUBLISHER_STATUS = {
  draft: 'publisher.status.draft',
  pending: 'pending.review',
  published: 'published.3',
  rejected: 'publisher.status.rejected',
  hidden: 'publisher.status.hidden'
};

export function publisherStatusLabel(status) {
  const key = PUBLISHER_STATUS[status];
  return key ? tKey(key) : status;
}

const PUBLISHER_TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

export function bindPublisher() {
  const newMode = $('publisher-new-mode');
  if (newMode) newMode.onclick = () => openPublisherModeModal();
  const refresh = $('publisher-refresh');
  if (refresh) refresh.onclick = () => loadPublisher(true);

  const modeForm = $('publisher-mode-form');
  if (modeForm) modeForm.onsubmit = (event) => {
    event.preventDefault();
    submitPublisherMode();
  };
  const releaseForm = $('publisher-release-form');
  if (releaseForm) releaseForm.onsubmit = (event) => {
    event.preventDefault();
    submitPublisherRelease();
  };
  const newsForm = $('publisher-news-form');
  if (newsForm) newsForm.onsubmit = (event) => {
    event.preventDefault();
    submitPublisherNews();
  };

  const title = $('pub-mode-title-input');
  const slug = $('pub-mode-slug-input');
  if (title && slug) {
    title.oninput = () => {
      if (!slug.dataset.touched) slug.value = publisherSlug(title.value);
    };
    slug.oninput = () => { slug.dataset.touched = '1'; };
  }

  const list = $('publisher-modes');
  if (list) list.onclick = (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const mode = S.publisherModes.find((item) => item.id === button.dataset.mode);
    if (!mode) return;
    const release = (mode.releases || []).find((item) => item.id === button.dataset.release);
    const action = button.dataset.action;
    if (action === 'new-release') openPublisherReleaseModal(mode);
    else if (action === 'news') openPublisherNewsModal(mode);
    else if (action === 'upload-cover') uploadPublisherCover(mode);
    else if (action === 'delete-cover') deletePublisherCover(mode);
    else if (action === 'upload-folder') uploadPublisherBuild(mode, release, true);
    else if (action === 'upload-archive') uploadPublisherBuild(mode, release, false);
    else if (action === 'upload-screenshot') uploadPublisherScreenshot(mode, release);
    else if (action === 'submit-release') submitPublisherReleaseForModeration(mode, release);
    else if (action === 'appeal') openPublisherAppealModal(mode, release);
  };

  const appealForm = $('publisher-appeal-form');
  if (appealForm) appealForm.onsubmit = (event) => {
    event.preventDefault();
    submitPublisherAppeal();
  };

  if (api.onPublisherProgress) api.onPublisherProgress(onPublisherProgress);
  publisherActions.updatePublisherNav();
}

export function publisherSlug(value) {
  return String(value || '')
    .toLowerCase()
    .split('')
    .map((char) => PUBLISHER_TRANSLIT[char] !== undefined ? PUBLISHER_TRANSLIT[char] : char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function openPublisherModeModal() {
  const form = $('publisher-mode-form');
  if (form) form.reset();
  const slug = $('pub-mode-slug-input');
  if (slug) delete slug.dataset.touched;
  fillPublisherTeamSelect();
  if (!S.teamsLoaded) loadTeams(true).then(fillPublisherTeamSelect).catch(() => {});
  hidePublisherError('pub-mode-error');
  publisherActions.openModal('modal-publisher-mode');
  const title = $('pub-mode-title-input');
  if (title) setTimeout(() => title.focus(), 50);
}

export function fillPublisherTeamSelect() {
  const select = $('pub-mode-team');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">' + tKey("no.team") + '</option>';
  (S.teams || []).forEach((team) => {
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = team.title;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

export function openPublisherNewsModal(mode) {
  if (!mode) return;
  S.publisherNewsMode = mode;
  const form = $('publisher-news-form');
  if (form) form.reset();
  const label = $('pub-news-mode');
  if (label) label.textContent = `${mode.title} · ${mode.slug}`;
  hidePublisherError('pub-news-error');
  publisherActions.openModal('modal-publisher-news');
  const title = $('pub-news-title');
  if (title) setTimeout(() => title.focus(), 50);
}

export function openPublisherReleaseModal(mode) {
  if (!mode) return;
  S.publisherReleaseMode = mode;
  const form = $('publisher-release-form');
  if (form) form.reset();
  hidePublisherError('pub-release-error');
  const label = $('pub-release-mode');
  if (label) label.textContent = `${mode.title} · ${mode.slug}`;
  const version = $('pub-release-version');
  if (version) version.value = nextPublisherVersion(mode);
  publisherActions.openModal('modal-publisher-release');
}

export function nextPublisherVersion(mode) {
  const releases = mode.releases || [];
  if (!releases.length) return '1.0.0';
  const parts = String(releases[0].version || '').split('.');
  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`;
  }
  return '';
}

export function hidePublisherError(id) {
  const error = $(id);
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }
}

export function showPublisherError(id, message) {
  const error = $(id);
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

export async function loadPublisher(force = false) {
  if (!publisherAllowed()) {
    publisherActions.updatePublisherNav();
    return;
  }
  if (S.publisherLoading) return;
  if (S.publisherLoaded && !force) {
    renderPublisher();
    return;
  }

  S.publisherLoading = true;
  const hint = $('publisher-hint');
  if (hint) hint.textContent = tKey("loading.list");
  renderPublisher();

  try {
    const modes = await api.publisherMyModes();
    S.publisherModes = Array.isArray(modes) ? modes : [];
    S.publisherLoaded = true;
    if (hint) {
      hint.textContent = S.publisherModes.length
        ? tKey("publisher.hint.drafts")
        : '';
    }
  } catch (err) {
    S.publisherLoaded = false;
    if (hint) hint.textContent = tKey("publisher.failed.load.modes") + ' ' + err;
    toast(tKey("publisher.failed.load.modes") + ' ' + err, 'error');
  } finally {
    S.publisherLoading = false;
    renderPublisher();
  }
}

export function renderPublisher() {
  if (!els.publisherView) return;
  if (!publisherAllowed()) return;

  const modes = S.publisherModes || [];
  const pending = modes.reduce(
    (total, mode) => total + (mode.releases || []).filter((release) => release.status === 'pending').length,
    0
  );
  const statModes = $('publisher-stat-modes');
  const statPending = $('publisher-stat-pending');
  if (statModes) statModes.textContent = String(modes.length);
  if (statPending) statPending.textContent = String(pending);

  const list = $('publisher-modes');
  const empty = $('publisher-empty');
  if (!list) return;

  if (!modes.length) {
    list.innerHTML = '';
    if (empty) empty.hidden = !S.publisherLoading;
    return;
  }
  if (empty) empty.hidden = true;

  list.innerHTML = modes.map((mode) => publisherModeCard(mode)).join('');
}

export function publisherModeCard(mode) {
  const releases = mode.releases || [];
  const status = publisherStatusLabel(mode.status);
  const loader = LOADER_LABELS[mode.loader] || mode.loader || 'Vanilla';
  const stats = mode.stats || {};
  const meta = [
    mode.mcVersion ? `Minecraft ${escapeHtml(mode.mcVersion)}` : tKey("publisher.mc.not.specified"),
    loader,
    mode.size ? escapeHtml(mode.size) : tKey("publisher.size.not.specified"),
    tKey("pattern.updated.x.2", [escapeHtml(publisherDate(mode.updatedAt))])
  ].join(' · ');
  const coverHtml = mode.coverUrl
    ? `<img class="pub-cover" src="${escapeHtml(mode.coverUrl)}" alt="${tKey("publisher.cover.alt", [escapeHtml(mode.title)])}">`
    : '';

  const releaseCards = releases.length
    ? releases.map((release) => publisherReleaseCard(mode, release)).join('')
    : '<div class="pub-empty-release">' + tKey("no.releases.yet.create") + '</div>';

  return `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(mode.title)}</div>
          <div class="pub-sub">${escapeHtml(mode.slug)}</div>
        </div>
        <span class="pub-status ${escapeHtml(mode.status)}">${escapeHtml(status)}</span>
      </div>
      ${coverHtml}
      <div class="pub-meta"><span>${meta}</span></div>
      <div class="pub-stats">
        <span>${tKey("downloads.2")} <b>${Number(stats.downloads) || 0}</b></span>
        <span>${tKey("installs")} <b>${Number(stats.installs) || 0}</b></span>
        <span>${tKey("updates.2")} <b>${Number(stats.updates) || 0}</b></span>
        <span>${tKey("players")} <b>${Number(stats.uniqueUsers) || 0}</b></span>
      </div>
      <div class="pub-releases">${releaseCards}</div>
      <div class="pub-release-actions">
        <button class="btn btn-ghost" type="button" data-action="news" data-mode="${escapeHtml(mode.id)}">${tKey("common.news")}</button>
        <button class="btn btn-ghost" type="button" data-action="new-release" data-mode="${escapeHtml(mode.id)}">${tKey("new.release")}</button>
        <button class="btn btn-ghost" type="button" data-action="upload-cover" data-mode="${escapeHtml(mode.id)}">${tKey("upload.cover")}</button>
        ${mode.coverUrl ? `<button class="btn btn-ghost" type="button" data-action="delete-cover" data-mode="${escapeHtml(mode.id)}">${tKey("remove.cover")}</button>` : ''}
      </div>
    </article>
  `;
}

export function publisherReleaseCard(mode, release) {
  const status = publisherStatusLabel(release.status);
  const archive = (release.assets || []).find((asset) => asset.kind === 'archive' && asset.url);
  const uploading = !!(S.publisherUpload && S.publisherUpload.releaseId === release.id);
  const changelog = String(release.changelog || '').replace(/\s+/g, ' ').trim();
  const changelogHtml = changelog
    ? `<div class="hint">${escapeHtml(changelog.slice(0, 180))}${changelog.length > 180 ? '…' : ''}</div>`
    : '';
  const archiveHtml = archive
    ? tKey("pattern.build.x", [escapeHtml(formatBytes(archive.size || 0)) + (archive.fileName ? ` · ${escapeHtml(archive.fileName)}` : '')])
    : tKey("no.build.uploaded");
  const uploadedAction = uploading
    ? '<span class="pub-uploading">' + tKey("loading.2") + '</span>'
    : '';
  const rejectionHtml = release.rejectionNote
    ? `<div class="mod-reject-note">${tKey("rejection.reason")} ${escapeHtml(release.rejectionNote)}</div>`
    : '';
  const screenshots = (release.assets || []).filter((asset) => asset.kind === 'screenshot' && asset.url).length;
  const screenshotHtml = screenshots ? `${tKey("screenshots.2")} ${screenshots}` : '';

  let actions = '';
  if (release.status === 'draft') {
    actions = `
      <button class="btn btn-ghost" type="button" data-action="upload-folder" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${uploading ? 'disabled' : ''}>${tKey("folder")}</button>
      <button class="btn btn-ghost" type="button" data-action="upload-archive" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${uploading ? 'disabled' : ''}>ZIP</button>
      <button class="btn btn-ghost" type="button" data-action="upload-screenshot" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${uploading ? 'disabled' : ''}>${tKey("screenshot")}</button>
      <button class="btn btn-primary" type="button" data-action="submit-release" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${(!archive || uploading) ? 'disabled' : ''}>${tKey("publisher.to.moderation")}</button>
      ${uploadedAction}
    `;
  } else if (release.status === 'published') {
    actions = `<span class="hint">${tKey("published.3")} ${escapeHtml(publisherDate(release.publishedAt))}</span>`;
  } else if (release.status === 'pending') {
    actions = '<span class="hint">' + tKey("awaiting.moderator.review") + '</span>';
  } else if (release.status === 'rejected') {
    if (release.appealStatus === 'open') {
      actions = '<span class="hint">' + tKey("appeal.under.review") + '</span>';
    } else if (release.appealStatus === 'rejected') {
      actions = '<span class="hint">' + tKey("appeal.rejected.fix.the") + '</span>';
    } else {
      actions = `<button class="btn btn-ghost" type="button" data-action="appeal" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" data-title="${escapeHtml(mode.title)}">${tKey("appeal")}</button>`;
    }
  }

  return `
    <div class="pub-release">
      <div class="pub-release-head">
        <span class="pub-release-version">${escapeHtml(release.version)}</span>
        <span class="pub-release-channel">${escapeHtml(release.channel || 'stable')}</span>
        <span class="pub-status ${escapeHtml(release.status)}">${escapeHtml(status)}</span>
      </div>
      <div class="hint">${archiveHtml}${screenshotHtml ? ` · ${screenshotHtml}` : ''}</div>
      ${changelogHtml}
      ${rejectionHtml}
      <div class="pub-release-actions">${actions}</div>
    </div>
  `;
}

export async function submitPublisherMode() {
  const title = $('pub-mode-title-input').value.trim();
  const slug = $('pub-mode-slug-input').value.trim().toLowerCase();
  if (!title) {
    showPublisherError('pub-mode-error', tKey("enter.a.mode.name"));
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    showPublisherError('pub-mode-error', tKey("slug.3.64.characters"));
    return;
  }

  const payload = {
    slug,
    title,
    shortDescription: $('pub-mode-short').value.trim(),
    description: $('pub-mode-description').value.trim(),
    mcVersion: $('pub-mode-mc').value.trim(),
    loader: $('pub-mode-loader').value,
    loaderVersion: $('pub-mode-loader-version').value.trim() || null,
    size: $('pub-mode-size').value.trim() || null,
    coverUrl: $('pub-mode-cover').value.trim() || null,
    trailerUrl: $('pub-mode-trailer').value.trim() || null,
    tags: $('pub-mode-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
    teamId: $('pub-mode-team').value || null,
    coAuthors: $('pub-mode-coauthors').value.split(',').map((name) => name.trim()).filter(Boolean)
  };

  const button = $('pub-mode-submit');
  button.disabled = true;
  button.textContent = tKey("creating");
  hidePublisherError('pub-mode-error');
  try {
    await api.publisherCreateMode(payload);
    $('modal-publisher-mode').hidden = true;
    toast(tKey("draft.created"), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    showPublisherError('pub-mode-error', String(err || tKey("failed.to.create.mode")));
  } finally {
    button.disabled = false;
    button.textContent = tKey("create.draft");
  }
}

export async function submitPublisherNews() {
  const mode = S.publisherNewsMode;
  if (!mode) return;
  const title = $('pub-news-title').value.trim();
  const body = $('pub-news-body').value.trim();
  if (title.length < 3) {
    showPublisherError('pub-news-error', tKey("enter.the.news.title"));
    return;
  }
  if (body.length < 3) {
    showPublisherError('pub-news-error', tKey("write.the.news.text"));
    return;
  }

  const button = $('pub-news-submit');
  button.disabled = true;
  button.textContent = tKey("publishing");
  hidePublisherError('pub-news-error');
  try {
    await api.newsCreateMode(mode.id, title, body);
    $('modal-publisher-news').hidden = true;
    delete S.modeNews[mode.slug];
    toast(tKey("teams.news.published"), 'ok');
    if (S.selectedId === mode.slug) loadModeNews(modeById(mode.slug));
  } catch (err) {
    showPublisherError('pub-news-error', String(err || tKey("failed.to.publish.news")));
  } finally {
    button.disabled = false;
    button.textContent = tKey("publish");
  }
}

export async function submitPublisherRelease() {
  const mode = S.publisherReleaseMode;
  if (!mode) return;
  const version = $('pub-release-version').value.trim();
  if (!version) {
    showPublisherError('pub-release-error', tKey("publisher.enter.release.version"));
    return;
  }
  const payload = {
    version,
    channel: $('pub-release-channel').value,
    changelog: $('pub-release-changelog').value.trim()
  };

  const button = $('pub-release-submit');
  button.disabled = true;
  button.textContent = tKey("creating");
  hidePublisherError('pub-release-error');
  try {
    await api.publisherCreateRelease(mode.id, payload);
    $('modal-publisher-release').hidden = true;
    toast(tKey("publisher.release.created", [version]), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    showPublisherError('pub-release-error', String(err || tKey("publisher.failed.create.release")));
  } finally {
    button.disabled = false;
    button.textContent = tKey("create.release");
  }
}

export async function uploadPublisherCover(mode) {
  if (!mode) return;
  let path;
  try {
    path = await api.publisherPickCover();
  } catch (err) {
    toast(tKey("publisher.failed.pick.cover") + ' ' + err, 'error');
    return;
  }
  if (!path) return;
  try {
    await api.publisherUploadCover(mode.id, path);
    toast(tKey("publisher.cover.updated"), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast(tKey("publisher.failed.upload.cover") + ' ' + err, 'error');
  }
}

export async function deletePublisherCover(mode) {
  if (!mode) return;
  const ok = await publisherActions.askConfirm(
    tKey("publisher.confirm.remove.cover.title"),
    tKey("publisher.confirm.remove.cover.text", [mode.title]),
    tKey("publisher.remove")
  );
  if (!ok) return;
  try {
    await api.publisherDeleteCover(mode.id);
    toast(tKey("publisher.cover.deleted"), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast(tKey("publisher.failed.delete.cover") + ' ' + err, 'error');
  }
}

export async function uploadPublisherScreenshot(mode, release) {
  if (!mode || !release) return;
  let path;
  try {
    path = await api.publisherPickScreenshot();
  } catch (err) {
    toast(tKey("publisher.failed.pick.screenshot") + ' ' + err, 'error');
    return;
  }
  if (!path) return;
  try {
    await api.publisherUploadScreenshot(release.id, path);
    toast(tKey("publisher.screenshot.uploaded"), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast(tKey("publisher.failed.upload.screenshot") + ' ' + err, 'error');
  }
}

export async function uploadPublisherBuild(mode, release, folder) {
  if (!mode || !release) return;
  if (S.publisherUpload) {
    toast(tKey("publisher.wait.current.upload"), 'warn');
    return;
  }

  let source;
  try {
    source = folder ? await api.publisherPickFolder() : await api.publisherPickArchive();
  } catch (err) {
    toast(tKey("failed.to.select.file") + " " + err, 'error');
    return;
  }
  if (!source) return;

  S.publisherUpload = {
    modeId: mode.id,
    releaseId: release.id,
    stage: tKey("publisher.preparing.build"),
    percent: 0
  };
  updatePublisherProgress(S.publisherUpload);
  renderPublisher();

  try {
    await api.publisherUploadBuild(mode.id, release.id, release.version, source);
    toast(tKey("publisher.build.uploaded"), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast(tKey("publisher.failed.upload.build") + ' ' + err, 'error');
  } finally {
    S.publisherUpload = null;
    updatePublisherProgress(null);
    renderPublisher();
  }
}

export async function submitPublisherReleaseForModeration(mode, release) {
  if (!mode || !release) return;
  const confirmed = await publisherActions.askConfirm(
    tKey("publisher.confirm.submit.title"),
    tKey("publisher.confirm.submit.text", [release.version, mode.title]),
    tKey("messages.send")
  );
  if (!confirmed) return;

  try {
    await api.publisherSubmit(release.id);
    toast(tKey("publisher.release.submitted"), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast(tKey("publisher.failed.submit.release") + ' ' + err, 'error');
  }
}

export function openPublisherAppealModal(mode, release) {
  if (!mode || !release) return;
  S.publisherAppealRelease = { mode, release };
  $('pub-appeal-info').textContent = `${mode.title} · ${tKey("common.release.lowercase")} ${release.version}`;
  $('pub-appeal-message').value = '';
  hidePublisherError('pub-appeal-error');
  $('modal-publisher-appeal').hidden = false;
  setTimeout(() => $('pub-appeal-message').focus(), 50);
}

export async function submitPublisherAppeal() {
  const context = S.publisherAppealRelease;
  if (!context) return;
  const message = $('pub-appeal-message').value.trim();
  if (message.length < 10) {
    showPublisherError('pub-appeal-error', tKey("publisher.appeal.reason.short"));
    return;
  }
  const button = $('pub-appeal-submit');
  button.disabled = true;
  button.textContent = tKey("sending");
  try {
    await api.publisherAppealRelease(context.release.id, message);
    $('modal-publisher-appeal').hidden = true;
    S.publisherAppealRelease = null;
    toast(tKey("publisher.appeal.sent"), 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    showPublisherError('pub-appeal-error', String(err || tKey("publisher.failed.send.appeal")));
  } finally {
    button.disabled = false;
    button.textContent = tKey("submit.appeal");
  }
}

export function onPublisherProgress(payload) {
  if (!S.publisherUpload) return;
  const percent = Math.max(0, Math.min(100, Number(payload && payload.percent) || 0));
  S.publisherUpload = {
    ...S.publisherUpload,
    stage: (payload && payload.stage) || tKey("loading"),
    percent
  };
  updatePublisherProgress(S.publisherUpload);
}

export function updatePublisherProgress(upload) {
  const box = $('publisher-progress');
  if (!box) return;
  if (!upload) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const stage = $('publisher-progress-stage');
  const percent = $('publisher-progress-percent');
  const bar = $('publisher-progress-bar');
  if (stage) stage.textContent = upload.stage || tKey("loading");
  if (percent) percent.textContent = `${Math.round(upload.percent || 0)}%`;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, upload.percent || 0))}%`;
}

