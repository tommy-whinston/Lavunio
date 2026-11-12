'use strict';

import { tKey } from '../../i18n/index.js';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { teamRoleLabel } from '../../core/labels.js';
import { formatDateTime } from '../../core/format.js';
import { toast } from '../../ui/toast.js';

let teamActions = {
  openDetail: () => {},
  publisherAllowed: () => false,
  openModal: () => {},
  askConfirm: async () => false,
  loggedIn: () => false,
  openAccount: () => {}
};

export function configureTeams(actions) {
  teamActions = { ...teamActions, ...actions };
}

function teamSlug(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 64);
  return slug || `team${Date.now().toString(36)}`;
}

export function bindTeams() {
  const newButton = $('team-new');
  if (newButton) newButton.onclick = () => {
    if (!teamActions.loggedIn()) {
      teamActions.openAccount();
      return;
    }
    openTeamModal(null);
  };
  const refresh = $('team-refresh');
  if (refresh) refresh.onclick = () => loadTeams(true);
  const form = $('team-form');
  if (form) form.onsubmit = (event) => {
    event.preventDefault();
    submitTeam();
  };
  const list = $('team-list');
  if (list) list.onclick = (event) => {
    const button = event.target.closest('button[data-team-action]');
    if (!button) return;
    const team = [...(S.teamDirectory || []), ...(S.teams || [])].find((item) => item.id === button.dataset.id);
    if (!team) return;
    const action = button.dataset.teamAction;
    if (action === 'page') openTeamPage(team);
    else if (action === 'edit' || action === 'settings') openTeamModal(team);
    else if (action === 'archive') archiveTeam(team);
    else if (action === 'members') openTeamMembers(team);
    else if (action === 'follow') followTeam(team);
    else if (action === 'unfollow') unfollowTeam(team);
  };
  const invitations = $('team-invitations');
  if (invitations) invitations.onclick = (event) => {
    const button = event.target.closest('button[data-invite-action]');
    if (!button) return;
    if (button.dataset.inviteAction === 'accept') acceptTeamInvitation(button.dataset.id);
    else if (button.dataset.inviteAction === 'decline') declineTeamInvitation(button.dataset.id);
  };
  const inviteForm = $('team-invite-form');
  if (inviteForm) inviteForm.onsubmit = (event) => {
    event.preventDefault();
    submitTeamInvite();
  };
  const membersList = $('team-members-list');
  if (membersList) {
    membersList.onchange = (event) => {
      const select = event.target.closest('select[data-member-role]');
      if (!select) return;
      changeTeamMemberRole(select.dataset.user, select.value);
    };
    membersList.onclick = (event) => {
      const remove = event.target.closest('button[data-member-remove]');
      if (remove) {
        removeTeamMember(remove.dataset.memberRemove);
        return;
      }
      const savePerms = event.target.closest('button[data-member-save-perms]');
      if (!savePerms) return;
      const row = savePerms.closest('.team-member-row');
      const select = row ? row.querySelector('select[data-member-role]') : null;
      const permissions = {};
      row?.querySelectorAll('input[data-permission]').forEach((input) => {
        permissions[input.dataset.permission] = input.checked;
      });
      changeTeamMemberRole(savePerms.dataset.memberSavePerms, select ? select.value : 'member', permissions);
    };
  }
  const page = $('team-page-content');
  if (page) page.onclick = (event) => {
    const modeButton = event.target.closest('[data-team-mode]');
    if (modeButton) {
      $('modal-team-page').hidden = true;
      teamActions.openDetail(modeButton.dataset.teamMode);
      return;
    }
    const requestButton = event.target.closest('button[data-team-request]');
    if (requestButton) {
      resolveTeamJoinRequest(requestButton.dataset.id, requestButton.dataset.teamRequest);
      return;
    }
    const button = event.target.closest('button[data-team-page-action]');
    if (!button) return;
    const team = S.teamPage;
    if (!team) return;
    const action = button.dataset.teamPageAction;
    if (action === 'members') openTeamMembers(team);
    else if (action === 'join-requests') showTeamJoinRequests(team);
    else if (action === 'news') openTeamNews(team);
    else if (action === 'edit' || action === 'settings') openTeamModal(team);
    else if (action === 'transfer') openTeamTransfer(team);
    else if (action === 'follow') followTeam(team);
    else if (action === 'unfollow') unfollowTeam(team);
    else if (action === 'join') openTeamJoin(team);
    else if (action === 'verify') toggleTeamVerified(team);
  };
  const joinForm = $('team-join-form');
  if (joinForm) joinForm.onsubmit = (event) => { event.preventDefault(); submitTeamJoin(); };
  const newsForm = $('team-news-form');
  if (newsForm) newsForm.onsubmit = (event) => { event.preventDefault(); submitTeamNews(); };
  const transferForm = $('team-transfer-form');
  if (transferForm) transferForm.onsubmit = (event) => { event.preventDefault(); submitTeamTransfer(); };
  const search = $('team-search');
  if (search) {
    let timer = null;
    search.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        S.teamSearch = search.value.trim();
        loadTeams(true);
      }, 300);
    };
  }
  const sort = $('team-sort');
  if (sort) {
    sort.onchange = () => {
      S.teamSort = sort.value;
      loadTeams(true);
    };
  }
  document.querySelectorAll('[data-team-filter]').forEach((button) => {
    button.onclick = () => {
      S.teamFilter = button.dataset.teamFilter;
      document.querySelectorAll('[data-team-filter]').forEach((item) => {
        item.classList.toggle('active', item.dataset.teamFilter === S.teamFilter);
      });
      loadTeams(true);
    };
  });
  const more = $('team-more');
  if (more) more.onclick = () => loadTeams(false, true);
  const title = $('team-title');
  const slug = $('team-slug');
  if (title && slug) {
    title.oninput = () => {
      if (!slug.dataset.touched) slug.value = teamSlug(title.value);
    };
    slug.oninput = () => { slug.dataset.touched = '1'; };
  }
}

