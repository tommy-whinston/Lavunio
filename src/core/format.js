'use strict';

import { escapeHtml } from './dom.js';

export function stripRichText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function renderRichText(value) {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '<p>Описание пока не заполнено.</p>';

  const inline = (raw) => escapeHtml(raw)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = text.split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const tag = heading[1].length === 1 ? 'h2' : heading[1].length === 2 ? 'h3' : 'h4';
      blocks.push(`<${tag}>${inline(heading[2].replace(/\*\*/g, ''))}</${tag}>`);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(inline(lines[index].replace(/^>\s?/, '')));
        index += 1;
      }
      blocks.push(`<blockquote>${quote.join('<br>')}</blockquote>`);
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim()
      && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|>\s?)/.test(lines[index])) {
      paragraph.push(inline(lines[index]));
      index += 1;
    }
    if (paragraph.length) blocks.push(`<p>${paragraph.join('<br>')}</p>`);
  }
  return blocks.join('');
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  const en = window.I18n && window.I18n.lang() === 'en';
  const units = en ? ['GB', 'MB', 'KB', 'B'] : ['ГБ', 'МБ', 'КБ', 'Б'];
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} ${units[0]}`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} ${units[1]}`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} ${units[2]}`;
  return `${value} ${units[3]}`;
}

export function formatPlaytime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total <= 0) return '—';
  const unit = window.I18n && window.I18n.lang() === 'en' ? 'h' : 'ч';
  return `${(total / 3600).toFixed(1)} ${unit}`;
}

export function formatUpdateDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return String(value || '');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString(window.I18n ? window.I18n.locale() : 'ru-RU');
}

export function formatDateTime(value) {
  let ms = Number(value);
  if (!Number.isFinite(ms) || !ms) {
    const parsed = Date.parse(String(value || ''));
    ms = Number.isFinite(parsed) ? parsed : 0;
  }
  if (!ms) return '—';
  return new Date(ms).toLocaleString(window.I18n ? window.I18n.locale() : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const en = window.I18n && window.I18n.lang() === 'en';
  const h = en ? 'h' : 'ч';
  const m = en ? 'min' : 'мин';
  const s = en ? 's' : 'сек';
  if (hours > 0) return `${hours} ${h} ${minutes} ${m}`;
  if (minutes > 0) return `${minutes} ${m}`;
  return `${total} ${s}`;
}

export function formatHistoryStamp(entry) {
  const date = entry && entry.date ? formatUpdateDate(entry.date) : '';
  const time = String((entry && entry.time) || '').slice(0, 5);
  return [date, time].filter(Boolean).join(' ');
}

