'use strict';

import { tKey } from '../../i18n/index.js';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { lavunioLoggedIn } from '../../core/lavunio.js';
import { isOwnUsername } from '../../core/social.js';
import { toast } from '../../ui/toast.js';
import { renderProfile } from './view.js';

let profileActions = {
  showView: () => {},
  loadFriends: async () => {},
  openModal: () => {},
  showSection: () => {},
  openChat: () => {},
  openTeamPage: () => {},
  openDetail: () => {},
  askConfirm: async () => false,
  logoutLavunio: async () => {},
  renderAccountChip: () => {},
  renderLavunioPane: () => {},
  respondFriendRequest: async () => {}
};

export function configureProfileActions(actions) {
  profileActions = { ...profileActions, ...actions };
}

export async function openProfile(username) {
  const user = S.lavunio && S.lavunio.user;
  const target = username || (user && user.username);
  if (!target) {
    profileActions.openModal('modal-account');
    return;
  }
  const seq = ++S.profileSeq;
  S.profileUsername = target;
  if (S.section !== 'profile') profileActions.showView('profile');
  if (els.profileContent) {
    els.profileContent.innerHTML = '<div class="mod-empty">' + tKey("loading.profile") + '</div>';
  }
  try {
    const profile = await api.playerProfile(target);
    if (seq !== S.profileSeq) return;
    S.playerProfile = profile;
    if (isOwnUsername(profile.username)) {
      try {
        await profileActions.loadFriends(true);
      } catch (_) {}
      if (seq !== S.profileSeq) return;
    }
    renderProfile(profile);
  } catch (err) {
    if (seq !== S.profileSeq) return;
    if (els.profileContent) {
      els.profileContent.innerHTML = `<div class="mod-empty">${tKey("failed.to.load.profile")} ${escapeHtml(String(err))}</div>`;
    }
  }
}

export function bindProfileView() {
  if (!els.profileContent || els.profileContent.dataset.bound) return;
  els.profileContent.dataset.bound = '1';
  els.profileContent.addEventListener('click', async (event) => {
    const teamButton = event.target.closest('[data-profile-team]');
    if (teamButton) {
      profileActions.openTeamPage({ slug: teamButton.dataset.profileTeam, title: teamButton.dataset.profileTeamTitle || teamButton.dataset.profileTeam });
      return;
    }
    const modeButton = event.target.closest('[data-profile-mode]');
    if (modeButton) {
      profileActions.openDetail(modeButton.dataset.profileMode);
      return;
    }
    const button = event.target.closest('[data-profile-action]');
    if (!button) return;
    const action = button.dataset.profileAction;
    const username = button.dataset.username || (S.playerProfile && S.playerProfile.username);
    if (action === 'settings') {
      profileActions.openModal('modal-settings');
    } else if (action === 'edit') {
      const panel = $('profile-edit');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action === 'logout') {
      profileActions.logoutLavunio();
    } else if (action === 'messages') {
      profileActions.showSection('messages');
    } else if (action === 'chat') {
      profileActions.openChat('direct', username, button.dataset.name || username);
    } else if (action === 'friend-profile') {
      openProfile(username);
    } else if (action === 'add-friend') {
      button.disabled = true;
      try {
        await api.friendAdd(username);
        toast(tKey("request.sent"), 'ok');
        await profileActions.loadFriends(true);
        await openProfile(username);
      } catch (err) {
        toast(tKey("failed.to.add.friend") + " " + err, 'error');
        button.disabled = false;
      }
    } else if (action === 'remove-friend') {
      const confirmed = await profileActions.askConfirm(tKey("remove.friend"), tKey("app.friend.remove.warning", [username]), tKey("delete"));
      if (!confirmed) return;
      try {
        await api.friendRemove(username);
        toast(tKey("friend.removed"), 'ok');
        await profileActions.loadFriends(true);
        if (S.playerProfile) await openProfile(S.playerProfile.username);
      } catch (err) {
        toast(tKey("failed.to.remove.friend") + " " + err, 'error');
      }
    } else if (action === 'accept-request' || action === 'decline-request') {
      await profileActions.respondFriendRequest(button.dataset.id, action === 'accept-request' ? 'accept' : 'decline');
      if (S.playerProfile) await openProfile(S.playerProfile.username);
    } else if (action === 'skin-upload') {
      await uploadLavunioSkin();
    } else if (action === 'skin-delete') {
      await deleteLavunioSkin();
    }
  });
  els.profileContent.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-profile-form]');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.profileForm === 'friend') {
      const input = $('profile-friend-name');
      const username = input ? input.value.trim() : '';
      if (!username) return;
      try {
        await api.friendAdd(username);
        input.value = '';
        toast(tKey("request.sent"), 'ok');
        await profileActions.loadFriends(true);
        if (S.playerProfile) renderProfile(S.playerProfile);
      } catch (err) {
        toast(tKey("failed.to.add.friend") + " " + err, 'error');
      }
      return;
    }
    if (form.dataset.profileForm === 'edit') await savePlayerProfile();
  });
}

export async function savePlayerProfile() {
  const displayName = $('profile-display-name') ? $('profile-display-name').value.trim() : '';
  const bio = $('profile-bio') ? $('profile-bio').value.trim() : '';
  const error = $('profile-error');
  if (!displayName) {
    if (error) {
      error.textContent = tKey("enter.a.display.name");
      error.hidden = false;
    }
    return;
  }
  const button = $('profile-save');
  if (button) button.disabled = true;
  if (error) error.hidden = true;
  try {
    await api.playerUpdateProfile(displayName, bio);
    if (api.lavunioRefreshProfile) {
      try { S.lavunio = await api.lavunioRefreshProfile(); } catch (_) {}
    }
    profileActions.renderAccountChip();
    profileActions.renderLavunioPane();
    toast(tKey("profile.saved"), 'ok');
    if (S.profileUsername) await openProfile(S.profileUsername);
  } catch (err) {
    if (error) {
      error.textContent = String(err || tKey("failed.to.save.profile"));
      error.hidden = false;
    }
  } finally {
    if (button) button.disabled = false;
  }
}

export async function uploadLavunioSkin() {
  if (!lavunioLoggedIn()) return;
  let path;
  try {
    path = await api.pickSkin();
  } catch (err) {
    toast(tKey("failed.to.select.file") + " " + err, 'error');
    return;
  }
  if (!path) return;

  const accountOpen = $('modal-account') && !$('modal-account').hidden;
  const modelEl = accountOpen
    ? $('lavunio-skin-model')
    : ($('profile-skin-model') || $('lavunio-skin-model'));
  const buttons = [$('profile-save'), $('lavunio-skin-upload')].filter(Boolean);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    S.lavunio = await api.uploadSkin(path, modelEl ? modelEl.value : 'classic');
    profileActions.renderLavunioPane();
    profileActions.renderAccountChip();
    toast(tKey("skin.updated"), 'ok');
    if (S.section === 'profile' && S.profileUsername) await openProfile(S.profileUsername);
  } catch (err) {
    toast(tKey("failed.to.upload.skin") + " " + err, 'error');
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

export async function deleteLavunioSkin() {
  if (!lavunioLoggedIn()) return;
  try {
    S.lavunio = await api.deleteSkin();
    profileActions.renderLavunioPane();
    profileActions.renderAccountChip();
    toast(tKey("skin.deleted"), 'ok');
    if (S.section === 'profile' && S.profileUsername) await openProfile(S.profileUsername);
  } catch (err) {
    toast(tKey("failed.to.delete.skin") + " " + err, 'error');
  }
}