function teamCardHtml(team) {
  const avatar = team.avatarUrl
    ? `<span class="team-card-avatar image" style="background-image:url('${escapeHtml(team.avatarUrl)}')"></span>`
    : `<span class="team-card-avatar">${escapeHtml((team.title || '?').slice(0, 2).toUpperCase())}</span>`;
  const banner = team.bannerUrl
    ? `<div class="team-card-banner" style="background-image:url('${escapeHtml(team.bannerUrl)}')"></div>`
    : '<div class="team-card-banner"></div>';
  const followed = !!team.following;
  const actions = [
    `<button class="btn btn-primary btn-small" type="button" data-team-action="page" data-id="${escapeHtml(team.id)}">${tKey("open")}</button>`
  ];
  if (team.role && canManageTeam(team)) {
    actions.push(`<button class="icon-btn" type="button" title="${tKey("settings")}" data-team-action="settings" data-id="${escapeHtml(team.id)}">⚙</button>`);
  } else if (teamActions.loggedIn()) {
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-team-action="${followed ? 'unfollow' : 'follow'}" data-id="${escapeHtml(team.id)}">${followed ? tKey("teams.unsubscribe") : tKey("follow")}</button>`);
  }
  return `
    <article class="team-card">
      ${banner}
      <div class="team-card-body">
        <div class="team-card-head">
          ${avatar}
          <div class="team-card-copy">
            <div class="team-card-title">${escapeHtml(team.title)}${team.verified ? ' <span class="team-verified">✓</span>' : ''}</div>
            <div class="team-card-slug">@${escapeHtml(team.slug)}</div>
          </div>
          ${team.role ? `<span class="team-role-badge">${escapeHtml(teamRoleLabel(team.role))}</span>` : ''}
        </div>
        <p class="team-card-description">${escapeHtml(team.description || tKey("no.description"))}</p>
        <div class="team-card-stats">
          <span><b>${Number(team.membersCount) || 0}</b> ${tKey("members")}</span>
          <span><b>${Number(team.modesCount) || 0}</b> ${tKey("modes")}</span>
          <span><b>${Number(team.followers) || 0}</b> ${tKey("followers")}</span>
        </div>
        <div class="team-card-actions">${actions.join('')}</div>
      </div>
    </article>
  `;
}

export function renderTeams() {
  if (!els.teamList) return;
  const teams = S.teamDirectory || [];
  if (els.teamStatCount) els.teamStatCount.textContent = String(Number(S.teamDirectoryTotal) || 0);
  if (els.teamStatMine) els.teamStatMine.textContent = String((S.teams || []).length);
  if (els.teamHint) {
    els.teamHint.textContent = S.teamsLoading && !S.teamsLoaded
      ? tKey("loading.2")
      : tKey("teams.count", [Number(S.teamDirectoryTotal) || 0]);
  }
  if (els.teamEmpty) els.teamEmpty.hidden = teams.length > 0;
  els.teamList.innerHTML = teams.map(teamCardHtml).join('');
  const more = $('team-more');
  if (more) more.hidden = !S.teamDirectoryHasMore;
}

export async function loadTeams(force = false, append = false) {
  if (S.teamsLoading) return;
  if (!force && !append && S.teamsLoaded) {
    renderTeams();
    return;
  }
  S.teamsLoading = true;
  if (!append) {
    S.teamDirectory = [];
    S.teamDirectoryTotal = 0;
    S.teamDirectoryHasMore = false;
  }
  renderTeams();
  const seq = ++S.teamDirectorySeq;
  try {
    const data = await api.teamsList({
      q: S.teamSearch || '',
      sort: S.teamSort || 'popular',
      filter: S.teamFilter || 'all',
      offset: append ? (S.teamDirectory || []).length : 0,
      limit: 24
    });
    if (seq !== S.teamDirectorySeq) return;
    const items = Array.isArray(data && data.items) ? data.items : [];
    S.teamDirectory = append ? [...(S.teamDirectory || []), ...items] : items;
    S.teamDirectoryTotal = Number(data && data.total) || S.teamDirectory.length;
    S.teamDirectoryHasMore = S.teamDirectory.length < S.teamDirectoryTotal;
    S.teamsLoaded = true;
    if (teamActions.loggedIn() && api.teamsMine) {
      try {
        const mine = await api.teamsMine();
        S.teams = Array.isArray(mine) ? mine : [];
      } catch (_) {
        S.teams = [];
      }
    } else {
      S.teams = [];
    }
  } catch (err) {
    toast(tKey("failed.to.load.teams") + " " + err, 'error');
  } finally {
    if (seq === S.teamDirectorySeq) {
      S.teamsLoading = false;
      renderTeams();
    }
  }
}

export function openTeamModal(team) {
  S.teamEditing = team || null;
  $('team-modal-title').textContent = team ? tKey("edit.team") : tKey("new.team");
  $('team-submit').textContent = team ? tKey("save") : tKey("create.team");
  $('team-title').value = team ? team.title : '';
  $('team-slug').value = team ? team.slug : '';
  $('team-slug').dataset.touched = team ? '1' : '';
  $('team-description').value = team ? team.description : '';
  $('team-links').value = team && team.links ? team.links : '';
  $('team-avatar').value = team && team.avatarUrl ? team.avatarUrl : '';
  $('team-banner').value = team && team.bannerUrl ? team.bannerUrl : '';
  $('team-join-mode').value = team && team.joinMode ? team.joinMode : 'invite';
  $('team-error').hidden = true;
  teamActions.openModal('modal-team');
  setTimeout(() => $('team-title').focus(), 50);
}

export async function submitTeam() {
  const editing = S.teamEditing;
  const payload = {
    slug: $('team-slug').value.trim(),
    title: $('team-title').value.trim(),
    description: $('team-description').value.trim(),
    links: $('team-links').value.trim(),
    avatarUrl: $('team-avatar').value.trim() || null,
    bannerUrl: $('team-banner').value.trim() || null,
    joinMode: $('team-join-mode').value
  };
  const error = $('team-error');
  if (!payload.title) {
    error.textContent = tKey("enter.a.team.name");
    error.hidden = false;
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(payload.slug)) {
    error.textContent = tKey("slug.3.64.characters");
    error.hidden = false;
    return;
  }
  const button = $('team-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    const result = editing
      ? await api.teamUpdate(editing.id, payload)
      : await api.teamCreate(payload);
    $('modal-team').hidden = true;
    S.teamsLoaded = false;
    toast(editing ? tKey("teams.updated") : tKey("teams.created"), 'ok');
    await loadTeams(true);
    if (result && result.slug) {
      openTeamPage(editing ? { ...editing, ...result } : { ...result, role: 'owner' });
    }
  } catch (err) {
    error.textContent = String(err || tKey("teams.failed.save"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function archiveTeam(team) {
  if (!team) return;
  const confirmed = await teamActions.askConfirm(
    tKey("teams.confirm.archive.title"),
    tKey("teams.confirm.archive.text", [team.title]),
    tKey("teams.archive")
  );
  if (!confirmed) return;
  try {
    await api.teamArchive(team.id);
    toast(tKey("team.is.archived"), 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    toast(tKey("failed.to.archive.team") + ' ' + err, 'error');
  }
}

export function renderTeamInvitations() {
  const box = els.teamInvitations;
  if (!box) return;
  const items = S.teamInvitations || [];
  box.hidden = items.length === 0;
  box.innerHTML = items.map((invitation) => `
    <div class="team-invite-card">
      <div class="team-invite-copy">
        <b>${tKey("pattern.invitation.to.x", [escapeHtml(invitation.teamTitle)])}</b>
        <span>${tKey("pattern.x.invites.you.as", [escapeHtml(invitation.inviterName), escapeHtml(teamRoleLabel(invitation.role))])}</span>
      </div>
      <div class="team-invite-actions">
        <button class="btn btn-primary btn-small" type="button" data-invite-action="accept" data-id="${escapeHtml(invitation.id)}">${tKey("accept")}</button>
        <button class="btn btn-ghost btn-small" type="button" data-invite-action="decline" data-id="${escapeHtml(invitation.id)}">${tKey("decline")}</button>
      </div>
    </div>
  `).join('');
}

export async function loadTeamInvitations() {
  if (!teamActions.loggedIn() || !api.teamInvitations) return;
  try {
    const items = await api.teamInvitations();
    S.teamInvitations = Array.isArray(items) ? items : [];
  } catch (_) {
    S.teamInvitations = [];
  }
  renderTeamInvitations();
}

export async function acceptTeamInvitation(invitationId) {
  try {
    await api.teamInvitationAccept(invitationId);
    toast(tKey("invitation.accepted"), 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
    await loadTeamInvitations();
  } catch (err) {
    toast(tKey("failed.to.accept.invitation") + " " + err, 'error');
  }
}

export async function declineTeamInvitation(invitationId) {
  try {
    await api.teamInvitationDecline(invitationId);
    toast(tKey("invitation.declined"), 'info');
    await loadTeamInvitations();
  } catch (err) {
    toast(tKey("failed.to.decline.invitation") + " " + err, 'error');
  }
}

export function canManageTeam(team) {
  const user = S.lavunio && S.lavunio.user;
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!team || !team.role) return false;
  return team.role === 'owner'
    || team.role === 'admin'
    || !!(team.permissions && team.permissions.manage_team);
}

export function canManageMembers(team) {
  const user = S.lavunio && S.lavunio.user;
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!team || !team.role) return false;
  return team.role === 'owner'
    || team.role === 'admin'
    || !!(team.permissions && team.permissions.manage_members);
}

const TEAM_PERMISSIONS = [
  ['manage_team', 'team.permission.manage_team'],
  ['manage_members', 'team.permission.manage_members'],
  ['manage_modes', 'team.permission.manage_modes'],
  ['manage_news', 'team.permission.manage_news']
];

const ROLE_DEFAULT_PERMISSIONS = {
  owner: { manage_team: true, manage_members: true, manage_modes: true, manage_news: true },
  admin: { manage_team: true, manage_members: true, manage_modes: false, manage_news: true },
  publisher: { manage_team: false, manage_members: false, manage_modes: true, manage_news: false },
  designer: { manage_team: false, manage_members: false, manage_modes: true, manage_news: false },
  builder: { manage_team: false, manage_members: false, manage_modes: true, manage_news: false },
  modeler: { manage_team: false, manage_members: false, manage_modes: true, manage_news: false },
  member: { manage_team: false, manage_members: false, manage_modes: false, manage_news: false }
};

function effectivePermissions(member) {
  return {
    ...(ROLE_DEFAULT_PERMISSIONS[member.role] || {}),
    ...(member.permissions && typeof member.permissions === 'object' ? member.permissions : {})
  };
}

function permissionsHtml(member) {
  const effective = effectivePermissions(member);
  return `
    <details class="team-member-perms">
      <summary>${tKey("team.permissions")}</summary>
      <div class="team-perm-grid">
        ${TEAM_PERMISSIONS.map(([key, label]) => `
          <label class="check"><input type="checkbox" data-permission="${key}" ${effective[key] ? 'checked' : ''}> <span>${tKey(label)}</span></label>
        `).join('')}
        <button class="btn btn-ghost btn-small" type="button" data-member-save-perms="${escapeHtml(member.userId)}">${tKey("save")}</button>
      </div>
    </details>
  `;
}

export function memberRoleOptions(current) {
  return ['admin', 'publisher', 'designer', 'builder', 'modeler', 'member'].map((role) =>
    `<option value="${role}" ${role === current ? 'selected' : ''}>${escapeHtml(teamRoleLabel(role))}</option>`
  ).join('');
}

export async function openTeamMembers(team) {
  if (!team) return;
  S.teamMembersTeam = team;
  $('team-members-title').textContent = tKey("pattern.members.x", [team.title]);
  $('team-members-hint').textContent = tKey("loading.2");
  $('team-members-list').innerHTML = '';
  $('team-invite-form').hidden = true;
  teamActions.openModal('modal-team-members');
  try {
    const profile = await api.teamProfile(team.slug);
    const members = Array.isArray(profile && profile.members) ? profile.members : [];
    S.teamMembers = members;
    renderTeamMembers(team, members);
  } catch (err) {
    $('team-members-hint').textContent = tKey("teams.failed.load.members") + ' ' + err;
  }
}

export function renderTeamMembers(team, members) {
  const manage = canManageMembers(team);
  $('team-members-hint').textContent = tKey("pattern.members.x.2", [members.length]);
  els.teamMembersList.innerHTML = members.map((member) => `
    <div class="team-member-row">
      <div class="grow">
        <div class="name">${escapeHtml(member.displayName || member.username)}</div>
        <div class="sub">@${escapeHtml(member.username)} · ${escapeHtml(teamRoleLabel(member.role))}</div>
      </div>
      ${manage && member.role !== 'owner'
        ? `<select data-member-role data-user="${escapeHtml(member.userId)}">${memberRoleOptions(member.role)}</select>
           <button class="btn btn-ghost btn-small" type="button" data-member-remove="${escapeHtml(member.userId)}">${tKey("delete")}</button>
           ${permissionsHtml(member)}`
        : ''}
    </div>
  `).join('');
  $('team-invite-form').hidden = !manage;
}

export async function submitTeamInvite() {
  const team = S.teamMembersTeam;
  if (!team) return;
  const username = $('team-invite-username').value.trim();
  const role = $('team-invite-role').value;
  const error = $('team-invite-error');
  if (!username) {
    error.textContent = tKey("teams.enter.username");
    error.hidden = false;
    return;
  }
  const button = $('team-invite-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamInvite(team.id, username, role);
    $('team-invite-username').value = '';
    toast(tKey("teams.invite.sent"), 'ok');
  } catch (err) {
    error.textContent = String(err || tKey("teams.failed.invite"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function changeTeamMemberRole(userId, role, permissions) {
  const team = S.teamMembersTeam;
  if (!team) return;
  try {
    await api.teamMemberRole(team.id, userId, role, permissions);
    toast(tKey("teams.role.updated"), 'ok');
    await openTeamMembers(team);
  } catch (err) {
    toast(tKey("teams.failed.role") + ' ' + err, 'error');
    await openTeamMembers(team);
  }
}

export async function removeTeamMember(userId) {
  const team = S.teamMembersTeam;
  if (!team) return;
  const confirmed = await teamActions.askConfirm(
    tKey("teams.confirm.remove.title"),
    tKey("teams.confirm.remove.text"),
    tKey("delete")
  );
  if (!confirmed) return;
  try {
    await api.teamMemberRemove(team.id, userId);
    toast(tKey("teams.member.removed"), 'ok');
    await openTeamMembers(team);
    S.teamsLoaded = false;
  } catch (err) {
    toast(tKey("teams.failed.remove.member") + ' ' + err, 'error');
  }
}

export async function openTeamPage(team) {
  if (!team) return;
  S.teamPage = team;
  S.teamPageData = null;
  $('team-page-title').textContent = team.title;
  els.teamPageContent.innerHTML = '<div class="mod-empty">' + tKey("teams.loading.page") + '</div>';
  teamActions.openModal('modal-team-page');
  try {
    const profile = api.teamProfilePublic
      ? await api.teamProfilePublic(team.slug)
      : await api.teamProfile(team.slug);
    const pageTeam = {
      ...team,
      ...(profile && profile.team ? profile.team : {}),
      role: profile && profile.role ? profile.role : (team.role || null),
      following: !!(profile && profile.following),
      permissions: profile && profile.permissions ? profile.permissions : (team.permissions || {})
    };
    S.teamPage = pageTeam;
    S.teamPageData = profile;
    renderTeamPage(pageTeam, profile);
  } catch (err) {
    els.teamPageContent.innerHTML = `<div class="mod-empty">${tKey("failed.to.load.team")} ${escapeHtml(String(err))}</div>`;
  }
}

export function renderTeamPage(team, profile) {
  const data = profile && profile.team ? profile.team : team;
  const stats = profile && profile.stats ? profile.stats : {};
  const members = Array.isArray(profile && profile.members) ? profile.members : [];
  const modes = Array.isArray(profile && profile.modes) ? profile.modes : [];
  const news = Array.isArray(profile && profile.news) ? profile.news : [];
  const role = profile && profile.role ? profile.role : (team.role || null);
  const pageTeam = { ...team, role, permissions: (profile && profile.permissions) || {} };
  const manage = canManageTeam(pageTeam);
  const membersManage = canManageMembers(pageTeam);
  const newsManage = role === 'owner' || role === 'admin'
    || !!(pageTeam.permissions && pageTeam.permissions.manage_news);
  const isMember = !!role;
  const following = !!(profile && profile.following);
  const user = S.lavunio && S.lavunio.user;
  const actions = [];
  if (manage) actions.push({ action: 'settings', label: '⚙', className: 'icon-btn' });
  if (membersManage) {
    actions.push({ action: 'members', label: tKey("members") });
    if (data.joinMode !== 'invite') actions.push({ action: 'join-requests', label: tKey("applications") });
  }
  if (newsManage) actions.push({ action: 'news', label: tKey("common.news") });
  if (role === 'owner') actions.push({ action: 'transfer', label: tKey("transfer.ownership") });
  if (user && user.role === 'admin') {
    actions.push({ action: 'verify', label: data.verified ? tKey("teams.remove.verified") : tKey("confirm") });
  }
  if (!isMember && teamActions.loggedIn()) {
    if (data.joinMode !== 'invite') actions.push({ action: 'join', label: data.joinMode === 'open' ? tKey("teams.join") : tKey("teams.apply") });
    actions.push({ action: following ? 'unfollow' : 'follow', label: following ? tKey("teams.unsubscribe") : tKey("follow") });
  } else if (isMember && following) {
    actions.push({ action: 'unfollow', label: tKey("teams.unsubscribe") });
  }
  const actionHtml = actions.map((item) => `
    <button class="${item.className || 'btn btn-ghost'}" type="button" data-team-page-action="${item.action}">${escapeHtml(item.label)}</button>
  `).join('');
  const banner = data.bannerUrl
    ? `<div class="team-page-banner" style="background-image:url('${escapeHtml(data.bannerUrl)}')"></div>`
    : '<div class="team-page-banner"></div>';
  const avatar = data.avatarUrl
    ? `<span class="team-page-avatar image" style="background-image:url('${escapeHtml(data.avatarUrl)}')"></span>`
    : `<span class="team-page-avatar">${escapeHtml((data.title || '?').slice(0, 2).toUpperCase())}</span>`;

  $('team-page-title').textContent = data.title || team.title || '';
  els.teamPageContent.innerHTML = `
    ${banner}
    <div class="team-page-hero">
      ${avatar}
      <div class="team-page-hero-copy">
        <h3>${escapeHtml(data.title || team.title)}${data.verified ? ' <span class="team-verified">✓</span>' : ''}</h3>
        <div class="team-card-slug">@${escapeHtml(data.slug || team.slug)}</div>
        ${role ? `<span class="team-role-badge">${escapeHtml(teamRoleLabel(role))}</span>` : ''}
        <p>${escapeHtml(data.description || tKey("no.description"))}</p>
      </div>
    </div>
    ${data.links ? `<div class="team-page-links">${escapeHtml(data.links)}</div>` : ''}
    <div class="dashboard-stats team-page-stats">
      <div class="dash-stat"><span>${tKey("modes")}</span><b>${Number(stats.modes) || 0}</b></div>
      <div class="dash-stat"><span>${tKey("published")}</span><b>${Number(stats.published) || 0}</b></div>
      <div class="dash-stat"><span>${tKey("downloads.2")}</span><b>${Number(stats.downloads) || 0}</b></div>
      <div class="dash-stat"><span>${tKey("installs")}</span><b>${Number(stats.installs) || 0}</b></div>
      <div class="dash-stat"><span>${tKey("followers")}</span><b>${Number(profile && profile.followers) || 0}</b></div>
    </div>
    <div class="pub-release-actions team-page-actions">${actionHtml}</div>
    <div id="team-page-requests"></div>
    <h3 class="team-page-heading">${tKey("members")}</h3>
    <div class="team-members-list">
      ${members.map((member) => `
        <div class="team-member-row">
          <div class="grow">
            <div class="name">${escapeHtml(member.displayName || member.username)}</div>
            <div class="sub">@${escapeHtml(member.username)} · ${escapeHtml(teamRoleLabel(member.role))}</div>
          </div>
        </div>
      `).join('') || '<div class="hint">' + tKey("teams.no.members") + '</div>'}
    </div>
    <h3 class="team-page-heading">${tKey("modes")}</h3>
    <div class="team-mode-list">
      ${modes.map((mode) => `
        <button class="team-mode-row" type="button" data-team-mode="${escapeHtml(mode.slug)}">
          <span>${escapeHtml(mode.title)}</span>
          <b>${tKey("pattern.x.installs", [Number(mode.installs) || 0])}</b>
        </button>
      `).join('') || '<div class="hint">' + tKey("no.published.modes.yet.2") + '</div>'}
    </div>
    <h3 class="team-page-heading">${tKey("news")}</h3>
    <div class="team-news-list">
      ${news.map((item) => `
        <div class="session-row">
          <span>${escapeHtml(item.title)}</span>
          <b>${escapeHtml(formatDateTime(item.createdAt))}</b>
        </div>
      `).join('') || '<div class="hint">' + tKey("no.news.yet") + '</div>'}
    </div>
  `;
}

export async function showTeamJoinRequests(team) {
  const box = $('team-page-requests');
  if (!box || !team) return;
  box.innerHTML = '<div class="hint">' + tKey("teams.loading.applications") + '</div>';
  try {
    const items = await api.teamJoinRequests(team.id);
    const list = Array.isArray(items) ? items : [];
    box.innerHTML = `
      <h3 class="team-page-heading">${tKey("teams.join.requests")}</h3>
      ${list.length ? list.map((item) => `
        <div class="session-row">
          <span>@${escapeHtml(item.username)} · ${escapeHtml(item.displayName || '')}</span>
          <span>
            <button class="btn btn-primary btn-small" type="button" data-team-request="accept" data-id="${escapeHtml(item.id)}">${tKey("accept")}</button>
            <button class="btn btn-ghost btn-small" type="button" data-team-request="reject" data-id="${escapeHtml(item.id)}">${tKey("decline")}</button>
          </span>
        </div>
      `).join('') : '<div class="hint">' + tKey("no.applications") + '</div>'}
    `;
  } catch (err) {
    box.innerHTML = `<div class="hint">${tKey("failed.to.load.applications")} ${escapeHtml(String(err))}</div>`;
  }
}

export async function resolveTeamJoinRequest(requestId, action) {
  const team = S.teamPage;
  if (!team) return;
  try {
    await api.teamResolveJoinRequest(team.id, requestId, action);
    toast(action === 'accept' ? tKey("request.accepted") : tKey("request.declined"), 'ok');
    await showTeamJoinRequests(team);
    await openTeamPage(team);
  } catch (err) {
    toast(tKey("failed.to.resolve.application") + " " + err, 'error');
  }
}

export function openTeamJoin(team) {
  if (!team) return;
  S.teamJoinTeam = team;
  $('team-join-info').textContent = tKey("pattern.team.x", [team.title]);
  $('team-join-message').value = '';
  $('team-join-error').hidden = true;
  teamActions.openModal('modal-team-join');
  setTimeout(() => $('team-join-message').focus(), 50);
}

export async function submitTeamJoin() {
  const team = S.teamJoinTeam;
  if (!team) return;
  const message = $('team-join-message').value.trim();
  const error = $('team-join-error');
  const button = $('team-join-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    const result = await api.teamJoin(team.id, message);
    $('modal-team-join').hidden = true;
    toast(result && result.status === 'joined' ? tKey("you.joined.the.team") : tKey("request.sent"), 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.submit.application"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export function openTeamNews(team) {
  if (!team) return;
  S.teamNewsTeam = team;
  $('team-news-title').value = '';
  $('team-news-body').value = '';
  $('team-news-error').hidden = true;
  teamActions.openModal('modal-team-news');
  setTimeout(() => $('team-news-title').focus(), 50);
}

export async function submitTeamNews() {
  const team = S.teamNewsTeam;
  if (!team) return;
  const title = $('team-news-title').value.trim();
  const body = $('team-news-body').value.trim();
  const error = $('team-news-error');
  if (title.length < 3 || body.length < 3) {
    error.textContent = tKey("fill.in.the.title");
    error.hidden = false;
    return;
  }
  const button = $('team-news-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamCreateNews(team.id, title, body);
    $('modal-team-news').hidden = true;
    toast(tKey("teams.news.published"), 'ok');
    await openTeamPage(team);
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.publish.news"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export function openTeamTransfer(team) {
  if (!team) return;
  S.teamTransferTeam = team;
  $('team-transfer-username').value = '';
  $('team-transfer-error').hidden = true;
  teamActions.openModal('modal-team-transfer');
  setTimeout(() => $('team-transfer-username').focus(), 50);
}

export async function submitTeamTransfer() {
  const team = S.teamTransferTeam;
  if (!team) return;
  const username = $('team-transfer-username').value.trim();
  const error = $('team-transfer-error');
  if (!username) {
    error.textContent = tKey("teams.enter.username");
    error.hidden = false;
    return;
  }
  const button = $('team-transfer-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamTransfer(team.id, username);
    $('modal-team-transfer').hidden = true;
    toast(tKey("teams.ownership.transferred"), 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.transfer.ownership"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function followTeam(team) {
  try {
    await api.teamFollow(team.id);
    toast(tKey("teams.subscribed"), 'ok');
    await loadTeams(true);
    await openTeamPage(team);
  } catch (err) {
    toast(tKey("teams.failed.subscribe") + ' ' + err, 'error');
  }
}

export async function unfollowTeam(team) {
  try {
    await api.teamUnfollow(team.id);
    toast(tKey("teams.unsubscribed"), 'info');
    await loadTeams(true);
    await openTeamPage(team);
  } catch (err) {
    toast(tKey("teams.failed.unsubscribe") + ' ' + err, 'error');
  }
}

export async function toggleTeamVerified(team) {
  try {
    await api.teamVerify(team.id, !team.verified);
    toast(tKey("teams.status.updated"), 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
    await openTeamPage(S.teams.find((item) => item.id === team.id) || team);
  } catch (err) {
    toast(tKey("teams.failed.status") + ' ' + err, 'error');
  }
}

