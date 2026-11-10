'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { modeById } from '../../core/modes.js';
import { tKey } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { activeDownloadTask, finishDownload, pumpDownloads, renderDownloads, updateDownloadProgress } from '../downloads/queue.js';
import { renderLibrary } from '../library/view.js';
import { updateCardProgress, renderStore } from '../store/view.js';
import { renderDetail, startMode, updateDetailAction } from '../detail/actions.js';

export function onGameEvent(ev) {
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
