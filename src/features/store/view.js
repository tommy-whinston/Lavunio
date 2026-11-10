'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { els } from '../../core/elements.js';
import { escapeHtml } from '../../core/dom.js';
import { publisherDate } from '../../core/format.js';
import { lavunioLoggedIn } from '../../core/lavunio.js';
import { moderatorAllowed } from '../../core/permissions.js';
import { tKey } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { cardStatus, imageSrc, wireImage, libraryStateMeta } from '../catalog/cards.js';
import { renderModeGrid } from '../catalog/grid.js';
import { syncFilterButtons, modePassesFilter, sortCatalog, filterModes } from '../catalog/query.js';
import { updateDashboardStats, updateSidebarCounts } from '../library/view.js';
import { enqueueDownload } from '../downloads/queue.js';
import { isUpdate, modeById, modeShortDescription, modeTags } from '../../core/modes.js';
import { newsCardHtml } from '../news/index.js';

let storeActions = {
  openDetail: () => {},
  renderDetail: () => {},
  renderModeration: () => {}
};

export function configureStore(actions) {
  storeActions = { ...storeActions, ...actions };
}

function canUseRemoteStore() {
  return typeof api.searchModes === 'function'
    && S.storeFilter === 'all'
    && (!!S.search || S.storeSort === 'title');
}

function remoteSort() {
  if (S.storeSort === 'title') return 'title';
  if (S.storeSort === 'default') return 'updated';
  return 'updated';
}

let storeRefreshTimer = null;

export function refreshStore(options = {}) {
  const reset = options.reset !== false;
  const debounce = Number(options.debounce) || 0;
  if (storeRefreshTimer) clearTimeout(storeRefreshTimer);
  const run = () => {
    if (canUseRemoteStore()) {
      loadStorePage({ reset });
      return;
    }
    S.storeRemote = false;
    S.storeItems = [];
    S.storeTotal = 0;
    S.storePage = 0;
    S.storeHasMore = false;
    renderStore();
  };
  if (debounce > 0) storeRefreshTimer = setTimeout(run, debounce);
  else run();
}

export async function loadStorePage({ reset = false } = {}) {
  if (S.storeLoading) return;
  if (!canUseRemoteStore() || typeof api.searchModes !== 'function') {
    refreshStore({ reset: true });
    return;
  }
  if (!reset && !S.storeHasMore) return;
  if (reset) {
    S.storeItems = [];
    S.storeTotal = 0;
    S.storePage = 0;
    S.storeHasMore = false;
  }
  S.storeLoading = true;
  renderStore();
  try {
    const page = reset ? 1 : S.storePage + 1;
    const result = await api.searchModes({
      q: S.search,
      tag: '',
      mcVersion: '',
      loader: '',
      author: '',
      sort: remoteSort(),
      page,
      limit: S.storePageSize
    });
    const items = result && Array.isArray(result.items) ? result.items : [];
    S.storeItems = reset ? items : [...S.storeItems, ...items];
    S.storeTotal = Number(result && result.total) || S.storeItems.length;
    S.storePage = Number(result && result.page) || page;
    S.storeRemote = true;
    S.storeHasMore = S.storeItems.length < S.storeTotal && items.length > 0;
  } catch (_) {
    S.storeRemote = false;
    S.storeItems = [];
    S.storeTotal = 0;
    S.storePage = 0;
    S.storeHasMore = false;
  } finally {
    S.storeLoading = false;
    renderStore();
  }
}

function renderStoreMore() {
  if (!els.storeMoreWrap || !els.storeLoadMore) return;
  const show = S.storeRemote && canUseRemoteStore() && S.storeHasMore;
  els.storeMoreWrap.hidden = !show;
  els.storeLoadMore.disabled = S.storeLoading;
  els.storeLoadMore.textContent = S.storeLoading ? tKey('loading.2') : tKey('load.more');
}

export function renderStore() {
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
    if (els.storeMoreWrap) els.storeMoreWrap.hidden = true;
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

  if (canUseRemoteStore() && S.storeRemote) {
    els.featured.hidden = true;
    if (els.feed) {
      els.feed.hidden = true;
      els.feedList.innerHTML = '';
    }
    if (els.storeNews) {
      els.storeNews.hidden = true;
      els.storeNewsList.innerHTML = '';
    }
    els.catalogTitle.textContent = S.search ? tKey("search.results") : tKey("all.modes");
    els.modesCount.textContent = String(S.storeTotal || S.storeItems.length);
    els.modesGrid.innerHTML = '';
    renderModeGrid(els.modesGrid, S.storeItems, true);
    els.loadingState.hidden = !(S.storeLoading && !S.storeItems.length);
    if (S.storeLoading && !S.storeItems.length) {
      els.emptyState.hidden = true;
    } else {
      setEmpty(
        S.storeItems.length === 0,
        tKey("nothing.found"),
        tKey("try.changing.the.query")
      );
    }
    renderStoreMore();
    updateSidebarCounts();
    return;
  }
  renderStoreMore();

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

export function updateAllModes() {
  const updates = S.modes.filter((mode) => isUpdate(mode));
  if (!updates.length) {
    toast(tKey("no.updates"), 'info');
    return;
  }
  updates.forEach((mode) => enqueueDownload(mode, 'update', false, true));
  toast(tKey("app.updates.queued", [updates.length]), 'ok');
}

let modeUpdatesNotified = false;
export function notifyModeUpdates() {
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

export async function loadFollows() {
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
  if (S.view === 'detail') storeActions.renderDetail();
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
    if (item) storeActions.openDetail(item.dataset.feedSlug);
  };
}

let storeNewsLoaded = false;

export async function loadStoreNews(force = false) {
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
  if (S.moderationTab === 'news' && moderatorAllowed()) storeActions.renderModeration();
}

export function renderStoreNews() {
  if (!els.storeNews || !els.storeNewsList) return;
  if (S.loading || S.search || !S.storeNews.length) {
    els.storeNews.hidden = true;
    els.storeNewsList.innerHTML = '';
    return;
  }
  els.storeNews.hidden = false;
  els.storeNewsList.innerHTML = S.storeNews.slice(0, 5).map(newsCardHtml).join('');
}

export function updateCardProgress() {
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

function setEmpty(show, title, sub) {
  els.emptyState.hidden = !show;
  if (show) {
    els.emptyTitle.textContent = title;
    els.emptySub.textContent = sub;
  }
}
