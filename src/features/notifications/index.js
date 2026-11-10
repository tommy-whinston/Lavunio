'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { els } from '../../core/elements.js';
import { $, escapeHtml } from '../../core/dom.js';
import { formatDateTime } from '../../core/format.js';
import { lavunioLoggedIn } from '../../core/lavunio.js';
import { tKey } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';

let notificationActions = {
  openModal: () => {},
  openDetail: () => {},
  openTeamPage: () => {},
  openProfile: () => {}
};

export function configureNotifications(actions) {
  notificationActions = { ...notificationActions, ...actions };
}

export function bindNotifications() {
  const bell = $('btn-notifications');
  if (bell) {
    bell.onclick = (event) => {
      event.stopPropagation();
      toggleNotifications();
    };
  }
  if (els.notificationsReadAll) {
    els.notificationsReadAll.onclick = (event) => {
      event.stopPropagation();
      readAllNotifications();
    };
  }
  if (els.notificationsList) {
    els.notificationsList.onclick = (event) => {
      const button = event.target.closest('button[data-notification-id]');
      if (!button) return;
      openNotification(button);
    };
  }
  document.addEventListener('click', (event) => {
    if (!els.notificationsPopover || els.notificationsPopover.hidden) return;
    if (!event.target.closest('.notif-wrap')) closeNotifications();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (els.notificationsPopover && !els.notificationsPopover.hidden) closeNotifications();
  });
}

export async function loadNotifications() {
  if (!lavunioLoggedIn() || !api.notificationsList) return;
  try {
    const result = await api.notificationsList();
    S.notifications = Array.isArray(result && result.items) ? result.items : [];
    S.notificationsUnread = Number(result && result.unread) || 0;
  } catch (_) {}
  updateNotificationsBadge();
  if (els.notificationsPopover && !els.notificationsPopover.hidden) renderNotifications();
}

export function updateNotificationsBadge() {
  if (!els.notifBadge) return;
  const count = S.notificationsUnread || 0;
  els.notifBadge.hidden = !lavunioLoggedIn() || count === 0;
  els.notifBadge.textContent = count > 99 ? '99+' : String(count);
}

export function closeNotifications() {
  if (els.notificationsPopover) els.notificationsPopover.hidden = true;
}

export function toggleNotifications(force) {
  if (!lavunioLoggedIn()) {
    notificationActions.openModal('modal-account');
    return;
  }
  if (!els.notificationsPopover) return;
  const show = typeof force === 'boolean' ? force : els.notificationsPopover.hidden;
  if (!show) {
    closeNotifications();
    return;
  }
  els.notificationsPopover.hidden = false;
  renderNotifications();
  loadNotifications().then(renderNotifications);
}

export function openNotifications() {
  toggleNotifications(true);
}

export function renderNotifications() {
  if (!els.notificationsList) return;
  const tr = (text) => (window.I18n ? window.I18n.t(text) : text);
  const items = S.notifications || [];
  els.notificationsList.innerHTML = items.length
    ? items.map((item) => `
      <button class="pub-card notification-item ${item.readAt ? 'read' : ''}" type="button"
        data-notification-id="${escapeHtml(item.id)}"
        data-notif-kind="${escapeHtml(item.kind)}"
        data-notif-link-type="${escapeHtml(item.linkType || '')}"
        data-notif-link-id="${escapeHtml(item.linkId || '')}">
        <div class="pub-title">${escapeHtml(tr(item.title))}</div>
        <div class="mod-changelog">${escapeHtml(tr(item.body || ''))}</div>
        <div class="pub-meta"><span>${escapeHtml(formatDateTime(item.createdAt))}</span></div>
      </button>
    `).join('')
    : '<div class="mod-empty">' + tKey("no.notifications") + '</div>';
}

export async function readAllNotifications() {
  try {
    const result = await api.notificationsRead([]);
    S.notifications = result.items || [];
    S.notificationsUnread = result.unread || 0;
    updateNotificationsBadge();
    renderNotifications();
  } catch (err) {
    toast(tKey("failed.to.mark.notifications") + " " + err, 'error');
  }
}

export async function openNotification(button) {
  const id = button.dataset.notificationId;
  try {
    const result = await api.notificationsRead([id]);
    S.notifications = result.items || S.notifications;
    S.notificationsUnread = result.unread || 0;
    updateNotificationsBadge();
  } catch (_) {}
  closeNotifications();
  const type = button.dataset.notifLinkType;
  const link = button.dataset.notifLinkId;
  if (type === 'mode' && link) notificationActions.openDetail(link);
  else if (type === 'team' && link) notificationActions.openTeamPage({ slug: link, title: link });
  else if (type === 'user' && link) notificationActions.openProfile(link);
}
