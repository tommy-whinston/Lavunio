'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { publisherAllowed } from '../../core/permissions.js';
import { toast } from '../../ui/toast.js';
import { loadTeams } from '../teams/index.js';

let publisherActions = {
  openModal: () => {},
  askConfirm: async () => false,
  updatePublisherNav: () => {}
};

export function configurePublisher(actions) {
  publisherActions = { ...publisherActions, ...actions };
}

export const PUBLISHER_STATUS = {
  draft: 'Черновик',
  pending: 'На модерации',
  published: 'Опубликован',
  rejected: 'Отклонён',
  hidden: 'Скрыт'
};

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
  select.innerHTML = '<option value="">Без команды</option>';
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
  if (hint) hint.textContent = 'Загрузка списка…';
  renderPublisher();

  try {
    const modes = await api.publisherMyModes();
    S.publisherModes = Array.isArray(modes) ? modes : [];
    S.publisherLoaded = true;
    if (hint) {
      hint.textContent = S.publisherModes.length
        ? 'Черновики видны только вам. После отправки релиз проверит модератор.'
        : '';
    }
  } catch (err) {
    S.publisherLoaded = false;
    if (hint) hint.textContent = 'Не удалось загрузить режимы: ' + err;
    toast('Не удалось загрузить режимы: ' + err, 'error');
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
  const status = PUBLISHER_STATUS[mode.status] || mode.status;
  const loader = LOADER_LABELS[mode.loader] || mode.loader || 'Vanilla';
  const stats = mode.stats || {};
  const meta = [
    mode.mcVersion ? `Minecraft ${escapeHtml(mode.mcVersion)}` : 'Minecraft не указан',
    loader,
    mode.size ? escapeHtml(mode.size) : 'Размер не указан',
    `Обновлён ${escapeHtml(publisherDate(mode.updatedAt))}`
  ].join(' · ');
  const coverHtml = mode.coverUrl
    ? `<img class="pub-cover" src="${escapeHtml(mode.coverUrl)}" alt="Обложка ${escapeHtml(mode.title)}">`
    : '';

  const releaseCards = releases.length
    ? releases.map((release) => publisherReleaseCard(mode, release)).join('')
    : '<div class="pub-empty-release">Релизов пока нет. Создай первый релиз и загрузи сборку.</div>';

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
        <span>Скачивания <b>${Number(stats.downloads) || 0}</b></span>
        <span>Установки <b>${Number(stats.installs) || 0}</b></span>
        <span>Обновления <b>${Number(stats.updates) || 0}</b></span>
        <span>Игроки <b>${Number(stats.uniqueUsers) || 0}</b></span>
      </div>
      <div class="pub-releases">${releaseCards}</div>
      <div class="pub-release-actions">
        <button class="btn btn-ghost" type="button" data-action="news" data-mode="${escapeHtml(mode.id)}">Новость</button>
        <button class="btn btn-ghost" type="button" data-action="new-release" data-mode="${escapeHtml(mode.id)}">Новый релиз</button>
        <button class="btn btn-ghost" type="button" data-action="upload-cover" data-mode="${escapeHtml(mode.id)}">Загрузить обложку</button>
        ${mode.coverUrl ? `<button class="btn btn-ghost" type="button" data-action="delete-cover" data-mode="${escapeHtml(mode.id)}">Убрать обложку</button>` : ''}
      </div>
    </article>
  `;
}

export function publisherReleaseCard(mode, release) {
  const status = PUBLISHER_STATUS[release.status] || release.status;
  const archive = (release.assets || []).find((asset) => asset.kind === 'archive' && asset.url);
  const uploading = !!(S.publisherUpload && S.publisherUpload.releaseId === release.id);
  const changelog = String(release.changelog || '').replace(/\s+/g, ' ').trim();
  const changelogHtml = changelog
    ? `<div class="hint">${escapeHtml(changelog.slice(0, 180))}${changelog.length > 180 ? '…' : ''}</div>`
    : '';
  const archiveHtml = archive
    ? `Сборка: ${escapeHtml(formatBytes(archive.size || 0))}${archive.fileName ? ` · ${escapeHtml(archive.fileName)}` : ''}`
    : 'Сборка не загружена';
  const uploadedAction = uploading
    ? '<span class="pub-uploading">Загрузка…</span>'
    : '';
  const rejectionHtml = release.rejectionNote
    ? `<div class="mod-reject-note">Причина отклонения: ${escapeHtml(release.rejectionNote)}</div>`
    : '';
  const screenshots = (release.assets || []).filter((asset) => asset.kind === 'screenshot' && asset.url).length;
  const screenshotHtml = screenshots ? `Скриншотов: ${screenshots}` : '';

  let actions = '';
  if (release.status === 'draft') {
    actions = `
      <button class="btn btn-ghost" type="button" data-action="upload-folder" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${uploading ? 'disabled' : ''}>Папка</button>
      <button class="btn btn-ghost" type="button" data-action="upload-archive" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${uploading ? 'disabled' : ''}>ZIP</button>
      <button class="btn btn-ghost" type="button" data-action="upload-screenshot" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${uploading ? 'disabled' : ''}>Скриншот</button>
      <button class="btn btn-primary" type="button" data-action="submit-release" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" ${(!archive || uploading) ? 'disabled' : ''}>На модерацию</button>
      ${uploadedAction}
    `;
  } else if (release.status === 'published') {
    actions = `<span class="hint">Опубликован ${escapeHtml(publisherDate(release.publishedAt))}</span>`;
  } else if (release.status === 'pending') {
    actions = '<span class="hint">Ожидает проверки модератором</span>';
  } else if (release.status === 'rejected') {
    if (release.appealStatus === 'open') {
      actions = '<span class="hint">Апелляция на рассмотрении</span>';
    } else if (release.appealStatus === 'rejected') {
      actions = '<span class="hint">Апелляция отклонена. Исправь сборку и создай новый релиз.</span>';
    } else {
      actions = `<button class="btn btn-ghost" type="button" data-action="appeal" data-mode="${escapeHtml(mode.id)}" data-release="${escapeHtml(release.id)}" data-title="${escapeHtml(mode.title)}">Оспорить</button>`;
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

export function publisherDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(window.I18n ? window.I18n.locale() : 'ru-RU');
}

export async function submitPublisherMode() {
  const title = $('pub-mode-title-input').value.trim();
  const slug = $('pub-mode-slug-input').value.trim().toLowerCase();
  if (!title) {
    showPublisherError('pub-mode-error', 'Укажи название режима');
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    showPublisherError('pub-mode-error', 'Slug: 3–64 символа, строчные латинские буквы, цифры и дефис');
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
  button.textContent = 'Создаём…';
  hidePublisherError('pub-mode-error');
  try {
    await api.publisherCreateMode(payload);
    $('modal-publisher-mode').hidden = true;
    toast('Черновик создан', 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    showPublisherError('pub-mode-error', String(err || 'Не удалось создать режим'));
  } finally {
    button.disabled = false;
    button.textContent = 'Создать черновик';
  }
}

export async function submitPublisherNews() {
  const mode = S.publisherNewsMode;
  if (!mode) return;
  const title = $('pub-news-title').value.trim();
  const body = $('pub-news-body').value.trim();
  if (title.length < 3) {
    showPublisherError('pub-news-error', 'Укажи заголовок новости');
    return;
  }
  if (body.length < 3) {
    showPublisherError('pub-news-error', 'Напиши текст новости');
    return;
  }

  const button = $('pub-news-submit');
  button.disabled = true;
  button.textContent = 'Публикуем…';
  hidePublisherError('pub-news-error');
  try {
    await api.newsCreateMode(mode.id, title, body);
    $('modal-publisher-news').hidden = true;
    delete S.modeNews[mode.slug];
    toast('Новость опубликована', 'ok');
    if (S.selectedId === mode.slug) loadModeNews(modeById(mode.slug));
  } catch (err) {
    showPublisherError('pub-news-error', String(err || 'Не удалось опубликовать новость'));
  } finally {
    button.disabled = false;
    button.textContent = 'Опубликовать';
  }
}

export async function submitPublisherRelease() {
  const mode = S.publisherReleaseMode;
  if (!mode) return;
  const version = $('pub-release-version').value.trim();
  if (!version) {
    showPublisherError('pub-release-error', 'Укажи версию релиза');
    return;
  }
  const payload = {
    version,
    channel: $('pub-release-channel').value,
    changelog: $('pub-release-changelog').value.trim()
  };

  const button = $('pub-release-submit');
  button.disabled = true;
  button.textContent = 'Создаём…';
  hidePublisherError('pub-release-error');
  try {
    await api.publisherCreateRelease(mode.id, payload);
    $('modal-publisher-release').hidden = true;
    toast(`Релиз ${version} создан`, 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    showPublisherError('pub-release-error', String(err || 'Не удалось создать релиз'));
  } finally {
    button.disabled = false;
    button.textContent = 'Создать релиз';
  }
}

export async function uploadPublisherCover(mode) {
  if (!mode) return;
  let path;
  try {
    path = await api.publisherPickCover();
  } catch (err) {
    toast('Не удалось выбрать обложку: ' + err, 'error');
    return;
  }
  if (!path) return;
  try {
    await api.publisherUploadCover(mode.id, path);
    toast('Обложка обновлена', 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast('Не удалось загрузить обложку: ' + err, 'error');
  }
}

export async function deletePublisherCover(mode) {
  if (!mode) return;
  const ok = await publisherActions.askConfirm(
    'Убрать обложку?',
    `У режима «${mode.title}» не будет обложки.`,
    'Убрать'
  );
  if (!ok) return;
  try {
    await api.publisherDeleteCover(mode.id);
    toast('Обложка удалена', 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast('Не удалось удалить обложку: ' + err, 'error');
  }
}

export async function uploadPublisherScreenshot(mode, release) {
  if (!mode || !release) return;
  let path;
  try {
    path = await api.publisherPickScreenshot();
  } catch (err) {
    toast('Не удалось выбрать скриншот: ' + err, 'error');
    return;
  }
  if (!path) return;
  try {
    await api.publisherUploadScreenshot(release.id, path);
    toast('Скриншот загружен', 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast('Не удалось загрузить скриншот: ' + err, 'error');
  }
}

export async function uploadPublisherBuild(mode, release, folder) {
  if (!mode || !release) return;
  if (S.publisherUpload) {
    toast('Дождитесь окончания текущей загрузки', 'warn');
    return;
  }

  let source;
  try {
    source = folder ? await api.publisherPickFolder() : await api.publisherPickArchive();
  } catch (err) {
    toast('Не удалось выбрать файл: ' + err, 'error');
    return;
  }
  if (!source) return;

  S.publisherUpload = {
    modeId: mode.id,
    releaseId: release.id,
    stage: 'Подготовка сборки',
    percent: 0
  };
  updatePublisherProgress(S.publisherUpload);
  renderPublisher();

  try {
    await api.publisherUploadBuild(mode.id, release.id, release.version, source);
    toast('Сборка загружена', 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast('Не удалось загрузить сборку: ' + err, 'error');
  } finally {
    S.publisherUpload = null;
    updatePublisherProgress(null);
    renderPublisher();
  }
}

export async function submitPublisherReleaseForModeration(mode, release) {
  if (!mode || !release) return;
  const confirmed = await publisherActions.askConfirm(
    'Отправить на модерацию?',
    `Релиз ${release.version} режима «${mode.title}» станет доступен после проверки.`,
    'Отправить'
  );
  if (!confirmed) return;

  try {
    await api.publisherSubmit(release.id);
    toast('Релиз отправлен на модерацию', 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    toast('Не удалось отправить релиз: ' + err, 'error');
  }
}

export function openPublisherAppealModal(mode, release) {
  if (!mode || !release) return;
  S.publisherAppealRelease = { mode, release };
  $('pub-appeal-info').textContent = `${mode.title} · релиз ${release.version}`;
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
    showPublisherError('pub-appeal-error', 'Опиши причину — минимум 10 символов');
    return;
  }
  const button = $('pub-appeal-submit');
  button.disabled = true;
  button.textContent = 'Отправляем…';
  try {
    await api.publisherAppealRelease(context.release.id, message);
    $('modal-publisher-appeal').hidden = true;
    S.publisherAppealRelease = null;
    toast('Апелляция отправлена', 'ok');
    S.publisherLoaded = false;
    await loadPublisher(true);
  } catch (err) {
    showPublisherError('pub-appeal-error', String(err || 'Не удалось отправить апелляцию'));
  } finally {
    button.disabled = false;
    button.textContent = 'Отправить апелляцию';
  }
}

export function onPublisherProgress(payload) {
  if (!S.publisherUpload) return;
  const percent = Math.max(0, Math.min(100, Number(payload && payload.percent) || 0));
  S.publisherUpload = {
    ...S.publisherUpload,
    stage: (payload && payload.stage) || 'Загрузка',
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
  if (stage) stage.textContent = upload.stage || 'Загрузка';
  if (percent) percent.textContent = `${Math.round(upload.percent || 0)}%`;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, upload.percent || 0))}%`;
}

