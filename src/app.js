'use strict';

const api = window.tm;
const $ = (id) => document.getElementById(id);

// WebView2 показывает своё меню (назад, сохранить как, печать) — в лаунчере оно не нужно.
document.addEventListener('contextmenu', (event) => event.preventDefault());

const LOADER_LABELS = {
  vanilla: 'Vanilla',
  forge: 'Forge',
  fabric: 'Fabric',
  quilt: 'Quilt',
  neoforge: 'NeoForge',
  paper: 'Paper',
  purpur: 'Purpur',
  spigot: 'Spigot',
  bukkit: 'Bukkit',
  folia: 'Folia',
  velocity: 'Velocity',
  bungeecord: 'BungeeCord',
  waterfall: 'Waterfall'
};

const UPDATE_TAGS = {
  release: { label: 'Релиз', cls: 'release' },
  hotfix: { label: 'Hot-fix', cls: 'hotfix' },
  content: { label: 'Контент', cls: 'content' },
  balance: { label: 'Баланс', cls: 'balance' },
  fix: { label: 'Исправление', cls: 'fix' },
  tech: { label: 'Техническое', cls: 'tech' }
};

const MODE_STATUS = {
  development: { label: 'В разработке', cls: 'development' },
  crowdfunding: { label: 'Сбор на релиз', cls: 'crowdfunding' }
};

function modeStatusMeta(mode) {
  return MODE_STATUS[String((mode && mode.status) || '')] || null;
}

const ART_CACHE = new Map();
const DEFAULT_ACCENT = '#e5322b';
const SPLASH_START = performance.now();

const S = {
  modes: [],
  collections: [],
  state: {},
  settings: null,
  systemRamGb: 0,
  selectedId: null,
  featuredId: null,
  view: 'store',
  busy: null,
  running: null,
  progress: 0,
  status: '',
  stage: '',
  search: '',
  loading: true,
  refreshing: false,
  section: 'store',
  detailFrom: null,
  updateInfo: null,
  autoUpdating: false,
  updatesSnoozed: false,
  storeFilter: 'all',
  storeSort: 'date',
  libraryFilter: 'all',
  librarySort: 'date',
  pendingPlay: null,
  lavunio: null,
  lavunioRegisterMode: false,
  authorApplication: null,
  wishlist: [],
  follows: [],
  feed: [],
  storeNews: [],
  modeNews: {},
  modeNewsLoading: {},
  downloads: [],
  downloadsActiveId: null,
  downloadsSeq: 0,
  sessionStartedAt: 0,
  reviews: {},
  reviewLoading: {},
  reviewRating: 5,
  publisherModes: [],
  publisherLoaded: false,
  publisherLoading: false,
  publisherUpload: null,
  publisherReleaseMode: null,
  publisherAppealRelease: null,
  teams: [],
  teamsLoaded: false,
  teamsLoading: false,
  teamEditing: null,
  teamMembersTeam: null,
  teamMembers: [],
  teamInvitations: [],
  teamPage: null,
  teamPageData: null,
  teamJoinTeam: null,
  teamNewsTeam: null,
  teamTransferTeam: null,
  publisherNewsMode: null,
  moderationQueue: [],
  moderationModes: [],
  moderationReports: [],
  moderationAppeals: [],
  moderationAuthorApplications: [],
  moderationReviews: [],
  moderationCollections: [],
  moderationHistory: [],
  moderationLoaded: false,
  moderationLoading: false,
  moderationTab: 'queue',
  moderationNoteAction: null,
  reportModeId: null,
  reviewReplyTarget: null
};

const els = {
  splash: $('splash'),
  splashSub: $('splash-sub'),
  splashBar: $('splash-progress-bar'),
  splashNormal: $('splash-normal'),
  splashUpdate: $('splash-update'),
  splashUpdateVersion: $('splash-update-version'),
  splashUpdateStatus: $('splash-update-status'),
  splashUpdateBar: $('splash-update-bar'),
  splashUpdatePercent: $('splash-update-percent'),
  splashUpdateRing: $('splash-update-ring'),
  sideLibCount: $('side-lib-count'),
  sideInstalledCount: $('side-installed-count'),
  storeFilters: $('store-filters'),
  storeSort: $('store-sort'),
  storeView: $('store-view'),
  collections: $('collections'),
  libraryView: $('library-view'),
  downloadsView: $('downloads-view'),
  downloadsList: $('downloads-list'),
  downloadsEmpty: $('downloads-empty'),
  downloadsCount: $('downloads-count'),
  downloadsStatQueued: $('downloads-stat-queued'),
  downloadsStatActive: $('downloads-stat-active'),
  downloadsStatDone: $('downloads-stat-done'),
  downloadsClear: $('downloads-clear'),
  sideDownloadsCount: $('side-downloads-count'),
  publisherView: $('publisher-view'),
  teamView: $('team-view'),
  teamList: $('team-list'),
  teamEmpty: $('team-empty'),
  teamHint: $('team-hint'),
  teamStatCount: $('team-stat-count'),
  teamInvitations: $('team-invitations'),
  teamMembersList: $('team-members-list'),
  teamMembersHint: $('team-members-hint'),
  teamPageContent: $('team-page-content'),
  moderationView: $('moderation-view'),
  libraryGrid: $('library-grid'),
  libraryCount: $('library-count'),
  libraryStatTotal: $('library-stat-total'),
  libraryStatInstalled: $('library-stat-installed'),
  libraryStatUpdates: $('library-stat-updates'),
  libraryStatPlaytime: $('library-stat-playtime'),
  libraryFilters: $('library-filters'),
  librarySort: $('library-sort'),
  libraryEmpty: $('library-empty'),
  libraryEmptyTitle: $('library-empty-title'),
  libraryEmptySub: $('library-empty-sub'),
  libraryUpdateBanner: $('library-update-banner'),
  libraryUpdateCount: $('library-update-count'),
  libraryUpdateAll: $('library-update-all'),
  libraryUpdateLater: $('library-update-later'),
  detailDefer: $('detail-defer'),
  detailView: $('detail-view'),
  detailBackLabel: $('detail-back-label'),
  featured: $('featured'),
  featuredImg: $('featured-img'),
  featuredTitle: $('featured-title'),
  featuredTags: $('featured-tags'),
  featuredDesc: $('featured-desc'),
  featuredStatus: $('featured-status'),
  featuredOpen: $('featured-open'),
  modesGrid: $('modes-grid'),
  modesCount: $('modes-count'),
  catalogTitle: $('catalog-title'),
  emptyState: $('empty-state'),
  emptyTitle: $('empty-title'),
  emptySub: $('empty-sub'),
  loadingState: $('loading-state'),
  search: $('search-input'),
  refresh: $('btn-refresh'),
  accChip: $('account-chip'),
  accAvatar: $('account-avatar'),
  accName: $('account-name'),
  updateChip: $('update-chip'),
  updateChipText: $('update-chip-text'),
  updateCurrent: $('update-current'),
  updateLatest: $('update-latest'),
  updateNotes: $('update-notes'),
  btnUpdateDownload: $('btn-update-download'),
  toast: $('toast'),
  confirmModal: $('modal-confirm'),
  confirmTitle: $('confirm-title'),
  confirmText: $('confirm-text'),
  btnConfirmOk: $('btn-confirm-ok'),
  btnConfirmCancel: $('btn-confirm-cancel'),
  btnConfirmX: $('btn-confirm-x'),
  detailBack: $('detail-back'),
  detailImg: $('detail-img'),
  detailTitle: $('detail-title'),
  detailTags: $('detail-tags'),
  detailSub: $('detail-sub'),
  detailAction: $('detail-action'),
  detailWishlist: $('detail-wishlist'),
  detailReport: $('detail-report'),
  detailStatus: $('detail-status'),
  detailProgress: $('detail-progress'),
  detailProgressBar: $('detail-progress-bar'),
  detailMeta: $('detail-meta'),
  detailDesc: $('detail-desc'),
  detailChangelogSection: $('detail-changelog-section'),
  detailChangelog: $('detail-changelog'),
  changelogToggle: $('changelog-toggle'),
  reqSize: $('req-size'),
  sideFolder: $('side-folder'),
  detailVerify: $('detail-verify'),
  detailSpotlight: $('detail-spotlight'),
  spotlightTitle: $('spotlight-title'),
  spotlightTag: $('spotlight-tag'),
  spotlightDate: $('spotlight-date'),
  spotlightLink: $('spotlight-link'),
  detailGallerySection: $('detail-gallery-section'),
  detailGallery: $('detail-gallery'),
  detailSessionsSection: $('detail-sessions-section'),
  detailSessions: $('detail-sessions'),
  detailAuthorSection: $('detail-author-section'),
  detailAuthorAvatar: $('detail-author-avatar'),
  detailAuthorName: $('detail-author-name'),
  detailAuthorSub: $('detail-author-sub'),
  detailAuthorModes: $('detail-author-modes'),
  detailAuthorFollow: $('detail-author-follow'),
  detailTeam: $('detail-team'),
  feed: $('feed'),
  feedList: $('feed-list'),
  storeNews: $('store-news'),
  storeNewsList: $('store-news-list'),
  galleryImage: $('gallery-image'),
  detailTrailerSection: $('detail-trailer-section'),
  detailTrailer: $('detail-trailer'),
  detailTrailerOpen: $('detail-trailer-open'),
  detailNewsSection: $('detail-news-section'),
  detailNewsList: $('detail-news-list'),
  detailReviewsSection: $('detail-reviews-section'),
  reviewsSummary: $('reviews-summary'),
  reviewsList: $('reviews-list'),
  reviewForm: $('review-form'),
  reviewStars: $('review-stars'),
  reviewText: $('review-text'),
  reviewError: $('review-error'),
  reviewSubmit: $('review-submit'),
  reviewLoginHint: $('review-login-hint'),
  reportForm: $('report-form'),
  reportTarget: $('report-target'),
  reportReason: $('report-reason'),
  reportError: $('report-error'),
  reportSubmit: $('report-submit'),
  moreSection: $('more-section'),
  moreGrid: $('more-grid'),
  cardContext: $('card-context'),
  ram: $('set-ram'),
  ramOut: $('ram-out'),
  setDir: $('set-dir'),
  setDirSelect: $('set-dir-select'),
  settingsDiskInfo: $('settings-disk-info'),
  setJava: $('set-java'),
  setWidth: $('set-width'),
  setHeight: $('set-height'),
  setFullscreen: $('set-fullscreen'),
  setJvmFlags: $('set-jvm-flags'),
  setLogsPath: $('set-logs-path'),
};

// ---------------------------------------------------------------- init

init();

