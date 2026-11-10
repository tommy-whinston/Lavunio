'use strict';

import { api } from './api/client.js';
import { S } from './core/state.js';
import { lavunioLoggedIn, lavunioName, applyLavunioAvatar } from './core/lavunio.js';
import { ownUsername, isOwnUsername, friendByUsername } from './core/social.js';
import { teamRoleLabel } from './core/labels.js';
import { els } from './core/elements.js';
import { formatBytes, formatDateTime, formatDuration, formatPlaytime, formatUpdateDate, renderRichText, stripRichText } from './core/format.js';
import { cardStatus, libraryStateMeta, modeCardHtml, imageSrc, wireImage } from './features/catalog/cards.js';
import { configureCatalogGrid, renderModeGrid } from './features/catalog/grid.js';
import { syncFilterButtons, modePassesFilter, sortCatalog, matchesSearch, filterModes } from './features/catalog/query.js';
import { updateDashboardStats, updateSidebarCounts, renderLibrary } from './features/library/view.js';
import { renderProfile } from './features/profile/view.js';
import { configureProfileActions, openProfile, bindProfileView, uploadLavunioSkin, deleteLavunioSkin } from './features/profile/actions.js';
import { configureSettings, bindSettings, fillSettingsForm, applyRamLimit } from './features/settings/view.js';
import { configureTeams, bindTeams, renderTeams, loadTeams, loadTeamInvitations, openTeamPage } from './features/teams/index.js';
import { configureMessages, loadChatList, renderMessagesList, openChat, sendChatMessage } from './features/messages/view.js';
import { configureDownloads, activeDownloadTask, downloadTaskForMode, enqueueDownload, pumpDownloads, finishDownload, failDownload, pauseDownload, resumeDownload, retryDownload, cancelDownload, removeDownload, clearDownloads, updateDownloadProgress, renderDownloads } from './features/downloads/queue.js';
import { tagPill, renderSpotlight, renderChangelog, updateChangelogToggle, renderTrailer, selectDetailTab, renderSessions } from './features/detail/view.js';
import { LOADER_LABELS, modeStatusMeta, isInstalled, inLibrary, isHiddenMode, isVisibleInLibrary, isUpdate, loaderLabel, modeSub, modeAuthors, cardSub, modeShortDescription, modeFullDescription, modeTags, sortByTitle, sortModes, modeById, modeInstalledAt, modePlaytime, modeReleaseDate, latestUpdateEntry, modeUpdatedAt, computeAction } from './core/modes.js';
import { parseDownloadSize } from './core/units.js';

import { $, escapeHtml } from './core/dom.js';
import { toast } from './ui/toast.js';
import { initCustomSelects, closeSelectMenu, syncSelectLabels } from './ui/select.js';
import { initAutoGrowTextareas, growAllTextareas } from './ui/textarea.js';

// WebView2 показывает своё меню (назад, сохранить как, печать) — в лаунчере оно не нужно.
document.addEventListener('contextmenu', (event) => event.preventDefault());

const SPLASH_START = performance.now();
let lastUpdateCheckAt = 0;



// ---------------------------------------------------------------- init

configureCatalogGrid({
  openCardContext,
  handleCardAction,
  closeCardMenus,
  startMode,
  openDetail,
  updateCardProgress
});

configureDownloads({
  updateCardProgress,
  renderStore,
  renderLibrary,
  renderDetail,
  updateDetailAction
});

configureMessages({
  showView,
  loadFriends,
  loadTeams
});

configureProfileActions({
  showView,
  loadFriends,
  openModal,
  showSection,
  openChat,
  openTeamPage,
  openDetail,
  askConfirm,
  logoutLavunio,
  renderAccountChip,
  renderLavunioPane,
  respondFriendRequest
});

configureSettings({ closeModals });

configureTeams({
  openDetail,
  publisherAllowed,
  openModal,
  askConfirm
});

init();

async function init() {
  if (api && api.windowSplash) api.windowSplash().catch(() => {});
  bindWindowButtons();
  bindModals();
  bindSidebar();
  bindStore();
  bindCatalogControls();
  bindDetail();
  bindSettings();
  bindAccountModal();
  bindPublisher();
  bindTeams();
  bindSocial();
  bindModeration();
  bindUpdateModal();
  initCustomSelects();
  initAutoGrowTextareas();
  window.addEventListener('focus', () => checkUpdateInBackground());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpdateInBackground();
  });
  setInterval(() => checkUpdateInBackground(true), 30 * 60 * 1000);
  document.addEventListener('lavunio:lang', () => {
    renderAccountChip();
    renderStore();
    renderLibrary();
    if (S.section === 'detail' && S.selectedId) renderDetail();
    else renderCurrentSection();
    if (!$('modal-account').hidden) renderLavunioPane();
    if (!$('modal-settings').hidden) fillSettingsForm();
  });

  if (api && api.onGameEvent) api.onGameEvent(onGameEvent);
  if (api && api.getSystemRam) {
    api.getSystemRam().then((gb) => {
      S.systemRamGb = Number(gb) || 0;
      applyRamLimit();
    }).catch(() => {});
  }

  renderStore();
  renderLibrary();
  updateSidebar();
  if (els.splashSub) els.splashSub.textContent = 'Загружаем режимы и аккаунт…';

  const startupUpdate = checkLauncherUpdate();

  try {
    const [cachedModes, state, settings, lavunio] = await Promise.all([
      api.getCachedModes ? api.getCachedModes() : Promise.resolve([]),
      api.getState(),
      api.getSettings(),
      api.lavunioStatus ? api.lavunioStatus().catch(() => null) : Promise.resolve(null)
    ]);
    let modes = Array.isArray(cachedModes) ? cachedModes : [];
    if (!modes.length) {
      try {
        modes = await api.getModes();
      } catch (_) {
        modes = [];
      }
    }
    S.modes = Array.isArray(modes) ? modes : [];
    S.state = state || {};
    S.settings = settings || null;
    S.lavunio = lavunio || null;
    if (settings && settings.lang && window.I18n) {
      window.I18n.setLang(settings.lang, { announce: false });
    }
    S.loading = false;
    renderAccountChip();
    updatePublisherNav();
    loadFollows();
    loadStoreNews();
    renderStore();
    renderLibrary();
    updateSidebar();
    heartbeatPresence();
    loadNotifications();
    requestAnimationFrame(() => { $('app').scrollTop = 0; });

    if (S.modes.length) {
      api.refreshModes().then((fresh) => {
        if (!Array.isArray(fresh) || !fresh.length) return;
        S.modes = fresh;
        renderStore();
        renderLibrary();
        updateSidebar();
        setTimeout(notifyModeUpdates, 1800);
      }).catch(() => {});
    }

    await handleStartupUpdate(startupUpdate);
  } catch (err) {
    S.loading = false;
    renderStore();
    renderLibrary();
    await finishStartup();
    toast('Не удалось загрузить данные: ' + err, 'error');
  }

  const openParam = new URLSearchParams(location.search).get('open');
  if (openParam && $('modal-' + openParam)) openModal('modal-' + openParam);
}

let splashFinished = false;
function finishSplash() {
  if (splashFinished || S.autoUpdating) return;
  splashFinished = true;
  const elapsed = performance.now() - SPLASH_START;
  const wait = Math.max(0, 680 - elapsed);
  setTimeout(() => {
    if (!els.splash) return;
    if (els.splashBar) {
      els.splashBar.style.animation = 'none';
      els.splashBar.style.width = '100%';
    }
    setTimeout(() => {
      if (!els.splash) return;
      els.splash.classList.add('done');
      setTimeout(() => {
        if (els.splash) els.splash.remove();
      }, 420);
    }, 180);
  }, wait);
}

setTimeout(() => {
  if (!S.autoUpdating) finishStartup();
}, 12000);

// ---------------------------------------------------------------- окно

function bindWindowButtons() {
  $('btn-min').onclick = () => api.minimize();
  $('btn-max').onclick = () => api.toggleMaximize().catch(() => {});
  $('btn-close').onclick = () => api.hide();
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'F11') return;
    event.preventDefault();
    api.toggleFullscreen().catch(() => {});
  });
}

// ---------------------------------------------------------------- store

function bindCatalogControls() {
  const bind = (container, attr, key, render) => {
    if (!container) return;
    container.querySelectorAll(`[data-${attr}]`).forEach((button) => {
      button.onclick = () => {
        S[key] = button.getAttribute(`data-${attr}`);
        render();
      };
    });
  };
  bind(els.storeFilters, 'store-filter', 'storeFilter', renderStore);
  bind(els.libraryFilters, 'library-filter', 'libraryFilter', renderLibrary);
  if (els.storeSort) {
    els.storeSort.onchange = () => {
      S.storeSort = els.storeSort.value;
      renderStore();
    };
  }
  if (els.librarySort) {
    els.librarySort.onchange = () => {
      S.librarySort = els.librarySort.value;
      renderLibrary();
    };
  }
  if (els.libraryUpdateAll) {
    els.libraryUpdateAll.onclick = () => updateAllModes();
  }
  if (els.libraryUpdateLater) {
    els.libraryUpdateLater.onclick = () => {
      S.updatesSnoozed = true;
      renderLibrary();
    };
  }
}

function bindStore() {
  els.featuredOpen.onclick = () => {
    if (S.featuredId) openDetail(S.featuredId);
  };

  els.search.addEventListener('input', () => {
    S.search = els.search.value.trim().toLowerCase();
    if (S.view === 'detail') {
      S.detailFrom = null;
      showSection(S.section);
    } else {
      renderCurrentSection();
    }
  });

  els.refresh.onclick = async () => {
    if (S.refreshing) return;
    S.refreshing = true;
    els.refresh.classList.add('spinning');
    try {
      const modes = await api.refreshModes();
      S.modes = Array.isArray(modes) ? modes : [];
      S.state = (await api.getState()) || {};
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId) renderDetail();
      toast('Список режимов обновлён', 'ok');
    } catch (err) {
      toast('Не удалось обновить список: ' + err, 'error');
    } finally {
      S.refreshing = false;
      els.refresh.classList.remove('spinning');
    }
  };

  document.addEventListener('click', (e) => {
    closeCardContext();
    if (!e.target.closest('.card-menu') && !e.target.closest('.card-menu-btn')) closeCardMenus();
  });
  window.addEventListener('focus', () => {
    if (S.lavunio && (S.lavunio.hasSession || S.lavunio.user)) refreshLavunioStatus();
  });
  const appScroll = $('app');
  if (appScroll) appScroll.addEventListener('scroll', closeCardContext, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (els.cardContext && !els.cardContext.hidden) {
        closeCardContext();
        e.preventDefault();
        return;
      }
      if (!document.querySelector('.modal-overlay:not([hidden])')) {
        if (S.view === 'detail') {
          showStore();
        } else if (S.search) {
          els.search.value = '';
          S.search = '';
          renderCurrentSection();
        }
      }
    }
  });
}

