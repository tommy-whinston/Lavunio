'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { modeById } from '../../core/modes.js';
import { parseDownloadSize } from '../../core/units.js';
import { imageSrc } from '../catalog/cards.js';
import { toast } from '../../ui/toast.js';

let downloadActions = {
  updateCardProgress: () => {},
  renderStore: () => {},
  renderLibrary: () => {},
  renderDetail: () => {},
  updateDetailAction: () => {}
};

export function configureDownloads(actions) {
  downloadActions = { ...downloadActions, ...actions };
}

// ---------------------------------------------------------------- загрузки

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
  downloadActions.updateCardProgress();
  renderDownloads();
  if (S.view === 'detail' && S.selectedId === mode.id) downloadActions.updateDetailAction();

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
  downloadActions.updateCardProgress();
  renderDownloads();
  downloadActions.renderStore();
  downloadActions.renderLibrary();
  if (S.view === 'detail') downloadActions.renderDetail();
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
  downloadActions.updateCardProgress();
  renderDownloads();
  downloadActions.renderStore();
  downloadActions.renderLibrary();
  if (S.view === 'detail') downloadActions.renderDetail();
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
  // Очередь загрузок работает в фоне, отдельного раздела в интерфейсе больше нет.
}

function renderDownloads() {
  updateDownloadsBadge();
}


export {
  activeDownloadTask,
  downloadTaskForMode,
  enqueueDownload,
  pumpDownloads,
  finishDownload,
  failDownload,
  pauseDownload,
  resumeDownload,
  retryDownload,
  cancelDownload,
  removeDownload,
  clearDownloads,
  updateDownloadProgress,
  renderDownloads
};