async function init() {
  if (api && api.windowSplash) api.windowSplash().catch(() => {});
  bindWindowButtons();
  bindModals();
  bindSidebar();
  bindStore();
  bindDownloads();
  bindCatalogControls();
  bindDetail();
  bindSettings();
  bindAccountModal();
  bindPublisher();
  bindTeams();
  bindModeration();
  bindUpdateModal();

  if (api && api.onGameEvent) api.onGameEvent(onGameEvent);
  if (api && api.getSystemRam) {
    api.getSystemRam().then((gb) => {
      S.systemRamGb = Number(gb) || 0;
      applyRamLimit();
    }).catch(() => {});
  }

  renderStore();
  renderLibrary();
  renderDownloads();
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
    S.loading = false;
    renderAccountChip();
    updatePublisherNav();
    loadWishlist();
    loadFollows();
    loadCollections();
    loadStoreNews();
    renderStore();
    renderLibrary();
    updateSidebar();
    requestAnimationFrame(() => { $('app').scrollTop = 0; });

    if (S.modes.length) {
      api.refreshModes().then((fresh) => {
        if (!Array.isArray(fresh) || !fresh.length) return;
        S.modes = fresh;
        loadCollections();
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
  $('btn-settings').onclick = () => openModal('modal-settings');
  $('btn-close').onclick = () => api.close();
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

function syncFilterButtons(container, attr, active) {
  if (!container) return;
  container.querySelectorAll(`[data-${attr}]`).forEach((button) => {
    button.classList.toggle('active', button.getAttribute(`data-${attr}`) === active);
  });
}

function modePassesFilter(mode, filter) {
  if (filter === 'installed') return isInstalled(mode);
  if (filter === 'wishlist' || filter === 'favorites') return S.wishlist.includes(mode.id);
  if (filter === 'following') return modeAuthorIds(mode).some((id) => S.follows.includes(id));
  if (filter === 'hidden') {
    const st = S.state[mode.id];
    return !!(st && st.hidden);
  }
  if (filter === 'collections') return modeInCollections(mode);
  if (filter === 'development') return mode.status === 'development';
  if (filter === 'crowdfunding') return mode.status === 'crowdfunding';
  return true;
}

function modeInCollections(mode) {
  if (!mode || !Array.isArray(S.collections)) return false;
  const automatic = new Set(['featured', 'popular', 'new', 'updated']);
  return S.collections
    .filter((section) => section && !automatic.has(section.id))
    .some((section) =>
      collectionModes(section).some((item) => item && item.id === mode.id)
    );
}

function modeAuthorIds(mode) {
  const ids = [];
  if (mode && mode.author && mode.author.id) ids.push(mode.author.id);
  if (mode && Array.isArray(mode.authors)) {
    mode.authors.forEach((author) => {
      if (author && author.id) ids.push(author.id);
    });
  }
  return [...new Set(ids)];
}

function modeUpdatedAt(mode) {
  const latest = latestUpdateEntry(mode);
  return String((latest && latest.date) || modeReleaseDate(mode) || '');
}

function sortCatalog(list, sort) {
  if (sort === 'title') return sortByTitle(list);
  if (sort === 'date' || sort === 'updated') {
    return [...list].sort((a, b) => modeUpdatedAt(b).localeCompare(modeUpdatedAt(a)));
  }
  if (sort === 'installed') {
    return [...list].sort((a, b) => modeInstalledAt(b) - modeInstalledAt(a));
  }
  if (sort === 'size') {
    return [...list].sort((a, b) => parseDownloadSize(b.size) - parseDownloadSize(a.size));
  }
  if (sort === 'playtime') {
    return [...list].sort((a, b) => modePlaytime(b) - modePlaytime(a));
  }
  return sortModes(list);
}

function modeInstalledAt(mode) {
  const st = S.state[mode.id];
  return Number(st && st.installedAt) || 0;
}

function modePlaytime(mode) {
  const st = S.state[mode.id];
  return Number(st && st.playtimeSecs) || 0;
}

function updateDashboardStats() {
  const modes = S.modes.filter((mode) => inLibrary(mode));
  if (els.libraryStatTotal) els.libraryStatTotal.textContent = String(modes.length);
  if (els.libraryStatInstalled) els.libraryStatInstalled.textContent = String(modes.filter((mode) => isInstalled(mode)).length);
  if (els.libraryStatUpdates) els.libraryStatUpdates.textContent = String(modes.filter((mode) => isUpdate(mode)).length);
  if (els.libraryStatPlaytime) {
    const total = modes.reduce((sum, mode) => sum + modePlaytime(mode), 0);
    els.libraryStatPlaytime.textContent = total > 0 ? formatPlaytime(total) : '—';
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
      loadCollections();
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      els.search.focus();
      return;
    }
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
}

function showSection(section) {
  if (section === 'publisher' && !publisherAllowed()) section = 'store';
  if (section === 'team' && !publisherAllowed()) section = 'store';
  if (section === 'moderation' && !moderatorAllowed()) section = 'store';
  S.section = ['library', 'publisher', 'team', 'moderation', 'downloads'].includes(section) ? section : 'store';
  S.view = S.section;
  els.storeView.hidden = S.section !== 'store';
  els.libraryView.hidden = S.section !== 'library';
  if (els.downloadsView) els.downloadsView.hidden = S.section !== 'downloads';
  if (els.publisherView) els.publisherView.hidden = S.section !== 'publisher';
  if (els.teamView) els.teamView.hidden = S.section !== 'team';
  if (els.moderationView) els.moderationView.hidden = S.section !== 'moderation';
  els.detailView.hidden = true;
  updateSidebar();
  if (S.section === 'library') renderLibrary();
  else if (S.section === 'downloads') renderDownloads();
  else if (S.section === 'publisher') {
    renderPublisher();
    loadPublisher();
  } else if (S.section === 'team') {
    renderTeams();
    loadTeams();
    loadTeamInvitations();
  } else if (S.section === 'moderation') {
    renderModeration();
    loadModeration();
  } else renderStore();
  requestAnimationFrame(() => {
    $('app').scrollTop = 0;
  });
}

function updateSidebar() {
  document.querySelectorAll('.side-link').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === S.section);
  });
  updatePublisherNav();
  updateModerationNav();
}

function renderCurrentSection() {
  if (S.section === 'library') renderLibrary();
  else if (S.section === 'downloads') renderDownloads();
  else if (S.section === 'publisher') renderPublisher();
  else if (S.section === 'team') renderTeams();
  else if (S.section === 'moderation') renderModeration();
  else renderStore();
}

function isInstalled(mode) {
  const st = S.state[mode.id];
  return !!(st && st.installed);
}

function inLibrary(mode) {
  const st = S.state[mode.id];
  if (!st) return false;
  if (typeof st.library === 'boolean') return st.library;
  return !!(st.installed && !st.hidden);
}

function isUpdate(mode) {
  const st = S.state[mode.id];
  return !!(
    st &&
    st.installed &&
    st.version !== mode.version &&
    st.skippedVersion !== mode.version
  );
}

function cardStatus(mode) {
  if (S.running === mode.id) return { cls: 'playing', text: 'В игре' };
  if (isUpdate(mode)) return { cls: 'update', text: 'Обновление' };
  if (isInstalled(mode)) return { cls: 'installed', text: 'Установлено' };
  if (inLibrary(mode)) return { cls: 'library', text: 'Не установлено' };
  return { cls: 'new', text: 'Доступно' };
}

function loaderLabel(mode) {
  return LOADER_LABELS[mode.loader] || mode.loader || 'Vanilla';
}

function modeSub(mode) {
  return `MC ${mode.mcVersion || '—'} · ${loaderLabel(mode)}`;
}

function modeAuthors(mode) {
  const list = Array.isArray(mode.authors) && mode.authors.length
    ? mode.authors
    : (mode.author ? [mode.author] : []);
  return [...new Set(list.filter((author) => author && author.name).map((author) => author.name))];
}

function cardSub(mode) {
  return `${modeSub(mode)}${mode.version ? ` · v${mode.version}` : ''}`;
}

function modeShortDescription(mode) {
  const short = String((mode && mode.shortDescription) || '').trim();
  if (short) return short;
  const full = String((mode && mode.description) || '').trim();
  if (!full) return 'Описание пока не заполнено.';
  return stripRichText(full).slice(0, 260) || 'Описание пока не заполнено.';
}

function modeFullDescription(mode) {
  return String((mode && mode.description) || '').trim() || modeShortDescription(mode);
}

function stripRichText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderRichText(value) {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '<p>Описание пока не заполнено.</p>';

  const inline = (raw) => escapeHtml(raw)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = text.split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const tag = heading[1].length === 1 ? 'h2' : heading[1].length === 2 ? 'h3' : 'h4';
      blocks.push(`<${tag}>${inline(heading[2].replace(/\*\*/g, ''))}</${tag}>`);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(inline(lines[index].replace(/^>\s?/, '')));
        index += 1;
      }
      blocks.push(`<blockquote>${quote.join('<br>')}</blockquote>`);
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim()
      && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|>\s?)/.test(lines[index])) {
      paragraph.push(inline(lines[index]));
      index += 1;
    }
    if (paragraph.length) blocks.push(`<p>${paragraph.join('<br>')}</p>`);
  }
  return blocks.join('');
}

function modeTags(mode, limit = 3) {
  const tags = Array.isArray(mode.tags) ? mode.tags.filter(Boolean) : [];
  return tags.slice(0, limit);
}

