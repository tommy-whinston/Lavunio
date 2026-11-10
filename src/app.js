'use strict';

import { tKey } from './i18n/index.js';

import { api } from './api/client.js';
import { S } from './core/state.js';
import { publisherAllowed, moderatorAllowed } from './core/permissions.js';
import { lavunioLoggedIn } from './core/lavunio.js';
import { els } from './core/elements.js';
import { configureCatalogGrid } from './features/catalog/grid.js';
import { renderLibrary } from './features/library/view.js';
import { renderProfile } from './features/profile/view.js';
import { configureProfileActions, openProfile, bindProfileView } from './features/profile/actions.js';
import { configureSettings, bindSettings, fillSettingsForm, applyRamLimit } from './features/settings/view.js';
import { configureTeams, bindTeams, renderTeams, loadTeams, loadTeamInvitations, openTeamPage } from './features/teams/index.js';
import { configurePublisher, bindPublisher, loadPublisher, renderPublisher } from './features/publisher/index.js';
import { configureModeration, bindModeration, loadModeration, renderModeration } from './features/moderation/index.js';
import { configureMessages, loadChatList, renderMessagesList, openChat, sendChatMessage } from './features/messages/view.js';
import { configureUpdates, bindUpdateModal, checkLauncherUpdate, checkUpdateInBackground, finishStartup, handleStartupUpdate } from './features/updates/index.js';
import { configureNotifications, bindNotifications, loadNotifications, renderNotifications } from './features/notifications/index.js';
import { configureAccount, renderAccountChip, bindAccountModal, refreshLavunioStatus, renderLavunioPane, logoutLavunio } from './features/account/index.js';
import { configureSocial, heartbeatPresence, loadFriends, respondFriendRequest } from './features/social/actions.js';
import { configureStore, renderStore, updateAllModes, notifyModeUpdates, loadFollows, loadStoreNews, updateCardProgress, refreshStore, loadStorePage } from './features/store/view.js';
import { configureDetailActions, bindDetail, openDetail, showStore, startMode, openCardContext, closeCardContext, renderDetail, updateDetailAction } from './features/detail/actions.js';
import { onGameEvent } from './features/game/events.js';
import { configureDownloads, renderDownloads } from './features/downloads/queue.js';
import { isInstalled, modeAuthors, modeById } from './core/modes.js';

import { $, escapeHtml } from './core/dom.js';
import { toast } from './ui/toast.js';
import { initCustomSelects, syncSelectLabels } from './ui/select.js';
import { initAutoGrowTextareas } from './ui/textarea.js';
import { openModal, closeModals, askConfirm, bindModals } from './ui/modal.js';

// WebView2 показывает своё меню (назад, сохранить как, печать) — в лаунчере оно не нужно.
document.addEventListener('contextmenu', (event) => event.preventDefault());

const SPLASH_START = performance.now();



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

configureUpdates({ finishSplash });

configureNotifications({ openModal, openDetail, openTeamPage, openProfile });

configureAccount({
  updateSocialNav,
  updatePublisherNav,
  updateModerationNav,
  loadFollows,
  heartbeatPresence,
  loadFriends,
  showSection,
  renderStore,
  openModal
});

configureSocial({ askConfirm });

configureStore({ openDetail, renderDetail, renderModeration });

configureDetailActions({ showSection, renderStore, openModal, askConfirm, handleCardAction });

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
  bind(els.storeFilters, 'store-filter', 'storeFilter', () => refreshStore({ reset: true }));
  bind(els.libraryFilters, 'library-filter', 'libraryFilter', renderLibrary);
  if (els.storeSort) {
    els.storeSort.onchange = () => {
      S.storeSort = els.storeSort.value;
      refreshStore({ reset: true });
    };
  }
  if (els.librarySort) {
    els.librarySort.onchange = () => {
      S.librarySort = els.librarySort.value;
      renderLibrary();
    };
  }
  if (els.storeLoadMore) {
    els.storeLoadMore.onclick = () => loadStorePage();
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
    } else if (S.section === 'store') {
      refreshStore({ reset: true, debounce: 250 });
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
  bindNotifications();
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
