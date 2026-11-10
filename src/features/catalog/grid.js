'use strict';

import { modeById } from '../../core/modes.js';
import { modeCardHtml, wireImage } from './cards.js';

let gridActions = {
  openCardContext: () => {},
  handleCardAction: () => {},
  closeCardMenus: () => {},
  startMode: () => {},
  openDetail: () => {},
  updateCardProgress: () => {}
};

export function configureCatalogGrid(actions) {
  gridActions = { ...gridActions, ...actions };
}

function renderModeGrid(container, list, withMenu = false, playMode = false) {
  container.innerHTML = list
    .map((mode) => modeCardHtml(mode, withMenu, playMode))
    .join('');
  container.onclick = (e) => {
    const menuBtn = e.target.closest('.card-menu-btn');
    if (menuBtn) {
      e.stopPropagation();
      const card = menuBtn.closest('.mode-card');
      if (!card || !card.dataset.id) return;
      const rect = menuBtn.getBoundingClientRect();
      gridActions.openCardContext(card, rect.right - 208, rect.bottom + 6, playMode);
      return;
    }
    const action = e.target.closest('[data-card-action]');
    if (action) {
      e.stopPropagation();
      const card = action.closest('.mode-card');
      if (card && card.dataset.id) gridActions.handleCardAction(card.dataset.id, action.dataset.cardAction, playMode);
      return;
    }
    gridActions.closeCardMenus();
    const card = e.target.closest('.mode-card');
    if (card && card.dataset.id) {
      if (playMode) gridActions.startMode(modeById(card.dataset.id), true);
      else gridActions.openDetail(card.dataset.id);
    }
  };
  container.oncontextmenu = (e) => {
    const card = e.target.closest('.mode-card');
    if (!card || !card.dataset.id) return;
    e.preventDefault();
    e.stopPropagation();
    gridActions.openCardContext(card, e.clientX, e.clientY, playMode);
  };
  container.querySelectorAll('img[data-fallback]').forEach((img) => {
    const card = img.closest('.mode-card');
    wireImage(img, card ? modeById(card.dataset.id) : null);
  });
  gridActions.updateCardProgress();
}


export { renderModeGrid };
