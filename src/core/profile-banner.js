'use strict';

const KEY_PREFIX = 'lavunio.profile.banner.';
const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 384;

function storageKey(username) {
  return KEY_PREFIX + String(username || '').trim().toLowerCase();
}

export function getLocalProfileBanner(username) {
  try {
    return localStorage.getItem(storageKey(username)) || '';
  } catch (_) {
    return '';
  }
}

export function setLocalProfileBanner(username, dataUrl) {
  try {
    localStorage.setItem(storageKey(username), dataUrl);
  } catch (_) {}
}

export function clearLocalProfileBanner(username) {
  try {
    localStorage.removeItem(storageKey(username));
  } catch (_) {}
}

export function cropImageToBanner(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      reject(new Error('unsupported image'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('image too large'));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = BANNER_WIDTH;
        canvas.height = BANNER_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas unavailable');
        const height = Math.round(BANNER_WIDTH / (image.naturalWidth / image.naturalHeight));
        context.drawImage(image, 0, Math.round((BANNER_HEIGHT - height) / 2), BANNER_WIDTH, height);
        resolve(canvas.toDataURL('image/webp', 0.9));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('failed to read image'));
    };
    image.src = objectUrl;
  });
}

export function updateProfileBannerElement(url) {
  const cover = document.querySelector('.profile-social-cover');
  if (!cover) return;
  cover.classList.toggle('has-banner', !!url);
  let image = cover.querySelector('.profile-social-banner');
  if (!url) {
    if (image) image.remove();
    return;
  }
  if (!image) {
    image = document.createElement('img');
    image.className = 'profile-social-banner';
    image.alt = '';
    cover.insertBefore(image, cover.firstChild);
  }
  image.src = url;
}
