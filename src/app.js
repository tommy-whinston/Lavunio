'use strict';

import { tKey } from './i18n/index.js';

import { api } from './api/client.js';
import { S } from './core/state.js';
import { publisherAllowed, moderatorAllowed } from './core/permissions.js';
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
import { configurePublisher, bindPublisher, loadPublisher, renderPublisher } from './features/publisher/index.js';
import { configureModeration, bindModeration, loadModeration, renderModeration } from './features/moderation/index.js';
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

configurePublisher({
  openModal,
  askConfirm,
  updatePublisherNav
});

configureModeration({
  openModal,
  askConfirm,
  updateModerationNav,
  loadStoreNews
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
    renderDownloads();
    if (S.section === 'detail' && S.selectedId) renderDetail();
    else renderCurrentSection();
    if (S.section === 'messages') {
      if (S.chatKind && S.chatTarget) {
        if (els.chatTitle) els.chatTitle.textContent = S.chatTitle;
        if (els.chatSubtitle) {
          els.chatSubtitle.textContent = S.chatKind === 'team'
            ? tKey('team.chat')
            : tKey('pattern.direct.chat.with.x', [S.chatTarget]);
        }
      } else {
        if (els.chatTitle) els.chatTitle.textContent = tKey('messages.title');
        if (els.chatSubtitle) els.chatSubtitle.textContent = tKey('messages.chooseChat');
      }
    }
    if (!$('modal-account').hidden) renderLavunioPane();
    if (!$('modal-settings').hidden) fillSettingsForm();
    if (els.notificationsPopover && !els.notificationsPopover.hidden) renderNotifications();
    if (window.I18n) window.I18n.applyKeys(document.body);
    syncSelectLabels();
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
  if (els.splashSub) els.splashSub.textContent = tKey("loading.modes.and.account");

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
    toast(tKey("failed.to.load.data") + " " + err, 'error');
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
      toast(tKey("mode.list.refreshed"), 'ok');
    } catch (err) {
      toast(tKey("failed.to.refresh.list") + " " + err, 'error');
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
    els.catalogTitle.textContent = tKey("loading");
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
    els.catalogTitle.textContent = tKey("search.results");
    els.modesCount.textContent = String(result.length);
    renderModeGrid(els.modesGrid, result, true);
    setEmpty(
      result.length === 0,
      tKey("nothing.found"),
      tKey("try.changing.the.query")
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
    all: tKey("all.modes"),
    installed: tKey("installed"),
    following: tKey("following"),
    development: tKey("in.development"),
    crowdfunding: tKey("crowdfunding")
  };
  els.catalogTitle.textContent = titles[S.storeFilter] || tKey("all.modes");
  els.modesCount.textContent = String(list.length);
  renderModeGrid(els.modesGrid, list, true);
  setEmpty(
    list.length === 0,
    tKey("nothing.here.yet"),
    tKey("try.another.filter.or")
  );
  updateSidebarCounts();
}

function updateAllModes() {
  const updates = S.modes.filter((mode) => isUpdate(mode));
  if (!updates.length) {
    toast(tKey("no.updates"), 'info');
    return;
  }
  updates.forEach((mode) => enqueueDownload(mode, 'update', false, true));
  toast(tKey("app.updates.queued", [updates.length]), 'ok');
}

let modeUpdatesNotified = false;
function notifyModeUpdates() {
  if (modeUpdatesNotified || S.updatesSnoozed) return;
  const count = S.modes.filter((mode) => isUpdate(mode)).length;
  if (!count) return;
  modeUpdatesNotified = true;
  toast(tKey("app.mode.updates.available.open", [count]), 'warn');
}

function renderFeatured(mode) {
  if (!mode) {
    els.featured.hidden = true;
    return;
  }
  els.featured.hidden = false;
  els.featuredImg.src = imageSrc(mode);
  wireImage(els.featuredImg, mode);
  els.featuredTitle.textContent = mode.title || tKey("untitled");
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
        <div class="news-title">${escapeHtml(item.title || tKey("common.news"))}</div>
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
      S.status = tKey("closing.the.game");
      toast(tKey("closing.the.game"), 'info');
    } catch (err) {
      toast(tKey("failed.to.close.the") + " " + err, 'error');
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
      if (!res || !res.ok) throw new Error((res && res.error) || tKey("error"));
      const st = S.state[modeId] || { installed: false, version: null, installedAt: 0 };
      S.state[modeId] = { ...st, library: true, hidden: false };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast(tKey("mode.added.to.library"), 'ok');
    } catch (err) {
      toast(tKey("failed.to.add.mode") + " " + err, 'error');
    }
    return;
  }

  if (action === 'folder') {
    try {
      await api.openModeFolder(modeId);
    } catch (err) {
      toast(tKey("failed.to.open.folder") + " " + err, 'error');
    }
    return;
  }

  if (action === 'hide' || action === 'unhide') {
    const hidden = action === 'hide';
    try {
      const res = await api.setHidden(modeId, hidden);
      if (!res || !res.ok) throw new Error((res && res.error) || tKey("error"));
      const st = S.state[modeId] || { installed: false, version: null, installedAt: 0 };
      S.state[modeId] = { ...st, hidden, library: true };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast(hidden ? tKey("mode.hidden") : tKey("mode.restored.to.library"), 'ok');
    } catch (err) {
      toast((hidden ? tKey("app.failed.hide.mode") : tKey("app.failed.unhide.mode")) + ' ' + err, 'error');
    }
    return;
  }

  if (action === 'removelib') {
    try {
      const res = await api.setLibrary(modeId, false);
      if (!res || !res.ok) throw new Error((res && res.error) || tKey("error"));
      const st = S.state[modeId] || { installed: false, version: null, installedAt: 0 };
      S.state[modeId] = { ...st, library: false, hidden: false };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast(tKey("mode.removed.from.library.2"), 'ok');
    } catch (err) {
      toast(tKey("app.failed.remove.library") + ' ' + err, 'error');
    }
    return;
  }

  if (action === 'uninstall') {
    if (!(await askConfirm(
      tKey("delete.mode"),
      tKey("app.confirm.delete.mode.device", [mode.title]),
      tKey("delete.from.device")
    ))) return;
    try {
      const res = await api.uninstall(modeId);
      if (!res || !res.ok) throw new Error((res && res.error) || tKey("error"));
      const st = S.state[modeId] || { library: true, hidden: false };
      S.state[modeId] = { ...st, installed: false, version: null, installedAt: 0 };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast(tKey("mode.deleted.from.device"), 'ok');
    } catch (err) {
      toast(tKey("failed.to.delete.mode") + " " + err, 'error');
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
        renderStore();
        renderLibrary();
        renderDetail();
        toast(tKey("mode.added.to.library"), 'ok');
      } catch (err) {
        toast(tKey("failed.to.add.mode") + " " + err, 'error');
      }
      return;
    }
    if (!lavunioLoggedIn()) {
      openModal('modal-account');
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
    const fix = await askConfirm(
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

async function startMode(mode, autoPlay = false) {
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
      renderStore();
      renderLibrary();
      toast(tKey("mode.added.to.library"), 'ok');
    } catch (err) {
      toast(tKey("failed.to.add.mode") + " " + err, 'error');
    }
    return;
  }
  if (!lavunioLoggedIn()) {
    openModal('modal-account');
    toast(tKey("sign.in.to.lavunio.2"), 'warn');
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
    ? tKey("back.to.library")
    : S.detailFrom === 'profile' ? tKey("app.back.to.profile")
      : tKey("back.to.catalog");
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

function renderDetail() {
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
    openModal('modal-account');
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
    openModal('modal-account');
    toast(tKey("sign.in.to.lavunio.2"), 'warn');
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
    openModal('modal-account');
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
    renderStore();
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
  const ok = await askConfirm(tKey("delete.review"), tKey("your.review.will.be"), tKey("delete"));
  if (!ok) return;
  try {
    await api.reviewDelete(modeId);
    delete S.reviews[modeId];
    mode.rating = null;
    mode.reviewsCount = 0;
    await loadReviews(mode);
    if (S.view === 'detail') renderDetail();
    renderStore();
    toast(tKey("review.deleted"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.delete.review") + " " + err, 'error');
  }
}

function updateDetailAction() {
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
    renderStore();
    renderLibrary();
    updateDetailAction();
    toast(tKey("update.postponed.until.the"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.postpone.update") + " " + err, 'error');
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
      S.status = tKey("sidebar.installed");
      if (mode) {
        const st = S.state[mode.id] || {};
        S.state[mode.id] = { ...st, installed: true, version: mode.version, installedAt: Date.now(), library: true, hidden: false };
      }
      if (finished) finishDownload(finished.id, 'completed');
      toast(tKey("mode.installed"), 'ok');
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
      S.status = tKey("game.launched");
      S.sessionStartedAt = Date.now();
      if (api.markLaunched) api.markLaunched(ev.modeId).catch(() => {});
      {
        const st = S.state[ev.modeId] || {};
        S.state[ev.modeId] = { ...st, lastPlayedAt: S.sessionStartedAt };
      }
      if (finished) finishDownload(finished.id, 'completed');
      toast(tKey("game.launched.2"), 'ok');
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
      S.status = ev.payload === 0 ? tKey("game.closed") : tKey("app.game.finished.code", [ev.payload]);
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
      S.status = wasPaused ? tKey("pause") : tKey("cancelled");
      if (finished) {
        finished.status = wasPaused ? 'paused' : 'cancelled';
        finished.stage = wasPaused ? tKey("pause") : tKey("cancelled");
        finished.speed = 0;
        finished.eta = 0;
        finished.pauseRequested = false;
        finished.cancelRequested = false;
        S.downloadsActiveId = null;
        renderDownloads();
        pumpDownloads();
      }
      toast(wasPaused ? tKey("download.paused.2") : tKey("operation.cancelled"), 'warn');
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && isCurrent) renderDetail();
      break;
    }
    case 'error': {
      const finished = active && active.modeId === ev.modeId ? active : null;
      const message = String(ev.payload || tKey("error"));
      S.pendingPlay = null;
      S.busy = null;
      S.stage = '';
      S.progress = 0;
      if (S.running === ev.modeId) S.running = null;
      S.status = tKey("error");
      if (finished) {
        finished.status = 'error';
        finished.stage = tKey("error");
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
    els.updateNotes.textContent = (S.updateInfo.notes || '').trim() || tKey("changelog.will.appear.later");
    els.btnUpdateDownload.textContent = S.updateInfo.installerUrl
      ? tKey("update.and.restart")
      : tKey("open.release");
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
  toast(tKey("app.update.available.version", [info.latest]), 'info');
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
  els.updateChipText.textContent = tKey("app.update.chip", [info.latest]);
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
    els.splashUpdateStatus.textContent = tKey("app.downloading.update.version", [info.latest]);
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
  const button = els.btnUpdateDownload;
  S.autoUpdating = true;
  els.updateChip.hidden = true;
  if (manual) {
    if (button) {
      button.disabled = true;
      button.textContent = `${tKey("downloading")} 0%`;
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
          if (button) button.textContent = `${tKey("downloading")} ${percent}%`;
          return;
        }
        const status = total > 0
          ? tKey("app.downloading.progress", [formatBytes(downloaded), formatBytes(total)])
          : tKey("downloading.update");
        setSplashProgress(percent, status);
      });
    }

    await api.installUpdate(info.installerUrl);
    if (manual) {
      if (button) button.textContent = tKey("installing.the.update.the");
      if (els.updateNotes) {
        els.updateNotes.textContent = tKey("update.downloaded.the.launcher");
      }
    } else {
      if (els.splashUpdate) els.splashUpdate.classList.add('installing');
      setSplashProgress(100, tKey("installing.the.update.the"));
    }
    setTimeout(() => {
      api.close().catch(() => {});
    }, 800);
  } catch (err) {
    S.autoUpdating = false;
    if (manual) {
      if (button) {
        button.disabled = false;
        button.textContent = tKey("update.and.restart");
      }
    } else {
      hideSplashUpdate();
      els.updateChipText.textContent = tKey("app.update.chip", [info.latest]);
      els.updateChip.hidden = false;
      await finishStartup();
    }
    toast(
      tKey("failed.to.install.update") + ' ' + err,
      'error'
    );
  } finally {
    if (typeof unlisten === 'function') unlisten();
  }
}

// ---------------------------------------------------------------- аккаунт

function renderAccountChip() {
  const user = S.lavunio && S.lavunio.user;
  if (els.sidebarName) els.sidebarName.textContent = user ? lavunioName(user) : tKey("guest");
  if (els.sidebarStatus) {
    els.sidebarStatus.textContent = user
      ? (user.role === 'admin' ? tKey("administrator")
        : user.role === 'author' ? tKey("author")
          : user.role === 'moderator' ? tKey("moderator.2") : tKey("player.2"))
      : tKey("sign.in.to.lavunio.3");
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
    bits.push(user.emailVerified ? tKey("email.verified") : tKey("email.not.verified.2"));
    bits.push(
      user.role === 'admin' ? tKey("administrator.2") :
      user.role === 'author' ? tKey("author.2") :
      user.role === 'moderator' ? tKey("moderator") : tKey("player")
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
    $('lavunio-submit').textContent = register ? tKey("create.account") : tKey("sign.in");
    $('lavunio-switch-text').textContent = register ? tKey("already.have.an.account") : tKey("no.account");
    $('lavunio-switch').textContent = register ? tKey("sign.in") : tKey("sign.up");
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
    error.textContent = tKey("fill.in.email.and");
    error.hidden = false;
    return;
  }
  if (register && !username) {
    error.textContent = tKey("choose.a.username");
    error.hidden = false;
    return;
  }
  if (register && els.consent && !els.consent.checked) {
    error.textContent = tKey("please.accept.the.terms");
    error.hidden = false;
    els.consent.focus();
    return;
  }
  if (!S.lavunio || !S.lavunio.configured) {
    error.textContent = tKey("lavunio.api.is.not.2");
    error.hidden = false;
    return;
  }

  const button = $('lavunio-submit');
  button.disabled = true;
  button.textContent = register ? tKey("creating") : tKey("signing.in");
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
    toast(register ? tKey("lavunio.account.created") : tKey("app.welcome.back", [name || tKey("player")]), 'ok');
    if (status && status.user && !status.user.emailVerified) {
      toast(tKey("email.not.verified"), 'warn');
    }
    if (status && status.user) $('modal-account').hidden = true;
    if (S.profileAfterLogin && status && status.user) {
      S.profileAfterLogin = false;
      openProfile(status.user.username);
    }
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.sign.in"));
    error.hidden = false;
  } finally {
    button.disabled = false;
    if (!S.lavunio || !S.lavunio.user) {
      button.textContent = register ? tKey("create.account") : tKey("sign.in");
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
  toast(tKey("you.signed.out.of"), 'ok');
}

async function verifyLavunioEmail() {
  const button = $('lavunio-verify-btn');
  button.disabled = true;
  button.textContent = tKey("sending");
  try {
    const status = await api.lavunioResendVerification();
    S.lavunio = status;
    renderLavunioPane();
    const verified = !!(status && status.user && status.user.emailVerified);
    toast(
      verified ? tKey("email.verified.2") : tKey("email.sent.check.your"),
      verified ? 'ok' : 'warn'
    );
  } catch (err) {
    toast(tKey("failed.to.verify.email") + " " + err, 'error');
  } finally {
    button.disabled = false;
    button.textContent = tKey("confirm");
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
    text.textContent = tKey("want.to.publish.your");
    button.hidden = false;
    button.textContent = tKey("become.an.author");
  } else if (application.status === 'open') {
    text.textContent = tKey("application.pending");
    button.hidden = true;
  } else if (application.status === 'rejected') {
    text.textContent = tKey("app.application.rejected.note", [application.note || tKey("app.without.reason")]);
    button.hidden = false;
    button.textContent = tKey("submit.again");
  } else {
    text.textContent = tKey("author.access.granted");
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
    error.textContent = tKey("tell.us.about.yourself");
    error.hidden = false;
    return;
  }
  const button = $('author-apply-submit');
  button.disabled = true;
  button.textContent = tKey("sending");
  error.hidden = true;
  try {
    S.authorApplication = await api.authorApplicationApply(message, links);
    $('modal-author-apply').hidden = true;
    toast(tKey("application.submitted.for.review"), 'ok');
    renderLavunioPane();
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.submit.application"));
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = tKey("submit.application");
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

function askConfirm(title, text, okLabel = tKey("delete")) {
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
    toast(tKey("failed.to.load.friends") + " " + err, 'error');
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
    toast(action === 'accept' ? tKey("request.accepted") : tKey("request.declined"), 'ok');
    await loadFriends(true);
    await loadNotifications();
  } catch (err) {
    toast(tKey("failed.to.process.request") + " " + err, 'error');
  }
}

async function removeFriend(username) {
  const confirmed = await askConfirm(tKey("remove.friend"), tKey("app.friend.remove.warning", [username]), tKey("delete"));
  if (!confirmed) return;
  try {
    await api.friendRemove(username);
    toast(tKey("friend.removed"), 'ok');
    await loadFriends(true);
  } catch (err) {
    toast(tKey("failed.to.remove.friend") + " " + err, 'error');
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
  const tr = (text) => (window.I18n ? window.I18n.t(text) : text);
  const items = S.notifications || [];
  els.notificationsList.innerHTML = items.length
    ? items.map((item) => `
      <button class="pub-card notification-item ${item.readAt ? 'read' : ''}" type="button"
        data-notification-id="${escapeHtml(item.id)}"
        data-notif-kind="${escapeHtml(item.kind)}"
        data-notif-link-type="${escapeHtml(item.linkType || '')}"
        data-notif-link-id="${escapeHtml(item.linkId || '')}">
        <div class="pub-title">${escapeHtml(tr(item.title))}</div>
        <div class="mod-changelog">${escapeHtml(tr(item.body || ''))}</div>
        <div class="pub-meta"><span>${escapeHtml(formatDateTime(item.createdAt))}</span></div>
      </button>
    `).join('')
    : '<div class="mod-empty">' + tKey("no.notifications") + '</div>';
}

async function readAllNotifications() {
  try {
    const result = await api.notificationsRead([]);
    S.notifications = result.items || [];
    S.notificationsUnread = result.unread || 0;
    updateNotificationsBadge();
    renderNotifications();
  } catch (err) {
    toast(tKey("failed.to.mark.notifications") + " " + err, 'error');
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

// ---------------------------------------------------------------- модерация

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
