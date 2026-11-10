'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { els } from '../../core/elements.js';
import { escapeHtml } from '../../core/dom.js';
import { formatDateTime } from '../../core/format.js';
import { friendByUsername } from '../../core/social.js';
import { applyLavunioAvatar } from '../../core/lavunio.js';
import { toast } from '../../ui/toast.js';

let messageActions = {
  showView: () => {},
  loadFriends: async () => {},
  loadTeams: async () => {}
};

export function configureMessages(actions) {
  messageActions = { ...messageActions, ...actions };
}

export async function loadChatList(force = false) {
  if (!lavunioLoggedIn()) return;
  if (!S.friends.length) await messageActions.loadFriends();
  if (!S.teams.length) await messageActions.loadTeams();
  renderMessagesList();
  if (!S.chatKind || !S.chatTarget) {
    const firstFriend = (S.friends || [])[0];
    if (firstFriend) {
      openChat('direct', firstFriend.username, firstFriend.displayName || firstFriend.username);
      return;
    }
    const firstTeam = (S.teams || [])[0];
    if (firstTeam) {
      openChat('team', firstTeam.id, firstTeam.title);
      return;
    }
  }
  if (S.chatKind && S.chatTarget) {
    await loadChatMessages();
    startChatPolling();
  } else {
    showChatEmpty();
  }
}

export function renderMessagesList() {
  const wrap = els.messagesList;
  if (!wrap) return;
  const friends = S.friends || [];
  const teams = S.teams || [];
  const parts = [];
  if (friends.length) {
    parts.push('<div class="messages-group-label">Друзья</div>');
    parts.push(friends.map((friend) => {
      const active = S.chatKind === 'direct'
        && String(S.chatTarget || '').toLowerCase() === String(friend.username || '').toLowerCase();
      return `
        <button class="message-person ${active ? 'active' : ''}" type="button"
          data-chat-kind="direct"
          data-chat-target="${escapeHtml(friend.username)}"
          data-chat-title="${escapeHtml(friend.displayName || friend.username)}">
          <span class="avatar" data-avatar-friend="${escapeHtml(friend.username)}"></span>
          <span class="message-person-copy">
            <b>${escapeHtml(friend.displayName || friend.username)}</b>
            <small>@${escapeHtml(friend.username)}</small>
          </span>
          <span class="dot ${friend.online ? 'online' : ''}"></span>
        </button>
      `;
    }).join(''));
  }
  if (teams.length) {
    parts.push('<div class="messages-group-label">Команды</div>');
    parts.push(teams.map((team) => {
      const active = S.chatKind === 'team' && String(S.chatTarget || '') === String(team.id || '');
      return `
        <button class="message-person ${active ? 'active' : ''}" type="button"
          data-chat-kind="team"
          data-chat-target="${escapeHtml(team.id)}"
          data-chat-title="${escapeHtml(team.title)}">
          <span class="avatar lavunio-avatar">${escapeHtml((team.title || '?')[0].toUpperCase())}</span>
          <span class="message-person-copy">
            <b>${escapeHtml(team.title)}</b>
            <small>@${escapeHtml(team.slug)}</small>
          </span>
          <span class="dot"></span>
        </button>
      `;
    }).join(''));
  }
  wrap.innerHTML = parts.join('') || '<div class="profile-empty">Добавь друга, чтобы начать переписку</div>';
  wrap.querySelectorAll('[data-avatar-friend]').forEach((el) => {
    const friendItem = friendByUsername(el.dataset.avatarFriend);
    if (friendItem) applyLavunioAvatar(el, friendItem);
  });
}

export function showChatEmpty() {
  if (els.chatTitle) els.chatTitle.textContent = 'Сообщения';
  if (els.chatSubtitle) els.chatSubtitle.textContent = 'Выбери чат слева';
  if (els.chatMessages) {
    els.chatMessages.innerHTML = '';
    els.chatMessages.hidden = true;
  }
  if (els.chatEmpty) els.chatEmpty.hidden = false;
  if (els.chatForm) els.chatForm.hidden = true;
}

export function openChat(kind, target, title) {
  if (!kind || !target) return;
  S.chatKind = kind;
  S.chatTarget = target;
  S.chatTitle = title || target;
  messageActions.showView('messages');
  renderMessagesList();
  if (els.chatTitle) els.chatTitle.textContent = S.chatTitle;
  if (els.chatSubtitle) {
    els.chatSubtitle.textContent = kind === 'team' ? 'Чат команды' : `Личный чат с @${target}`;
  }
  if (els.chatMessages) {
    els.chatMessages.innerHTML = '';
    els.chatMessages.hidden = false;
  }
  if (els.chatEmpty) els.chatEmpty.hidden = true;
  if (els.chatForm) els.chatForm.hidden = false;
  loadChatMessages();
  startChatPolling();
}

export async function loadChatMessages() {
  if (!S.chatKind || !S.chatTarget) return;
  try {
    const items = S.chatKind === 'direct'
      ? await api.chatDirect(S.chatTarget)
      : await api.chatTeam(S.chatTarget);
    S.chatMessages = Array.isArray(items) ? items : [];
    renderChatMessages();
  } catch (err) {
    if (els.chatMessages) {
      els.chatMessages.innerHTML = `<div class="hint">Не удалось загрузить чат: ${escapeHtml(String(err))}</div>`;
    }
  }
}

export function renderChatMessages() {
  if (!els.chatMessages) return;
  const me = S.lavunio && S.lavunio.user ? S.lavunio.user.id : '';
  els.chatMessages.innerHTML = (S.chatMessages || []).map((message) => `
    <div class="chat-msg ${message.senderId === me ? 'own' : ''}">
      <div class="meta">${escapeHtml(message.senderDisplayName || message.senderUsername)} · ${escapeHtml(formatDateTime(message.createdAt))}</div>
      ${escapeHtml(message.body)}
    </div>
  `).join('') || '<div class="hint">Сообщений пока нет.</div>';
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

export async function sendChatMessage() {
  if (!S.chatKind || !S.chatTarget || !els.chatInput) return;
  const body = els.chatInput.value.trim();
  if (!body) return;
  els.chatInput.value = '';
  try {
    if (S.chatKind === 'direct') await api.chatSendDirect(S.chatTarget, body);
    else await api.chatSendTeam(S.chatTarget, body);
    await loadChatMessages();
  } catch (err) {
    toast('Не удалось отправить сообщение: ' + err, 'error');
  }
}

export function startChatPolling() {
  if (S.chatTimer) clearInterval(S.chatTimer);
  S.chatTimer = setInterval(() => {
    if (S.section !== 'messages' || !S.chatKind || !S.chatTarget) {
      clearInterval(S.chatTimer);
      S.chatTimer = null;
      return;
    }
    loadChatMessages();
  }, 4000);
}

