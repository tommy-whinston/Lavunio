'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { formatBytes } from '../../core/format.js';
import { toast } from '../../ui/toast.js';

let settingsActions = {
  closeModals: () => {}
};

export function configureSettings(actions) {
  settingsActions = { ...settingsActions, ...actions };
}

export function applyRamLimit() {
  if (!els.ram) return;
  const total = Math.floor(Number(S.systemRamGb) || 0);
  if (total < 2) return;
  els.ram.max = String(total);
  const current = Math.min(Math.max(2, Number(els.ram.value) || 4), total);
  els.ram.value = String(current);
  els.ramOut.textContent = `${current} ГБ`;
}

export function bindSettings() {
  if (els.setLang) {
    els.setLang.onchange = async () => {
      const lang = els.setLang.value === 'en' ? 'en' : 'ru';
      const previous = (S.settings && S.settings.lang) || 'ru';
      S.settings = { ...(S.settings || {}), lang };
      if (window.I18n) window.I18n.setLang(lang);
      try {
        const saved = await api.saveSettings({ lang });
        S.settings = saved;
        toast(window.I18n ? window.I18n.t('Язык изменён') : 'Язык изменён', 'ok');
      } catch (err) {
        S.settings = { ...(S.settings || {}), lang: previous };
        if (window.I18n) window.I18n.setLang(previous);
        toast('Не удалось сохранить язык: ' + err, 'error');
      }
    };
  }
  els.ram.addEventListener('input', () => {
    const unit = window.I18n && window.I18n.lang() === 'en' ? 'GB' : 'ГБ';
    els.ramOut.textContent = `${els.ram.value} ${unit}`;
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
        jvmFlags: els.setJvmFlags.checked,
        lang: els.setLang ? els.setLang.value : undefined
      });
      S.settings = s;
      settingsActions.closeModals();
      toast('Настройки сохранены', 'ok');
    } catch (err) {
      toast('Не удалось сохранить настройки: ' + err, 'error');
    }
  };
}

export function fillSettingsForm() {
  const s = S.settings || {};
  const total = Math.floor(Number(S.systemRamGb) || 0);
  if (total >= 2) els.ram.max = String(total);
  const ram = Math.min(Number(s.ramGb) || 4, Number(els.ram.max) || 32);
  els.ram.value = String(ram);
  const unit = window.I18n && window.I18n.lang() === 'en' ? 'GB' : 'ГБ';
  els.ramOut.textContent = `${ram} ${unit}`;
  if (els.setLang) {
    const lang = (s.lang === 'en' || (window.I18n && window.I18n.lang() === 'en')) ? 'en' : 'ru';
    els.setLang.value = lang;
  }
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

export function fillDirOptions(current, installDirs) {
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

export async function refreshDiskInfo() {
  if (!api.diskInfo || !els.settingsDiskInfo) return;
  const dir = els.setDir.value.trim();
  try {
    const info = await api.diskInfo(dir || null);
    if (!info) return;
    const free = formatBytes(info.availableBytes || 0);
    const total = formatBytes(info.totalBytes || 0);
    const library = formatBytes(info.libraryBytes || 0);
    const en = window.I18n && window.I18n.lang() === 'en';
    els.settingsDiskInfo.textContent = en
      ? `Free: ${free} of ${total} · Library: ${library}`
      : `Свободно: ${free} из ${total} · Библиотека: ${library}`;
    els.settingsDiskInfo.classList.toggle(
      'warn',
      Number(info.availableBytes) > 0 && Number(info.availableBytes) < 2 * 1024 * 1024 * 1024
    );
  } catch (_) {}
}

