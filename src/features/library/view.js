'use strict';

import { S } from '../../core/state.js';
import { els } from '../../core/elements.js';
import { formatPlaytime } from '../../core/format.js';
import { isInstalled, isUpdate, isVisibleInLibrary, modePlaytime } from '../../core/modes.js';
import { syncFilterButtons, modePassesFilter, sortCatalog, matchesSearch } from '../catalog/query.js';
import { renderModeGrid } from '../catalog/grid.js';

export function updateDashboardStats() {
  const modes = S.modes.filter((mode) => isVisibleInLibrary(mode));
  if (els.libraryStatTotal) els.libraryStatTotal.textContent = String(modes.length);
  if (els.libraryStatInstalled) els.libraryStatInstalled.textContent = String(modes.filter((mode) => isInstalled(mode)).length);
  if (els.libraryStatUpdates) els.libraryStatUpdates.textContent = String(modes.filter((mode) => isUpdate(mode)).length);
  if (els.libraryStatPlaytime) {
    const total = modes.reduce((sum, mode) => sum + modePlaytime(mode), 0);
    els.libraryStatPlaytime.textContent = total > 0 ? formatPlaytime(total) : '—';
  }
}

export function updateSidebarCounts() {
  if (!els.sideLibCount) return;
  els.sideLibCount.textContent = String(S.modes.filter((mode) => isVisibleInLibrary(mode)).length);
  els.sideInstalledCount.textContent = String(S.modes.filter((mode) => isInstalled(mode)).length);
}

export function renderLibrary() {
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
    : S.modes.filter((mode) => isVisibleInLibrary(mode));
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
      els.libraryEmptySub.textContent = 'Скрытые режимы появятся здесь';
    } else {
      els.libraryEmptyTitle.textContent = 'Библиотека пуста';
      els.libraryEmptySub.textContent = 'Добавь режим в библиотеку, чтобы он появился здесь';
    }
  }
  updateSidebarCounts();
}

