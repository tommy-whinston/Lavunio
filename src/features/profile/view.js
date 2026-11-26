'use strict';

import { tKey } from '../../i18n/index.js';

import { S } from '../../core/state.js';
import { els } from '../../core/elements.js';
import { $, escapeHtml } from '../../core/dom.js';
import { formatDateTime } from '../../core/format.js';
import { isInstalled, isVisibleInLibrary } from '../../core/modes.js';
import { teamRoleLabel } from '../../core/labels.js';
import { isOwnUsername, friendByUsername } from '../../core/social.js';
import { applyLavunioAvatar } from '../../core/lavunio.js';

let profileTab = 'posts';
let profileTabUser = '';

export function profileRoleLabel(role) {
  return role === 'admin' ? tKey("administrator")
    : role === 'author' ? tKey("author")
      : role === 'moderator' ? tKey("moderator.2") : tKey("player.2");
}

export function profileOnlineLabel(profile) {
  if (profile.online) return tKey("online.2");
  const seen = formatDateTime(profile.lastSeenAt);
  return seen === '—' ? tKey("offline.2") : `${tKey("last.seen")} ${seen}`;
}

export function profileModesHtml(profile) {
  const modes = profile.modes || [];
  if (!modes.length) return '<div class="profile-empty">' + tKey("no.published.modes.yet") + '</div>';
  return modes.map((mode) => `
    <button class="profile-mode-row" type="button" data-profile-mode="${escapeHtml(mode.slug)}">
      <span>${escapeHtml(mode.title)}</span>
      <b>${tKey("pattern.x.installs", [Number(mode.installs) || 0])}</b>
    </button>
  `).join('');
}

export function profileTeamsHtml(profile) {
  const teams = profile.teams || [];
  if (!teams.length) return '<div class="profile-empty">' + tKey("not.a.member.of") + '</div>';
  return teams.map((team) => `
    <button class="profile-mode-row" type="button" data-profile-team="${escapeHtml(team.slug)}" data-profile-team-title="${escapeHtml(team.title)}">
      <span>${escapeHtml(team.title)}${team.verified ? ' ✓' : ''}</span>
      <b>${escapeHtml(teamRoleLabel(team.role))}</b>
    </button>
  `).join('');
}

