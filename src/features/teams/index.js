'use strict';

import { tKey } from '../../i18n/index.js';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { teamRoleLabel } from '../../core/labels.js';
import { formatDateTime } from '../../core/format.js';
import { toast } from '../../ui/toast.js';
import { syncSelectLabels } from '../../ui/select.js';

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
    if ((S.teams || []).length > 0) {
      toast(tKey("teams.one.only"), 'info');
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
    const button = event.target.closest('[data-team-action]');
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
  if (page) page.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-team-news-form]');
    if (!form) return;
    event.preventDefault();
    submitTeamNewsInline();
  });
  if (page) page.onclick = (event) => {
    const tabButton = event.target.closest('button[data-team-tab]');
    if (tabButton) {
      selectTeamTab(tabButton.dataset.teamTab);
      return;
    }
    const backButton = event.target.closest('[data-team-page-back]');
    if (backButton) {
      closeTeamPage();
      return;
    }
    const modeButton = event.target.closest('[data-team-mode]');
    if (modeButton) {
      teamActions.openDetail(modeButton.dataset.teamMode);
      S.detailFrom = 'team-page';
      if (els.detailBackLabel) els.detailBackLabel.textContent = tKey("app.back.to.team");
      return;
    }
    const requestButton = event.target.closest('button[data-team-request]');
    if (requestButton) {
      return;
    }
    const button = event.target.closest('button[data-team-page-action]');
    if (!button) return;
    const team = S.teamPage;
    if (!team) return;
    const action = button.dataset.teamPageAction;
    if (action === 'settings' || action === 'edit') openTeamSettings(team, 'overview');
    else if (action === 'members') openTeamSettings(team, 'members');
    else if (action === 'news') openTeamNews(team);
    else if (action === 'transfer') openTeamTransfer(team);
    else if (action === 'follow') followTeam(team);
    else if (action === 'unfollow') unfollowTeam(team);
    else if (action === 'verify') toggleTeamVerified(team);
  };
  const settingsModal = $('modal-team-settings');
  if (settingsModal) {
    settingsModal.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-team-settings-tab]');
      if (tab) setTeamSettingsTab(tab.dataset.teamSettingsTab);
    });
  }
  const settingsSave = $('team-settings-save');
  if (settingsSave) settingsSave.onclick = () => saveTeamSettings();
  const settingsTransfer = $('team-settings-transfer');
  if (settingsTransfer) settingsTransfer.onclick = () => openTeamTransfer(S.teamSettingsTeam || S.teamPage);
  const settingsArchive = $('team-settings-archive');
  if (settingsArchive) settingsArchive.onclick = () => archiveTeam(S.teamSettingsTeam || S.teamPage);
  const settingsVerify = $('team-settings-verify');
  if (settingsVerify) settingsVerify.onclick = () => toggleTeamVerified(S.teamSettingsTeam || S.teamPage);
  const avatarUpload = $('team-avatar-upload');
  if (avatarUpload) avatarUpload.onclick = () => uploadTeamImage('avatar');
  const bannerUpload = $('team-banner-upload');
  if (bannerUpload) bannerUpload.onclick = () => uploadTeamImage('banner');
  const roleNew = $('team-role-new');
  if (roleNew) roleNew.onclick = () => startNewRole();
  const rolesList = $('team-roles-list');
  if (rolesList) rolesList.onclick = (event) => {
    const item = event.target.closest('[data-role-select]');
    if (item) selectTeamRole(item.dataset.roleSelect);
  };
  const roleEditor = $('team-role-editor');
  if (roleEditor) roleEditor.onclick = (event) => {
    if (event.target.closest('#team-role-save')) submitTeamRole();
    else if (event.target.closest('#team-role-delete')) deleteTeamRole(roleEditingId);
  };
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
  const actions = [];
  if (team.role && canManageTeam(team)) {
    actions.push(`<button class="icon-btn" type="button" title="${tKey("settings")}" data-team-action="settings" data-id="${escapeHtml(team.id)}">⚙</button>`);
  } else if (teamActions.loggedIn()) {
    actions.push(`<button class="btn btn-ghost btn-small" type="button" data-team-action="${followed ? 'unfollow' : 'follow'}" data-id="${escapeHtml(team.id)}">${followed ? tKey("teams.unsubscribe") : tKey("follow")}</button>`);
  }
  return `
    <article class="team-card" data-team-action="page" data-id="${escapeHtml(team.id)}">
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
  const mineIds = new Set((S.teams || []).map((team) => team.id));
  const teams = (S.teamDirectory || [])
    .slice()
    .sort((a, b) => (mineIds.has(b.id) ? 1 : 0) - (mineIds.has(a.id) ? 1 : 0));
  if (els.teamStatCount) els.teamStatCount.textContent = String(Number(S.teamDirectoryTotal) || 0);
  if (els.teamStatMine) els.teamStatMine.textContent = String((S.teams || []).length);
  const newButton = $('team-new');
  if (newButton) newButton.hidden = (S.teams || []).length > 0;
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
  if (team) {
    openTeamSettings(team, 'overview');
    return;
  }
  S.teamEditing = null;
  $('team-modal-title').textContent = tKey("new.team");
  $('team-submit').textContent = tKey("create.team");
  $('team-title').value = '';
  $('team-slug').value = '';
  $('team-slug').dataset.touched = '';
  $('team-avatar').value = '';
  $('team-error').hidden = true;
  teamActions.openModal('modal-team');
  setTimeout(() => $('team-title').focus(), 50);
}

export async function submitTeam() {
  const payload = {
    slug: $('team-slug').value.trim(),
    title: $('team-title').value.trim(),
    description: '',
    links: '',
    avatarUrl: $('team-avatar').value.trim() || null,
    bannerUrl: null,
    joinMode: 'invite'
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
    const result = await api.teamCreate(payload);
    $('modal-team').hidden = true;
    S.teamsLoaded = false;
    toast(tKey("teams.created"), 'ok');
    await loadTeams(true);
    if (result && result.slug) {
      const created = { ...result, role: 'owner' };
      await openTeamPage(created);
      openTeamSettings(created, 'overview');
    }
  } catch (err) {
    error.textContent = String(err || tKey("teams.failed.save"));
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

/* ---- Настройки команды ---- */

const TEAM_ROLE_ORDER = ['owner', 'admin', 'publisher', 'designer', 'builder', 'modeler', 'member'];

export function setTeamSettingsTab(tab) {
  const allowed = ['overview', 'roles', 'members', 'danger'];
  S.teamSettingsTab = allowed.includes(tab) ? tab : 'overview';
  document.querySelectorAll('[data-team-settings-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.teamSettingsTab === S.teamSettingsTab);
  });
  document.querySelectorAll('[data-team-settings-pane]').forEach((pane) => {
    pane.hidden = pane.dataset.teamSettingsPane !== S.teamSettingsTab;
  });
}

function fillTeamSettings(team) {
  const set = (id, value) => {
    const el = $(id);
    if (el) el.value = value || '';
  };
  set('team-settings-name', team.title);
  set('team-settings-slug', team.slug);
  set('team-settings-description', team.description);
  set('team-settings-links', team.links);
  updateTeamImageHints();
  const error = $('team-settings-error');
  if (error) error.hidden = true;
}

function updateTeamImageHints() {
  const team = S.teamSettingsTeam || {};
  const avatarHint = $('team-avatar-hint');
  if (avatarHint) avatarHint.textContent = team.avatarUrl ? tKey("team.image.uploaded") : tKey("team.image.none");
  const bannerHint = $('team-banner-hint');
  if (bannerHint) bannerHint.textContent = team.bannerUrl ? tKey("team.image.uploaded") : tKey("team.image.none");
}

export async function uploadTeamImage(kind) {
  const team = S.teamSettingsTeam;
  if (!team) return;
  let path;
  try {
    path = await api.teamPickImage();
  } catch (err) {
    toast(String(err), 'error');
    return;
  }
  if (!path) return;
  const button = $(kind === 'avatar' ? 'team-avatar-upload' : 'team-banner-upload');
  if (button) button.disabled = true;
  try {
    const result = await api.teamUploadImage(team.id, kind, path);
    const url = result && result.url;
    if (url) {
      S.teamSettingsTeam = {
        ...team,
        [kind === 'avatar' ? 'avatarUrl' : 'bannerUrl']: url
      };
      if (S.teamPage && S.teamPage.id === team.id) {
        await openTeamPage(S.teamPage);
      }
    }
    updateTeamImageHints();
    toast(tKey("team.image.saved"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.upload") + ' ' + err, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function renderTeamRoles() {
  const box = $('team-roles-table');
  if (!box) return;
  box.innerHTML = `
    <div class="team-roles-head">
      <span>${tKey("role")}</span>
      ${TEAM_PERMISSIONS.map(([, label]) => `<span>${tKey(label)}</span>`).join('')}
    </div>
    ${TEAM_ROLE_ORDER.map((role) => {
      const perms = ROLE_DEFAULT_PERMISSIONS[role] || {};
      return `
        <div class="team-roles-row">
          <span class="team-roles-name">${escapeHtml(teamRoleName(role))}</span>
          ${TEAM_PERMISSIONS.map(([key]) => `<span class="team-roles-mark${perms[key] ? ' on' : ''}">${perms[key] ? '✓' : '—'}</span>`).join('')}
        </div>`;
    }).join('')}
  `;
}

function updateTeamDanger(team) {
  const user = S.lavunio && S.lavunio.user;
  const transfer = $('team-settings-transfer');
  if (transfer) transfer.hidden = !(team && team.role === 'owner');
  const verifyRow = $('team-settings-verify-row');
  const isAdmin = !!(user && user.role === 'admin');
  if (verifyRow) verifyRow.hidden = !isAdmin;
  const verify = $('team-settings-verify');
  if (verify) verify.textContent = team && team.verified ? tKey("teams.remove.verified") : tKey("team.verify");
}

export function openTeamSettings(team, tab) {
  if (!team) return;
  S.teamSettingsTeam = team;
  fillTeamSettings(team);
  roleEditingId = null;
  updateTeamDanger(team);
  teamActions.openModal('modal-team-settings');
  setTeamSettingsTab(tab || 'overview');
  void refreshTeamRoles(team);
  void loadTeamMembersFor(team);
}

export async function saveTeamSettings() {
  const team = S.teamSettingsTeam;
  if (!team) return;
  const error = $('team-settings-error');
  const showError = (text) => {
    if (!error) return;
    error.textContent = text;
    error.hidden = false;
  };
  const payload = {
    title: $('team-settings-name').value.trim(),
    slug: $('team-settings-slug').value.trim(),
    description: $('team-settings-description').value.trim(),
    links: $('team-settings-links').value.trim(),
    avatarUrl: (S.teamSettingsTeam && S.teamSettingsTeam.avatarUrl) || null,
    bannerUrl: (S.teamSettingsTeam && S.teamSettingsTeam.bannerUrl) || null,
    joinMode: 'invite'
  };
  if (!payload.title) {
    showError(tKey("enter.a.team.name"));
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(payload.slug)) {
    showError(tKey("slug.3.64.characters"));
    return;
  }
  const button = $('team-settings-save');
  if (button) button.disabled = true;
  if (error) error.hidden = true;
  try {
    const result = await api.teamUpdate(team.id, payload);
    S.teamsLoaded = false;
    toast(tKey("teams.updated"), 'ok');
    await loadTeams(true);
    const next = { ...team, ...(result || {}), ...payload };
    S.teamSettingsTeam = next;
    if (S.teamPage && S.teamPage.id === team.id) await openTeamPage(next);
  } catch (err) {
    showError(String(err || tKey("teams.failed.save")));
  } finally {
    if (button) button.disabled = false;
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

const TEAM_ROLE_NAME_KEYS = {
  owner: 'owner',
  admin: 'administrator',
  publisher: 'publisher',
  designer: 'designer',
  builder: 'team.role.builder',
  modeler: 'team.role.modeler',
  member: 'member'
};

function teamRoleName(role) {
  const key = TEAM_ROLE_NAME_KEYS[role];
  return key ? tKey(key) : role;
}

let roleEditingId = null;

export function memberRoleOptions(current) {
  const roles = Array.isArray(S.teamRoles) && S.teamRoles.length
    ? S.teamRoles.map((role) => role.name)
    : ['admin', 'publisher', 'designer', 'builder', 'modeler', 'member'];
  return roles.map((role) =>
    `<option value="${escapeHtml(role)}" ${role === current ? 'selected' : ''}>${escapeHtml(teamRoleName(role))}</option>`
  ).join('');
}

function rolePermissions(role) {
  return role && role.permissions && typeof role.permissions === 'object' ? role.permissions : {};
}

const ROLE_PERMISSION_GROUPS = [
  { labelKey: 'team.role.group.team', perms: [['manage_team', 'team.permission.manage_team']] },
  { labelKey: 'team.role.group.members', perms: [['manage_members', 'team.permission.manage_members']] },
  { labelKey: 'team.role.group.content', perms: [['manage_modes', 'team.permission.manage_modes'], ['manage_news', 'team.permission.manage_news']] }
];

function renderTeamRolesList() {
  const box = $('team-roles-list');
  if (!box) return;
  const roles = Array.isArray(S.teamRoles) ? S.teamRoles : [];
  box.innerHTML = roles.map((role) => `
    <button class="team-role-item${role.id === roleEditingId ? ' active' : ''}" type="button" data-role-select="${escapeHtml(role.id)}">
      <span class="team-role-item-name">${escapeHtml(teamRoleName(role.name))}</span>
      ${role.name === 'owner' ? `<span class="team-role-item-tag">${tKey("team.role.base")}</span>` : ''}
    </button>
  `).join('') || `<div class="team-role-item empty">${tKey("team.roles.empty")}</div>`;
}

function renderRoleEditor(role) {
  const box = $('team-role-editor');
  if (!box) return;
  const isNew = !role;
  const perms = isNew ? {} : rolePermissions(role);
  const isBase = !!role && (role.name === 'owner' || role.isDefault);
  box.innerHTML = `
    <div class="team-role-editor-head">
      <h4>${isNew ? tKey("team.role.new") : escapeHtml(teamRoleName(role.name))}</h4>
      ${isBase ? `<span class="team-role-locked">${tKey("team.role.locked")}</span>` : ''}
    </div>
    <div class="field">
      <label for="team-role-name">${tKey("team.role.name")}</label>
      <input id="team-role-name" type="text" maxlength="32" value="${isNew ? '' : escapeHtml(role.name)}">
    </div>
    ${ROLE_PERMISSION_GROUPS.map((group) => `
      <div class="team-perm-group">
        <h5>${tKey(group.labelKey)}</h5>
        ${group.perms.map(([key, label]) => `
          <label class="team-perm-row">
            <span>${tKey(label)}</span>
            <span class="team-switch">
              <input type="checkbox" data-role-perm="${key}"${perms[key] ? ' checked' : ''}${isBase ? ' disabled' : ''}>
              <i></i>
            </span>
          </label>
        `).join('')}
      </div>
    `).join('')}
    <div class="form-error" id="team-role-error" hidden></div>
    <div class="team-role-editor-foot">
      <button class="btn btn-primary" id="team-role-save" type="button">${isNew ? tKey("team.role.create") : tKey("save")}</button>
      ${role && !isBase ? `<button class="btn btn-danger" id="team-role-delete" type="button">${tKey("delete")}</button>` : ''}
    </div>
  `;
}

function selectTeamRole(roleId) {
  const roles = Array.isArray(S.teamRoles) ? S.teamRoles : [];
  const role = roles.find((item) => item.id === roleId) || null;
  roleEditingId = role ? role.id : null;
  renderTeamRolesList();
  renderRoleEditor(role);
}

export function startNewRole() {
  roleEditingId = null;
  renderTeamRolesList();
  renderRoleEditor(null);
}

async function refreshTeamRoles(team) {
  try {
    const roles = await api.teamRoles(team.id);
    S.teamRoles = Array.isArray(roles) ? roles : [];
  } catch (_) {
    S.teamRoles = S.teamRoles || [];
  }
  const roles = S.teamRoles;
  if (!roles.some((role) => role.id === roleEditingId)) {
    roleEditingId = roles[0] ? roles[0].id : null;
  }
  renderTeamRolesList();
  renderRoleEditor(roles.find((role) => role.id === roleEditingId) || null);
  syncInviteRoles();
}

function syncInviteRoles() {
  const select = $('team-invite-role');
  if (!select) return;
  const roles = Array.isArray(S.teamRoles) ? S.teamRoles.filter((role) => role.name !== 'owner') : [];
  if (!roles.length) return;
  const current = select.value;
  select.innerHTML = roles.map((role) => `<option value="${escapeHtml(role.name)}">${escapeHtml(teamRoleName(role.name))}</option>`).join('');
  if (roles.some((role) => role.name === current)) select.value = current;
  syncSelectLabels();
}

export async function submitTeamRole() {
  const team = S.teamSettingsTeam;
  if (!team) return;
  const error = $('team-role-error');
  const input = $('team-role-name');
  const name = input ? input.value.trim() : '';
  const showError = (text) => {
    if (!error) return;
    error.textContent = text;
    error.hidden = false;
  };
  if (!name) {
    showError(tKey("team.role.name.required"));
    return;
  }
  const permissions = {};
  document.querySelectorAll('#team-role-editor [data-role-perm]').forEach((el) => {
    permissions[el.dataset.rolePerm] = el.checked;
  });
  const button = $('team-role-save');
  if (button) button.disabled = true;
  if (error) error.hidden = true;
  try {
    const saved = roleEditingId
      ? await api.teamRoleUpdate(team.id, roleEditingId, name, permissions)
      : await api.teamRoleCreate(team.id, name, permissions);
    if (saved && saved.id) roleEditingId = saved.id;
    toast(tKey("team.role.saved"), 'ok');
    await refreshTeamRoles(team);
    if (S.teamPage && S.teamPage.id === team.id) await openTeamPage(S.teamPage);
  } catch (err) {
    showError(String(err || tKey("team.role.failed")));
  } finally {
    if (button) button.disabled = false;
  }
}

export async function deleteTeamRole(roleId) {
  const team = S.teamSettingsTeam;
  if (!team || !roleId) return;
  const confirmed = await teamActions.askConfirm(
    tKey("team.role.delete"),
    tKey("team.role.delete.confirm"),
    tKey("delete")
  );
  if (!confirmed) return;
  try {
    await api.teamRoleDelete(team.id, roleId);
    toast(tKey("team.role.deleted"), 'ok');
    roleEditingId = null;
    await refreshTeamRoles(team);
  } catch (err) {
    toast(tKey("team.role.failed") + ' ' + err, 'error');
  }
}

export function openTeamMembers(team) {
  openTeamSettings(team, 'members');
}

async function loadTeamMembersFor(team) {
  if (!team) return;
  S.teamMembersTeam = team;
  const hint = $('team-members-hint');
  if (hint) hint.textContent = tKey("loading.2");
  if (els.teamMembersList) els.teamMembersList.innerHTML = '';
  const invite = $('team-invite-form');
  if (invite) invite.hidden = true;
  try {
    const profile = await api.teamProfile(team.slug);
    const members = Array.isArray(profile && profile.members) ? profile.members : [];
    S.teamMembers = members;
    if (profile && Array.isArray(profile.roles) && profile.roles.length) {
      S.teamRoles = profile.roles;
      renderTeamRolesList();
      syncInviteRoles();
    }
    renderTeamMembers(team, members);
    if (profile && profile.team) {
      S.teamSettingsTeam = { ...team, ...profile.team, role: profile.role || team.role };
    }
  } catch (err) {
    if (hint) hint.textContent = tKey("teams.failed.load.members") + ' ' + err;
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
  teamActions.showView('team');
  showTeamPage();
  els.teamPageContent.innerHTML = '<div class="mod-empty">' + tKey("teams.loading.page") + '</div>';
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

export function showTeamPage() {
  const directory = document.querySelector('#team-view .team-directory');
  if (directory) directory.hidden = true;
  if (els.teamPageContent) els.teamPageContent.hidden = false;
}

export function closeTeamPage() {
  const directory = document.querySelector('#team-view .team-directory');
  if (directory) directory.hidden = false;
  if (els.teamPageContent) els.teamPageContent.hidden = true;
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
  const newsManage = role === 'owner' || role === 'admin'
    || !!(pageTeam.permissions && pageTeam.permissions.manage_news);
  const isMember = !!role;
  const following = !!(profile && profile.following);
  const actions = [];
  if (manage) actions.push({ action: 'settings', label: '⚙', className: 'icon-btn' });
  if (manage) actions.push({ action: 'edit', label: tKey("edit.team") });
  if (!isMember && teamActions.loggedIn()) {
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

  els.teamPageContent.innerHTML = `
    <button class="back-btn" type="button" data-team-page-back>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5 L8 12 L15 19"/></svg>
      <span>${tKey("app.back.to.team")}</span>
    </button>

    <div class="profile-hero team-hero">
      ${banner}
      <div class="profile-avatar-wrap team-avatar-wrap">
        ${avatar}
      </div>
      <div class="profile-hero-main team-hero-main">
        <h1>${escapeHtml(data.title || team.title)}${data.verified ? ' <span class="team-verified">✓</span>' : ''}</h1>
        <div class="profile-handle">@${escapeHtml(data.slug || team.slug)}</div>
        <div class="profile-badges team-badges">
          ${role ? `<span class="profile-badge team-role-badge">${escapeHtml(teamRoleLabel(role))}</span>` : ''}
          ${following ? `<span class="profile-badge team-badge">${tKey("teams.subscribed")}</span>` : ''}
        </div>
        <div class="profile-bio team-bio">${escapeHtml(data.description || tKey("no.description"))}</div>
      </div>
      <div class="profile-actions team-actions">${actionHtml}</div>
    </div>

    <div class="profile-stats team-stats">
      <div class="profile-stat team-stat"><span>${tKey("modes")}</span><b>${Number(stats.modes) || 0}</b></div>
      <div class="profile-stat team-stat"><span>${tKey("published")}</span><b>${Number(stats.published) || 0}</b></div>
      <div class="profile-stat team-stat"><span>${tKey("downloads.2")}</span><b>${Number(stats.downloads) || 0}</b></div>
      <div class="profile-stat team-stat"><span>${tKey("installs")}</span><b>${Number(stats.installs) || 0}</b></div>
      <div class="profile-stat team-stat"><span>${tKey("followers")}</span><b>${Number(profile && profile.followers) || 0}</b></div>
    </div>

    <div class="detail-tabs team-tabs" role="tablist">
      <button class="detail-tab" type="button" role="tab" data-team-tab="news">${tKey("news")}</button>
      <button class="detail-tab" type="button" role="tab" data-team-tab="modes">${tKey("modes")}</button>
      <button class="detail-tab" type="button" role="tab" data-team-tab="team">${tKey("nav.team")}</button>
    </div>

    <section class="team-section" data-team-section="news">
      ${newsManage ? `
        <form class="profile-panel team-panel team-news-form" data-team-news-form>
          <textarea id="team-news-input" rows="3" maxlength="5000" placeholder="${tKey("what.is.new")}"></textarea>
          <div class="team-news-form-foot">
            <span class="hint">${tKey("teams.news.hint")}</span>
            <button class="btn btn-primary" type="submit">${tKey("publish")}</button>
          </div>
        </form>
      ` : ''}
      <div class="profile-panel team-panel">
        <div class="team-news-list">
          ${news.map((item) => `
            <div class="session-row">
              <span>${escapeHtml(item.title)}</span>
              <b>${escapeHtml(formatDateTime(item.createdAt))}</b>
            </div>
          `).join('') || '<div class="hint">' + tKey("no.news.yet") + '</div>'}
        </div>
      </div>
    </section>

    <section class="team-section" data-team-section="modes">
      <div class="profile-panel team-panel">
        <div class="team-mode-list">
          ${modes.map((mode) => `
            <button class="profile-mode-row team-mode-row" type="button" data-team-mode="${escapeHtml(mode.slug)}">
              <span>${escapeHtml(mode.title)}</span>
              <b>${tKey("pattern.x.installs", [Number(mode.installs) || 0])}</b>
            </button>
          `).join('') || '<div class="hint">' + tKey("no.published.modes.yet.2") + '</div>'}
        </div>
      </div>
    </section>

    <section class="team-section" data-team-section="team">
      <div class="profile-panel team-panel">
        <div class="team-members-list">
          ${members.map((member) => `
            <div class="team-member-row">
              <div class="grow">
                <div class="name">${escapeHtml(member.displayName || member.username)}</div>
                <div class="sub">@${escapeHtml(member.username)}</div>
              </div>
              <span class="team-role-badge">${escapeHtml(teamRoleName(member.role))}</span>
            </div>
          `).join('') || '<div class="hint">' + tKey("teams.no.members") + '</div>'}
        </div>
      </div>
      ${data.links ? `
        <div class="profile-panel team-panel">
          <h2>${tKey("links")}</h2>
          <div class="team-page-links">${escapeHtml(data.links)}</div>
        </div>
      ` : ''}
    </section>
  `;
  selectTeamTab(S.teamPageTab || 'news');
}

export function selectTeamTab(tab) {
  const allowed = ['news', 'modes', 'team'];
  S.teamPageTab = allowed.includes(tab) ? tab : 'news';
  document.querySelectorAll('#team-page-content [data-team-tab]').forEach((button) => {
    const active = button.dataset.teamTab === S.teamPageTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('#team-page-content [data-team-section]').forEach((section) => {
    section.classList.toggle('tab-hidden', section.dataset.teamSection !== S.teamPageTab);
  });
}

export async function submitTeamNewsInline() {
  const team = S.teamPage;
  const input = $('team-news-input');
  if (!team || !input) return;
  const text = input.value.trim();
  if (text.length < 3) {
    toast(tKey("fill.in.the.title"), 'error');
    return;
  }
  const title = (text.split('\n')[0] || text).slice(0, 120);
  const button = document.querySelector('.team-news-form button[type="submit"]');
  if (button) button.disabled = true;
  try {
    await api.teamCreateNews(team.id, title, text);
    toast(tKey("teams.news.published"), 'ok');
    await openTeamPage(team);
  } catch (err) {
    toast(tKey("failed.to.publish.news") + ' ' + err, 'error');
  } finally {
    if (button) button.disabled = false;
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

