'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { teamRoleLabel } from '../../core/labels.js';
import { toast } from '../../ui/toast.js';

let teamActions = {
  openDetail: () => {},
  publisherAllowed: () => false,
  openModal: () => {},
  askConfirm: async () => false
};

export function configureTeams(actions) {
  teamActions = { ...teamActions, ...actions };
}

export function bindTeams() {
  const newButton = $('team-new');
  if (newButton) newButton.onclick = () => openTeamModal(null);
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
    const team = S.teams.find((item) => item.id === button.dataset.id);
    if (!team) return;
    if (button.dataset.teamAction === 'edit') openTeamModal(team);
    else if (button.dataset.teamAction === 'archive') archiveTeam(team);
    else if (button.dataset.teamAction === 'members') openTeamMembers(team);
    else if (button.dataset.teamAction === 'page') openTeamPage(team);
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
      const button = event.target.closest('button[data-member-remove]');
      if (!button) return;
      removeTeamMember(button.dataset.memberRemove);
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
    else if (action === 'edit') openTeamModal(team);
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
  const title = $('team-title');
  const slug = $('team-slug');
  if (title && slug) {
    title.oninput = () => {
      if (!slug.dataset.touched) slug.value = publisherSlug(title.value);
    };
    slug.oninput = () => { slug.dataset.touched = '1'; };
  }
}

export function renderTeams() {
  if (!els.teamList) return;
  const teams = S.teams || [];
  if (els.teamStatCount) els.teamStatCount.textContent = String(teams.length);
  if (els.teamHint) {
    els.teamHint.textContent = S.teamsLoading && !S.teamsLoaded
      ? 'Загрузка…'
      : teams.length
        ? `Команд: ${teams.length}`
        : 'Создай первую команду';
  }
  if (els.teamEmpty) els.teamEmpty.hidden = teams.length > 0;
  els.teamList.innerHTML = teams.map((team) => `
    <article class="pub-card">
      <div class="pub-card-head">
        <div>
          <div class="pub-title">${escapeHtml(team.title)}</div>
          <div class="pub-sub">${escapeHtml(team.slug)} · ${escapeHtml(teamRoleLabel(team.role))}</div>
        </div>
        <span class="pub-status ${team.status === 'active' ? 'published' : 'hidden'}">${team.status === 'active' ? 'Активна' : 'В архиве'}</span>
      </div>
      <div class="mod-changelog">${escapeHtml(team.description || 'Без описания')}</div>
      <div class="pub-release-actions">
        <button class="btn btn-primary" type="button" data-team-action="page" data-id="${escapeHtml(team.id)}">Страница</button>
        <button class="btn btn-ghost" type="button" data-team-action="members" data-id="${escapeHtml(team.id)}">Участники</button>
        <button class="btn btn-ghost" type="button" data-team-action="edit" data-id="${escapeHtml(team.id)}">Редактировать</button>
        ${team.role === 'owner' ? `<button class="btn btn-ghost" type="button" data-team-action="archive" data-id="${escapeHtml(team.id)}">В архив</button>` : ''}
      </div>
    </article>
  `).join('');
}

export async function loadTeams(force = false) {
  if (!teamActions.publisherAllowed()) return;
  if (S.teamsLoading) return;
  if (S.teamsLoaded && !force) {
    renderTeams();
    return;
  }
  S.teamsLoading = true;
  renderTeams();
  try {
    const teams = await api.teamsMine();
    S.teams = Array.isArray(teams) ? teams : [];
    S.teamsLoaded = true;
  } catch (err) {
    toast('Не удалось загрузить команды: ' + err, 'error');
  } finally {
    S.teamsLoading = false;
    renderTeams();
  }
}

