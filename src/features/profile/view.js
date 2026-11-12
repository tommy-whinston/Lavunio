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

export function profileEditHtml(profile) {
  return `
    <section class="profile-panel" id="profile-edit">
      <h2>${tKey("profile.settings")}</h2>
      <form class="profile-edit" data-profile-form="edit" autocomplete="off">
        <div class="field">
          <label for="profile-username">${tKey("profile.id")}</label>
          <input id="profile-username" type="text" maxlength="20" pattern="[a-z0-9]{3,20}" spellcheck="false" autocapitalize="none" value="${escapeHtml(profile.username || '')}">
          <div class="hint">${tKey("profile.id.hint")}</div>
        </div>
        <div class="field">
          <label for="profile-display-name">${tKey("display.name")}</label>
          <input id="profile-display-name" type="text" maxlength="16" spellcheck="false" value="${escapeHtml(profile.displayName || profile.username)}">
          <div class="hint">${tKey("display.name.hint")}</div>
        </div>
        <div class="field">
          <label for="profile-bio">${tKey("about")}</label>
          <textarea id="profile-bio" rows="3" maxlength="500" placeholder="${tKey("a.few.words.about")}">${escapeHtml(profile.bio || '')}</textarea>
        </div>
        <div class="form-error" id="profile-error" hidden></div>
        <button class="btn btn-primary" id="profile-save" type="submit">${tKey("save")}</button>
      </form>
      <div class="profile-account-row">
        <button class="btn btn-ghost" type="button" data-profile-action="settings">${tKey("launcher.settings")}</button>
        <button class="btn btn-ghost" type="button" data-profile-action="logout">${tKey("sign.out.of.lavunio")}</button>
      </div>
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
    <section class="profile-panel profile-feed">
      <div class="profile-feed-head">
        <h2>${tKey("posts")}</h2>
        <span class="profile-feed-count" id="profile-posts-count">${Number(S.profilePostsTotal) || 0}</span>
      </div>
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
  const outgoing = ((S.friendRequests && S.friendRequests.outgoing) || []).some(
    (item) => String(item.username || '').toLowerCase() === String(profile.username).toLowerCase()
  );
  const display = profile.displayName || profile.username;
  const nameClass = String(display).length > 13 ? 'profile-name-xlong'
    : String(display).length > 10 ? 'profile-name-long' : '';
  const stats = profile.stats || {};

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
        : outgoing
          ? '<button class="btn btn-ghost" type="button" disabled>' + tKey("request.sent") + '</button>'
          : `<button class="btn btn-primary" type="button" data-profile-action="add-friend" data-username="${escapeHtml(profile.username)}">${tKey("add.friend")}</button>`}
      <button class="btn btn-ghost" type="button" data-profile-action="messages">${tKey("messages.title")}</button>
    `;

  els.profileContent.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar-wrap${own ? ' profile-avatar-editable' : ''}">
        <span class="avatar" id="profile-avatar"${own ? ` role="button" tabindex="0" title="${escapeHtml(tKey("profile.avatar.hint"))}"` : ''}></span>
        ${own ? `<div class="profile-avatar-hint">${tKey("profile.avatar.hint")}</div>` : ''}
      </div>
      <div class="profile-hero-main">
        <h1${nameClass ? ` class="${nameClass}"` : ''}>${escapeHtml(display)}</h1>
        <div class="profile-handle">@${escapeHtml(profile.username)}</div>
        <div class="profile-badges">
          <span class="profile-badge role">${escapeHtml(profileRoleLabel(profile.role))}</span>
          <span class="profile-badge ${profile.online ? 'online' : ''}">${escapeHtml(profileOnlineLabel(profile))}</span>
          ${friend ? '<span class="profile-badge">' + tKey("friend") + '</span>' : ''}
          ${own ? '<span class="profile-badge">' + tKey("you") + '</span>' : ''}
        </div>
        <div class="profile-bio">${escapeHtml(profile.bio || tKey("no.description"))}</div>
      </div>
      <div class="profile-actions">${actions}</div>
    </div>

    <div class="profile-stats">
      <div class="profile-stat"><span>${tKey("modes")}</span><b>${Number(stats.modes) || 0}</b></div>
      <div class="profile-stat"><span>${tKey("downloads.2")}</span><b>${Number(stats.downloads) || 0}</b></div>
      <div class="profile-stat"><span>${tKey("installs")}</span><b>${Number(stats.installs) || 0}</b></div>
      <div class="profile-stat"><span>${tKey("teams.2")}</span><b>${(profile.teams || []).length}</b></div>
    </div>

    ${profileFeedHtml(profile)}

    <div class="profile-layout">
      <div class="profile-main">
        <section class="profile-panel">
          <h2>${tKey("modes")}</h2>
          ${profileModesHtml(profile)}
        </section>
        ${own ? `
          <section class="profile-panel">
            <h2>${tKey("nav.library")}</h2>
            ${S.modes.filter((mode) => isVisibleInLibrary(mode)).slice(0, 20).map((mode) => `
              <button class="profile-mode-row" type="button" data-profile-mode="${escapeHtml(mode.id)}">
                <span>${escapeHtml(mode.title)}</span>
                <b>${isInstalled(mode) ? tKey("sidebar.installed") : tKey("sidebar.inLibrary")}</b>
              </button>
            `).join('') || '<div class="profile-empty">' + tKey("library.is.empty") + '</div>'}
          </section>
          ${profileEditHtml(profile)}
        ` : ''}
      </div>
      <aside class="profile-side">
        <section class="profile-panel">
          <h2>${tKey("teams.2")}</h2>
          ${profileTeamsHtml(profile)}
        </section>
        ${own ? `
          ${profileRequestsHtml()}
          <section class="profile-panel">
            <h2>${tKey("friends")}</h2>
            <form class="profile-add-friend" data-profile-form="friend" autocomplete="off">
              <input id="profile-friend-name" type="text" maxlength="20" placeholder="username">
              <button class="btn btn-ghost" type="submit">${tKey("add")}</button>
            </form>
            ${profileFriendsHtml()}
          </section>
        ` : `
          <section class="profile-panel">
            <h2>${tKey("information")}</h2>
            <div class="profile-info-row"><span>${tKey("role")}</span><b>${escapeHtml(profileRoleLabel(profile.role))}</b></div>
            <div class="profile-info-row"><span>${tKey("status")}</span><b>${profile.online ? tKey("online.2") : tKey("offline.2")}</b></div>
            <div class="profile-info-row"><span>${tKey("on.lavunio.since")}</span><b>${escapeHtml(formatDateTime(profile.createdAt))}</b></div>
          </section>
        `}
      </aside>
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
}