function bindSidebar() {
  document.querySelectorAll('.side-link').forEach((btn) => {
    btn.onclick = () => {
      S.detailFrom = null;
      showSection(btn.dataset.section);
    };
  });
  if (els.sidebarProfile) {
    els.sidebarProfile.onclick = () => {
      const user = S.lavunio && S.lavunio.user;
      if (user) openProfile(user.username);
      else {
        S.profileAfterLogin = true;
        openModal('modal-account');
      }
    };
  }
  if (els.sidebarMessages) {
    els.sidebarMessages.onclick = (event) => {
      event.stopPropagation();
      showSection('messages');
    };
  }
  if (els.sidebarSettings) {
    els.sidebarSettings.onclick = (event) => {
      event.stopPropagation();
      openModal('modal-settings');
    };
  }
  bindProfileView();
}

const PRIMARY_SECTIONS = new Set(['store', 'library', 'publisher', 'team', 'moderation', 'profile', 'messages']);

function showView(section) {
  S.section = section;
  S.view = section;
  els.storeView.hidden = section !== 'store';
  els.libraryView.hidden = section !== 'library';
  if (els.publisherView) els.publisherView.hidden = section !== 'publisher';
  if (els.teamView) els.teamView.hidden = section !== 'team';
  if (els.moderationView) els.moderationView.hidden = section !== 'moderation';
  if (els.profileView) els.profileView.hidden = section !== 'profile';
  if (els.messagesView) els.messagesView.hidden = section !== 'messages';
  els.detailView.hidden = true;
  if (section !== 'messages' && S.chatTimer) {
    clearInterval(S.chatTimer);
    S.chatTimer = null;
  }
  updateSidebar();
  const app = $('app');
  if (app) app.scrollTop = 0;
}

function showSection(section) {
  if (section === 'publisher' && !publisherAllowed()) section = 'store';
  if (section === 'team' && !publisherAllowed()) section = 'store';
  if (section === 'moderation' && !moderatorAllowed()) section = 'store';
  if ((section === 'profile' || section === 'messages') && !lavunioLoggedIn()) {
    S.profileAfterLogin = section === 'profile';
    openModal('modal-account');
    section = 'store';
  }
  if (!PRIMARY_SECTIONS.has(section)) section = 'store';

  if (section === 'profile') {
    const target = S.profileUsername || (S.lavunio && S.lavunio.user && S.lavunio.user.username);
    if (!target) {
      openModal('modal-account');
      return;
    }
    openProfile(target);
    return;
  }

  showView(section);
  if (section === 'library') renderLibrary();
  else if (section === 'publisher') {
    renderPublisher();
    loadPublisher();
  } else if (section === 'team') {
    renderTeams();
    loadTeams();
    loadTeamInvitations();
  } else if (section === 'moderation') {
    renderModeration();
    loadModeration();
  } else if (section === 'messages') {
    loadChatList();
  } else renderStore();
  const app = $('app');
  if (app) app.scrollTop = 0;
}

