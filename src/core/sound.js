'use strict';

const STORAGE_KEY = 'lavunio.uiSounds';
let enabled = true;
let context = null;
let master = null;
const lastSoundAt = {};

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

/* Один мягкий тон: осциллятор → плавная огибающая → сглаживающий lowpass,
   чтобы убрать резкий «цифровой» старт и сделать звук тёплым. */
function tone({ freq, at = 0, dur, vol = 0.12, type = 'sine', glide = null, cutoff = null }) {
  const audio = ensureContext();
  if (!audio || !master) return;
  const startAt = audio.currentTime + at;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, startAt);
  if (glide) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, glide), startAt + dur);
  }

  filter.type = 'lowpass';
  filter.frequency.value = cutoff || freq * 5;
  filter.Q.value = 0.6;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  oscillator.start(startAt);
  oscillator.stop(startAt + dur + 0.03);
}

export function playUiSound(kind = 'click') {
  if (!enabled) return;
  const now = performance.now();
  /* Троттл на вид звука: разные события не глушат друг друга. */
  if (now - (lastSoundAt[kind] || 0) < 28) return;
  lastSoundAt[kind] = now;

  switch (kind) {
    case 'tab':
      tone({ freq: 620, dur: 0.06, vol: 0.1 });
      tone({ freq: 930, at: 0.006, dur: 0.05, vol: 0.035 });
      return;
    case 'toggle':
      tone({ freq: 523.25, dur: 0.09, vol: 0.09 });
      tone({ freq: 783.99, at: 0.04, dur: 0.1, vol: 0.07 });
      return;
    case 'success':
      tone({ freq: 523.25, dur: 0.35, vol: 0.1 });
      tone({ freq: 659.25, at: 0.09, dur: 0.35, vol: 0.09 });
      tone({ freq: 783.99, at: 0.18, dur: 0.45, vol: 0.08 });
      tone({ freq: 1046.5, at: 0.27, dur: 0.55, vol: 0.055 });
      return;
    case 'error':
      tone({ freq: 392, dur: 0.16, vol: 0.1, glide: 370 });
      tone({ freq: 311.13, at: 0.12, dur: 0.22, vol: 0.1, glide: 290 });
      return;
    case 'warn':
      tone({ freq: 440, dur: 0.18, vol: 0.09, glide: 415 });
      return;
    case 'pop':
      tone({ freq: 300, dur: 0.09, vol: 0.09, glide: 520 });
      return;
    case 'close':
      tone({ freq: 430, dur: 0.09, vol: 0.08, glide: 240 });
      return;
    case 'begin':
      tone({ freq: 660, dur: 0.05, vol: 0.09 });
      tone({ freq: 990, at: 0.06, dur: 0.06, vol: 0.06 });
      return;
    default:
      /* Клики: короткий мягкий «тук» вместо пика. */
      tone({ freq: 190, dur: 0.05, vol: 0.11 });
      tone({ freq: 950, dur: 0.03, vol: 0.035 });
      return;
  }
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
