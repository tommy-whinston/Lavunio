'use strict';

export function parseDownloadSize(label) {
  const match = String(label || '').replace(',', '.').match(/([\d.]+)\s*(ГБ|МБ|КБ|GB|MB|KB|Б|B)/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2].toUpperCase();
  const multiplier = unit === 'ГБ' || unit === 'GB'
    ? 1024 ** 3
    : unit === 'МБ' || unit === 'MB'
      ? 1024 ** 2
      : unit === 'КБ' || unit === 'KB'
        ? 1024
        : 1;
  return value * multiplier;
}
