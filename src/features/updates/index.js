'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { els } from '../../core/elements.js';
import { $ } from '../../core/dom.js';
import { formatBytes } from '../../core/format.js';
import { tKey } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { activeDownloadTask } from '../downloads/queue.js';

let updateActions = {
  finishSplash: () => {}
};

let lastUpdateCheckAt = 0;
let startupFinalized = false;

export function configureUpdates(actions) {
  updateActions = { ...updateActions, ...actions };
}

export function bindUpdateModal() {
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

export async function checkLauncherUpdate() {
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

export async function checkUpdateInBackground(force = false) {
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

export async function finishStartup() {
  if (startupFinalized) return;
  startupFinalized = true;
  try {
    if (api.windowReady) await api.windowReady();
  } catch (_) {
    // Окно уже могло быть закрыто.
  }
  updateActions.finishSplash();
}

export async function handleStartupUpdate(pending) {
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