function updateSidebar() {
  document.querySelectorAll('.side-link').forEach((btn) => {
    const active = btn.dataset.section === S.section;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  const profileCard = $('sidebar-profile-card');
  if (profileCard) profileCard.classList.toggle('active', S.section === 'profile');
  if (els.sidebarMessages) els.sidebarMessages.classList.toggle('active', S.section === 'messages');
  updatePublisherNav();
  updateModerationNav();
  updateSocialNav();
  updateSideGroups();
}

function updateSideGroups() {
  document.querySelectorAll('.side-group').forEach((group) => {
    const links = [...group.querySelectorAll('.side-link')];
    if (!links.length) return;
    group.hidden = links.every((link) => link.hidden);
  });
}

function renderCurrentSection() {
  if (S.section === 'library') renderLibrary();
  else if (S.section === 'publisher') renderPublisher();
  else if (S.section === 'team') renderTeams();
  else if (S.section === 'moderation') renderModeration();
  else if (S.section === 'profile') {
    if (S.playerProfile) renderProfile(S.playerProfile);
    else if (S.profileUsername) openProfile(S.profileUsername);
  } else if (S.section === 'messages') renderMessagesList();
  else renderStore();
}

function renderStore() {
  if (!els.storeView) return;

  const searchActive = !!S.search;

  if (S.loading) {
    els.featured.hidden = true;
    if (els.feed) {
      els.feed.hidden = true;
      els.feedList.innerHTML = '';
    }
    if (els.storeNews) {
      els.storeNews.hidden = true;
      els.storeNewsList.innerHTML = '';
    }
    els.catalogTitle.textContent = 'Загрузка';
    els.modesCount.textContent = '';
    els.modesGrid.innerHTML = '';
    els.emptyState.hidden = true;
    els.loadingState.hidden = false;
    updateSidebarCounts();
    return;
  }
  els.loadingState.hidden = true;
  updateDashboardStats();
  syncFilterButtons(els.storeFilters, 'store-filter', S.storeFilter);

  if (searchActive) {
    els.featured.hidden = true;
    if (els.feed) {
      els.feed.hidden = true;
    }
    if (els.storeNews) {
      els.storeNews.hidden = true;
    }
    const result = sortCatalog(filterModes().filter((mode) => modePassesFilter(mode, S.storeFilter)), S.storeSort);
    els.catalogTitle.textContent = 'Результаты поиска';
    els.modesCount.textContent = String(result.length);
    renderModeGrid(els.modesGrid, result, true);
    setEmpty(
      result.length === 0,
      'Ничего не найдено',
      'Попробуй изменить запрос или выбрать другой фильтр'
    );
    return;
  }

  const featured = S.modes.find((m) => m.imageUrl || m.image) || S.modes[0] || null;
  S.featuredId = featured ? featured.id : null;
  renderFeatured(featured);
  renderFeed();
  renderStoreNews();

  const list = sortCatalog(
    S.modes.filter((mode) => modePassesFilter(mode, S.storeFilter)),
    S.storeSort
  );
  const titles = {
    all: 'Все режимы',
    installed: 'Установленные',
    following: 'Подписки',
    development: 'В разработке',
    crowdfunding: 'Сбор на релиз'
  };
  els.catalogTitle.textContent = titles[S.storeFilter] || 'Все режимы';
  els.modesCount.textContent = String(list.length);
  renderModeGrid(els.modesGrid, list, true);
  setEmpty(
    list.length === 0,
    'Здесь пока пусто',
    'Попробуй другой фильтр или нажми «Обновить»'
  );
  updateSidebarCounts();
}

function updateAllModes() {
  const updates = S.modes.filter((mode) => isUpdate(mode));
  if (!updates.length) {
    toast('Обновлений нет', 'info');
    return;
  }
  updates.forEach((mode) => enqueueDownload(mode, 'update', false, true));
  toast(`В очередь добавлено обновлений: ${updates.length}`, 'ok');
}

let modeUpdatesNotified = false;
function notifyModeUpdates() {
  if (modeUpdatesNotified || S.updatesSnoozed) return;
  const count = S.modes.filter((mode) => isUpdate(mode)).length;
  if (!count) return;
  modeUpdatesNotified = true;
  toast(`Доступны обновления режимов: ${count}. Открой Библиотеку.`, 'warn');
}

function renderFeatured(mode) {
  if (!mode) {
    els.featured.hidden = true;
    return;
  }
  els.featured.hidden = false;
  els.featuredImg.src = imageSrc(mode);
  wireImage(els.featuredImg, mode);
  els.featuredTitle.textContent = mode.title || 'Без названия';
  els.featuredDesc.textContent = modeShortDescription(mode);
  els.featuredTags.innerHTML = modeTags(mode, 4)
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join('');
  const st = cardStatus(mode);
  els.featuredStatus.textContent = st.text;
}

let followsRequestSeq = 0;

async function loadFollows() {
  const seq = ++followsRequestSeq;
  if (!lavunioLoggedIn() || !api.followsGet || !api.feedGet) {
    S.follows = [];
    S.feed = [];
    renderFeed();
    return;
  }
  let follows = [];
  let feed = [];
  try {
    [follows, feed] = await Promise.all([api.followsGet(), api.feedGet()]);
  } catch (_) {}
  if (seq !== followsRequestSeq) return;
  S.follows = Array.isArray(follows)
    ? follows.map((item) => item && item.username).filter(Boolean)
    : [];
  S.feed = Array.isArray(feed) ? feed : [];
  renderFeed();
  renderStore();
  if (S.view === 'detail') renderDetail();
}

function renderFeed() {
  if (!els.feed || !els.feedList) return;
  if (S.loading || S.view !== 'store' || S.search || S.storeFilter !== 'all' || !S.feed.length) {
    els.feed.hidden = true;
    els.feedList.innerHTML = '';
    return;
  }
  els.feed.hidden = false;
  els.feedList.innerHTML = S.feed.map((item) => {
    const date = item.publishedAt ? publisherDate(item.publishedAt) : '';
    const changelog = String(item.changelog || '').split('\n')[0].slice(0, 180);
    return `
      <button class="feed-item" type="button" data-feed-slug="${escapeHtml(item.modeSlug)}">
        ${item.coverUrl
          ? `<img src="${escapeHtml(item.coverUrl)}" alt="" loading="lazy">`
          : '<span class="feed-cover"></span>'}
        <span class="feed-body">
          <span class="feed-title">${escapeHtml(item.modeTitle || item.modeSlug)} <span class="feed-version">v${escapeHtml(item.version || '')}</span></span>
          <span class="feed-sub">${escapeHtml(item.authorName || item.authorUsername || '')}${date ? ' · ' + escapeHtml(date) : ''}</span>
          ${changelog ? `<span class="feed-text">${escapeHtml(changelog)}</span>` : ''}
        </span>
        <span class="feed-arrow">›</span>
      </button>`;
  }).join('');
  els.feedList.onclick = (event) => {
    const item = event.target.closest('[data-feed-slug]');
    if (item) openDetail(item.dataset.feedSlug);
  };
}

let storeNewsLoaded = false;

async function loadStoreNews(force = false) {
  if (!api.newsStore) return;
  if (storeNewsLoaded && !force) return;
  try {
    const items = await api.newsStore();
    S.storeNews = Array.isArray(items) ? items : [];
    storeNewsLoaded = true;
  } catch (_) {
    S.storeNews = [];
  }
  renderStoreNews();
  if (S.moderationTab === 'news' && moderatorAllowed()) renderModeration();
}

function newsCardHtml(item) {
  return `
    <article class="news-card">
      <div class="news-head">
        <div class="news-title">${escapeHtml(item.title || 'Новость')}</div>
        <span class="news-date">${escapeHtml(publisherDate(item.createdAt))}</span>
      </div>
      <div class="news-body">${escapeHtml(item.body || '')}</div>
      <div class="news-author">${escapeHtml(item.authorName || item.authorUsername || 'Lavunio')}</div>
    </article>`;
}

function renderStoreNews() {
  if (!els.storeNews || !els.storeNewsList) return;
  if (S.loading || S.search || !S.storeNews.length) {
    els.storeNews.hidden = true;
    els.storeNewsList.innerHTML = '';
    return;
  }
  els.storeNews.hidden = false;
  els.storeNewsList.innerHTML = S.storeNews.slice(0, 5).map(newsCardHtml).join('');
}

async function loadModeNews(mode) {
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

function renderModeNews(mode) {
  if (!els.detailNewsSection || !els.detailNewsList) return;
  const items = (S.modeNews[mode.id] || []).slice(0, 6);
  els.detailNewsSection.hidden = items.length === 0;
  els.detailNewsList.innerHTML = items.map(newsCardHtml).join('');
}

function updateCardProgress() {
  document.querySelectorAll('[data-card-progress]').forEach((bar) => {
    const card = bar.closest('.mode-card');
    if (!card) return;
    const mode = modeById(card.dataset.id);
    if (mode) {
      const meta = libraryStateMeta(mode);
      const state = card.querySelector('[data-card-state]');
      if (state) {
        state.className = `card-state state-${meta.cls}`;
        state.textContent = meta.label;
      }
      const play = card.querySelector('.card-play');
      if (play) {
        play.disabled = !!meta.busy;
        play.dataset.cardAction = meta.action;
      }
    }
    const active = !!(S.busy && S.busy.modeId === card.dataset.id);
    bar.hidden = !active;
    if (!active) return;
    const percent = Math.max(0, Math.min(100, Math.round((Number(S.progress) || 0) * 100)));
    bar.setAttribute('aria-valuenow', String(percent));
    const fill = bar.querySelector('span');
    if (fill) fill.style.width = `${percent}%`;
  });
}

function closeCardMenus() {
  document.querySelectorAll('.card-menu:not([hidden])').forEach((menu) => {
    menu.hidden = true;
  });
}

async function handleCardAction(modeId, action, autoPlay = false) {
  closeCardMenus();
  closeCardContext();
  const mode = modeById(modeId);
  if (!mode) return;

  if (action === 'play') {
    await startMode(mode, autoPlay);
    return;
  }

  if (action === 'stop') {
    try {
      await api.stopGame();
      S.status = 'Закрываю игру…';
      toast('Закрываю игру…', 'info');
    } catch (err) {
      toast('Не удалось закрыть игру: ' + err, 'error');
    }
    return;
  }

  if (action === 'page') {
    openDetail(modeId);
    return;
  }

  if (action === 'addlib') {
    try {
      const res = await api.setLibrary(modeId, true);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Ошибка');
      const st = S.state[modeId] || { installed: false, version: null, installedAt: 0 };
      S.state[modeId] = { ...st, library: true, hidden: false };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast('Режим добавлен в библиотеку', 'ok');
    } catch (err) {
      toast('Не удалось добавить режим: ' + err, 'error');
    }
    return;
  }

  if (action === 'folder') {
    try {
      await api.openModeFolder(modeId);
    } catch (err) {
      toast('Не удалось открыть папку: ' + err, 'error');
    }
    return;
  }

  if (action === 'hide' || action === 'unhide') {
    const hidden = action === 'hide';
    try {
      const res = await api.setHidden(modeId, hidden);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Ошибка');
      const st = S.state[modeId] || { installed: false, version: null, installedAt: 0 };
      S.state[modeId] = { ...st, hidden, library: true };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast(hidden ? 'Режим скрыт' : 'Режим возвращён в библиотеку', 'ok');
    } catch (err) {
      toast((hidden ? 'Не удалось скрыть режим: ' : 'Не удалось вернуть режим: ') + err, 'error');
    }
    return;
  }

  if (action === 'removelib') {
    try {
      const res = await api.setLibrary(modeId, false);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Ошибка');
      const st = S.state[modeId] || { installed: false, version: null, installedAt: 0 };
      S.state[modeId] = { ...st, library: false, hidden: false };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast('Режим удалён из библиотеки', 'ok');
    } catch (err) {
      toast('Не удалось удалить режим из библиотеки: ' + err, 'error');
    }
    return;
  }

  if (action === 'uninstall') {
    if (!(await askConfirm(
      'Удалить режим?',
      `Удалить режим «${mode.title}» с устройства? Файлы сборки будут удалены.`,
      'Удалить с устройства'
    ))) return;
    try {
      const res = await api.uninstall(modeId);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Ошибка');
      const st = S.state[modeId] || { library: true, hidden: false };
      S.state[modeId] = { ...st, installed: false, version: null, installedAt: 0 };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast('Режим удалён с устройства', 'ok');
    } catch (err) {
      toast('Не удалось удалить режим: ' + err, 'error');
    }
  }
}

function setEmpty(show, title, sub) {
  els.emptyState.hidden = !show;
  if (show) {
    els.emptyTitle.textContent = title;
    els.emptySub.textContent = sub;
  }
}

// ---------------------------------------------------------------- detail

function bindDetail() {
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
      toast('Не удалось открыть папку: ' + err, 'error');
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
    openModal('modal-gallery');
  };
  els.detailAuthorModes.onclick = () => {
    const name = els.detailAuthorName.textContent.trim();
    if (!name) return;
    S.selectedId = null;
    S.detailFrom = null;
    els.search.value = name;
    S.search = name.toLowerCase();
    showSection('store');
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
      S.status = 'Закрываю игру…';
      toast('Закрываю игру…', 'info');
      return;
    }
    const action = computeAction(mode);
    if (action === 'running') return;
    if (action === 'add') {
      try {
        const res = await api.setLibrary(mode.id, true);
        if (!res || !res.ok) throw new Error((res && res.error) || 'Ошибка');
        const st = S.state[mode.id] || { installed: false, version: null, installedAt: 0 };
        S.state[mode.id] = { ...st, library: true, hidden: false };
        renderStore();
        renderLibrary();
        renderDetail();
        toast('Режим добавлен в библиотеку', 'ok');
      } catch (err) {
        toast('Не удалось добавить режим: ' + err, 'error');
      }
      return;
    }
    if (!lavunioLoggedIn()) {
      openModal('modal-account');
      toast('Сначала войдите в Lavunio ID', 'warn');
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
  els.detailVerify.textContent = 'Проверяем…';
  try {
    const report = await api.verify(mode.id);
    if (!report) throw new Error('Пустой ответ проверки');
    if (report.ok) {
      toast(`Файлы в порядке · проверено ${Number(report.checked) || 0}`, 'ok');
      return;
    }
    const message = `Отсутствует файлов: ${Number(report.missing) || 0}, повреждено: ${Number(report.corrupted) || 0}.`;
    const fix = await askConfirm(
      'Файлы повреждены',
      `${message} Исправить установку?`,
      'Исправить'
    );
    if (fix) await repairMode(mode);
  } catch (err) {
    toast('Не удалось проверить файлы: ' + err, 'error');
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
    toast('Исправление добавлено в очередь', 'info');
  } catch (err) {
    toast('Не удалось запустить исправление: ' + err, 'error');
  }
}

async function startMode(mode, autoPlay = false) {
  if (!mode) return;
  if (S.running === mode.id) return;
  let action = computeAction(mode);
  if (action === 'running') return;
  if (action === 'add') {
    try {
      const res = await api.setLibrary(mode.id, true);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Ошибка');
      const st = S.state[mode.id] || { installed: false, version: null, installedAt: 0 };
      S.state[mode.id] = { ...st, library: true, hidden: false };
      renderStore();
      renderLibrary();
      toast('Режим добавлен в библиотеку', 'ok');
    } catch (err) {
      toast('Не удалось добавить режим: ' + err, 'error');
    }
    return;
  }
  if (!lavunioLoggedIn()) {
    openModal('modal-account');
    toast('Сначала войдите в Lavunio ID', 'warn');
    return;
  }

  if (action === 'play') {
    enqueueDownload(mode, 'play');
    return;
  }
  enqueueDownload(mode, action, autoPlay);
}

function closeCardContext() {
  if (els.cardContext) els.cardContext.hidden = true;
}

function openCardContext(card, x, y, playMode) {
  if (!els.cardContext) return;
  const mode = modeById(card.dataset.id);
  if (!mode) return;
  const action = computeAction(mode);
  const installed = isInstalled(mode);
  const inLib = inLibrary(mode);
  const actions = [];

  if (action === 'running') {
    actions.push({ action: 'stop', label: 'Закрыть игру', primary: true, danger: true });
  } else {
    const label = action === 'update'
      ? 'Обновить'
      : action === 'play'
        ? 'Играть'
        : action === 'add'
          ? 'Добавить в библиотеку'
          : 'Установить';
    actions.push({ action: 'play', label, primary: true });
  }

  if (playMode) actions.push({ action: 'page', label: 'Страница режима' });
  if (installed) actions.push({ action: 'folder', label: 'Открыть папку' });
  if (isHiddenMode(mode)) {
    actions.push({ action: 'unhide', label: 'Вернуть в библиотеку' });
    actions.push({ action: 'removelib', label: 'Удалить из библиотеки' });
  } else if (inLib) {
    actions.push({ action: 'removelib', label: 'Удалить из библиотеки' });
    actions.push({ action: 'hide', label: 'Скрыть' });
  }
  if (installed && action !== 'running') {
    actions.push({ action: 'uninstall', label: 'Удалить с устройства', danger: true });
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
    handleCardAction(mode.id, button.dataset.contextAction, playMode);
  };
}

function openDetail(id) {
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
    ? 'Назад в библиотеку'
    : S.detailFrom === 'profile' ? 'Назад в профиль'
      : 'Назад в каталог';
  renderDetail();
  $('app').scrollTop = 0;
}

function showStore() {
  S.selectedId = null;
  const section = S.detailFrom || S.section || 'store';
  S.detailFrom = null;
  showSection(section);
}

function actionLabel(action) {
  return {
    add: 'Добавить в библиотеку',
    install: 'Установить',
    update: 'Обновить',
    play: 'Играть',
    running: 'В игре'
  }[action] || 'Установить';
}

function defaultStatus(mode) {
  if (S.running === mode.id) return 'Игра запущена';
  if (!inLibrary(mode)) return 'Сначала добавь режим в библиотеку';
  if (isUpdate(mode)) return 'Доступно обновление';
  if (isInstalled(mode)) return 'Готов к запуску';
  return 'Файлы ещё не скачаны';
}

function renderDetail() {
  const mode = modeById(S.selectedId);
  if (!mode) {
    showStore();
    return;
  }

  els.detailImg.src = imageSrc(mode);
  wireImage(els.detailImg, mode);
  els.detailTitle.textContent = mode.title || 'Без названия';
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
    ['Версия', 'v' + (mode.version || '—')],
    ['Minecraft', mode.mcVersion || '—'],
    ['Ядро', loaderLabel(mode)],
    ['Размер', mode.size || '—'],
    ['Рейтинг', mode.rating ? `${Number(mode.rating).toFixed(1)} ★ (${Number(mode.reviewsCount) || 0})` : '—'],
    ['Установки', String(Number(mode.installs) || 0)],
    ['Вышла', released ? formatUpdateDate(released) : '—'],
    ['Обновлено', updated]
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
    els.detailAuthorSub.textContent = author && author.verified ? 'Проверенный автор' : 'Автор режима';
    const avatar = els.detailAuthorAvatar;
    avatar.textContent = authorName[0].toUpperCase();
    avatar.style.backgroundImage = author && author.avatar ? `url("${author.avatar}")` : '';
  }
  const canFollow = !!(apiReady && author && author.id && S.lavunio.user && S.lavunio.user.username !== author.id);
  els.detailAuthorFollow.hidden = !canFollow;
  if (els.detailAuthorProfile) els.detailAuthorProfile.hidden = !(author && author.username);
  if (canFollow) {
    const following = S.follows.includes(author.id);
    els.detailAuthorFollow.textContent = following ? 'Вы подписаны' : 'Подписаться';
    els.detailAuthorFollow.classList.toggle('active', following);
  }
  if (els.detailTeam) {
    const team = mode.team;
    els.detailTeam.hidden = !team;
    if (team) els.detailTeam.textContent = `Команда: ${team.title}${team.verified ? ' ✓' : ''}`;
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
    openModal('modal-account');
    toast('Сначала войдите в Lavunio ID', 'warn');
    return;
  }
  if (S.lavunio.user && S.lavunio.user.username === author.id) {
    toast('Нельзя подписаться на себя', 'warn');
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
    toast(following ? 'Вы отписались от автора' : 'Вы подписались на автора', 'ok');
  } catch (err) {
    toast('Не удалось обновить подписку: ' + err, 'error');
  }
}

function openReportModal(mode) {
  if (!mode) return;
  if (!lavunioLoggedIn()) {
    openModal('modal-account');
    toast('Сначала войдите в Lavunio ID', 'warn');
    return;
  }
  S.reportModeId = mode.id;
  els.reportTarget.textContent = `${mode.title} · ${mode.id}`;
  els.reportReason.value = '';
  els.reportError.hidden = true;
  openModal('modal-report');
  setTimeout(() => els.reportReason.focus(), 50);
}

async function submitReport() {
  const mode = modeById(S.reportModeId);
  if (!mode) return;
  const reason = els.reportReason.value.trim();
  if (reason.length < 3) {
    els.reportError.textContent = 'Опиши причину жалобы';
    els.reportError.hidden = false;
    return;
  }
  const button = els.reportSubmit;
  button.disabled = true;
  els.reportError.hidden = true;
  try {
    await api.reportMode(mode.id, reason);
    $('modal-report').hidden = true;
    toast('Жалоба отправлена', 'ok');
  } catch (err) {
    els.reportError.textContent = String(err || 'Не удалось отправить жалобу');
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
      renderStore();
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
    ? `${average.toFixed(1)} ★ · ${count} отзывов`
    : 'Отзывов пока нет';

  if (!items.length) {
    els.reviewsList.innerHTML = '<div class="hint">Стань первым, кто оставит отзыв.</div>';
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
            <span class="review-author">${escapeHtml(item.authorName || item.authorUsername || 'Игрок')}</span>
            <span class="review-stars">${reviewStarsText(item.rating)}</span>
            <span class="review-date">${escapeHtml(publisherDate(item.createdAt))}</span>
          </div>
          ${item.text ? `<div class="review-text">${escapeHtml(item.text)}</div>` : ''}
          ${item.authorReply ? `
            <div class="review-reply">
              <div class="review-reply-label">Ответ автора</div>
              <div class="review-reply-text">${escapeHtml(item.authorReply)}</div>
            </div>` : ''}
          <div class="review-actions">
            ${canReply ? `<button class="link link-btn" type="button" data-review-reply="${escapeHtml(item.id)}">${item.authorReply ? 'Изменить ответ' : 'Ответить'}</button>` : ''}
            ${own ? `<button class="link link-btn review-delete" type="button" data-review-delete="${escapeHtml(mode.id)}">Удалить мой отзыв</button>` : ''}
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
    openModal('modal-account');
    toast('Сначала войдите в Lavunio ID', 'warn');
    return;
  }
  const text = els.reviewText.value.trim();
  const error = els.reviewError;
  if (text.length > 2000) {
    error.textContent = 'Отзыв должен быть не длиннее 2000 символов';
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
    renderStore();
    toast(data && data.pending ? 'Отзыв отправлен на модерацию' : 'Отзыв сохранён', 'ok');
  } catch (err) {
    error.textContent = String(err || 'Не удалось сохранить отзыв');
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
  $('review-reply-target').textContent = `${mode.title} · ${item.authorName || item.authorUsername || 'игрок'}`;
  $('review-reply-text').value = item.authorReply || '';
  $('review-reply-error').hidden = true;
  openModal('modal-review-reply');
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
    error.textContent = 'Напиши текст ответа';
    error.hidden = false;
    return;
  }
  const button = $('review-reply-submit');
  button.disabled = true;
  button.textContent = 'Отправляем…';
  error.hidden = true;
  try {
    await api.reviewReply(mode.id, target.reviewId, text);
    $('modal-review-reply').hidden = true;
    delete S.reviews[mode.id];
    await loadReviews(mode);
    toast('Ответ опубликован', 'ok');
  } catch (err) {
    error.textContent = String(err || 'Не удалось отправить ответ');
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Отправить ответ';
  }
}

async function deleteReview(modeId) {
  const mode = modeById(modeId);
  if (!mode) return;
  const ok = await askConfirm('Удалить отзыв?', 'Твой отзыв будет удалён.', 'Удалить');
  if (!ok) return;
  try {
    await api.reviewDelete(modeId);
    delete S.reviews[modeId];
    mode.rating = null;
    mode.reviewsCount = 0;
    await loadReviews(mode);
    if (S.view === 'detail') renderDetail();
    renderStore();
    toast('Отзыв удалён', 'ok');
  } catch (err) {
    toast('Не удалось удалить отзыв: ' + err, 'error');
  }
}

function updateDetailAction() {
  if (S.view !== 'detail') return;
  const mode = modeById(S.selectedId);
  if (!mode) return;
  if (els.detailDefer) els.detailDefer.hidden = true;

  const task = downloadTaskForMode(mode.id);
  if (task && task.status === 'queued') {
    els.detailAction.textContent = 'Отменить';
    els.detailAction.className = 'btn btn-danger btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = 'В очереди';
    els.detailProgress.hidden = true;
    return;
  }
  if (task && task.status === 'paused') {
    els.detailAction.textContent = 'Продолжить';
    els.detailAction.className = 'btn btn-primary btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = 'Загрузка на паузе';
    els.detailProgress.hidden = false;
    els.detailProgressBar.style.width = Math.max(0, Math.min(100, task.progress * 100)) + '%';
    return;
  }

  const busyHere = !!(S.busy && S.busy.modeId === mode.id);
  if (busyHere) {
    els.detailAction.textContent = 'Отмена';
    els.detailAction.className = 'btn btn-danger btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = S.status || 'Подготовка…';
    els.detailProgress.hidden = false;
    els.detailProgressBar.style.width = Math.max(0, Math.min(100, S.progress * 100)) + '%';
    return;
  }

  const action = computeAction(mode);
  if (action === 'running') {
    els.detailAction.textContent = 'Закрыть игру';
    els.detailAction.className = 'btn btn-danger btn-big btn-block';
    els.detailAction.disabled = false;
    els.detailStatus.textContent = 'Игра запущена';
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
    if (res && res.ok === false) throw new Error(res.error || 'Ошибка');
    const st = S.state[mode.id] || { installed: true, version: null, installedAt: 0 };
    S.state[mode.id] = { ...st, skippedVersion: version };
    renderStore();
    renderLibrary();
    updateDetailAction();
    toast('Обновление отложено до следующей версии', 'ok');
  } catch (err) {
    toast('Не удалось отложить обновление: ' + err, 'error');
  }
}

// ---------------------------------------------------------------- события игры

function onGameEvent(ev) {
  if (!ev || !ev.modeId) return;
  const mode = modeById(ev.modeId);
  const isCurrent = S.selectedId === ev.modeId;
  const active = activeDownloadTask();

  switch (ev.type) {
    case 'progress': {
      const p = ev.payload && ev.payload.total
        ? ev.payload.task / ev.payload.total
        : 0;
      S.progress = Math.max(0, Math.min(1, p));
      if (active && active.modeId === ev.modeId) {
        updateDownloadProgress(active, S.progress);
        renderDownloads();
      }
      updateCardProgress();
      if (isCurrent) updateDetailAction();
      break;
    }
    case 'status': {
      S.status = String(ev.payload || '');
      S.stage = S.status;
      if (active && active.modeId === ev.modeId) {
        active.stage = S.status;
        renderDownloads();
      }
      updateCardProgress();
      if (isCurrent) updateDetailAction();
      break;
    }
    case 'installed': {
      const finished = active && active.modeId === ev.modeId ? active : null;
      const shouldPlay = !!(mode && (S.pendingPlay === mode.id || (finished && finished.autoPlay)));
      S.pendingPlay = null;
      S.busy = null;
      S.stage = '';
      S.progress = 1;
      S.status = 'Установлено';
      if (mode) {
        const st = S.state[mode.id] || {};
        S.state[mode.id] = { ...st, installed: true, version: mode.version, installedAt: Date.now(), library: true, hidden: false };
      }
      if (finished) finishDownload(finished.id, 'completed');
      toast('Режим установлен', 'ok');
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && isCurrent) renderDetail();
      if (shouldPlay && mode) setTimeout(() => startMode(mode), 250);
      break;
    }
    case 'launched': {
      const finished = active && active.modeId === ev.modeId ? active : null;
      S.busy = null;
      S.stage = '';
      S.running = ev.modeId;
      S.progress = 1;
      S.status = 'Игра запущена';
      S.sessionStartedAt = Date.now();
      if (api.markLaunched) api.markLaunched(ev.modeId).catch(() => {});
      {
        const st = S.state[ev.modeId] || {};
        S.state[ev.modeId] = { ...st, lastPlayedAt: S.sessionStartedAt };
      }
      if (finished) finishDownload(finished.id, 'completed');
      toast('Игра запущена!', 'ok');
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && isCurrent) renderDetail();
      break;
    }
    case 'played': {
      const seconds = Math.max(0, Math.floor(Number(ev.payload) || 0));
      if (seconds > 0) {
        const st = S.state[ev.modeId] || { installed: false, version: null, installedAt: 0 };
        const endedAt = Date.now();
        const startedAt = S.sessionStartedAt || endedAt - seconds * 1000;
        const sessions = [
          ...(Array.isArray(st.sessions) ? st.sessions : []),
          { startedAt, endedAt, seconds }
        ].slice(-20);
        S.state[ev.modeId] = {
          ...st,
          playtimeSecs: (Number(st.playtimeSecs) || 0) + seconds,
          lastPlayedAt: endedAt,
          sessions
        };
        if (api.addPlaytime) api.addPlaytime(ev.modeId, seconds, startedAt).catch(() => {});
        S.sessionStartedAt = 0;
        if (S.view === 'detail' && isCurrent) renderDetail();
        renderLibrary();
      }
      break;
    }
    case 'exit': {
      S.running = null;
      S.busy = null;
      S.stage = '';
      S.progress = 0;
      S.sessionStartedAt = 0;
      S.status = ev.payload === 0 ? 'Игра закрыта' : `Игра завершилась (код ${ev.payload})`;
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && isCurrent) renderDetail();
      pumpDownloads();
      break;
    }
    case 'cancelled': {
      const finished = active && active.modeId === ev.modeId ? active : null;
      const wasPaused = !!(finished && finished.pauseRequested);
      S.pendingPlay = null;
      S.busy = null;
      S.stage = '';
      S.progress = 0;
      S.status = wasPaused ? 'Пауза' : 'Отменено';
      if (finished) {
        finished.status = wasPaused ? 'paused' : 'cancelled';
        finished.stage = wasPaused ? 'Пауза' : 'Отменено';
        finished.speed = 0;
        finished.eta = 0;
        finished.pauseRequested = false;
        finished.cancelRequested = false;
        S.downloadsActiveId = null;
        renderDownloads();
        pumpDownloads();
      }
      toast(wasPaused ? 'Загрузка приостановлена' : 'Операция отменена', 'warn');
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && isCurrent) renderDetail();
      break;
    }
    case 'error': {
      const finished = active && active.modeId === ev.modeId ? active : null;
      const message = String(ev.payload || 'Ошибка');
      S.pendingPlay = null;
      S.busy = null;
      S.stage = '';
      S.progress = 0;
      if (S.running === ev.modeId) S.running = null;
      S.status = 'Ошибка';
      if (finished) {
        finished.status = 'error';
        finished.stage = 'Ошибка';
        finished.error = message;
        finished.speed = 0;
        finished.eta = 0;
        S.downloadsActiveId = null;
        renderDownloads();
      }
      toast(message, 'error');
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && isCurrent) renderDetail();
      pumpDownloads();
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- обновление лаунчера

function bindUpdateModal() {
  const close = () => {
    $('modal-update').hidden = true;
  };
  $('btn-update-later').onclick = close;
  $('btn-update-later-x').onclick = close;
  els.updateChip.onclick = () => {
    if (!S.updateInfo) return;
    els.updateCurrent.textContent = `v${S.updateInfo.current}`;
    els.updateLatest.textContent = `v${S.updateInfo.latest}`;
    els.updateNotes.textContent = (S.updateInfo.notes || '').trim() || 'Список изменений появится позже.';
    els.btnUpdateDownload.textContent = S.updateInfo.installerUrl
      ? 'Обновить и перезапустить'
      : 'Открыть релиз';
    els.btnUpdateDownload.disabled = false;
    $('modal-update').hidden = false;
  };
  els.btnUpdateDownload.onclick = async () => {
    const info = S.updateInfo;
    if (!info) return;
    if (!info.installerUrl) {
      api.openUrl(info.url).catch((err) => toast(String(err), 'error'));
      return;
    }
    await startAutoUpdate(info, { manual: true });
  };
}

async function checkLauncherUpdate() {
  if (!api.checkUpdate) return null;
  try {
    const info = await api.checkUpdate();
    if (!info || !info.available) {
      els.updateChip.hidden = true;
      return null;
    }
    S.updateInfo = info;
    return info;
  } catch (_) {
    els.updateChip.hidden = true;
    return null;
  }
}

async function checkUpdateInBackground(force = false) {
  if (!api.checkUpdate || S.autoUpdating || S.loading) return;
  const now = Date.now();
  if (!force && now - lastUpdateCheckAt < 15 * 60 * 1000) return;
  lastUpdateCheckAt = now;
  const info = await checkLauncherUpdate();
  if (!info) return;
  if (els.updateChip && !els.updateChip.hidden && S.updateInfo && S.updateInfo.latest === info.latest) {
    return;
  }
  let hidden = false;
  if (api.isWindowVisible) {
    try {
      hidden = !(await api.isWindowVisible());
    } catch (_) {}
  }
  if (hidden && info.installerUrl && !S.running && !activeDownloadTask()) {
    startAutoUpdate(info);
    return;
  }
  showUpdateChip(info);
  toast(`Доступно обновление ${info.latest}`, 'info');
}

let startupFinalized = false;

async function finishStartup() {
  if (startupFinalized) return;
  startupFinalized = true;
  try {
    if (api.windowReady) await api.windowReady();
  } catch (_) {
    // Окно уже могло быть закрыто.
  }
  finishSplash();
}

async function handleStartupUpdate(pending) {
  const info = await withTimeout(pending, 900);
  lastUpdateCheckAt = Date.now();
  if (info && info.installerUrl) {
    startAutoUpdate(info);
    return;
  }
  if (info) {
    showUpdateChip(info);
  } else if (info === undefined) {
    pending.then((late) => {
      if (late) showUpdateChip(late);
    }).catch(() => {});
  }
  await finishStartup();
}

function showUpdateChip(info) {
  els.updateChipText.textContent = `Обновление ${info.latest}`;
  els.updateChip.hidden = false;
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(undefined);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

function showSplashUpdate(info) {
  if (els.splash) els.splash.classList.add('updating');
  if (els.splashNormal) els.splashNormal.hidden = true;
  if (els.splashUpdate) {
    els.splashUpdate.classList.remove('installing');
    els.splashUpdate.hidden = false;
  }
  if (els.splashUpdateVersion) els.splashUpdateVersion.textContent = `v${info.latest}`;
  if (els.splashUpdateRing) els.splashUpdateRing.style.strokeDashoffset = '402.12';
  if (els.splashUpdateBar) els.splashUpdateBar.style.width = '0%';
  if (els.splashUpdatePercent) els.splashUpdatePercent.textContent = '0%';
  if (els.splashUpdateStatus) {
    els.splashUpdateStatus.textContent = `Скачиваю обновление ${info.latest}…`;
  }
}

function setSplashProgress(percent, status) {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  if (els.splashUpdateBar) els.splashUpdateBar.style.width = `${value}%`;
  if (els.splashUpdatePercent) els.splashUpdatePercent.textContent = `${value}%`;
  if (els.splashUpdateRing) els.splashUpdateRing.style.strokeDashoffset = `${(402.12 * (1 - value / 100)).toFixed(2)}`;
  if (status && els.splashUpdateStatus) els.splashUpdateStatus.textContent = status;
}

function hideSplashUpdate() {
  if (els.splash) els.splash.classList.remove('updating');
  if (els.splashUpdate) {
    els.splashUpdate.hidden = true;
    els.splashUpdate.classList.remove('installing');
  }
  if (els.splashNormal) els.splashNormal.hidden = false;
}

async function startAutoUpdate(info, options = {}) {
  if (S.autoUpdating) return;
  const manual = !!options.manual;
  const tr = (text) => (window.I18n ? window.I18n.t(text) : text);
  const button = els.btnUpdateDownload;
  S.autoUpdating = true;
  els.updateChip.hidden = true;
  if (manual) {
    if (button) {
      button.disabled = true;
      button.textContent = `${tr('Скачиваю…')} 0%`;
    }
  } else {
    showSplashUpdate(info);
  }

  let unlisten = null;
  try {
    if (api.onUpdateProgress) {
      unlisten = await api.onUpdateProgress((payload) => {
        const total = Number(payload && payload.total) || 0;
        const downloaded = Number(payload && payload.downloaded) || 0;
        const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
        if (manual) {
          if (button) button.textContent = `${tr('Скачиваю…')} ${percent}%`;
          return;
        }
        const status = total > 0
          ? `Скачивание… ${formatBytes(downloaded)} из ${formatBytes(total)}`
          : 'Скачивание обновления…';
        setSplashProgress(percent, status);
      });
    }

    await api.installUpdate(info.installerUrl);
    if (manual) {
      if (button) button.textContent = tr('Устанавливаю обновление. Лаунчер сейчас закроется…');
      if (els.updateNotes) {
        els.updateNotes.textContent = tr('Обновление скачано. Лаунчер закроется и запустится заново.');
      }
    } else {
      if (els.splashUpdate) els.splashUpdate.classList.add('installing');
      setSplashProgress(100, 'Устанавливаю обновление. Лаунчер сейчас закроется…');
    }
    setTimeout(() => {
      api.close().catch(() => {});
    }, 800);
  } catch (err) {
    S.autoUpdating = false;
    if (manual) {
      if (button) {
        button.disabled = false;
        button.textContent = tr('Обновить и перезапустить');
      }
    } else {
      hideSplashUpdate();
      els.updateChipText.textContent = `Обновление ${info.latest}`;
      els.updateChip.hidden = false;
      await finishStartup();
    }
    toast(
      (window.I18n ? window.I18n.t('Не удалось установить обновление:') : 'Не удалось установить обновление:') + ' ' + err,
      'error'
    );
  } finally {
    if (typeof unlisten === 'function') unlisten();
  }
}

// ---------------------------------------------------------------- аккаунт

function renderAccountChip() {
  const user = S.lavunio && S.lavunio.user;
  if (els.sidebarName) els.sidebarName.textContent = user ? lavunioName(user) : 'Гость';
  if (els.sidebarStatus) {
    els.sidebarStatus.textContent = user
      ? (user.role === 'admin' ? 'Администратор'
        : user.role === 'author' ? 'Автор'
          : user.role === 'moderator' ? 'Модератор' : 'Игрок')
      : 'Войти в Lavunio';
  }
  applyLavunioAvatar(els.sidebarAvatar, user);
  if (els.sidebarMessages) els.sidebarMessages.hidden = !user;
  updateSocialNav();
}

function bindAccountModal() {
  $('lavunio-form').onsubmit = (event) => {
    event.preventDefault();
    submitLavunioForm();
  };
  $('lavunio-switch').onclick = () => {
    S.lavunioRegisterMode = !S.lavunioRegisterMode;
    renderLavunioPane();
    $('lavunio-email').focus();
  };
  $('lavunio-logout').onclick = () => logoutLavunio();
  $('lavunio-profile').onclick = () => {
    const user = S.lavunio && S.lavunio.user;
    if (!user) return;
    $('modal-account').hidden = true;
    openProfile(user.username);
  };
  $('lavunio-verify-btn').onclick = () => verifyLavunioEmail();
  $('lavunio-skin-upload').onclick = () => uploadLavunioSkin();
  $('lavunio-skin-delete').onclick = () => deleteLavunioSkin();
  const applyBtn = $('author-apply-btn');
  if (applyBtn) applyBtn.onclick = () => openAuthorApplyModal();
  const applyForm = $('author-apply-form');
  if (applyForm) applyForm.onsubmit = (event) => {
    event.preventDefault();
    submitAuthorApplication();
  };
}

async function refreshLavunioStatus() {
  if (!api.lavunioStatus) return;
  try {
    S.lavunio = api.lavunioRefreshProfile
      ? await api.lavunioRefreshProfile()
      : await api.lavunioStatus();
    renderLavunioPane();
    renderAccountChip();
    loadFollows();
    loadAuthorApplication();
    heartbeatPresence();
    loadNotifications();
    updateSocialNav();
  } catch (_) {}
}

function renderAccountModal() {
  renderLavunioPane();
}

function renderLavunioPane() {
  const available = !!(S.lavunio && S.lavunio.configured);
  const user = S.lavunio && S.lavunio.user;
  const form = $('lavunio-form');
  const signed = $('lavunio-signed');
  const current = $('lavunio-current');
  const hint = $('lavunio-api-hint');
  const error = $('lavunio-error');

  if (!form) return;
  if (hint) hint.hidden = available;
  if (current) current.hidden = !user;
  if (form) form.hidden = !!user;
  if (signed) signed.hidden = !user;

  if (user) {
    $('lavunio-name').textContent = lavunioName(user);
    const bits = [];
    if (user.email) bits.push(user.email);
    bits.push(user.emailVerified ? 'почта подтверждена' : 'почта не подтверждена');
    bits.push(
      user.role === 'admin' ? 'администратор' :
      user.role === 'author' ? 'автор' :
      user.role === 'moderator' ? 'модератор' : 'игрок'
    );
    const sub = $('lavunio-sub');
    sub.innerHTML = '';
    bits.forEach((text, index) => {
      if (index) sub.appendChild(document.createTextNode(' · '));
      const span = document.createElement('span');
      span.textContent = text;
      if (index === 1) span.className = user.emailVerified ? 'ok' : 'warn';
      sub.appendChild(span);
    });
    applyLavunioAvatar($('lavunio-avatar'), user);
    $('lavunio-verify').hidden = !!user.emailVerified;
    renderAuthorApply(user);

    const skinImg = $('lavunio-skin-img');
    if (user.skinUrl) {
      skinImg.src = user.skinUrl;
      skinImg.hidden = false;
    } else {
      skinImg.removeAttribute('src');
      skinImg.hidden = true;
    }
    $('lavunio-skin-model').value = user.skinModel || 'classic';
    $('lavunio-skin-delete').hidden = !user.skinUrl;
  } else {
    const register = !!S.lavunioRegisterMode;
    $('lavunio-username-field').hidden = !register;
    if (els.consentRow) els.consentRow.hidden = !register;
    $('lavunio-password').autocomplete = register ? 'new-password' : 'current-password';
    $('lavunio-submit').textContent = register ? 'Создать аккаунт' : 'Войти';
    $('lavunio-switch-text').textContent = register ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
    $('lavunio-switch').textContent = register ? 'Войти' : 'Регистрация';
    if (error) error.hidden = true;
  }
  updatePublisherNav();
  updateModerationNav();
}

async function submitLavunioForm() {
  const error = $('lavunio-error');
  const email = $('lavunio-email').value.trim();
  const password = $('lavunio-password').value;
  const username = $('lavunio-username').value.trim();
  const register = !!S.lavunioRegisterMode;

  error.hidden = true;
  if (!email || !password) {
    error.textContent = 'Заполните email и пароль';
    error.hidden = false;
    return;
  }
  if (register && !username) {
    error.textContent = 'Придумайте имя пользователя';
    error.hidden = false;
    return;
  }
  if (register && els.consent && !els.consent.checked) {
    error.textContent = 'Подтвердите согласие с условиями и политикой конфиденциальности';
    error.hidden = false;
    els.consent.focus();
    return;
  }
  if (!S.lavunio || !S.lavunio.configured) {
    error.textContent = 'Lavunio API не настроен';
    error.hidden = false;
    return;
  }

  const button = $('lavunio-submit');
  button.disabled = true;
  button.textContent = register ? 'Создаём…' : 'Входим…';
  try {
    const status = register
      ? await api.lavunioRegister(email, password, username || null, !!(els.consent && els.consent.checked))
      : await api.lavunioLogin(email, password);
    S.lavunio = status;
    $('lavunio-password').value = '';
    renderLavunioPane();
    renderAccountChip();
    loadFollows();
    heartbeatPresence();
    loadNotifications();
    loadFriends(true);
    updateSocialNav();
    const name = status && status.user ? lavunioName(status.user) : '';
    toast(register ? 'Аккаунт Lavunio создан' : `С возвращением, ${name || 'игрок'}!`, 'ok');
    if (status && status.user && !status.user.emailVerified) {
      toast('Почта не подтверждена', 'warn');
    }
    if (status && status.user) $('modal-account').hidden = true;
    if (S.profileAfterLogin && status && status.user) {
      S.profileAfterLogin = false;
      openProfile(status.user.username);
    }
  } catch (err) {
    error.textContent = String(err || 'Не удалось выполнить вход');
    error.hidden = false;
  } finally {
    button.disabled = false;
    if (!S.lavunio || !S.lavunio.user) {
      button.textContent = register ? 'Создать аккаунт' : 'Войти';
    }
  }
}

async function logoutLavunio() {
  try {
    await api.lavunioLogout();
  } catch (_) {}
  S.lavunio = { configured: true, hasSession: false, user: null };
  S.reviews = {};
  S.follows = [];
  S.feed = [];
  S.friends = [];
  S.notifications = [];
  S.notificationsUnread = 0;
  S.playerProfile = null;
  S.profileUsername = null;
  S.chatKind = null;
  S.chatTarget = null;
  S.chatMessages = [];
  updateNotificationsBadge();
  closeNotifications();
  updateSocialNav();
  if (S.section === 'profile' || S.section === 'messages') showSection('store');
  renderLavunioPane();
  renderAccountChip();
  renderStore();
  toast('Вы вышли из Lavunio', 'ok');
}

async function verifyLavunioEmail() {
  const button = $('lavunio-verify-btn');
  button.disabled = true;
  button.textContent = 'Отправляем…';
  try {
    const status = await api.lavunioResendVerification();
    S.lavunio = status;
    renderLavunioPane();
    const verified = !!(status && status.user && status.user.emailVerified);
    toast(
      verified ? 'Почта подтверждена' : 'Письмо отправлено. Проверьте почту.',
      verified ? 'ok' : 'warn'
    );
  } catch (err) {
    toast('Не удалось подтвердить почту: ' + err, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Подтвердить';
  }
}

function renderAuthorApply(user) {
  const box = $('author-apply');
  if (!box) return;
  const isPlayer = !!(user && user.role === 'player');
  box.hidden = !isPlayer;
  if (!isPlayer) return;
  const text = $('author-apply-text');
  const button = $('author-apply-btn');
  const application = S.authorApplication;
  if (!application) {
    text.textContent = 'Хочешь публиковать свои режимы в Lavunio?';
    button.hidden = false;
    button.textContent = 'Стать автором';
  } else if (application.status === 'open') {
    text.textContent = 'Заявка на рассмотрении';
    button.hidden = true;
  } else if (application.status === 'rejected') {
    text.textContent = `Заявка отклонена: ${application.note || 'без причины'}`;
    button.hidden = false;
    button.textContent = 'Подать заново';
  } else {
    text.textContent = 'Доступ автора выдан';
    button.hidden = true;
  }
}

async function loadAuthorApplication() {
  const user = S.lavunio && S.lavunio.user;
  if (!user || user.role !== 'player' || !api.authorApplicationStatus) {
    S.authorApplication = null;
    renderAuthorApply(user);
    return;
  }
  try {
    S.authorApplication = await api.authorApplicationStatus();
  } catch (_) {
    S.authorApplication = null;
  }
  renderAuthorApply(user);
}

function openAuthorApplyModal() {
  $('author-apply-message').value = '';
  $('author-apply-links').value = '';
  $('author-apply-error').hidden = true;
  openModal('modal-author-apply');
  setTimeout(() => $('author-apply-message').focus(), 50);
}

async function submitAuthorApplication() {
  const message = $('author-apply-message').value.trim();
  const links = $('author-apply-links').value.trim();
  const error = $('author-apply-error');
  if (message.length < 20) {
    error.textContent = 'Расскажи о себе — минимум 20 символов';
    error.hidden = false;
    return;
  }
  const button = $('author-apply-submit');
  button.disabled = true;
  button.textContent = 'Отправляем…';
  error.hidden = true;
  try {
    S.authorApplication = await api.authorApplicationApply(message, links);
    $('modal-author-apply').hidden = true;
    toast('Заявка отправлена на рассмотрение', 'ok');
    renderLavunioPane();
  } catch (err) {
    error.textContent = String(err || 'Не удалось отправить заявку');
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Отправить заявку';
  }
}

// ---------------------------------------------------------------- настройки

// ---------------------------------------------------------------- модалки

let lastFocusedElement = null;

function openModals() {
  return [...document.querySelectorAll('.modal-overlay:not([hidden])')];
}

function focusableIn(root) {
  if (!root) return [];
  return [...root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => element.offsetParent !== null && !element.closest('[hidden]'));
}

function focusFirstIn(modal) {
  const items = focusableIn(modal).filter((element) => !element.classList.contains('modal-close'));
  const target = items[0] || focusableIn(modal)[0];
  if (target) target.focus();
}

function rememberFocus() {
  if (!openModals().length) lastFocusedElement = document.activeElement;
}

function restoreFocus() {
  if (openModals().length) return;
  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    try { lastFocusedElement.focus(); } catch (_) {}
  }
  lastFocusedElement = null;
}

function openModal(id) {
  if (document.getElementById(id).hidden) rememberFocus();
  closeSelectMenu();
  if (id === 'modal-settings') {
    fillSettingsForm();
  }
  if (id === 'modal-account') {
    renderAccountModal();
    refreshLavunioStatus();
  }
  $(id).hidden = false;
  requestAnimationFrame(() => {
    syncSelectLabels();
    growAllTextareas($(id));
  });
  setTimeout(() => focusFirstIn($(id)), 30);
}

function closeModals() {
  closeSelectMenu();
  document.querySelectorAll('.modal-overlay').forEach((m) => (m.hidden = true));
  if (confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(false);
  }
  restoreFocus();
}

let confirmResolve = null;

function askConfirm(title, text, okLabel = 'Удалить') {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    if (!openModals().length) lastFocusedElement = document.activeElement;
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.btnConfirmOk.textContent = okLabel;
    els.confirmModal.hidden = false;
    els.btnConfirmOk.focus();
  });
}