export function profileFriendsHtml() {
  const friends = S.friends || [];
  if (!friends.length) return '<div class="profile-empty">' + tKey("no.friends.yet") + '</div>';
  return friends.map((friend) => `
    <div class="profile-friend">
      <span class="avatar" data-avatar-friend="${escapeHtml(friend.username)}"></span>
      <div class="profile-friend-copy">
        <b>${escapeHtml(friend.displayName || friend.username)}</b>
        <span>@${escapeHtml(friend.username)} · <span>${friend.online ? tKey("online.2") : tKey("offline.2")}</span></span>
      </div>
      <div class="profile-friend-actions">
        <button class="icon-btn" type="button" title="${tKey("profile")}" data-profile-action="friend-profile" data-username="${escapeHtml(friend.username)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"/></svg>
        </button>
        <button class="icon-btn" type="button" title="${tKey("message")}" data-profile-action="chat" data-username="${escapeHtml(friend.username)}" data-name="${escapeHtml(friend.displayName || friend.username)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8"/><path d="M8 12h5"/></svg>
        </button>
        <button class="icon-btn" type="button" title="${tKey("delete")}" data-profile-action="remove-friend" data-username="${escapeHtml(friend.username)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7v12h10V7"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

export function profileRequestsHtml() {
  const incoming = (S.friendRequests && S.friendRequests.incoming) || [];
  if (!incoming.length) return '';
  return `
    <section class="profile-panel">
      <h2>${tKey("friend.requests")}</h2>
      ${incoming.map((item) => `
        <div class="profile-request">
          <span>@${escapeHtml(item.username)}</span>
          <span class="profile-request-actions">
            <button class="btn btn-primary btn-small" type="button" data-profile-action="accept-request" data-id="${escapeHtml(item.id)}">${tKey("accept")}</button>
            <button class="btn btn-ghost btn-small" type="button" data-profile-action="decline-request" data-id="${escapeHtml(item.id)}">${tKey("decline")}</button>
          </span>
        </div>
      `).join('')}
    </section>
  `;
}

export function profilePostHtml(post) {
  const own = isOwnUsername(post.username);
  return `
    <article class="profile-post">
      <div class="profile-post-head">
        <span class="avatar" data-post-avatar="${escapeHtml(post.username)}"></span>
        <div class="profile-post-copy">
          <b>${escapeHtml(post.displayName || post.username)}</b>
          <span>@${escapeHtml(post.username)} · ${escapeHtml(formatDateTime(post.createdAt))}</span>
        </div>
        ${own ? `<button class="icon-btn profile-post-delete" type="button" title="${tKey("delete")}" data-profile-action="delete-post" data-post-id="${escapeHtml(post.id)}">✕</button>` : ''}
      </div>
      <div class="profile-post-body">${escapeHtml(post.body).replace(/\n/g, '<br>')}</div>
    </article>
  `;
}

export function profileFeedHtml(profile) {
  const own = isOwnUsername(profile.username);
  const posts = S.profilePosts || [];
  return `
    <section class="profile-social-card profile-feed-card">
      ${own ? `
        <form class="profile-post-form" data-profile-form="post">
          <textarea id="profile-post-body" maxlength="1000" rows="3" placeholder="${tKey("share.something")}"></textarea>
          <div class="profile-post-form-foot">
            <span class="hint" id="profile-post-length">0/1000</span>
            <button class="btn btn-primary" id="profile-post-submit" type="submit">${tKey("publish")}</button>
          </div>
        </form>
      ` : ''}
      <div class="profile-posts" id="profile-posts">
        ${posts.length ? posts.map(profilePostHtml).join('') : `<div class="profile-empty">${tKey("no.posts.yet")}</div>`}
      </div>
      <button class="btn btn-ghost profile-posts-more" id="profile-posts-more" type="button" data-profile-action="posts-more" ${S.profilePostsHasMore ? '' : 'hidden'}>${tKey("load.more")}</button>
    </section>
  `;
}

export function renderProfile(profile) {
  if (!profile || !els.profileContent) return;
  const own = isOwnUsername(profile.username);
  const friend = friendByUsername(profile.username);
  const display = profile.displayName || profile.username;
  const nameClass = String(display).length > 13 ? 'profile-name-xlong'
    : String(display).length > 10 ? 'profile-name-long' : '';
  const stats = profile.stats || {};
  const libraryModes = own ? (S.modes || []).filter((mode) => isVisibleInLibrary(mode)) : [];
  const friends = own ? (S.friends || []) : [];
  const teams = profile.teams || [];

  if (profileTabUser !== profile.username) {
    profileTabUser = profile.username;
    profileTab = 'posts';
  }

  const tabs = [
    { id: 'posts', label: tKey('posts'), count: Number(S.profilePostsTotal) || 0, countId: 'profile-posts-count' },
    { id: 'modes', label: tKey('modes'), count: (profile.modes || []).length },
    ...(own ? [
      { id: 'library', label: tKey('nav.library'), count: libraryModes.length },
      { id: 'friends', label: tKey('friends'), count: friends.length }
    ] : []),
    { id: 'teams', label: tKey('teams.2'), count: teams.length }
  ];
  if (!tabs.some((tab) => tab.id === profileTab)) profileTab = 'posts';

  const actions = own
    ? `
      <button class="btn btn-primary" type="button" data-profile-action="messages">${tKey("messages.title")}</button>
      <button class="btn btn-ghost" type="button" data-profile-action="edit">${tKey("edit")}</button>
      <button class="btn btn-ghost" type="button" data-profile-action="logout">${tKey("sign.out")}</button>
    `
    : `
      ${friend
        ? `<button class="btn btn-primary" type="button" data-profile-action="chat" data-username="${escapeHtml(profile.username)}" data-name="${escapeHtml(display)}">${tKey("message")}</button>
           <button class="btn btn-ghost" type="button" data-profile-action="remove-friend" data-username="${escapeHtml(profile.username)}">${tKey("remove.friend.2")}</button>`
        : ''}
      <button class="btn btn-ghost" type="button" data-profile-action="messages">${tKey("messages.title")}</button>
    `;

  const friendPreview = friends.slice(0, 4).map((item) => `
    <button class="profile-social-preview" type="button" data-profile-action="friend-profile" data-username="${escapeHtml(item.username)}">
      <span class="avatar" data-avatar-friend="${escapeHtml(item.username)}"></span>
      <span class="profile-social-preview-copy">
        <b>${escapeHtml(item.displayName || item.username)}</b>
        <span>@${escapeHtml(item.username)}</span>
      </span>
      <span class="profile-social-presence ${item.online ? 'online' : ''}"><i></i></span>
    </button>
  `).join('');

  const teamPreview = teams.slice(0, 3).map((team) => `
    <button class="profile-social-preview" type="button" data-profile-team="${escapeHtml(team.slug)}" data-profile-team-title="${escapeHtml(team.title)}">
      <span class="profile-social-team-mark">${escapeHtml(String(team.title || '?').slice(0, 2).toUpperCase())}</span>
      <span class="profile-social-preview-copy">
        <b>${escapeHtml(team.title)}${team.verified ? ' ✓' : ''}</b>
        <span>${escapeHtml(teamRoleLabel(team.role))}</span>
      </span>
    </button>
  `).join('');

  const libraryRows = libraryModes.slice(0, 40).map((mode) => `
    <button class="profile-mode-row" type="button" data-profile-mode="${escapeHtml(mode.id)}">
      <span>${escapeHtml(mode.title)}</span>
      <b>${isInstalled(mode) ? tKey('sidebar.installed') : tKey('sidebar.inLibrary')}</b>
    </button>
  `).join('');

  els.profileContent.innerHTML = `
    <div class="profile-social-page">
      <section class="profile-social-header profile-hero">
        <div class="profile-social-cover">
          <span class="profile-social-cover-mark">@${escapeHtml(profile.username)}</span>
        </div>
        <div class="profile-social-head">
          <div class="profile-social-avatar${own ? ' profile-avatar-editable' : ''}">
            <span class="avatar" id="profile-avatar"${own ? ` role="button" tabindex="0" title="${escapeHtml(tKey("profile.avatar.hint"))}"` : ''}></span>
          </div>
          ${own ? `<span class="profile-avatar-hint" hidden>${tKey("profile.avatar.hint")}</span>` : ''}
          <div class="profile-social-identity profile-hero-main">
            <h1${nameClass ? ` class="${nameClass}"` : ''}>${escapeHtml(display)}</h1>
            <div class="profile-handle">@${escapeHtml(profile.username)}</div>
            <div class="profile-badges">
              <span class="profile-badge role">${escapeHtml(profileRoleLabel(profile.role))}</span>
              <span class="profile-badge ${profile.online ? 'online' : ''}">${escapeHtml(profileOnlineLabel(profile))}</span>
              ${friend ? '<span class="profile-badge">' + tKey("friend") + '</span>' : ''}
              ${own ? '<span class="profile-badge">' + tKey("you") + '</span>' : ''}
            </div>
          </div>
          <div class="profile-social-actions">${actions}</div>
        </div>
        <div class="profile-social-bio profile-bio">${escapeHtml(profile.bio || tKey("no.description"))}</div>
        <div class="profile-social-stats">
          <div><span>${tKey("modes")}</span><b>${Number(stats.modes) || 0}</b></div>
          <div><span>${tKey("downloads.2")}</span><b>${Number(stats.downloads) || 0}</b></div>
          <div><span>${tKey("installs")}</span><b>${Number(stats.installs) || 0}</b></div>
          <div><span>${tKey("teams.2")}</span><b>${teams.length}</b></div>
        </div>
      </section>

      <nav class="profile-social-tabs" role="tablist">
        ${tabs.map((tab) => `
          <button class="profile-social-tab ${tab.id === profileTab ? 'active' : ''}" type="button" role="tab" aria-selected="${tab.id === profileTab}" data-profile-tab="${tab.id}">
            ${escapeHtml(tab.label)}
            <span${tab.countId ? ` id="${tab.countId}"` : ''}>${Number(tab.count) || 0}</span>
          </button>
        `).join('')}
      </nav>

      <div class="profile-social-body">
        <div class="profile-social-main">
          <section class="profile-social-pane" data-profile-pane="posts" ${profileTab !== 'posts' ? 'hidden' : ''}>
            ${profileFeedHtml(profile)}
          </section>
          <section class="profile-social-pane" data-profile-pane="modes" ${profileTab !== 'modes' ? 'hidden' : ''}>
            <section class="profile-social-card">
              <div class="profile-social-card-head"><h3>${tKey("modes")}</h3><span>${(profile.modes || []).length}</span></div>
              ${profileModesHtml(profile)}
            </section>
          </section>
          ${own ? `
            <section class="profile-social-pane" data-profile-pane="library" ${profileTab !== 'library' ? 'hidden' : ''}>
              <section class="profile-social-card">
                <div class="profile-social-card-head"><h3>${tKey("nav.library")}</h3><span>${libraryModes.length}</span></div>
                ${libraryRows || '<div class="profile-empty">' + tKey("library.is.empty") + '</div>'}
              </section>
            </section>
            <section class="profile-social-pane" data-profile-pane="friends" ${profileTab !== 'friends' ? 'hidden' : ''}>
              <section class="profile-social-card">
                <div class="profile-social-card-head"><h3>${tKey("friends")}</h3><span>${friends.length}</span></div>
                ${profileFriendsHtml()}
              </section>
            </section>
          ` : ''}
          <section class="profile-social-pane" data-profile-pane="teams" ${profileTab !== 'teams' ? 'hidden' : ''}>
            <section class="profile-social-card">
              <div class="profile-social-card-head"><h3>${tKey("teams.2")}</h3><span>${teams.length}</span></div>
              ${profileTeamsHtml(profile)}
            </section>
          </section>
        </div>

        <aside class="profile-social-side">
          <section class="profile-social-card">
            <div class="profile-social-card-head"><h3>${tKey("information")}</h3></div>
            <div class="profile-info-row"><span>${tKey("role")}</span><b>${escapeHtml(profileRoleLabel(profile.role))}</b></div>
            <div class="profile-info-row"><span>${tKey("status")}</span><b>${profile.online ? tKey("online.2") : tKey("offline.2")}</b></div>
            <div class="profile-info-row"><span>${tKey("on.lavunio.since")}</span><b>${escapeHtml(formatDateTime(profile.createdAt))}</b></div>
            <div class="profile-info-row"><span>${tKey("profile.id")}</span><b>@${escapeHtml(profile.username)}</b></div>
          </section>

          ${own ? `
            <section class="profile-social-card">
              <div class="profile-social-card-head">
                <h3>${tKey("friends")} <span>${friends.length}</span></h3>
                ${friends.length ? `<button class="profile-social-link" type="button" data-profile-tab-link="friends">${tKey("all")}</button>` : ''}
              </div>
              ${friendPreview || '<div class="profile-empty">' + tKey("no.friends.yet") + '</div>'}
            </section>
          ` : ''}

          <section class="profile-social-card">
            <div class="profile-social-card-head">
              <h3>${tKey("teams.2")} <span>${teams.length}</span></h3>
              ${teams.length ? `<button class="profile-social-link" type="button" data-profile-tab-link="teams">${tKey("all")}</button>` : ''}
            </div>
            ${teamPreview || '<div class="profile-empty">' + tKey("not.a.member.of") + '</div>'}
          </section>
        </aside>
      </div>
    </div>
  `;

  $('app').scrollTop = 0;
  applyLavunioAvatar($('profile-avatar'), {
    skinUrl: profile.skinUrl,
    username: profile.username,
    displayName: profile.displayName
  });
  els.profileContent.querySelectorAll('[data-avatar-friend]').forEach((el) => {
    const friendItem = friendByUsername(el.dataset.avatarFriend);
    if (friendItem) applyLavunioAvatar(el, friendItem);
  });
  els.profileContent.querySelectorAll('[data-post-avatar]').forEach((el) => {
    applyLavunioAvatar(el, profile);
  });

  const tabButtons = [...els.profileContent.querySelectorAll('[data-profile-tab]')];
  const tabLinks = [...els.profileContent.querySelectorAll('[data-profile-tab-link]')];
  const panes = [...els.profileContent.querySelectorAll('[data-profile-pane]')];
  const activateTab = (tab) => {
    if (!tabs.some((item) => item.id === tab)) tab = 'posts';
    profileTab = tab;
    tabButtons.forEach((button) => {
      const active = button.dataset.profileTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    panes.forEach((pane) => { pane.hidden = pane.dataset.profilePane !== tab; });
  };
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.profileTab));
  });
  tabLinks.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.profileTabLink));
  });
}

