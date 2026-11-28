'use strict';

const STORAGE_KEY = 'lavunio.uiSounds';
let enabled = true;
let context = null;
let master = null;
let lastSoundAt = 0;

try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === '0') enabled = false;
} catch (_) {}

export function uiSoundsEnabled() {
  return enabled;
}

export function setUiSoundsEnabled(value) {
  enabled = !!value;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch (_) {}
  if (enabled) playUiSound('toggle');
}

function ensureContext() {
  if (!enabled) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!context) {
    try {
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 0.1;
      master.connect(context.destination);
    } catch (_) {
      context = null;
      master = null;
      return null;
    }
  }
  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }
  return context;
}

function tone(frequency, delay, duration, volume = 0.2, type = 'sine') {
  const audio = ensureContext();
  if (!audio || !master) return;
  const startAt = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export function playUiSound(kind = 'click') {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastSoundAt < 28) return;
  lastSoundAt = now;
  if (kind === 'tab') {
    tone(620, 0, 0.055, 0.15);
    return;
  }
  if (kind === 'toggle') {
    tone(560, 0, 0.05, 0.13);
    tone(840, 0.035, 0.06, 0.08);
    return;
  }
  if (kind === 'success') {
    tone(523.25, 0, 0.12, 0.18);
    tone(659.25, 0.07, 0.13, 0.16);
    tone(783.99, 0.14, 0.16, 0.13);
    return;
  }
  if (kind === 'error') {
    tone(220, 0, 0.12, 0.14, 'triangle');
    return;
  }
  tone(520, 0, 0.05, 0.16);
  tone(780, 0.006, 0.04, 0.06);
}

export function initUiSounds() {
  if (document.documentElement.dataset.uiSoundsBound === '1') return;
  document.documentElement.dataset.uiSoundsBound = '1';
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!enabled) return;
      const target = event.target.closest(
        'button:not([disabled]), .side-link, .mode-card, .profile-library-card, .profile-team-card, [role="button"]'
      );
      if (!target) return;
      if (target.id === 'set-ui-sounds') return;
      if (target.closest('.window-controls, .brand')) return;
      if (
        target.closest(
          '[data-settings-tab], [data-detail-tab], [data-profile-tab], .side-link, .settings-nav-item, .theme-choice'
        )
      ) {
        playUiSound('tab');
      } else {
        playUiSound('click');
      }
    },
    true
  );
}