function closeConfirm(value) {
  els.confirmModal.hidden = true;
  if (confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(value);
  }
  restoreFocus();
}

function closeTopModal() {
  const opened = openModals();
  if (!opened.length) return false;
  const top = opened[opened.length - 1];
  if (top.id === 'modal-confirm') {
    closeConfirm(false);
  } else {
    top.hidden = true;
    restoreFocus();
  }
  return true;
}

function bindModals() {
  els.btnConfirmOk.onclick = () => closeConfirm(true);
  els.btnConfirmCancel.onclick = () => closeConfirm(false);
  els.btnConfirmX.onclick = () => closeConfirm(false);
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.close === 'modal-confirm') {
        closeConfirm(false);
      } else {
        const target = $(btn.dataset.close);
        if (target) target.hidden = true;
        restoreFocus();
      }
    };
  });
  document.querySelectorAll('.modal-overlay').forEach((ov) => {
    ov.addEventListener('mousedown', (e) => {
      if (e.target !== ov) return;
      if (ov.id === 'modal-confirm') closeConfirm(false);
      else { ov.hidden = true; restoreFocus(); }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (closeTopModal()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const opened = openModals();
    if (!opened.length) return;
    const items = focusableIn(opened[opened.length - 1]);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

// ---------------------------------------------------------------- утилиты



// ---------------------------------------------------------------- публикатор

const PUBLISHER_STATUS = {
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

function publisherAllowed() {
  const user = S.lavunio && S.lavunio.user;
  return !!(S.lavunio && S.lavunio.configured && user && (user.role === 'author' || user.role === 'admin'));
}

function updateSocialNav() {
  const logged = lavunioLoggedIn();
  if (els.sidebarMessages) els.sidebarMessages.hidden = !logged;
  updateSideGroups();
}

function updatePublisherNav() {
  const allowed = publisherAllowed();
  const button = $('side-publisher');
  if (button) button.hidden = !allowed;
  const teamButton = $('side-team');
  if (teamButton) teamButton.hidden = !allowed;
  updateSideGroups();
  if (!allowed && (S.section === 'publisher' || S.section === 'team')) {
    S.section = 'store';
    S.view = 'store';
    if (els.storeView) els.storeView.hidden = false;
    if (els.libraryView) els.libraryView.hidden = true;
    if (els.publisherView) els.publisherView.hidden = true;
    if (els.teamView) els.teamView.hidden = true;
    if (els.moderationView) els.moderationView.hidden = true;
    if (els.detailView) els.detailView.hidden = true;
    document.querySelectorAll('.side-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.section === 'store');
    });
    renderStore();
  }
}

function moderatorAllowed() {
  const user = S.lavunio && S.lavunio.user;
  return !!(S.lavunio && S.lavunio.configured && user && (user.role === 'moderator' || user.role === 'admin'));
}

function updateModerationNav() {
  const allowed = moderatorAllowed();
  const button = $('side-moderator');
  if (button) button.hidden = !allowed;
  updateSideGroups();
  if (!allowed && S.section === 'moderation') {
    S.section = 'store';
    S.view = 'store';
    if (els.storeView) els.storeView.hidden = false;
    if (els.libraryView) els.libraryView.hidden = true;
    if (els.publisherView) els.publisherView.hidden = true;
    if (els.moderationView) els.moderationView.hidden = true;
    if (els.detailView) els.detailView.hidden = true;
    document.querySelectorAll('.side-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.section === 'store');
    });
    renderStore();
  }
}

function bindPublisher() {
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
  updatePublisherNav();
}

function bindSocial() {
  const bell = $('btn-notifications');
  if (bell) {
    bell.onclick = (event) => {
      event.stopPropagation();
      toggleNotifications();
    };
  }
  if (els.notificationsReadAll) {
    els.notificationsReadAll.onclick = (event) => {
      event.stopPropagation();
      readAllNotifications();
    };
  }
  if (els.notificationsList) {
    els.notificationsList.onclick = (event) => {
      const button = event.target.closest('button[data-notification-id]');
      if (!button) return;
      openNotification(button);
    };
  }
  if (els.messagesRefresh) {
    els.messagesRefresh.onclick = () => loadChatList(true);
  }
  if (els.chatForm) {
    els.chatForm.onsubmit = (event) => {
      event.preventDefault();
      sendChatMessage();
    };
  }
  if (els.messagesList) {
    els.messagesList.onclick = (event) => {
      const button = event.target.closest('button[data-chat-kind]');
      if (!button) return;
      openChat(
        button.dataset.chatKind,
        button.dataset.chatTarget,
        button.dataset.chatTitle || button.dataset.chatTarget
      );
    };
  }
  document.addEventListener('click', (event) => {
    if (!els.notificationsPopover || els.notificationsPopover.hidden) return;
    if (!event.target.closest('.notif-wrap')) closeNotifications();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (els.notificationsPopover && !els.notificationsPopover.hidden) closeNotifications();
  });
  window.addEventListener('focus', () => {
    heartbeatPresence();
    loadNotifications();
  });
  setInterval(() => {
    if (lavunioLoggedIn()) {
      heartbeatPresence();
      loadNotifications();
    }
  }, 60000);
}

async function heartbeatPresence() {
  if (!lavunioLoggedIn() || !api.presenceHeartbeat) return;
  try { await api.presenceHeartbeat(); } catch (_) {}
}

async function loadFriends(force = false) {
  if (!lavunioLoggedIn() || !api.friendsList) return;
  try {
    const [friends, requests] = await Promise.all([api.friendsList(), api.friendRequests()]);
    S.friends = Array.isArray(friends) ? friends : [];
    S.friendRequests = requests && typeof requests === 'object'
      ? { incoming: requests.incoming || [], outgoing: requests.outgoing || [] }
      : { incoming: [], outgoing: [] };
  } catch (err) {
    toast('Не удалось загрузить друзей: ' + err, 'error');
  }
  refreshFriendSurfaces();
}

function refreshFriendSurfaces() {
  if (S.section === 'profile' && S.playerProfile) renderProfile(S.playerProfile);
  if (S.section === 'messages') renderMessagesList();
}

async function respondFriendRequest(id, action) {
  try {
    await api.friendRespond(id, action);
    toast(action === 'accept' ? 'Заявка принята' : 'Заявка отклонена', 'ok');
    await loadFriends(true);
    await loadNotifications();
  } catch (err) {
    toast('Не удалось обработать заявку: ' + err, 'error');
  }
}

async function removeFriend(username) {
  const confirmed = await askConfirm('Удалить друга?', `@${username} исчезнет из списка друзей.`, 'Удалить');
  if (!confirmed) return;
  try {
    await api.friendRemove(username);
    toast('Друг удалён', 'ok');
    await loadFriends(true);
  } catch (err) {
    toast('Не удалось удалить друга: ' + err, 'error');
  }
}

async function loadNotifications() {
  if (!lavunioLoggedIn() || !api.notificationsList) return;
  try {
    const result = await api.notificationsList();
    S.notifications = Array.isArray(result && result.items) ? result.items : [];
    S.notificationsUnread = Number(result && result.unread) || 0;
  } catch (_) {}
  updateNotificationsBadge();
  if (els.notificationsPopover && !els.notificationsPopover.hidden) renderNotifications();
}

function updateNotificationsBadge() {
  if (!els.notifBadge) return;
  const count = S.notificationsUnread || 0;
  els.notifBadge.hidden = !lavunioLoggedIn() || count === 0;
  els.notifBadge.textContent = count > 99 ? '99+' : String(count);
}

function closeNotifications() {
  if (els.notificationsPopover) els.notificationsPopover.hidden = true;
}

function toggleNotifications(force) {
  if (!lavunioLoggedIn()) {
    openModal('modal-account');
    return;
  }
  if (!els.notificationsPopover) return;
  const show = typeof force === 'boolean' ? force : els.notificationsPopover.hidden;
  if (!show) {
    closeNotifications();
    return;
  }
  els.notificationsPopover.hidden = false;
  renderNotifications();
  loadNotifications().then(renderNotifications);
}

function openNotifications() {
  toggleNotifications(true);
}

function renderNotifications() {
  if (!els.notificationsList) return;
  const items = S.notifications || [];
  els.notificationsList.innerHTML = items.length
    ? items.map((item) => `
      <button class="pub-card notification-item ${item.readAt ? 'read' : ''}" type="button"
        data-notification-id="${escapeHtml(item.id)}"
        data-notif-kind="${escapeHtml(item.kind)}"
        data-notif-link-type="${escapeHtml(item.linkType || '')}"
        data-notif-link-id="${escapeHtml(item.linkId || '')}">
        <div class="pub-title">${escapeHtml(item.title)}</div>
        <div class="mod-changelog">${escapeHtml(item.body || '')}</div>
        <div class="pub-meta"><span>${escapeHtml(formatDateTime(item.createdAt))}</span></div>
      </button>
    `).join('')
    : '<div class="mod-empty">Уведомлений нет.</div>';
}

async function readAllNotifications() {
  try {
    const result = await api.notificationsRead([]);
    S.notifications = result.items || [];
    S.notificationsUnread = result.unread || 0;
    updateNotificationsBadge();
    renderNotifications();
  } catch (err) {
    toast('Не удалось прочитать уведомления: ' + err, 'error');
  }
}

async function openNotification(button) {
  const id = button.dataset.notificationId;
  try {
    const result = await api.notificationsRead([id]);
    S.notifications = result.items || S.notifications;
    S.notificationsUnread = result.unread || 0;
    updateNotificationsBadge();
  } catch (_) {}
  closeNotifications();
  const type = button.dataset.notifLinkType;
  const link = button.dataset.notifLinkId;
  if (type === 'mode' && link) openDetail(link);
  else if (type === 'team' && link) openTeamPage({ slug: link, title: link });
  else if (type === 'user' && link) openProfile(link);
}

function publisherSlug(value) {
  return String(value || '')
    .toLowerCase()
    .split('')
    .map((char) => PUBLISHER_TRANSLIT[char] !== undefined ? PUBLISHER_TRANSLIT[char] : char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function openPublisherModeModal() {
  const form = $('publisher-mode-form');
  if (form) form.reset();
  const slug = $('pub-mode-slug-input');
  if (slug) delete slug.dataset.touched;
  fillPublisherTeamSelect();
  if (!S.teamsLoaded) loadTeams(true).then(fillPublisherTeamSelect).catch(() => {});
  hidePublisherError('pub-mode-error');
  openModal('modal-publisher-mode');
  const title = $('pub-mode-title-input');
  if (title) setTimeout(() => title.focus(), 50);
}

function fillPublisherTeamSelect() {
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

function openPublisherNewsModal(mode) {
  if (!mode) return;
  S.publisherNewsMode = mode;
  const form = $('publisher-news-form');
  if (form) form.reset();
  const label = $('pub-news-mode');
  if (label) label.textContent = `${mode.title} · ${mode.slug}`;
  hidePublisherError('pub-news-error');
  openModal('modal-publisher-news');
  const title = $('pub-news-title');
  if (title) setTimeout(() => title.focus(), 50);
}

function openPublisherReleaseModal(mode) {
  if (!mode) return;
  S.publisherReleaseMode = mode;
  const form = $('publisher-release-form');
  if (form) form.reset();
  hidePublisherError('pub-release-error');
  const label = $('pub-release-mode');
  if (label) label.textContent = `${mode.title} · ${mode.slug}`;
  const version = $('pub-release-version');
  if (version) version.value = nextPublisherVersion(mode);
  openModal('modal-publisher-release');
}

function nextPublisherVersion(mode) {
  const releases = mode.releases || [];
  if (!releases.length) return '1.0.0';
  const parts = String(releases[0].version || '').split('.');
  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`;
  }
  return '';
}

function hidePublisherError(id) {
  const error = $(id);
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }
}

function showPublisherError(id, message) {
  const error = $(id);
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

async function loadPublisher(force = false) {
  if (!publisherAllowed()) {
    updatePublisherNav();
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

function renderPublisher() {
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

function publisherModeCard(mode) {
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

function publisherReleaseCard(mode, release) {
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

function publisherDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(window.I18n ? window.I18n.locale() : 'ru-RU');
}

async function submitPublisherMode() {
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

async function submitPublisherNews() {
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

async function submitPublisherRelease() {
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

async function uploadPublisherCover(mode) {
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

async function deletePublisherCover(mode) {
  if (!mode) return;
  const ok = await askConfirm(
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

async function uploadPublisherScreenshot(mode, release) {
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

async function uploadPublisherBuild(mode, release, folder) {
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

async function submitPublisherReleaseForModeration(mode, release) {
  if (!mode || !release) return;
  const confirmed = await askConfirm(
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

function openPublisherAppealModal(mode, release) {
  if (!mode || !release) return;
  S.publisherAppealRelease = { mode, release };
  $('pub-appeal-info').textContent = `${mode.title} · релиз ${release.version}`;
  $('pub-appeal-message').value = '';
  hidePublisherError('pub-appeal-error');
  $('modal-publisher-appeal').hidden = false;
  setTimeout(() => $('pub-appeal-message').focus(), 50);
}

async function submitPublisherAppeal() {
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

function onPublisherProgress(payload) {
  if (!S.publisherUpload) return;
  const percent = Math.max(0, Math.min(100, Number(payload && payload.percent) || 0));
  S.publisherUpload = {
    ...S.publisherUpload,
    stage: (payload && payload.stage) || 'Загрузка',
    percent
  };
  updatePublisherProgress(S.publisherUpload);
}

function updatePublisherProgress(upload) {
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

// ---------------------------------------------------------------- модерация

const MODERATION_ACTIONS = {
  approve: 'Одобрил релиз',
  reject: 'Отклонил релиз',
  hide: 'Скрыл режим',
  unhide: 'Показал режим',
  report_close: 'Закрыл жалобу',
  review_approve: 'Одобрил отзыв',
  review_reject: 'Отклонил отзыв'
};

function bindModeration() {
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

  updateModerationNav();
}

function setModerationTab(tab) {
  S.moderationTab = ['queue', 'modes', 'reviews', 'reports', 'appeals', 'applications', 'news', 'history'].includes(tab) ? tab : 'queue';
  if (S.moderationTab === 'news') loadStoreNews(true);
  renderModeration();
}

async function loadModeration(force = false) {
  if (!moderatorAllowed()) {
    updateModerationNav();
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

function renderModeration() {
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

function moderationScanHtml(scan) {
  if (!scan || !scan.checkedAt) return '';
  const suspicious = Array.isArray(scan.suspicious) ? scan.suspicious : [];
  if (suspicious.length) {
    const shown = suspicious.slice(0, 5).map((name) => escapeHtml(name)).join(', ');
    const rest = suspicious.length > 5 ? ` и ещё ${suspicious.length - 5}` : '';
    return `<div class="mod-scan warn">Подозрительные файлы: ${shown}${rest}</div>`;
  }
  return `<div class="mod-scan ok">Архив проверен: ${Number(scan.files) || 0} файлов, ${formatBytes(Number(scan.bytes) || 0)}</div>`;
}

function moderationQueueHtml() {
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

function moderationModesHtml() {
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

function moderationReviewsHtml() {
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

async function approveModerationReview(reviewId) {
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

async function rejectModerationReview(reviewId) {
  const item = (S.moderationReviews || []).find((review) => review.id === reviewId);
  const ok = await askConfirm(
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

function moderationAuthorApplicationsHtml() {
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

async function approveAuthorApplication(id, title) {
  const confirmed = await askConfirm(
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

function moderationAppealsHtml() {
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

async function resolveModerationAppeal(id, action, note) {
  if (action === 'accept') {
    const confirmed = await askConfirm(
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

function moderationReportsHtml() {  const items = S.moderationReports || [];
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

async function closeModerationReport(reportId) {
  const ok = await askConfirm(
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

function moderationNewsHtml() {
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

async function submitStoreNews() {
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
    await loadStoreNews(true);
    renderModeration();
  } catch (err) {
    error.textContent = String(err || 'Не удалось опубликовать новость');
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Опубликовать';
  }
}

function moderationHistoryHtml() {
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

function openModerationNote(kind, id, title) {
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
  openModal('modal-moderation-note');
  setTimeout(() => $('moderation-note-text').focus(), 50);
}

async function submitModerationNote() {
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

async function approveModerationRelease(id, title) {
  const ok = await askConfirm(
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

async function unhideModerationMode(id, title) {
  const ok = await askConfirm(
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

// ---------------------------------------------------------------- debug / tests

window.LavunioDebug = {
  get S() { return S; },
  get api() { return api; },
  $,
  escapeHtml,
  toast,
  openModal,
  closeModals,
  openDetail,
  showStore,
  showSection,
  renderStore,
  renderLibrary,
  isInstalled,
  modeAuthors,
  openProfile,
  openChat
};