function sortByTitle(list) {
  return [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'));
}

function sortModes(list) {
  return [...list].sort((a, b) => {
    const ar = S.running === a.id ? 0 : 1;
    const br = S.running === b.id ? 0 : 1;
    if (ar !== br) return ar - br;
    const ai = isInstalled(a) ? 0 : 1;
    const bi = isInstalled(b) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
  });
}

function matchesSearch(mode) {
  if (!S.search) return true;
  const haystack = [
    mode.title,
    mode.description,
    mode.shortDescription,
    mode.mcVersion,
    mode.loader,
    ...modeAuthors(mode),
    ...(Array.isArray(mode.tags) ? mode.tags : [])
  ].join(' ').toLowerCase();
  return haystack.includes(S.search);
}

function filterModes() {
  return S.modes.filter(matchesSearch);
}

function updateSidebarCounts() {
  if (!els.sideLibCount) return;
  els.sideLibCount.textContent = String(S.modes.filter((mode) => inLibrary(mode)).length);
  els.sideInstalledCount.textContent = String(S.modes.filter((mode) => isInstalled(mode)).length);
}

function renderStore() {
  if (!els.storeView) return;

  const searchActive = !!S.search;

  if (S.loading) {
    els.featured.hidden = true;
    if (els.collections) {
      els.collections.hidden = true;
      els.collections.innerHTML = '';
    }
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
    if (els.collections) {
      els.collections.hidden = true;
      els.collections.innerHTML = '';
    }
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

  const recommended = collectionModes(
    (S.collections || []).find((section) => section.id === 'featured')
  ).filter((mode) => mode.imageUrl || mode.image);
  const featured = recommended[0] || S.modes.find((m) => m.imageUrl || m.image) || S.modes[0] || null;
  S.featuredId = featured ? featured.id : null;
  renderFeatured(featured);
  renderCollections();
  renderFeed();
  renderStoreNews();

  const list = sortCatalog(
    S.modes.filter((mode) => modePassesFilter(mode, S.storeFilter)),
    S.storeSort
  );
  const titles = {
    all: 'Все режимы',
    installed: 'Установленные',
    wishlist: 'Желаемое',
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

function renderLibrary() {
  if (!els.libraryView) return;
  updateDashboardStats();
  syncFilterButtons(els.libraryFilters, 'library-filter', S.libraryFilter);
  const updates = S.modes.filter((mode) => isUpdate(mode));
  if (els.libraryUpdateBanner) {
    els.libraryUpdateBanner.hidden = updates.length === 0 || S.updatesSnoozed;
  }
  if (els.libraryUpdateCount) els.libraryUpdateCount.textContent = String(updates.length);
  const source = S.libraryFilter === 'hidden'
    ? S.modes.filter((mode) => {
        const st = S.state[mode.id];
        return !!(st && st.hidden);
      })
    : S.modes.filter((mode) => inLibrary(mode));
  const list = sortCatalog(
    source.filter((mode) => matchesSearch(mode) && modePassesFilter(mode, S.libraryFilter)),
    S.librarySort
  );
  els.libraryCount.textContent = String(list.length);
  renderModeGrid(els.libraryGrid, list, true, true);
  const showEmpty = list.length === 0;
  els.libraryEmpty.hidden = !showEmpty;
  if (showEmpty) {
    if (S.search) {
      els.libraryEmptyTitle.textContent = 'Ничего не найдено';
      els.libraryEmptySub.textContent = 'Попробуй изменить запрос или выбрать другой фильтр';
    } else if (S.libraryFilter === 'hidden') {
      els.libraryEmptyTitle.textContent = 'Скрытых режимов нет';
      els.libraryEmptySub.textContent = 'Режимы, убранные из библиотеки, появятся здесь';
    } else if (S.libraryFilter === 'favorites') {
      els.libraryEmptyTitle.textContent = 'В избранном пусто';
      els.libraryEmptySub.textContent = 'Добавляй режимы в список желаемого, чтобы они появились здесь';
    } else if (S.libraryFilter === 'collections') {
      els.libraryEmptyTitle.textContent = 'В коллекциях пусто';
      els.libraryEmptySub.textContent = 'Режимы из подборок появятся здесь';
    } else {
      els.libraryEmptyTitle.textContent = 'Библиотека пуста';
      els.libraryEmptySub.textContent = 'Добавь режим в библиотеку, чтобы он появился здесь';
    }
  }
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

function collectionMode(item) {
  if (!item) return null;
  if (typeof item === 'string') return modeById(item);
  return modeById(item.slug || item.id);
}

function collectionModes(section) {
  if (!section || !Array.isArray(section.modes)) return [];
  const seen = new Set();
  const modes = [];
  for (const item of section.modes) {
    const mode = collectionMode(item);
    if (mode && !seen.has(mode.id)) {
      seen.add(mode.id);
      modes.push(mode);
    }
  }
  return modes;
}

function localCollections() {
  if (!S.modes.length) return [];
  const byInstalls = [...S.modes].sort(
    (a, b) => (Number(b.installs) || 0) - (Number(a.installs) || 0)
  );
  const byDate = [...S.modes].sort((a, b) =>
    String(modeReleaseDate(b) || '').localeCompare(String(modeReleaseDate(a) || ''))
  );
  const rated = S.modes
    .filter((mode) => Number(mode.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating));
  return [
    { id: 'featured', title: 'Рекомендуем', modes: rated.length ? rated : byInstalls },
    { id: 'popular', title: 'Популярное', modes: byInstalls },
    { id: 'new', title: 'Новинки', modes: byDate },
    { id: 'updated', title: 'Обновления', modes: byDate }
  ];
}

async function loadCollections() {
  if (!api.collectionsGet) return;
  try {
    const sections = await api.collectionsGet();
    S.collections = Array.isArray(sections) ? sections : [];
  } catch (_) {
    S.collections = [];
  }
  if (S.view === 'store' && !S.search) renderStore();
  if (S.section === 'library') renderLibrary();
}

function renderCollections() {
  const container = els.collections;
  if (!container) return;
  if (S.loading || S.search || S.storeFilter !== 'all') {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  const source = Array.isArray(S.collections) && S.collections.length
    ? S.collections
    : localCollections();
  const sections = source
    .map((section) => ({
      id: String((section && section.id) || ''),
      title: String((section && section.title) || ''),
      modes: collectionModes(section)
    }))
    .filter((section) => section.id && section.title && section.modes.length)
    .slice(0, 8);

  if (!sections.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  container.innerHTML = sections.map((section) => `
    <section class="shelf collection-shelf">
      <div class="shelf-head">
        <div class="shelf-title"><h2>${escapeHtml(section.title)}</h2></div>
        <span class="count">${section.modes.length}</span>
      </div>
      <div class="collection-row" data-collection-row></div>
    </section>
  `).join('');

  const rows = container.querySelectorAll('[data-collection-row]');
  sections.forEach((section, index) => {
    if (rows[index]) renderModeGrid(rows[index], section.modes.slice(0, 8), false, false, true);
  });
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

function renderModeGrid(container, list, withMenu = false, playMode = false, compact = false) {
  container.innerHTML = list
    .map((mode) => compact ? collectionCardHtml(mode) : modeCardHtml(mode, withMenu, playMode))
    .join('');
  container.onclick = (e) => {
    const menuBtn = e.target.closest('.card-menu-btn');
    if (menuBtn) {
      e.stopPropagation();
      const card = menuBtn.closest('.mode-card');
      if (!card || !card.dataset.id) return;
      const rect = menuBtn.getBoundingClientRect();
      openCardContext(card, rect.right - 208, rect.bottom + 6, playMode);
      return;
    }
    const action = e.target.closest('[data-card-action]');
    if (action) {
      e.stopPropagation();
      const card = action.closest('.mode-card');
      if (card && card.dataset.id) handleCardAction(card.dataset.id, action.dataset.cardAction, playMode);
      return;
    }
    closeCardMenus();
    const card = e.target.closest('.mode-card');
    if (card && card.dataset.id) {
      if (playMode) startMode(modeById(card.dataset.id), true);
      else openDetail(card.dataset.id);
    }
  };
  container.oncontextmenu = (e) => {
    const card = e.target.closest('.mode-card');
    if (!card || !card.dataset.id) return;
    e.preventDefault();
    e.stopPropagation();
    openCardContext(card, e.clientX, e.clientY, playMode);
  };
  container.querySelectorAll('img[data-fallback]').forEach((img) => {
    const card = img.closest('.mode-card');
    wireImage(img, card ? modeById(card.dataset.id) : null);
  });
  updateCardProgress();
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
      toast('Режим добавлен в библиотеку', 'ok');
    } catch (err) {
      toast('Не удалось добавить режим: ' + err, 'error');
    }
    return;
  }

  if (action === 'wish' || action === 'unwish') {
    try {
      if (action === 'wish') {
        await api.wishlistAdd(modeId);
        if (!S.wishlist.includes(modeId)) S.wishlist = [...S.wishlist, modeId];
        toast('Добавлено в избранное', 'ok');
      } else {
        await api.wishlistRemove(modeId);
        S.wishlist = S.wishlist.filter((id) => id !== modeId);
        toast('Убрано из избранного', 'ok');
      }
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
    } catch (err) {
      toast('Не удалось обновить избранное: ' + err, 'error');
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

  if (action === 'hide') {
    try {
      const res = await api.setLibrary(modeId, false);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Ошибка');
      const st = S.state[modeId] || { installed: false, version: null, installedAt: 0 };
      S.state[modeId] = { ...st, library: false, hidden: true };
      renderStore();
      renderLibrary();
      if (S.view === 'detail' && S.selectedId === modeId) renderDetail();
      toast('Режим убран из библиотеки', 'ok');
    } catch (err) {
      toast('Не удалось убрать режим: ' + err, 'error');
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

function libraryStateMeta(mode) {
  if (S.busy && S.busy.modeId === mode.id) {
    const percent = Math.max(0, Math.min(100, Math.round((Number(S.progress) || 0) * 100)));
    const kind = S.busy.action === 'update' ? 'update' : S.busy.action === 'play' ? 'ready' : 'install';
    const stage = String(S.stage || '').trim();
    const prefix = stage || (kind === 'update' ? 'Обновление' : kind === 'ready' ? 'Запуск' : 'Установка');
    return {
      cls: kind,
      label: `${prefix} ${percent}%`,
      icon: kind === 'update' ? 'update' : kind === 'ready' ? 'play' : 'install',
      action: 'play',
      busy: true
    };
  }
  const action = computeAction(mode);
  if (action === 'running') return { cls: 'running', label: 'Запущено', icon: 'stop', action: 'stop' };
  if (action === 'update') return { cls: 'update', label: 'Обновить', icon: 'update', action: 'play' };
  if (action === 'play') return { cls: 'ready', label: 'Готово к игре', icon: 'play', action: 'play' };
  return { cls: 'install', label: 'Установить', icon: 'install', action: 'play' };
}

function cardPlayIcon(kind) {
  if (kind === 'install') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10"/><path d="m7.5 10 4.5 4.5L16.5 10"/><path d="M5 19h14"/></svg>';
  }
  if (kind === 'update') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4v6h-6"/></svg>';
  }
  if (kind === 'stop') {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.8" fill="currentColor"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5a1 1 0 0 0-1.53.85Z"/></svg>';
}

function collectionCardHtml(mode) {
  const st = cardStatus(mode);
  const installed = isInstalled(mode);
  const updated = modeUpdatedAt(mode);
  return `
  <article class="mode-card collection-card ${installed ? 'installed' : ''}" data-id="${escapeHtml(mode.id)}">
    <div class="card-media">
      <img src="${escapeHtml(imageSrc(mode))}" alt="" loading="lazy" data-fallback>
      <div class="card-badge ${st.cls}">${st.text}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(mode.title || 'Без названия')}</div>
      <div class="card-sub">${escapeHtml(cardSub(mode))}</div>
      ${updated ? `<div class="card-release">Обновлено ${escapeHtml(formatUpdateDate(updated))}</div>` : ''}
      <div class="card-foot">
        <span class="card-installs">${Number(mode.installs) ? `${Number(mode.installs)} установок` : ''}</span>
        ${mode.rating ? `<span class="card-installs">★ ${Number(mode.rating).toFixed(1)}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function modeCardHtml(mode, withMenu = false, playMode = false) {
  const st = cardStatus(mode);
  const installed = isInstalled(mode);
  const updated = modeUpdatedAt(mode);
  const status = modeStatusMeta(mode);
  const stateMeta = playMode ? libraryStateMeta(mode) : null;
  const screenshots = (Array.isArray(mode.screenshots) ? mode.screenshots : [])
    .filter(Boolean)
    .slice(0, 3);
  const tags = modeTags(mode, 3)
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join('');
  return `
    <article class="mode-card ${installed ? 'installed' : ''}" data-id="${escapeHtml(mode.id)}">
      <div class="card-media">
        <img src="${escapeHtml(imageSrc(mode))}" alt="" loading="lazy" data-fallback>
        ${playMode ? `<button class="card-play state-${stateMeta.cls}" data-card-action="${stateMeta.action}" type="button" aria-label="${escapeHtml(stateMeta.action === 'stop' ? 'Закрыть игру' : stateMeta.label)}: ${escapeHtml(mode.title || 'режим')}" ${stateMeta.busy ? 'disabled' : ''}>${cardPlayIcon(stateMeta.icon)}</button>` : ''}
        <div class="card-badge ${st.cls}">${st.text}</div>
        ${playMode ? `<div class="card-progress" data-card-progress role="progressbar" aria-label="Прогресс" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><span></span></div>` : ''}
        ${withMenu ? `<button class="card-menu-btn" type="button" title="Действия" aria-label="Действия">⋯</button>` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(mode.title || 'Без названия')}</div>
        <div class="card-sub">${escapeHtml(cardSub(mode))}</div>
        ${modeAuthors(mode).length ? `<div class="card-author">${escapeHtml(modeAuthors(mode).join(', '))}</div>` : ''}
        ${screenshots.length ? `
          <div class="card-shots">
            ${screenshots.map((url) => `<img src="${escapeHtml(url)}" alt="" loading="lazy">`).join('')}
          </div>` : ''}
        ${status ? `<div class="card-status-row"><span class="mode-status ${status.cls}">${status.label}</span></div>` : ''}
        ${updated ? `<div class="card-release">Обновлено ${escapeHtml(formatUpdateDate(updated))}</div>` : ''}
        <div class="card-desc">${escapeHtml(modeShortDescription(mode))}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        <div class="card-foot">
          <span class="card-installs">${Number(mode.installs) ? `${Number(mode.installs)} установок` : ''}</span>
          ${mode.rating ? `<span class="card-installs">★ ${Number(mode.rating).toFixed(1)}</span>` : ''}
          <span class="card-size">${escapeHtml(mode.size || '-')}</span>
          ${playMode
            ? `<span class="card-state state-${stateMeta.cls}" data-card-state>${escapeHtml(stateMeta.label)}</span>`
            : `<button class="btn btn-small btn-ghost" type="button" aria-label="Подробнее: ${escapeHtml(mode.title || 'режим')}">Подробнее</button>`}
        </div>
      </div>
    </article>`;
}

function setEmpty(show, title, sub) {
  els.emptyState.hidden = !show;
  if (show) {
    els.emptyTitle.textContent = title;
    els.emptySub.textContent = sub;
  }
}

function accentColor(mode) {
  const raw = String((mode && mode.accent) || '').trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : DEFAULT_ACCENT;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} МБ`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} КБ`;
  return `${value} Б`;
}

function tagPill(tag) {
  const meta = UPDATE_TAGS[tag] || { label: tag, cls: 'tech' };
  return `<span class="tag-pill ${escapeHtml(meta.cls)}">${escapeHtml(meta.label)}</span>`;
}

function formatPlaytime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total <= 0) return '—';
  return `${(total / 3600).toFixed(1)} ч`;
}

function formatUpdateDate(value) {
  return String(value || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1');
}

function formatDateTime(value) {
  const ms = Number(value) || 0;
  if (!ms) return '—';
  return new Date(ms).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин`;
  return `${total} сек`;
}

function modeReleaseDate(mode) {
  const direct = String((mode && mode.releaseDate) || '').trim();
  if (direct) return direct;
  const history = Array.isArray(mode && mode.history) ? mode.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const date = String((history[index] && history[index].date) || '').trim();
    if (date) return date;
  }
  return '';
}

function formatHistoryStamp(entry) {
  const date = entry && entry.date ? formatUpdateDate(entry.date) : '';
  const time = String((entry && entry.time) || '').slice(0, 5);
  return [date, time].filter(Boolean).join(' ');
}

function latestUpdateEntry(mode) {
  if (Array.isArray(mode.history) && mode.history.length) {
    return mode.history[0];
  }
  const parsed = parseChangelog(mode)[0];
  if (!parsed) return null;
  const match = String(parsed.title || '').match(/^v?(\d+\.\d+(?:\.\d+)?)/i);
  return {
    version: match ? match[1] : parsed.title,
    title: '',
    tags: [],
    date: '',
    changes: parsed.lines
  };
}

function renderSpotlight(mode) {
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

function fallbackArt(mode) {
  const key = [mode.id, mode.title, mode.accent].join('|');
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);

  const accent = accentColor(mode);
  const words = String(mode.title || 'TM')
    .split(/\s+/)
    .map((word) => (word.match(/[A-Za-zА-Яа-я0-9]/) || [''])[0])
    .filter(Boolean);
  const initials = (words.slice(0, 2).join('') || 'T').toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#14141b"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0.5"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.76" cy="0.34" r="0.7">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="450" fill="url(#bg)"/>
    <rect width="800" height="450" fill="url(#glow)"/>
    <g stroke="#ffffff" stroke-opacity="0.07" stroke-width="1">
      <path d="M0 300 H800 M0 350 H800 M0 400 H800"/>
      <path d="M520 0 V450 M600 0 V450 M680 0 V450"/>
    </g>
    <text x="744" y="330" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="200" font-weight="800" fill="#ffffff" fill-opacity="0.9">${initials}</text>
    <text x="744" y="386" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="7" fill="#ffffff" fill-opacity="0.55">TM MODE</text>
  </svg>`;

  const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  ART_CACHE.set(key, url);
  return url;
}

function imageSrc(mode) {
  return mode.imageUrl || mode.image || fallbackArt(mode);
}

function wireImage(img, mode) {
  if (!img) return;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackArt(mode || { id: 'fallback', title: 'TM' });
  };
}

// ---------------------------------------------------------------- detail

function bindDetail() {
  els.detailBack.onclick = () => showStore();
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
  els.detailWishlist.onclick = () => toggleWishlist(modeById(S.selectedId));
  els.detailAuthorFollow.onclick = () => toggleFollowAuthor();
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

// ---------------------------------------------------------------- загрузки

const DOWNLOAD_STATUS = {
  queued: 'В очереди',
  downloading: 'Загрузка',
  paused: 'Пауза',
  completed: 'Готово',
  error: 'Ошибка',
  cancelled: 'Отменено'
};

function bindDownloads() {
  if (els.downloadsList) {
    els.downloadsList.onclick = (event) => {
      const button = event.target.closest('[data-download-action]');
      if (!button) return;
      const id = button.getAttribute('data-download-id');
      const action = button.getAttribute('data-download-action');
      if (action === 'pause') pauseDownload(id);
      else if (action === 'resume') resumeDownload(id);
      else if (action === 'cancel') cancelDownload(id);
      else if (action === 'retry') retryDownload(id);
      else if (action === 'remove') removeDownload(id);
    };
  }
  if (els.downloadsClear) {
    els.downloadsClear.onclick = () => clearDownloads();
  }
}

function parseDownloadSize(label) {
  const match = String(label || '').replace(',', '.').match(/([\d.]+)\s*(ГБ|МБ|КБ|GB|MB|KB|Б|B)/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2].toUpperCase();
  const multiplier = unit === 'ГБ' || unit === 'GB'
    ? 1024 ** 3
    : unit === 'МБ' || unit === 'MB'
      ? 1024 ** 2
      : unit === 'КБ' || unit === 'KB'
        ? 1024
        : 1;
  return value * multiplier;
}

function formatDownloadEta(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (value < 60) return `${Math.max(1, value)} с`;
  if (value < 3600) return `${Math.floor(value / 60)} мин`;
  return `${Math.floor(value / 3600)} ч ${Math.floor((value % 3600) / 60)} мин`;
}

function downloadActionLabel(action) {
  return { install: 'Установка', update: 'Обновление', repair: 'Исправление', play: 'Запуск' }[action] || 'Загрузка';
}

function activeDownloadTask() {
  return S.downloads.find((task) => task.id === S.downloadsActiveId) || null;
}

function downloadTaskForMode(modeId) {
  return S.downloads.find(
    (task) => task.modeId === modeId && ['queued', 'downloading', 'paused'].includes(task.status)
  ) || null;
}

function enqueueDownload(mode, action, autoPlay = false, silent = false) {
  if (!mode) return;
  const existing = downloadTaskForMode(mode.id);
  if (existing) {
    if (!silent) {
      toast(existing.status === 'downloading' ? 'Этот режим уже скачивается' : 'Этот режим уже в очереди', 'warn');
    }
    return;
  }
  const task = {
    id: `dl-${++S.downloadsSeq}`,
    modeId: mode.id,
    modeTitle: mode.title || mode.id,
    cover: imageSrc(mode),
    sizeLabel: mode.size || '',
    sizeBytes: parseDownloadSize(mode.size),
    action,
    autoPlay: !!autoPlay,
    status: 'queued',
    progress: 0,
    stage: 'В очереди',
    speed: 0,
    eta: 0,
    error: '',
    createdAt: Date.now(),
    startedAt: 0,
    lastTick: 0,
    lastProgress: 0
  };
  S.downloads.push(task);
  renderDownloads();
  pumpDownloads();
  if (!silent) {
    toast(action === 'update' ? 'Обновление добавлено в очередь' : 'Загрузка добавлена в очередь', 'info');
  }
}

function pumpDownloads() {
  if (S.downloadsActiveId || S.running) return;
  const task = S.downloads.find((item) => item.status === 'queued');
  if (!task) return;
  const mode = modeById(task.modeId);
  if (!mode) {
    task.status = 'error';
    task.stage = 'Ошибка';
    task.error = 'Режим не найден';
    renderDownloads();
    return pumpDownloads();
  }

  task.status = 'downloading';
  task.progress = 0;
  task.stage = 'Подготовка';
  task.speed = 0;
  task.eta = 0;
  task.error = '';
  task.startedAt = Date.now();
  task.lastTick = 0;
  task.lastProgress = 0;
  S.downloadsActiveId = task.id;
  S.busy = { modeId: mode.id, action: task.action };
  S.progress = 0;
  S.stage = task.stage;
  S.status = task.action === 'play' ? 'Запускаю Minecraft…' : 'Загружаю файлы…';
  S.pendingPlay = task.autoPlay ? mode.id : null;
  updateCardProgress();
  renderDownloads();
  if (S.view === 'detail' && S.selectedId === mode.id) updateDetailAction();

  const request = task.action === 'play' ? api.play(mode.id) : api.install(mode.id);
  Promise.resolve(request)
    .then((res) => {
      if (!res || !res.ok) {
        const error = String((res && res.error) || 'Не удалось начать операцию');
        if (error.includes('Дождитесь завершения текущей операции')) {
          task.status = 'queued';
          task.stage = 'В очереди';
          task.speed = 0;
          task.eta = 0;
          S.downloadsActiveId = null;
          if (S.busy && S.busy.modeId === task.modeId) S.busy = null;
          S.pendingPlay = null;
          renderDownloads();
          setTimeout(() => pumpDownloads(), 700);
          return;
        }
        failDownload(task.id, error);
      }
    })
    .catch((err) => failDownload(task.id, String(err)));
}

function finishDownload(taskId, status = 'completed') {
  const task = S.downloads.find((item) => item.id === taskId);
  if (!task) return;
  task.status = status;
  task.progress = 1;
  task.stage = status === 'completed' ? 'Готово' : task.stage;
  task.speed = 0;
  task.eta = 0;
  task.finishedAt = Date.now();
  if (S.downloadsActiveId === task.id) S.downloadsActiveId = null;
  if (S.busy && S.busy.modeId === task.modeId) S.busy = null;
  updateCardProgress();
  renderDownloads();
  renderStore();
  renderLibrary();
  if (S.view === 'detail') renderDetail();
  pumpDownloads();
}

function failDownload(taskId, error) {
  const task = S.downloads.find((item) => item.id === taskId);
  if (!task) return;
  task.status = 'error';
  task.stage = 'Ошибка';
  task.error = String(error || 'Не удалось выполнить загрузку');
  task.speed = 0;
  task.eta = 0;
  if (S.downloadsActiveId === task.id) S.downloadsActiveId = null;
  if (S.busy && S.busy.modeId === task.modeId) S.busy = null;
  S.pendingPlay = null;
  updateCardProgress();
  renderDownloads();
  renderStore();
  renderLibrary();
  if (S.view === 'detail') renderDetail();
  toast(task.error, 'error');
  pumpDownloads();
}

function pauseDownload(id) {
  const task = S.downloads.find((item) => item.id === id);
  if (!task) return;
  if (task.status === 'queued') {
    task.status = 'paused';
    task.stage = 'Пауза';
    renderDownloads();
    return;
  }
  if (task.status !== 'downloading') return;
  task.pauseRequested = true;
  task.status = 'paused';
  task.stage = 'Пауза';
  task.speed = 0;
  task.eta = 0;
  renderDownloads();
  if (S.downloadsActiveId === task.id) api.cancel().catch(() => {});
}

function resumeDownload(id) {
  const task = S.downloads.find((item) => item.id === id);
  if (!task) return;
  if (S.downloadsActiveId === task.id) {
    toast('Дождитесь остановки загрузки', 'warn');
    return;
  }
  if (!['paused', 'error', 'cancelled'].includes(task.status)) return;
  task.status = 'queued';
  task.progress = 0;
  task.stage = 'В очереди';
  task.speed = 0;
  task.eta = 0;
  task.error = '';
  task.pauseRequested = false;
  task.cancelRequested = false;
  task.lastTick = 0;
  task.lastProgress = 0;
  renderDownloads();
  pumpDownloads();
}

function retryDownload(id) {
  resumeDownload(id);
}

function cancelDownload(id) {
  const task = S.downloads.find((item) => item.id === id);
  if (!task) return;
  if (['completed', 'cancelled'].includes(task.status)) return;
  task.status = 'cancelled';
  task.stage = 'Отменено';
  task.speed = 0;
  task.eta = 0;
  if (S.downloadsActiveId === task.id) {
    task.cancelRequested = true;
    renderDownloads();
    api.cancel().catch(() => {});
    return;
  }
  renderDownloads();
  pumpDownloads();
}

function removeDownload(id) {
  if (S.downloadsActiveId === id) {
    toast('Сначала отмените загрузку', 'warn');
    return;
  }
  S.downloads = S.downloads.filter((task) => task.id !== id);
  renderDownloads();
}

function clearDownloads() {
  S.downloads = S.downloads.filter(
    (task) => !['completed', 'cancelled', 'error'].includes(task.status)
  );
  renderDownloads();
}

function updateDownloadProgress(task, progress) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const now = Date.now();
  if (!task.lastTick) {
    task.lastTick = now;
    task.lastProgress = clamped;
  } else {
    const dt = (now - task.lastTick) / 1000;
    const delta = clamped - task.lastProgress;
    if (dt >= 0.25 && delta > 0) {
      if (task.sizeBytes > 0) {
        const instant = (delta * task.sizeBytes) / dt;
        task.speed = task.speed > 0 ? task.speed * 0.65 + instant * 0.35 : instant;
      }
      task.lastTick = now;
      task.lastProgress = clamped;
    }
  }
  task.progress = clamped;
  if (task.sizeBytes > 0 && task.speed > 0) {
    task.eta = ((1 - clamped) * task.sizeBytes) / task.speed;
  } else if (task.startedAt && clamped > 0.01) {
    const elapsed = (now - task.startedAt) / 1000;
    task.eta = (elapsed * (1 - clamped)) / clamped;
  }
}

function updateDownloadsBadge() {
  if (!els.sideDownloadsCount) return;
  const count = S.downloads.filter((task) => ['queued', 'downloading'].includes(task.status)).length;
  els.sideDownloadsCount.textContent = String(count);
  els.sideDownloadsCount.hidden = count === 0;
}

function renderDownloads() {
  if (!els.downloadsView) return;
  const tasks = S.downloads || [];
  const queued = tasks.filter((task) => ['queued', 'paused'].includes(task.status)).length;
  const active = tasks.filter((task) => task.status === 'downloading').length;
  const done = tasks.filter((task) => task.status === 'completed').length;
  if (els.downloadsStatQueued) els.downloadsStatQueued.textContent = String(queued);
  if (els.downloadsStatActive) els.downloadsStatActive.textContent = String(active);
  if (els.downloadsStatDone) els.downloadsStatDone.textContent = String(done);
  updateDownloadsBadge();

  if (els.downloadsClear) {
    els.downloadsClear.hidden = !tasks.some((task) =>
      ['completed', 'cancelled', 'error'].includes(task.status)
    );
  }

  const order = { downloading: 0, queued: 1, paused: 2, error: 3, cancelled: 4, completed: 5 };
  const list = [...tasks].sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.createdAt - b.createdAt
  );
  if (els.downloadsList) {
    els.downloadsList.innerHTML = list.map(downloadCardHtml).join('');
  }
  if (els.downloadsEmpty) els.downloadsEmpty.hidden = list.length > 0;
  if (els.downloadsCount) els.downloadsCount.textContent = String(list.length);
}

function downloadCardHtml(task) {
  const mode = modeById(task.modeId);
  const title = (mode && mode.title) || task.modeTitle || task.modeId;
  const cover = (mode && imageSrc(mode)) || task.cover || '';
  const status = DOWNLOAD_STATUS[task.status] || task.status;
  const percent = Math.round(Math.max(0, Math.min(1, task.progress)) * 100);
  const stage = task.stage || DOWNLOAD_STATUS[task.status] || '';
  const size = task.sizeLabel || (mode && mode.size) || '';
  const speed = task.speed > 0 ? `${formatBytes(task.speed)}/с` : '—';
  const eta = task.eta > 0 && task.status !== 'completed' ? `~${formatDownloadEta(task.eta)}` : '—';
  const actions = [];
  if (task.status === 'downloading') {
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-download-action="pause" data-download-id="${escapeHtml(task.id)}">Пауза</button>`);
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-download-action="cancel" data-download-id="${escapeHtml(task.id)}">Отмена</button>`);
  } else if (task.status === 'queued') {
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-download-action="cancel" data-download-id="${escapeHtml(task.id)}">Отмена</button>`);
  } else if (task.status === 'paused') {
    actions.push(`<button class="btn btn-primary btn-small" type="button" data-download-action="resume" data-download-id="${escapeHtml(task.id)}">Продолжить</button>`);
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-download-action="cancel" data-download-id="${escapeHtml(task.id)}">Отмена</button>`);
  } else if (task.status === 'error' || task.status === 'cancelled') {
    actions.push(`<button class="btn btn-primary btn-small" type="button" data-download-action="retry" data-download-id="${escapeHtml(task.id)}">Повторить</button>`);
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-download-action="remove" data-download-id="${escapeHtml(task.id)}">Убрать</button>`);
  } else {
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-download-action="remove" data-download-id="${escapeHtml(task.id)}">Убрать</button>`);
  }

  return `
    <article class="download-card ${task.status}">
      <div class="download-cover">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">` : ''}
      </div>
      <div class="download-body">
        <div class="download-head">
          <div>
            <div class="download-title">${escapeHtml(title)}</div>
            <div class="download-sub">${escapeHtml(downloadActionLabel(task.action))}${size ? ` · ${escapeHtml(size)}` : ''}</div>
          </div>
          <span class="download-status ${task.status}">${escapeHtml(status)}</span>
        </div>
        <div class="download-progress"><span style="width:${percent}%"></span></div>
        <div class="download-meta">
          <span>${escapeHtml(stage)}</span>
          <span>${percent}%</span>
          <span>Скорость: ${speed}</span>
          <span>Осталось: ${eta}</span>
        </div>
        ${task.error ? `<div class="form-error">${escapeHtml(task.error)}</div>` : ''}
        <div class="download-actions">${actions.join('')}</div>
      </div>
    </article>`;
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
      return;
    }
    action = computeAction(mode);
    if (action === 'add' || action === 'running') return;
    if (action === 'play') {
      await startMode(mode, autoPlay);
      return;
    }
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
  actions.push({
    action: inLib ? 'hide' : 'addlib',
    label: inLib ? 'Убрать из библиотеки' : 'Добавить в библиотеку'
  });
  if (lavunioLoggedIn()) {
    const favorite = S.wishlist.includes(mode.id);
    actions.push({
      action: favorite ? 'unwish' : 'wish',
      label: favorite ? 'Убрать из избранного' : 'В избранное'
    });
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
  S.detailFrom = S.section || 'store';
  S.selectedId = id;
  els.storeView.hidden = true;
  els.libraryView.hidden = true;
  if (els.publisherView) els.publisherView.hidden = true;
  if (els.moderationView) els.moderationView.hidden = true;
  els.detailView.hidden = false;
  S.view = 'detail';
  els.detailBackLabel.textContent = S.detailFrom === 'library' ? 'Назад в библиотеку' : 'Назад в каталог';
  renderDetail();
  $('app').scrollTop = 0;
}

function showStore() {
  S.selectedId = null;
  const section = S.detailFrom || S.section || 'store';
  S.detailFrom = null;
  showSection(section);
}

function modeById(id) {
  return S.modes.find((m) => m.id === id) || null;
}

function computeAction(mode) {
  if (S.running === mode.id) return 'running';
  if (!inLibrary(mode)) return 'add';
  if (isUpdate(mode)) return 'update';
  if (isInstalled(mode)) return 'play';
  return 'install';
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
  if (!inLibrary(mode)) return 'Режим не добавлен в библиотеку';
  if (isUpdate(mode)) return 'Доступно обновление';
  if (isInstalled(mode)) return 'Готов к запуску';
  return 'Файлы ещё не скачаны';
}

function isChangelogHeading(line) {
  const text = String(line || '').trim();
  if (!text) return false;
  return /^(?:\[?v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?\]?)(?:\s|$|[-—:])/i.test(text)
    || /^(?:версия|обновление)\s+\d/i.test(text)
    || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(text);
}

function cleanChangelogLine(line) {
  return String(line || '').replace(/^[-—–•*]\s*/, '').trim();
}

function parseChangelog(mode) {
  const raw = (mode.changelog || '').trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (const line of lines) {
    if (isChangelogHeading(line)) {
      const title = line
        .replace(/^\[|\]$/g, '')
        .replace(/^(?:версия|обновление)\s+/i, '')
        .trim();
      current = { title, lines: [] };
      entries.push(current);
      continue;
    }

    if (!current) {
      current = {
        title: mode.version ? `Версия ${mode.version}` : 'Текущая версия',
        lines: []
      };
      entries.push(current);
    }

    const cleaned = cleanChangelogLine(line);
    if (cleaned) current.lines.push(cleaned);
  }

  return entries;
}

function changelogModel(mode) {
  if (Array.isArray(mode.history) && mode.history.length) {
    return mode.history.map((entry) => ({
      version: entry.version || '',
      title: entry.title || '',
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      date: entry.date || '',
      time: entry.time || '',
      lines: Array.isArray(entry.changes) ? entry.changes : []
    }));
  }
  return parseChangelog(mode).map((entry) => ({
    version: '',
    title: entry.title,
    tags: [],
    date: '',
    time: '',
    lines: entry.lines
  }));
}

function renderChangelog(mode) {
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

function updateChangelogToggle() {
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

function trailerEmbed(url) {
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

function renderTrailer(mode) {
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
  const stats = S.state[mode.id] || {};
  els.detailMeta.innerHTML = [
    ['Версия', 'v' + (mode.version || '—')],
    ['Minecraft', mode.mcVersion || '—'],
    ['Автор', modeAuthors(mode).join(', ') || '—'],
    ['Ядро', loaderLabel(mode)],
    ['Размер', mode.size || '—'],
    ['Установки', String(Number(mode.installs) || 0)],
    ['Рейтинг', mode.rating ? `${Number(mode.rating).toFixed(1)} ★ (${Number(mode.reviewsCount) || 0})` : '—'],
    ['Вышла', released ? formatUpdateDate(released) : '—'],
    ['Обновлено', updated],
    ['Наиграно', formatPlaytime(stats.playtimeSecs)],
    ['Последний запуск', formatDateTime(stats.lastPlayedAt)]
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

  const sessions = Array.isArray(stats.sessions) ? stats.sessions.slice().reverse().slice(0, 5) : [];
  els.detailSessionsSection.hidden = sessions.length === 0;
  els.detailSessions.innerHTML = sessions.map((session) => `
    <div class="session-row">
      <span>${escapeHtml(formatDateTime(session.startedAt))}</span>
      <b>${escapeHtml(formatDuration(session.seconds))}</b>
    </div>`).join('');

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

  const wishlisted = S.wishlist.includes(mode.id);
  els.detailWishlist.textContent = wishlisted ? 'В желаемом' : 'В список желаемого';
  els.detailWishlist.classList.toggle('active', wishlisted);

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
}

async function loadWishlist() {
  if (!lavunioLoggedIn() || !S.lavunio.configured) {
    S.wishlist = [];
    renderStore();
    renderLibrary();
    return;
  }
  try {
    const items = await api.wishlistGet();
    S.wishlist = Array.isArray(items) ? items : [];
  } catch (_) {
    S.wishlist = [];
  }
  renderStore();
  renderLibrary();
  if (S.view === 'detail') renderDetail();
}

async function toggleWishlist(mode) {
  if (!mode) return;
  if (!lavunioLoggedIn()) {
    openModal('modal-account');
    toast('Сначала войдите в Lavunio ID', 'warn');
    return;
  }
  const listed = S.wishlist.includes(mode.id);
  try {
    if (listed) {
      await api.wishlistRemove(mode.id);
      S.wishlist = S.wishlist.filter((id) => id !== mode.id);
    } else {
      await api.wishlistAdd(mode.id);
      S.wishlist = [...S.wishlist, mode.id];
    }
    renderStore();
    if (S.view === 'detail') renderDetail();
    toast(listed ? 'Убрано из желаемого' : 'Добавлено в желаемое', 'ok');
  } catch (err) {
    toast('Не удалось обновить желаемое: ' + err, 'error');
  }
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
      ? 'Скачать обновление'
      : 'Открыть релиз';
    $('modal-update').hidden = false;
  };
  els.btnUpdateDownload.onclick = async () => {
    const info = S.updateInfo;
    if (!info) return;
    if (!info.installerUrl) {
      api.openUrl(info.url).catch((err) => toast(String(err), 'error'));
      return;
    }
    els.btnUpdateDownload.disabled = true;
    els.btnUpdateDownload.textContent = 'Скачиваю…';
    try {
      await api.downloadUpdate(info.installerUrl);
      close();
      toast('Установщик открыт. Заверши установку обновления.', 'ok');
    } catch (err) {
      toast(String(err), 'error');
    } finally {
      els.btnUpdateDownload.disabled = false;
      els.btnUpdateDownload.textContent = 'Скачать обновление';
    }
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

async function finishStartup() {
  try {
    if (api.windowReady) await api.windowReady();
  } catch (_) {
    // Окно уже могло быть закрыто.
  }
  finishSplash();
}

async function handleStartupUpdate(pending) {
  const info = await withTimeout(pending, 900);
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

async function startAutoUpdate(info) {
  if (S.autoUpdating) return;
  S.autoUpdating = true;
  els.updateChip.hidden = true;
  showSplashUpdate(info);

  let unlisten = null;
  try {
    if (api.onUpdateProgress) {
      unlisten = await api.onUpdateProgress((payload) => {
        const total = Number(payload && payload.total) || 0;
        const downloaded = Number(payload && payload.downloaded) || 0;
        const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
        const status = total > 0
          ? `Скачивание… ${formatBytes(downloaded)} из ${formatBytes(total)}`
          : 'Скачивание обновления…';
        setSplashProgress(percent, status);
      });
    }

    await api.installUpdate(info.installerUrl);
    if (els.splashUpdate) els.splashUpdate.classList.add('installing');
    setSplashProgress(100, 'Устанавливаю обновление. Лаунчер сейчас закроется…');
    setTimeout(() => {
      api.close().catch(() => {});
    }, 800);
  } catch (err) {
    S.autoUpdating = false;
    hideSplashUpdate();
    els.updateChipText.textContent = `Обновление ${info.latest}`;
    els.updateChip.hidden = false;
    toast('Автообновление не удалось: ' + err, 'error');
    await finishStartup();
  } finally {
    if (typeof unlisten === 'function') unlisten();
  }
}

// ---------------------------------------------------------------- аккаунт

function lavunioLoggedIn() {
  return !!(S.lavunio && S.lavunio.user);
}

function lavunioName(user) {
  if (!user) return 'Гость';
  return user.displayName || user.username || 'Игрок';
}

function lavunioLetter(user) {
  const name = lavunioName(user);
  return name ? name[0].toUpperCase() : '?';
}

function applyLavunioAvatar(el, user) {
  if (!el) return;
  el.classList.remove('loaded', 'skin-head', 'lavunio-avatar');
  const url = user && user.skinUrl;
  if (url) {
    el.textContent = '';
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add('loaded', 'skin-head');
  } else {
    el.style.backgroundImage = '';
    el.textContent = lavunioLetter(user);
    el.classList.add('lavunio-avatar');
  }
}

function renderAccountChip() {
  const user = S.lavunio && S.lavunio.user;
  els.accName.textContent = user ? lavunioName(user) : 'Гость';
  applyLavunioAvatar(els.accAvatar, user);
}

function bindAccountModal() {
  els.accChip.onclick = () => openModal('modal-account');
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
  $('lavunio-verify-btn').onclick = () => verifyLavunioEmail();
  $('lavunio-skin-upload').onclick = () => uploadLavunioSkin();
  $('lavunio-skin-delete').onclick = () => deleteLavunioSkin();
  $('lavunio-cape-upload').onclick = () => uploadLavunioCape();
  $('lavunio-cape-delete').onclick = () => deleteLavunioCape();
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

    const capeImg = $('lavunio-cape-img');
    if (user.capeUrl) {
      capeImg.src = user.capeUrl;
      capeImg.hidden = false;
    } else {
      capeImg.removeAttribute('src');
      capeImg.hidden = true;
    }
    $('lavunio-cape-delete').hidden = !user.capeUrl;
  } else {
    const register = !!S.lavunioRegisterMode;
    $('lavunio-username-field').hidden = !register;
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
      ? await api.lavunioRegister(email, password, username || null)
      : await api.lavunioLogin(email, password);
    S.lavunio = status;
    $('lavunio-password').value = '';
    renderLavunioPane();
    renderAccountChip();
    loadWishlist();
    loadFollows();
    const name = status && status.user ? lavunioName(status.user) : '';
    toast(register ? 'Аккаунт Lavunio создан' : `С возвращением, ${name || 'игрок'}!`, 'ok');
    if (status && status.user && !status.user.emailVerified) {
      toast('Почта не подтверждена', 'warn');
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
  S.wishlist = [];
  S.reviews = {};
  S.follows = [];
  S.feed = [];
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

async function uploadLavunioSkin() {
  if (!lavunioLoggedIn()) return;
  let path;
  try {
    path = await api.pickSkin();
  } catch (err) {
    toast('Не удалось выбрать файл: ' + err, 'error');
    return;
  }
  if (!path) return;

  const button = $('lavunio-skin-upload');
  button.disabled = true;
  try {
    S.lavunio = await api.uploadSkin(path, $('lavunio-skin-model').value);
    renderLavunioPane();
    renderAccountChip();
    toast('Скин обновлён', 'ok');
  } catch (err) {
    toast('Не удалось загрузить скин: ' + err, 'error');
  } finally {
    button.disabled = false;
  }
}

async function deleteLavunioSkin() {
  if (!lavunioLoggedIn()) return;
  try {
    S.lavunio = await api.deleteSkin();
    renderLavunioPane();
    renderAccountChip();
    toast('Скин удалён', 'ok');
  } catch (err) {
    toast('Не удалось удалить скин: ' + err, 'error');
  }
}

async function uploadLavunioCape() {
  if (!lavunioLoggedIn()) return;
  let path;
  try {
    path = await api.pickCape();
  } catch (err) {
    toast('Не удалось выбрать файл: ' + err, 'error');
    return;
  }
  if (!path) return;

  const button = $('lavunio-cape-upload');
  button.disabled = true;
  try {
    S.lavunio = await api.uploadCape(path);
    renderLavunioPane();
    toast('Плащ обновлён', 'ok');
  } catch (err) {
    toast('Не удалось загрузить плащ: ' + err, 'error');
  } finally {
    button.disabled = false;
  }
}

async function deleteLavunioCape() {
  if (!lavunioLoggedIn()) return;
  try {
    S.lavunio = await api.deleteCape();
    renderLavunioPane();
    toast('Плащ удалён', 'ok');
  } catch (err) {
    toast('Не удалось удалить плащ: ' + err, 'error');
  }
}

// ---------------------------------------------------------------- настройки

function applyRamLimit() {
  if (!els.ram) return;
  const total = Math.floor(Number(S.systemRamGb) || 0);
  if (total < 2) return;
  els.ram.max = String(total);
  const current = Math.min(Math.max(2, Number(els.ram.value) || 4), total);
  els.ram.value = String(current);
  els.ramOut.textContent = `${current} ГБ`;
}

function bindSettings() {
  els.ram.addEventListener('input', () => {
    els.ramOut.textContent = `${els.ram.value} ГБ`;
  });
  $('btn-choose-dir').onclick = async () => {
    try {
      const dir = await api.chooseDir();
      if (!dir) return;
      els.setDir.value = dir;
      if (els.setDirSelect) {
        const exists = [...els.setDirSelect.options].some(
          (option) => option.value.toLowerCase() === dir.toLowerCase()
        );
        if (!exists) {
          const option = document.createElement('option');
          option.value = dir;
          option.textContent = dir;
          els.setDirSelect.appendChild(option);
        }
        els.setDirSelect.value = dir;
      }
      refreshDiskInfo();
    } catch (ex) {
      toast('Не удалось выбрать папку: ' + ex, 'error');
    }
  };
  if (els.setDirSelect) {
    els.setDirSelect.onchange = () => {
      els.setDir.value = els.setDirSelect.value;
      refreshDiskInfo();
    };
  }
  $('btn-open-dir').onclick = () => api.openGameFolder().catch(() => {});
  $('btn-open-logs').onclick = () => api.openLogs().catch((err) => {
    toast('Не удалось открыть папку логов: ' + err, 'error');
  });
  $('btn-save-settings').onclick = async () => {
    try {
      const s = await api.saveSettings({
        ramGb: Number(els.ram.value),
        dir: els.setDir.value.trim() || (S.settings && S.settings.dir) || '',
        javaPath: els.setJava.value.trim(),
        width: Number(els.setWidth.value) || 925,
        height: Number(els.setHeight.value) || 530,
        fullscreen: els.setFullscreen.checked,
        jvmFlags: els.setJvmFlags.checked
      });
      S.settings = s;
      closeModals();
      toast('Настройки сохранены', 'ok');
    } catch (err) {
      toast('Не удалось сохранить настройки: ' + err, 'error');
    }
  };
}

function fillSettingsForm() {
  const s = S.settings || {};
  const total = Math.floor(Number(S.systemRamGb) || 0);
  if (total >= 2) els.ram.max = String(total);
  const ram = Math.min(Number(s.ramGb) || 4, Number(els.ram.max) || 32);
  els.ram.value = String(ram);
  els.ramOut.textContent = `${ram} ГБ`;
  els.setDir.value = s.dir || '';
  fillDirOptions(s.dir || '', s.installDirs);
  els.setJava.value = s.javaPath || '';
  els.setWidth.value = s.width || 925;
  els.setHeight.value = s.height || 530;
  els.setFullscreen.checked = !!s.fullscreen;
  els.setJvmFlags.checked = s.jvmFlags !== false;
  refreshDiskInfo();
  if (api.getLogsPath) {
    api.getLogsPath().then((logsPath) => {
      els.setLogsPath.value = logsPath || '';
    }).catch(() => {});
  }
}

function fillDirOptions(current, installDirs) {
  if (!els.setDirSelect) return;
  const dirs = Array.isArray(installDirs) ? [...installDirs] : [];
  if (current && !dirs.some((dir) => dir.toLowerCase() === current.toLowerCase())) {
    dirs.unshift(current);
  }
  els.setDirSelect.innerHTML = '';
  dirs.forEach((dir) => {
    const option = document.createElement('option');
    option.value = dir;
    option.textContent = dir;
    els.setDirSelect.appendChild(option);
  });
  if (current) els.setDirSelect.value = current;
}

async function refreshDiskInfo() {
  if (!api.diskInfo || !els.settingsDiskInfo) return;
  const dir = els.setDir.value.trim();
  try {
    const info = await api.diskInfo(dir || null);
    if (!info) return;
    const free = formatBytes(info.availableBytes || 0);
    const total = formatBytes(info.totalBytes || 0);
    const library = formatBytes(info.libraryBytes || 0);
    els.settingsDiskInfo.textContent = `Свободно: ${free} из ${total} · Библиотека: ${library}`;
    els.settingsDiskInfo.classList.toggle(
      'warn',
      Number(info.availableBytes) > 0 && Number(info.availableBytes) < 2 * 1024 * 1024 * 1024
    );
  } catch (_) {}
}

// ---------------------------------------------------------------- модалки

function openModal(id) {
  if (id === 'modal-settings') {
    fillSettingsForm();
  }
  if (id === 'modal-account') {
    renderAccountModal();
    refreshLavunioStatus();
  }
  $(id).hidden = false;
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach((m) => (m.hidden = true));
}

let confirmResolve = null;

function askConfirm(title, text, okLabel = 'Удалить') {
  return new Promise((resolve) => {
    confirmResolve = resolve;
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
}

function closeTopModal() {
  const openModals = [...document.querySelectorAll('.modal-overlay:not([hidden])')];
  if (!openModals.length) return false;
  const top = openModals[openModals.length - 1];
  if (top.id === 'modal-confirm') {
    closeConfirm(false);
  } else {
    top.hidden = true;
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
      }
    };
  });
  document.querySelectorAll('.modal-overlay').forEach((ov) => {
    ov.addEventListener('mousedown', (e) => {
      if (e.target !== ov) return;
      if (ov.id === 'modal-confirm') closeConfirm(false);
      else ov.hidden = true;
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeTopModal()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });
}

// ---------------------------------------------------------------- утилиты

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

let toastTimer = null;
function toast(msg, type = 'info') {
  els.toast.textContent = msg;
  els.toast.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.className = ''), 3200);
}

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

function updatePublisherNav() {
  const allowed = publisherAllowed();
  const button = $('side-publisher');
  if (button) button.hidden = !allowed;
  const teamButton = $('side-team');
  if (teamButton) teamButton.hidden = !allowed;
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

function bindTeams() {
  const newButton = $('team-new');
  if (newButton) newButton.onclick = () => openTeamModal(null);
  const refresh = $('team-refresh');
  if (refresh) refresh.onclick = () => loadTeams(true);
  const form = $('team-form');
  if (form) form.onsubmit = (event) => {
    event.preventDefault();
    submitTeam();
  };
  const list = $('team-list');
  if (list) list.onclick = (event) => {
    const button = event.target.closest('button[data-team-action]');
    if (!button) return;
    const team = S.teams.find((item) => item.id === button.dataset.id);
    if (!team) return;
    if (button.dataset.teamAction === 'edit') openTeamModal(team);
    else if (button.dataset.teamAction === 'archive') archiveTeam(team);
    else if (button.dataset.teamAction === 'members') openTeamMembers(team);
    else if (button.dataset.teamAction === 'page') openTeamPage(team);
  };
  const invitations = $('team-invitations');
  if (invitations) invitations.onclick = (event) => {
    const button = event.target.closest('button[data-invite-action]');
    if (!button) return;
    if (button.dataset.inviteAction === 'accept') acceptTeamInvitation(button.dataset.id);
    else if (button.dataset.inviteAction === 'decline') declineTeamInvitation(button.dataset.id);
  };
  const inviteForm = $('team-invite-form');
  if (inviteForm) inviteForm.onsubmit = (event) => {
    event.preventDefault();
    submitTeamInvite();
  };
  const membersList = $('team-members-list');
  if (membersList) {
    membersList.onchange = (event) => {
      const select = event.target.closest('select[data-member-role]');
      if (!select) return;
      changeTeamMemberRole(select.dataset.user, select.value);
    };
    membersList.onclick = (event) => {
      const button = event.target.closest('button[data-member-remove]');
      if (!button) return;
      removeTeamMember(button.dataset.memberRemove);
    };
  }
  const page = $('team-page-content');
  if (page) page.onclick = (event) => {
    const modeButton = event.target.closest('[data-team-mode]');
    if (modeButton) {
      $('modal-team-page').hidden = true;
      openDetail(modeButton.dataset.teamMode);
      return;
    }
    const requestButton = event.target.closest('button[data-team-request]');
    if (requestButton) {
      resolveTeamJoinRequest(requestButton.dataset.id, requestButton.dataset.teamRequest);
      return;
    }
    const button = event.target.closest('button[data-team-page-action]');
    if (!button) return;
    const team = S.teamPage;
    if (!team) return;
    const action = button.dataset.teamPageAction;
    if (action === 'members') openTeamMembers(team);
    else if (action === 'join-requests') showTeamJoinRequests(team);
    else if (action === 'news') openTeamNews(team);
    else if (action === 'edit') openTeamModal(team);
    else if (action === 'transfer') openTeamTransfer(team);
    else if (action === 'follow') followTeam(team);
    else if (action === 'unfollow') unfollowTeam(team);
    else if (action === 'join') openTeamJoin(team);
    else if (action === 'verify') toggleTeamVerified(team);
  };
  const joinForm = $('team-join-form');
  if (joinForm) joinForm.onsubmit = (event) => { event.preventDefault(); submitTeamJoin(); };
  const newsForm = $('team-news-form');
  if (newsForm) newsForm.onsubmit = (event) => { event.preventDefault(); submitTeamNews(); };
  const transferForm = $('team-transfer-form');
  if (transferForm) transferForm.onsubmit = (event) => { event.preventDefault(); submitTeamTransfer(); };
  const title = $('team-title');
  const slug = $('team-slug');
  if (title && slug) {
    title.oninput = () => {
      if (!slug.dataset.touched) slug.value = publisherSlug(title.value);
    };
    slug.oninput = () => { slug.dataset.touched = '1'; };
  }
}

function teamRoleLabel(role) {
  return ({
    owner: 'владелец',
    admin: 'администратор',
    publisher: 'публикатор',
    designer: 'дизайнер',
    member: 'участник'
  })[role] || role;
}

function renderTeams() {
  if (!els.teamList) return;
  const teams = S.teams || [];
  if (els.teamStatCount) els.teamStatCount.textContent = String(teams.length);
  if (els.teamHint) {
    els.teamHint.textContent = S.teamsLoading && !S.teamsLoaded
      ? 'Загрузка…'
      : teams.length
        ? `Команд: ${teams.length}`
        : 'Создай первую команду';
  }
  if (els.teamEmpty) els.teamEmpty.hidden = teams.length > 0;
  els.teamList.innerHTML = teams.map((team) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(team.title)}</div>
          <div class="pub-sub">${escapeHtml(team.slug)} · ${escapeHtml(teamRoleLabel(team.role))}</div>
        </div>
        <span class="pub-status ${team.status === 'active' ? 'published' : 'hidden'}">${team.status === 'active' ? 'Активна' : 'В архиве'}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(team.description || 'Без описания')}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-team-action="page" data-id="${escapeHtml(team.id)}">Страница</button>
        <button class="btn btn-ghost" type="button" data-team-action="members" data-id="${escapeHtml(team.id)}">Участники</button>
        <button class="btn btn-ghost" type="button" data-team-action="edit" data-id="${escapeHtml(team.id)}">Редактировать</button>
        ${team.role === 'owner' ? `<button class="btn btn-ghost" type="button" data-team-action="archive" data-id="${escapeHtml(team.id)}">В архив</button>` : ''}
      </div>
    </article>
  `).join('');
}

async function loadTeams(force = false) {
  if (!publisherAllowed()) return;
  if (S.teamsLoading) return;
  if (S.teamsLoaded && !force) {
    renderTeams();
    return;
  }
  S.teamsLoading = true;
  renderTeams();
  try {
    const teams = await api.teamsMine();
    S.teams = Array.isArray(teams) ? teams : [];
    S.teamsLoaded = true;
  } catch (err) {
    toast('Не удалось загрузить команды: ' + err, 'error');
  } finally {
    S.teamsLoading = false;
    renderTeams();
  }
}

function openTeamModal(team) {
  S.teamEditing = team || null;
  $('team-modal-title').textContent = team ? 'Редактировать команду' : 'Новая команда';
  $('team-submit').textContent = team ? 'Сохранить' : 'Создать команду';
  $('team-title').value = team ? team.title : '';
  $('team-slug').value = team ? team.slug : '';
  $('team-slug').dataset.touched = team ? '1' : '';
  $('team-description').value = team ? team.description : '';
  $('team-links').value = team && team.links ? team.links : '';
  $('team-avatar').value = team && team.avatarUrl ? team.avatarUrl : '';
  $('team-banner').value = team && team.bannerUrl ? team.bannerUrl : '';
  $('team-join-mode').value = team && team.joinMode ? team.joinMode : 'invite';
  $('team-error').hidden = true;
  openModal('modal-team');
  setTimeout(() => $('team-title').focus(), 50);
}

async function submitTeam() {
  const editing = S.teamEditing;
  const payload = {
    slug: $('team-slug').value.trim(),
    title: $('team-title').value.trim(),
    description: $('team-description').value.trim(),
    links: $('team-links').value.trim(),
    avatarUrl: $('team-avatar').value.trim() || null,
    bannerUrl: $('team-banner').value.trim() || null,
    joinMode: $('team-join-mode').value
  };
  const error = $('team-error');
  if (!payload.title) {
    error.textContent = 'Укажи название команды';
    error.hidden = false;
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(payload.slug)) {
    error.textContent = 'Slug: 3–64 символа, строчные латинские буквы, цифры и дефис';
    error.hidden = false;
    return;
  }
  const button = $('team-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    if (editing) await api.teamUpdate(editing.id, payload);
    else await api.teamCreate(payload);
    $('modal-team').hidden = true;
    S.teamsLoaded = false;
    toast(editing ? 'Команда обновлена' : 'Команда создана', 'ok');
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || 'Не удалось сохранить команду');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

async function archiveTeam(team) {
  if (!team) return;
  const confirmed = await askConfirm(
    'Архивировать команду?',
    `Команда «${team.title}» будет скрыта. Режимы и история сохранятся.`,
    'В архив'
  );
  if (!confirmed) return;
  try {
    await api.teamArchive(team.id);
    toast('Команда в архиве', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    toast('Не удалось архивировать команду: ' + err, 'error');
  }
}

function renderTeamInvitations() {
  const box = els.teamInvitations;
  if (!box) return;
  const items = S.teamInvitations || [];
  box.hidden = items.length === 0;
  box.innerHTML = items.map((invitation) => `
    <div class="team-invite-card">
      <div class="team-invite-copy">
        <b>Приглашение в «${escapeHtml(invitation.teamTitle)}»</b>
        <span>${escapeHtml(invitation.inviterName)} приглашает на роль «${escapeHtml(teamRoleLabel(invitation.role))}»</span>
      </div>
      <div class="team-invite-actions">
        <button class="btn btn-primary btn-small" type="button" data-invite-action="accept" data-id="${escapeHtml(invitation.id)}">Принять</button>
        <button class="btn btn-ghost btn-small" type="button" data-invite-action="decline" data-id="${escapeHtml(invitation.id)}">Отклонить</button>
      </div>
    </div>
  `).join('');
}

async function loadTeamInvitations() {
  if (!publisherAllowed() || !api.teamInvitations) return;
  try {
    const items = await api.teamInvitations();
    S.teamInvitations = Array.isArray(items) ? items : [];
  } catch (_) {
    S.teamInvitations = [];
  }
  renderTeamInvitations();
}

async function acceptTeamInvitation(invitationId) {
  try {
    await api.teamInvitationAccept(invitationId);
    toast('Приглашение принято', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
    await loadTeamInvitations();
  } catch (err) {
    toast('Не удалось принять приглашение: ' + err, 'error');
  }
}

async function declineTeamInvitation(invitationId) {
  try {
    await api.teamInvitationDecline(invitationId);
    toast('Приглашение отклонено', 'info');
    await loadTeamInvitations();
  } catch (err) {
    toast('Не удалось отклонить приглашение: ' + err, 'error');
  }
}

function canManageTeam(team) {
  const user = S.lavunio && S.lavunio.user;
  return !!user && (user.role === 'admin' || (team && (team.role === 'owner' || team.role === 'admin')));
}

function memberRoleOptions(current) {
  return ['admin', 'publisher', 'designer', 'member'].map((role) =>
    `<option value="${role}" ${role === current ? 'selected' : ''}>${escapeHtml(teamRoleLabel(role))}</option>`
  ).join('');
}

async function openTeamMembers(team) {
  if (!team) return;
  S.teamMembersTeam = team;
  $('team-members-title').textContent = `Участники · ${team.title}`;
  $('team-members-hint').textContent = 'Загрузка…';
  $('team-members-list').innerHTML = '';
  $('team-invite-form').hidden = true;
  openModal('modal-team-members');
  try {
    const profile = await api.teamProfile(team.slug);
    const members = Array.isArray(profile && profile.members) ? profile.members : [];
    S.teamMembers = members;
    renderTeamMembers(team, members);
  } catch (err) {
    $('team-members-hint').textContent = 'Не удалось загрузить участников: ' + err;
  }
}

function renderTeamMembers(team, members) {
  const manage = canManageTeam(team);
  $('team-members-hint').textContent = `Участников: ${members.length}`;
  els.teamMembersList.innerHTML = members.map((member) => `
    <div class="team-member-row">
      <div class="grow">
        <div class="name">${escapeHtml(member.displayName || member.username)}</div>
        <div class="sub">@${escapeHtml(member.username)} · ${escapeHtml(teamRoleLabel(member.role))}</div>
      </div>
      ${manage && member.role !== 'owner'
        ? `<select data-member-role data-user="${escapeHtml(member.userId)}">${memberRoleOptions(member.role)}</select>
           <button class="btn btn-ghost btn-small" type="button" data-member-remove="${escapeHtml(member.userId)}">Удалить</button>`
        : ''}
    </div>
  `).join('');
  $('team-invite-form').hidden = !manage;
}

async function submitTeamInvite() {
  const team = S.teamMembersTeam;
  if (!team) return;
  const username = $('team-invite-username').value.trim();
  const role = $('team-invite-role').value;
  const error = $('team-invite-error');
  if (!username) {
    error.textContent = 'Укажи username';
    error.hidden = false;
    return;
  }
  const button = $('team-invite-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamInvite(team.id, username, role);
    $('team-invite-username').value = '';
    toast('Приглашение отправлено', 'ok');
  } catch (err) {
    error.textContent = String(err || 'Не удалось отправить приглашение');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

async function changeTeamMemberRole(userId, role) {
  const team = S.teamMembersTeam;
  if (!team) return;
  try {
    await api.teamMemberRole(team.id, userId, role);
    toast('Роль обновлена', 'ok');
    await openTeamMembers(team);
  } catch (err) {
    toast('Не удалось изменить роль: ' + err, 'error');
    await openTeamMembers(team);
  }
}

async function removeTeamMember(userId) {
  const team = S.teamMembersTeam;
  if (!team) return;
  const confirmed = await askConfirm(
    'Удалить участника?',
    'Участник покинет команду. Его авторство в опубликованных режимах сохранится.',
    'Удалить'
  );
  if (!confirmed) return;
  try {
    await api.teamMemberRemove(team.id, userId);
    toast('Участник удалён', 'ok');
    await openTeamMembers(team);
    S.teamsLoaded = false;
  } catch (err) {
    toast('Не удалось удалить участника: ' + err, 'error');
  }
}

async function openTeamPage(team) {
  if (!team) return;
  S.teamPage = team;
  S.teamPageData = null;
  $('team-page-title').textContent = team.title;
  els.teamPageContent.innerHTML = '<div class="mod-empty">Загрузка страницы…</div>';
  openModal('modal-team-page');
  try {
    const profile = api.teamProfilePublic
      ? await api.teamProfilePublic(team.slug)
      : await api.teamProfile(team.slug);
    S.teamPageData = profile;
    renderTeamPage(team, profile);
  } catch (err) {
    els.teamPageContent.innerHTML = `<div class="mod-empty">Не удалось загрузить команду: ${escapeHtml(String(err))}</div>`;
  }
}

function renderTeamPage(team, profile) {
  const data = profile && profile.team ? profile.team : {};
  const stats = profile && profile.stats ? profile.stats : {};
  const members = Array.isArray(profile && profile.members) ? profile.members : [];
  const modes = Array.isArray(profile && profile.modes) ? profile.modes : [];
  const news = Array.isArray(profile && profile.news) ? profile.news : [];
  const manage = canManageTeam(team);
  const isMember = !!team.role;
  const user = S.lavunio && S.lavunio.user;
  const actions = [];
  if (manage) {
    actions.push({ action: 'members', label: 'Участники' });
    if (data.joinMode !== 'invite') actions.push({ action: 'join-requests', label: 'Заявки' });
    actions.push({ action: 'news', label: 'Новость' });
    actions.push({ action: 'edit', label: 'Редактировать' });
  }
  if (team.role === 'owner') actions.push({ action: 'transfer', label: 'Передать владение' });
  if (user && user.role === 'admin') {
    actions.push({ action: 'verify', label: data.verified ? 'Снять галочку' : 'Подтвердить' });
  }
  if (!isMember) {
    if (data.joinMode !== 'invite') actions.push({ action: 'join', label: data.joinMode === 'open' ? 'Вступить' : 'Подать заявку' });
    actions.push({ action: 'follow', label: 'Подписаться' });
  }
  const actionHtml = actions.map((item) => `
    <button class="btn btn-ghost" type="button" data-team-page-action="${item.action}">${escapeHtml(item.label)}</button>
  `).join('');

  $('team-page-title').textContent = `${data.title || team.title}${data.verified ? ' ✓' : ''}`;
  els.teamPageContent.innerHTML = `
    <div class="hint">${escapeHtml(data.description || 'Без описания')}</div>
    ${data.links ? `<div class="hint">${escapeHtml(data.links)}</div>` : ''}
    <div class="dashboard-stats team-page-stats">
      <div class="dash-stat"><span>Режимы</span><b>${Number(stats.modes) || 0}</b></div>
      <div class="dash-stat"><span>Опубликовано</span><b>${Number(stats.published) || 0}</b></div>
      <div class="dash-stat"><span>Скачивания</span><b>${Number(stats.downloads) || 0}</b></div>
      <div class="dash-stat"><span>Установки</span><b>${Number(stats.installs) || 0}</b></div>
      <div class="dash-stat"><span>Подписчики</span><b>${Number(profile && profile.followers) || 0}</b></div>
    </div>
    <div class="pub-release-actions team-page-actions">${actionHtml}</div>
    <div id="team-page-requests"></div>
    <h3 class="team-page-heading">Участники</h3>
    <div class="team-members-list">
      ${members.map((member) => `
        <div class="team-member-row">
          <div class="grow">
            <div class="name">${escapeHtml(member.displayName || member.username)}</div>
            <div class="sub">@${escapeHtml(member.username)} · ${escapeHtml(teamRoleLabel(member.role))}</div>
          </div>
        </div>
      `).join('') || '<div class="hint">Участников нет</div>'}
    </div>
    <h3 class="team-page-heading">Режимы</h3>
    <div class="team-mode-list">
      ${modes.map((mode) => `
        <button class="team-mode-row" type="button" data-team-mode="${escapeHtml(mode.slug)}">
          <span>${escapeHtml(mode.title)}</span>
          <b>${Number(mode.installs) || 0} установок</b>
        </button>
      `).join('') || '<div class="hint">Опубликованных режимов пока нет</div>'}
    </div>
    <h3 class="team-page-heading">Новости</h3>
    <div class="team-news-list">
      ${news.map((item) => `
        <div class="session-row">
          <span>${escapeHtml(item.title)}</span>
          <b>${escapeHtml(publisherDate(item.createdAt))}</b>
        </div>
      `).join('') || '<div class="hint">Новостей пока нет</div>'}
    </div>
  `;
}

async function showTeamJoinRequests(team) {
  const box = $('team-page-requests');
  if (!box || !team) return;
  box.innerHTML = '<div class="hint">Загрузка заявок…</div>';
  try {
    const items = await api.teamJoinRequests(team.id);
    const list = Array.isArray(items) ? items : [];
    box.innerHTML = `
      <h3 class="team-page-heading">Заявки на вступление</h3>
      ${list.length ? list.map((item) => `
        <div class="session-row">
          <span>@${escapeHtml(item.username)} · ${escapeHtml(item.displayName || '')}</span>
          <span>
            <button class="btn btn-primary btn-small" type="button" data-team-request="accept" data-id="${escapeHtml(item.id)}">Принять</button>
            <button class="btn btn-ghost btn-small" type="button" data-team-request="reject" data-id="${escapeHtml(item.id)}">Отклонить</button>
          </span>
        </div>
      `).join('') : '<div class="hint">Заявок нет</div>'}
    `;
  } catch (err) {
    box.innerHTML = `<div class="hint">Не удалось загрузить заявки: ${escapeHtml(String(err))}</div>`;
  }
}

async function resolveTeamJoinRequest(requestId, action) {
  const team = S.teamPage;
  if (!team) return;
  try {
    await api.teamResolveJoinRequest(team.id, requestId, action);
    toast(action === 'accept' ? 'Заявка принята' : 'Заявка отклонена', 'ok');
    await showTeamJoinRequests(team);
    await openTeamPage(team);
  } catch (err) {
    toast('Не удалось рассмотреть заявку: ' + err, 'error');
  }
}

function openTeamJoin(team) {
  if (!team) return;
  S.teamJoinTeam = team;
  $('team-join-info').textContent = `Команда «${team.title}»`;
  $('team-join-message').value = '';
  $('team-join-error').hidden = true;
  openModal('modal-team-join');
  setTimeout(() => $('team-join-message').focus(), 50);
}

async function submitTeamJoin() {
  const team = S.teamJoinTeam;
  if (!team) return;
  const message = $('team-join-message').value.trim();
  const error = $('team-join-error');
  const button = $('team-join-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    const result = await api.teamJoin(team.id, message);
    $('modal-team-join').hidden = true;
    toast(result && result.status === 'joined' ? 'Ты вступил в команду' : 'Заявка отправлена', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || 'Не удалось отправить заявку');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

function openTeamNews(team) {
  if (!team) return;
  S.teamNewsTeam = team;
  $('team-news-title').value = '';
  $('team-news-body').value = '';
  $('team-news-error').hidden = true;
  openModal('modal-team-news');
  setTimeout(() => $('team-news-title').focus(), 50);
}

async function submitTeamNews() {
  const team = S.teamNewsTeam;
  if (!team) return;
  const title = $('team-news-title').value.trim();
  const body = $('team-news-body').value.trim();
  const error = $('team-news-error');
  if (title.length < 3 || body.length < 3) {
    error.textContent = 'Заполни заголовок и текст';
    error.hidden = false;
    return;
  }
  const button = $('team-news-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamCreateNews(team.id, title, body);
    $('modal-team-news').hidden = true;
    toast('Новость опубликована', 'ok');
    await openTeamPage(team);
  } catch (err) {
    error.textContent = String(err || 'Не удалось опубликовать новость');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

function openTeamTransfer(team) {
  if (!team) return;
  S.teamTransferTeam = team;
  $('team-transfer-username').value = '';
  $('team-transfer-error').hidden = true;
  openModal('modal-team-transfer');
  setTimeout(() => $('team-transfer-username').focus(), 50);
}

async function submitTeamTransfer() {
  const team = S.teamTransferTeam;
  if (!team) return;
  const username = $('team-transfer-username').value.trim();
  const error = $('team-transfer-error');
  if (!username) {
    error.textContent = 'Укажи username';
    error.hidden = false;
    return;
  }
  const button = $('team-transfer-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamTransfer(team.id, username);
    $('modal-team-transfer').hidden = true;
    toast('Владение передано', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || 'Не удалось передать владение');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

async function followTeam(team) {
  try {
    await api.teamFollow(team.id);
    toast('Подписка оформлена', 'ok');
    await openTeamPage(team);
  } catch (err) {
    toast('Не удалось подписаться: ' + err, 'error');
  }
}

async function unfollowTeam(team) {
  try {
    await api.teamUnfollow(team.id);
    toast('Подписка отменена', 'info');
    await openTeamPage(team);
  } catch (err) {
    toast('Не удалось отписаться: ' + err, 'error');
  }
}

async function toggleTeamVerified(team) {
  try {
    await api.teamVerify(team.id, !team.verified);
    toast('Статус команды обновлён', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
    await openTeamPage(S.teams.find((item) => item.id === team.id) || team);
  } catch (err) {
    toast('Не удалось изменить статус: ' + err, 'error');
  }
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
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
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
    else if (action === 'collection-delete') deleteModerationCollection(id, title);
  };

  updateModerationNav();
}

function setModerationTab(tab) {
  S.moderationTab = ['queue', 'modes', 'reviews', 'collections', 'reports', 'appeals', 'applications', 'news', 'history'].includes(tab) ? tab : 'queue';
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
    const [queue, modes, reports, reviews, collections, history, appeals, applications] = await Promise.all([
      api.adminQueue(),
      api.adminModes(),
      api.adminReports(),
      api.adminReviews(),
      api.adminCollections(),
      api.adminHistory(),
      api.adminAppeals(),
      api.adminAuthorApplications()
    ]);
    S.moderationQueue = Array.isArray(queue) ? queue : [];
    S.moderationModes = Array.isArray(modes) ? modes : [];
    S.moderationReports = Array.isArray(reports) ? reports : [];
    S.moderationReviews = Array.isArray(reviews) ? reviews : [];
    S.moderationCollections = Array.isArray(collections) ? collections : [];
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
  } else if (S.moderationTab === 'collections') {
    content.innerHTML = moderationCollectionsHtml();
    const form = content.querySelector('#mod-collection-form');
    if (form) {
      form.onsubmit = (event) => {
        event.preventDefault();
        submitCollection();
      };
    }
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

function moderationCollectionsHtml() {
  const items = S.moderationCollections || [];
  const list = items.length
    ? items.map((item) => `
      <article class="pub-card">
        <div class="pub-card-head">
          <div>
            <div class="pub-title">${escapeHtml(item.title)}</div>
            <div class="pub-sub">${escapeHtml(item.slug)}</div>
          </div>
          <span class="pub-status published">Опубликована</span>
        </div>
        <div class="pub-meta">
          <span>Режимы: ${escapeHtml((item.modeSlugs || []).join(', ') || 'пусто')}</span>
          <span>Порядок: ${Number(item.sortOrder) || 0}</span>
        </div>
        ${item.description ? `<div class="mod-changelog">${escapeHtml(item.description)}</div>` : ''}
        <div class="pub-release-actions">
          <button class="btn btn-ghost" type="button" data-action="collection-delete" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}">Удалить</button>
        </div>
      </article>
    `).join('')
    : '<div class="mod-empty">Ручных подборок пока нет.</div>';

  return `
    <form id="mod-collection-form" class="mod-news-form" autocomplete="off">
      <div class="field">
        <label for="mod-collection-slug">Slug</label>
        <input id="mod-collection-slug" type="text" maxlength="64" placeholder="staff-picks">
      </div>
      <div class="field">
        <label for="mod-collection-title">Название</label>
        <input id="mod-collection-title" type="text" maxlength="120" placeholder="Выбор редакции">
      </div>
      <div class="field">
        <label for="mod-collection-description">Описание</label>
        <textarea id="mod-collection-description" rows="2" placeholder="Коротко о подборке"></textarea>
      </div>
      <div class="field">
        <label for="mod-collection-modes">Режимы (slug через запятую)</label>
        <input id="mod-collection-modes" type="text" placeholder="night-demon, eclipse">
      </div>
      <div class="field">
        <label for="mod-collection-order">Порядок</label>
        <input id="mod-collection-order" type="number" value="0">
      </div>
      <div class="form-error" id="mod-collection-error" hidden></div>
      <button class="btn btn-primary" id="mod-collection-submit" type="submit">Создать подборку</button>
    </form>
    <div class="mod-news-list">${list}</div>
  `;
}

async function submitCollection() {
  const slug = $('mod-collection-slug').value.trim().toLowerCase();
  const title = $('mod-collection-title').value.trim();
  const description = $('mod-collection-description').value.trim();
  const modeSlugs = $('mod-collection-modes').value
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const sortOrder = Number($('mod-collection-order').value) || 0;
  const error = $('mod-collection-error');
  const button = $('mod-collection-submit');
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    error.textContent = 'Slug: 3–64 символа, строчные латинские буквы, цифры и дефис';
    error.hidden = false;
    return;
  }
  if (title.length < 3) {
    error.textContent = 'Укажи название подборки';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  button.disabled = true;
  button.textContent = 'Создаём…';
  try {
    await api.adminCreateCollection({ slug, title, description, modeSlugs, sortOrder });
    toast('Подборка создана', 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
    await loadCollections();
  } catch (err) {
    error.textContent = String(err || 'Не удалось создать подборку');
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Создать подборку';
  }
}

async function deleteModerationCollection(collectionId, title) {
  const ok = await askConfirm(
    'Удалить подборку?',
    `Подборка «${title || 'без названия'}» исчезнет из магазина.`,
    'Удалить'
  );
  if (!ok) return;
  try {
    await api.adminDeleteCollection(collectionId);
    toast('Подборка удалена', 'ok');
    S.moderationLoaded = false;
    await loadModeration(true);
    await loadCollections();
  } catch (err) {
    toast('Не удалось удалить подборку: ' + err, 'error');
  }
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
