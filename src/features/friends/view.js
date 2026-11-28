'use strict';

import { tKey } from '../../i18n/index.js';
import { S } from '../../core/state.js';
import { escapeHtml } from '../../core/dom.js';
import { friendByUsername } from '../../core/social.js';
import { applyLavunioAvatar, lavunioLoggedIn } from '../../core/lavunio.js';
import { api } from '../../api/client.js';
import { toast } from '../../ui/toast.js';

let friendActions = {
  openChat: () => {},
  openProfile: () => {},
  loadFriends: async () => {},
  respondFriendRequest: async () => {}
};

let friendsFilter = 'all';
let friendsQuery = '';

export function configureFriends(actions) {
  friendActions = { ...friendActions, ...actions };
}

export function bindFriends() {
  document.querySelectorAll('[data-friends-filter]').forEach((button) => {
    button.onclick = () => {
      friendsFilter = button.dataset.friendsFilter || 'all';
      document.querySelectorAll('[data-friends-filter]').forEach((item) => {
        item.classList.toggle('active', item === button);
      });
      renderFriends();
    };
  });
  const search = document.getElementById('friends-search');
  if (search) {
    search.addEventListener('input', () => {
      friendsQuery = search.value.trim().toLowerCase();
      renderFriends();
    });
  }
  const refresh = document.getElementById('friends-refresh');
  if (refresh) refresh.onclick = () => friendActions.loadFriends(true);
  const addForm = document.getElementById('friends-add-form');
  if (addForm) {
    addForm.onsubmit = async (event) => {
      event.preventDefault();
      const input = document.getElementById('friends-add-input');
      const nickname = (input ? input.value : '').trim();
      if (!/^[A-Za-z0-9_]{1,16}$/.test(nickname)) {
        toast(tKey('display.name.hint'), 'error');
        return;
      }
      const button = addForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        await api.friendAdd(nickname);
        toast(tKey('request.sent'), 'ok');
        if (input) input.value = '';
        await friendActions.loadFriends(true);
      } catch (err) {
        toast(tKey('failed.to.add.friend') + ' ' + err, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    };
  }
  const grid = document.getElementById('friends-grid');
  if (grid) {
    grid.onclick = (event) => {
      const button = event.target.closest('[data-friend-action]');
      if (!button) return;
      const username = button.dataset.username || '';
      const name = button.dataset.name || username;
      if (button.dataset.friendAction === 'chat') {
        friendActions.openChat('direct', username, name);
      } else if (button.dataset.friendAction === 'profile') {
        friendActions.openProfile(username);
      }
    };
  }
  const requests = document.getElementById('friends-requests');
  if (requests) {
    requests.onclick = (event) => {
      const button = event.target.closest('[data-request-action]');
      if (!button) return;
      friendActions.respondFriendRequest(button.dataset.requestId, button.dataset.requestAction);
    };
  }
}

export function renderFriends() {
  const grid = document.getElementById('friends-grid');
  const requestsWrap = document.getElementById('friends-requests');
  const empty = document.getElementById('friends-empty');
  if (!grid) return;

  const logged = lavunioLoggedIn();
  const friends = logged ? (S.friends || []) : [];
  const requests = logged ? (((S.friendRequests || {}).incoming) || []) : [];
  const query = friendsQuery;
  const filtered = friends.filter((friend) => {
    if (friendsFilter === 'online' && !friend.online) return false;
    if (friendsFilter === 'offline' && friend.online) return false;
    if (!query) return true;
    return `${friend.displayName || ''} ${friend.username || ''}`.toLowerCase().includes(query);
  });

  const total = document.getElementById('friends-stat-total');
  const online = document.getElementById('friends-stat-online');
  const incoming = document.getElementById('friends-stat-requests');
  if (total) total.textContent = String(friends.length);
  if (online) online.textContent = String(friends.filter((friend) => friend.online).length);
  if (incoming) incoming.textContent = String(requests.length);

  grid.innerHTML = filtered.map((friend) => {
    const name = friend.displayName || friend.username || '?';
    const status = friend.online ? tKey('online.2') : tKey('offline.2');
    return `
      <article class="friend-card">
        <div class="friend-card-head">
          <span class="avatar" data-avatar-friend="${escapeHtml(friend.username)}"></span>
          <div class="friend-card-copy">
            <b>${escapeHtml(name)}</b>
            <span>${escapeHtml(friend.displayName || friend.username)}</span>
          </div>
          <span class="friend-presence ${friend.online ? 'online' : ''}"><i></i>${escapeHtml(status)}</span>
        </div>
        <div class="friend-card-actions">
          <button class="btn btn-ghost btn-small" type="button" data-friend-action="chat" data-username="${escapeHtml(friend.username)}" data-name="${escapeHtml(name)}">${escapeHtml(tKey('message'))}</button>
          <button class="btn btn-ghost btn-small" type="button" data-friend-action="profile" data-username="${escapeHtml(friend.username)}">${escapeHtml(tKey('profile'))}</button>
        </div>
      </article>
    `;
  }).join('');

  if (requestsWrap) {
    requestsWrap.hidden = requests.length === 0;
    requestsWrap.innerHTML = requests.length ? `
      <div class="friends-requests-head"><b>${escapeHtml(tKey('friend.requests'))}</b><span>${requests.length}</span></div>
      ${requests.map((request) => {
        const name = request.displayName || request.username || '?';
        return `
          <div class="friends-request">
            <span class="avatar" data-request-avatar="${escapeHtml(request.username)}"></span>
            <div class="friends-request-copy">
              <b>${escapeHtml(name)}</b>
              <span>${escapeHtml(request.displayName || request.username)}</span>
            </div>
            <div class="friends-request-actions">
              <button class="btn btn-primary btn-small" type="button" data-request-action="accept" data-request-id="${escapeHtml(request.id)}">${escapeHtml(tKey('accept'))}</button>
              <button class="btn btn-ghost btn-small" type="button" data-request-action="decline" data-request-id="${escapeHtml(request.id)}">${escapeHtml(tKey('decline'))}</button>
            </div>
          </div>
        `;
      }).join('')}
    ` : '';
  }

  if (empty) {
    empty.hidden = filtered.length > 0 || requests.length > 0;
    const title = empty.querySelector('h3');
    if (title) title.textContent = friends.length ? tKey('friends.nothing') : tKey('no.friends.yet');
  }

  grid.querySelectorAll('[data-avatar-friend]').forEach((el) => {
    const friend = friendByUsername(el.dataset.avatarFriend);
    applyLavunioAvatar(el, friend || { username: el.dataset.avatarFriend });
  });
  if (requestsWrap) {
    requestsWrap.querySelectorAll('[data-request-avatar]').forEach((el) => {
      applyLavunioAvatar(el, { username: el.dataset.requestAvatar });
    });
  }
}