export function openTeamModal(team) {
  S.teamEditing = team || null;
  $('team-modal-title').textContent = team ? 'Редактировать команду' : 'Новая команда';
  $('team-submit').textContent = team ? 'Сохранить' : 'Создать команду';
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
    error.textContent = 'Укажи название команды';
    error.hidden = false;
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(payload.slug)) {
    error.textContent = 'Slug: 3–64 символа, строчные латинские буквы, цифры и дефис';
    error.hidden = false;
    return;
  }
  const button = $('team-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    if (editing) await api.teamUpdate(editing.id, payload);
    else await api.teamCreate(payload);
    $('modal-team').hidden = true;
    S.teamsLoaded = false;
    toast(editing ? 'Команда обновлена' : 'Команда создана', 'ok');
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || 'Не удалось сохранить команду');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function archiveTeam(team) {
  if (!team) return;
  const confirmed = await teamActions.askConfirm(
    'Архивировать команду?',
    `Команда «${team.title}» будет скрыта. Режимы и история сохранятся.`,
    'В архив'
  );
  if (!confirmed) return;
  try {
    await api.teamArchive(team.id);
    toast('Команда в архиве', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    toast('Не удалось архивировать команду: ' + err, 'error');
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
        <b>Приглашение в «${escapeHtml(invitation.teamTitle)}»</b>
        <span>${escapeHtml(invitation.inviterName)} приглашает на роль «${escapeHtml(teamRoleLabel(invitation.role))}»</span>
      </div>
      <div class="team-invite-actions">
        <button class="btn btn-primary btn-small" type="button" data-invite-action="accept" data-id="${escapeHtml(invitation.id)}">Принять</button>
        <button class="btn btn-ghost btn-small" type="button" data-invite-action="decline" data-id="${escapeHtml(invitation.id)}">Отклонить</button>
      </div>
    </div>
  `).join('');
}

export async function loadTeamInvitations() {
  if (!teamActions.publisherAllowed() || !api.teamInvitations) return;
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
    toast('Приглашение принято', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
    await loadTeamInvitations();
  } catch (err) {
    toast('Не удалось принять приглашение: ' + err, 'error');
  }
}

export async function declineTeamInvitation(invitationId) {
  try {
    await api.teamInvitationDecline(invitationId);
    toast('Приглашение отклонено', 'info');
    await loadTeamInvitations();
  } catch (err) {
    toast('Не удалось отклонить приглашение: ' + err, 'error');
  }
}

export function canManageTeam(team) {
  const user = S.lavunio && S.lavunio.user;
  return !!user && (user.role === 'admin' || (team && (team.role === 'owner' || team.role === 'admin')));
}

export function memberRoleOptions(current) {
  return ['admin', 'publisher', 'designer', 'member'].map((role) =>
    `<option value="${role}" ${role === current ? 'selected' : ''}>${escapeHtml(teamRoleLabel(role))}</option>`
  ).join('');
}

export async function openTeamMembers(team) {
  if (!team) return;
  S.teamMembersTeam = team;
  $('team-members-title').textContent = `Участники · ${team.title}`;
  $('team-members-hint').textContent = 'Загрузка…';
  $('team-members-list').innerHTML = '';
  $('team-invite-form').hidden = true;
  teamActions.openModal('modal-team-members');
  try {
    const profile = await api.teamProfile(team.slug);
    const members = Array.isArray(profile && profile.members) ? profile.members : [];
    S.teamMembers = members;
    renderTeamMembers(team, members);
  } catch (err) {
    $('team-members-hint').textContent = 'Не удалось загрузить участников: ' + err;
  }
}

export function renderTeamMembers(team, members) {
  const manage = canManageTeam(team);
  $('team-members-hint').textContent = `Участников: ${members.length}`;
  els.teamMembersList.innerHTML = members.map((member) => `
    <div class="team-member-row">
      <div class="grow">
        <div class="name">${escapeHtml(member.displayName || member.username)}</div>
        <div class="sub">@${escapeHtml(member.username)} · ${escapeHtml(teamRoleLabel(member.role))}</div>
      </div>
      ${manage && member.role !== 'owner'
        ? `<select data-member-role data-user="${escapeHtml(member.userId)}">${memberRoleOptions(member.role)}</select>
           <button class="btn btn-ghost btn-small" type="button" data-member-remove="${escapeHtml(member.userId)}">Удалить</button>`
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
    error.textContent = 'Укажи username';
    error.hidden = false;
    return;
  }
  const button = $('team-invite-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamInvite(team.id, username, role);
    $('team-invite-username').value = '';
    toast('Приглашение отправлено', 'ok');
  } catch (err) {
    error.textContent = String(err || 'Не удалось отправить приглашение');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function changeTeamMemberRole(userId, role) {
  const team = S.teamMembersTeam;
  if (!team) return;
  try {
    await api.teamMemberRole(team.id, userId, role);
    toast('Роль обновлена', 'ok');
    await openTeamMembers(team);
  } catch (err) {
    toast('Не удалось изменить роль: ' + err, 'error');
    await openTeamMembers(team);
  }
}

export async function removeTeamMember(userId) {
  const team = S.teamMembersTeam;
  if (!team) return;
  const confirmed = await teamActions.askConfirm(
    'Удалить участника?',
    'Участник покинет команду. Его авторство в опубликованных режимах сохранится.',
    'Удалить'
  );
  if (!confirmed) return;
  try {
    await api.teamMemberRemove(team.id, userId);
    toast('Участник удалён', 'ok');
    await openTeamMembers(team);
    S.teamsLoaded = false;
  } catch (err) {
    toast('Не удалось удалить участника: ' + err, 'error');
  }
}

export async function openTeamPage(team) {
  if (!team) return;
  S.teamPage = team;
  S.teamPageData = null;
  $('team-page-title').textContent = team.title;
  els.teamPageContent.innerHTML = '<div class="mod-empty">Загрузка страницы…</div>';
  teamActions.openModal('modal-team-page');
  try {
    const profile = api.teamProfilePublic
      ? await api.teamProfilePublic(team.slug)
      : await api.teamProfile(team.slug);
    S.teamPageData = profile;
    renderTeamPage(team, profile);
  } catch (err) {
    els.teamPageContent.innerHTML = `<div class="mod-empty">Не удалось загрузить команду: ${escapeHtml(String(err))}</div>`;
  }
}

export function renderTeamPage(team, profile) {
  const data = profile && profile.team ? profile.team : {};
  const stats = profile && profile.stats ? profile.stats : {};
  const members = Array.isArray(profile && profile.members) ? profile.members : [];
  const modes = Array.isArray(profile && profile.modes) ? profile.modes : [];
  const news = Array.isArray(profile && profile.news) ? profile.news : [];
  const manage = canManageTeam(team);
  const isMember = !!team.role;
  const user = S.lavunio && S.lavunio.user;
  const actions = [];
  if (manage) {
    actions.push({ action: 'members', label: 'Участники' });
    if (data.joinMode !== 'invite') actions.push({ action: 'join-requests', label: 'Заявки' });
    actions.push({ action: 'news', label: 'Новость' });
    actions.push({ action: 'edit', label: 'Редактировать' });
  }
  if (team.role === 'owner') actions.push({ action: 'transfer', label: 'Передать владение' });
  if (user && user.role === 'admin') {
    actions.push({ action: 'verify', label: data.verified ? 'Снять галочку' : 'Подтвердить' });
  }
  if (!isMember) {
    if (data.joinMode !== 'invite') actions.push({ action: 'join', label: data.joinMode === 'open' ? 'Вступить' : 'Подать заявку' });
    actions.push({ action: 'follow', label: 'Подписаться' });
  }
  const actionHtml = actions.map((item) => `
    <button class="btn btn-ghost" type="button" data-team-page-action="${item.action}">${escapeHtml(item.label)}</button>
  `).join('');

  $('team-page-title').textContent = `${data.title || team.title}${data.verified ? ' ✓' : ''}`;
  els.teamPageContent.innerHTML = `
    <div class="hint">${escapeHtml(data.description || 'Без описания')}</div>
    ${data.links ? `<div class="hint">${escapeHtml(data.links)}</div>` : ''}
    <div class="dashboard-stats team-page-stats">
      <div class="dash-stat"><span>Режимы</span><b>${Number(stats.modes) || 0}</b></div>
      <div class="dash-stat"><span>Опубликовано</span><b>${Number(stats.published) || 0}</b></div>
      <div class="dash-stat"><span>Скачивания</span><b>${Number(stats.downloads) || 0}</b></div>
      <div class="dash-stat"><span>Установки</span><b>${Number(stats.installs) || 0}</b></div>
      <div class="dash-stat"><span>Подписчики</span><b>${Number(profile && profile.followers) || 0}</b></div>
    </div>
    <div class="pub-release-actions team-page-actions">${actionHtml}</div>
    <div id="team-page-requests"></div>
    <h3 class="team-page-heading">Участники</h3>
    <div class="team-members-list">
      ${members.map((member) => `
        <div class="team-member-row">
          <div class="grow">
            <div class="name">${escapeHtml(member.displayName || member.username)}</div>
            <div class="sub">@${escapeHtml(member.username)} · ${escapeHtml(teamRoleLabel(member.role))}</div>
          </div>
        </div>
      `).join('') || '<div class="hint">Участников нет</div>'}
    </div>
    <h3 class="team-page-heading">Режимы</h3>
    <div class="team-mode-list">
      ${modes.map((mode) => `
        <button class="team-mode-row" type="button" data-team-mode="${escapeHtml(mode.slug)}">
          <span>${escapeHtml(mode.title)}</span>
          <b>${Number(mode.installs) || 0} установок</b>
        </button>
      `).join('') || '<div class="hint">Опубликованных режимов пока нет</div>'}
    </div>
    <h3 class="team-page-heading">Новости</h3>
    <div class="team-news-list">
      ${news.map((item) => `
        <div class="session-row">
          <span>${escapeHtml(item.title)}</span>
          <b>${escapeHtml(publisherDate(item.createdAt))}</b>
        </div>
      `).join('') || '<div class="hint">Новостей пока нет</div>'}
    </div>
  `;
}

export async function showTeamJoinRequests(team) {
  const box = $('team-page-requests');
  if (!box || !team) return;
  box.innerHTML = '<div class="hint">Загрузка заявок…</div>';
  try {
    const items = await api.teamJoinRequests(team.id);
    const list = Array.isArray(items) ? items : [];
    box.innerHTML = `
      <h3 class="team-page-heading">Заявки на вступление</h3>
      ${list.length ? list.map((item) => `
        <div class="session-row">
          <span>@${escapeHtml(item.username)} · ${escapeHtml(item.displayName || '')}</span>
          <span>
            <button class="btn btn-primary btn-small" type="button" data-team-request="accept" data-id="${escapeHtml(item.id)}">Принять</button>
            <button class="btn btn-ghost btn-small" type="button" data-team-request="reject" data-id="${escapeHtml(item.id)}">Отклонить</button>
          </span>
        </div>
      `).join('') : '<div class="hint">Заявок нет</div>'}
    `;
  } catch (err) {
    box.innerHTML = `<div class="hint">Не удалось загрузить заявки: ${escapeHtml(String(err))}</div>`;
  }
}

export async function resolveTeamJoinRequest(requestId, action) {
  const team = S.teamPage;
  if (!team) return;
  try {
    await api.teamResolveJoinRequest(team.id, requestId, action);
    toast(action === 'accept' ? 'Заявка принята' : 'Заявка отклонена', 'ok');
    await showTeamJoinRequests(team);
    await openTeamPage(team);
  } catch (err) {
    toast('Не удалось рассмотреть заявку: ' + err, 'error');
  }
}

export function openTeamJoin(team) {
  if (!team) return;
  S.teamJoinTeam = team;
  $('team-join-info').textContent = `Команда «${team.title}»`;
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
    toast(result && result.status === 'joined' ? 'Ты вступил в команду' : 'Заявка отправлена', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || 'Не удалось отправить заявку');
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
    error.textContent = 'Заполни заголовок и текст';
    error.hidden = false;
    return;
  }
  const button = $('team-news-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamCreateNews(team.id, title, body);
    $('modal-team-news').hidden = true;
    toast('Новость опубликована', 'ok');
    await openTeamPage(team);
  } catch (err) {
    error.textContent = String(err || 'Не удалось опубликовать новость');
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
    error.textContent = 'Укажи username';
    error.hidden = false;
    return;
  }
  const button = $('team-transfer-submit');
  button.disabled = true;
  error.hidden = true;
  try {
    await api.teamTransfer(team.id, username);
    $('modal-team-transfer').hidden = true;
    toast('Владение передано', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
  } catch (err) {
    error.textContent = String(err || 'Не удалось передать владение');
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export async function followTeam(team) {
  try {
    await api.teamFollow(team.id);
    toast('Подписка оформлена', 'ok');
    await openTeamPage(team);
  } catch (err) {
    toast('Не удалось подписаться: ' + err, 'error');
  }
}

export async function unfollowTeam(team) {
  try {
    await api.teamUnfollow(team.id);
    toast('Подписка отменена', 'info');
    await openTeamPage(team);
  } catch (err) {
    toast('Не удалось отписаться: ' + err, 'error');
  }
}

export async function toggleTeamVerified(team) {
  try {
    await api.teamVerify(team.id, !team.verified);
    toast('Статус команды обновлён', 'ok');
    S.teamsLoaded = false;
    await loadTeams(true);
    await openTeamPage(S.teams.find((item) => item.id === team.id) || team);
  } catch (err) {
    toast('Не удалось изменить статус: ' + err, 'error');
  }
}

