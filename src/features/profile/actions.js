'use strict';

import { tKey } from '../../i18n/index.js';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, escapeHtml, normalizeIdInput } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { lavunioLoggedIn, applyLavunioAvatar } from '../../core/lavunio.js';
import { isOwnUsername } from '../../core/social.js';
import { toast } from '../../ui/toast.js';
import { renderProfile, profilePostHtml } from './view.js';

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

let skinModalProfile = null;
let skinViewer = null;
let skinViewerKey = '';
let skinViewerSeq = 0;

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
    S.profilePosts = [];
    S.profilePostsTotal = 0;
    S.profilePostsHasMore = false;
    renderProfile(profile);
    loadProfilePosts(profile.username, true).catch(() => {});
  } catch (err) {
    if (seq !== S.profileSeq) return;
    if (els.profileContent) {
      els.profileContent.innerHTML = `<div class="mod-empty">${tKey("failed.to.load.profile")} ${escapeHtml(String(err))}</div>`;
    }
  }
}

export async function loadProfilePosts(username, reset = false) {
  const target = username || S.profileUsername;
  if (!target || !api.playerPosts) return;
  const seq = ++S.profilePostsSeq;
  const offset = reset ? 0 : (S.profilePosts || []).length;
  try {
    const data = await api.playerPosts(target, offset, 20);
    if (seq !== S.profilePostsSeq) return;
    const items = Array.isArray(data && data.items) ? data.items : [];
    S.profilePosts = reset ? items : [...(S.profilePosts || []), ...items];
    S.profilePostsTotal = Number(data && data.total) || S.profilePosts.length;
    S.profilePostsHasMore = S.profilePosts.length < S.profilePostsTotal;
    renderProfilePosts();
  } catch (_) {
    if (seq === S.profilePostsSeq && reset) renderProfilePosts();
  }
}

function renderProfilePosts() {
  const list = $('profile-posts');
  if (!list) return;
  const posts = S.profilePosts || [];
  list.innerHTML = posts.length
    ? posts.map(profilePostHtml).join('')
    : `<div class="profile-empty">${tKey("no.posts.yet")}</div>`;
  const profile = S.playerProfile || {};
  list.querySelectorAll('[data-post-avatar]').forEach((el) => {
    applyLavunioAvatar(el, profile);
  });
  const count = $('profile-posts-count');
  if (count) count.textContent = String(Number(S.profilePostsTotal) || 0);
  const more = $('profile-posts-more');
  if (more) more.hidden = !S.profilePostsHasMore;
}

async function createProfilePost() {
  const input = $('profile-post-body');
  if (!input || !api.profilePostCreate) return;
  const body = input.value.trim();
  if (!body) return;
  const button = $('profile-post-submit');
  if (button) button.disabled = true;
  try {
    await api.profilePostCreate(body);
    input.value = '';
    const length = $('profile-post-length');
    if (length) length.textContent = '0/1000';
    await loadProfilePosts(S.profileUsername, true);
    toast(tKey("post.published"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.publish.post") + " " + err, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteProfilePost(id) {
  const confirmed = await profileActions.askConfirm(
    tKey("delete.post"),
    tKey("delete.post.warning"),
    tKey("delete")
  );
  if (!confirmed) return;
  try {
    await api.profilePostDelete(id);
    await loadProfilePosts(S.profileUsername, true);
    toast(tKey("post.deleted"), 'ok');
  } catch (err) {
    toast(tKey("failed.to.delete.post") + " " + err, 'error');
  }
}

export function bindProfileView() {
  if (!els.profileContent || els.profileContent.dataset.bound) return;
  els.profileContent.dataset.bound = '1';
  els.profileContent.addEventListener('click', async (event) => {
    const avatar = event.target.closest('#profile-avatar');
    if (avatar && avatar.closest('.profile-avatar-editable')) {
      event.preventDefault();
      openSkinModal(S.playerProfile);
      return;
    }
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
    } else if (action === 'delete-post') {
      await deleteProfilePost(button.dataset.postId);
    } else if (action === 'posts-more') {
      await loadProfilePosts(S.profileUsername, false);
    } else if (action === 'skin-upload') {
      await uploadLavunioSkin();
    } else if (action === 'skin-delete') {
      await deleteLavunioSkin();
    }
  });
  els.profileContent.addEventListener('input', (event) => {
    const input = event.target.closest('#profile-username');
    if (input) normalizeIdInput(input);
    if (event.target.id === 'profile-post-body') {
      const length = $('profile-post-length');
      if (length) length.textContent = `${event.target.value.length}/1000`;
    }
  });
  els.profileContent.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const avatar = event.target.closest('#profile-avatar');
    if (!avatar || !avatar.closest('.profile-avatar-editable')) return;
    event.preventDefault();
    openSkinModal(S.playerProfile);
  });
  els.profileContent.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-profile-form]');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.profileForm === 'post') {
      await createProfilePost();
      return;
    }
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
  const upload = $('skin-modal-upload');
  if (upload) upload.onclick = () => uploadLavunioSkin();
  const remove = $('skin-modal-delete');
  if (remove) remove.onclick = () => deleteLavunioSkin();
  const model = $('skin-modal-model');
  if (model) model.onchange = () => setSkinModel(model.value);
  const skinModal = $('modal-skin');
  if (skinModal) {
    new MutationObserver(() => {
      if (!skinViewer) return;
      try { skinViewer.renderPaused = skinModal.hidden; } catch (_) {}
    }).observe(skinModal, { attributes: true, attributeFilter: ['hidden'] });
  }
}

export function openSkinModal(profile) {
  skinModalProfile = profile || S.playerProfile || (S.lavunio && S.lavunio.user) || null;
  if (!skinModalProfile) return;
  renderSkinModal();
  profileActions.openModal('modal-skin');
}

function skinModelHtml(profile) {
  const model = profile.skinModel === 'slim' ? 'slim' : 'classic';
  return `
    <div class="skin-model ${model}" style="--skin:url('${escapeHtml(profile.skinUrl)}')" aria-label="${escapeHtml(tKey("skin"))}">
      <span class="skin-part head"></span>
      <span class="skin-part body"></span>
      <span class="skin-part arm right"></span>
      <span class="skin-part arm left"></span>
      <span class="skin-part leg right"></span>
      <span class="skin-part leg left"></span>
    </div>
  `;
}

function destroySkinViewer() {
  if (skinViewer) {
    try { skinViewer.dispose(); } catch (_) {}
  }
  skinViewer = null;
  skinViewerKey = '';
}

function renderSkinModal() {
  const profile = skinModalProfile || (S.lavunio && S.lavunio.user);
  const preview = $('skin-modal-preview');
  if (!profile || !preview) return;
  const modelValue = profile.skinModel === 'slim' ? 'slim' : 'classic';
  const model = modelValue === 'slim' ? 'slim' : 'default';
  const select = $('skin-modal-model');
  if (select) select.value = modelValue;
  const remove = $('skin-modal-delete');
  if (remove) remove.hidden = !profile.skinUrl;
  if (!profile.skinUrl) {
    destroySkinViewer();
    preview.innerHTML = `<span class="skin-empty">${tKey("no.skin")}</span>`;
    return;
  }

  const key = `${profile.skinUrl}|${model}`;
  if (skinViewer && skinViewerKey === key) return;
  destroySkinViewer();
  preview.innerHTML = '<canvas id="skin-modal-canvas"></canvas>';
  const seq = ++skinViewerSeq;
  if (!window.skinview3d || !api.skinData) {
    preview.innerHTML = skinModelHtml(profile);
    return;
  }
  api.skinData()
    .then((dataUrl) => {
      if (seq !== skinViewerSeq) return null;
      const canvas = $('skin-modal-canvas');
      if (!canvas) return null;
      let viewer;
      try {
        viewer = new window.skinview3d.SkinViewer({
          canvas,
          width: 240,
          height: 240,
          model,
          zoom: 0.85,
          pixelRatio: 1
        });
        viewer.controls.enableZoom = false;
        viewer.autoRotate = false;
      } catch (_) {
        preview.innerHTML = skinModelHtml(profile);
        return null;
      }
      return viewer.loadSkin(dataUrl, { model }).then(() => {
        if (seq !== skinViewerSeq) {
          try { viewer.dispose(); } catch (_) {}
          return;
        }
        skinViewer = viewer;
        skinViewerKey = key;
        canvas.dataset.skinReady = '1';
      });
    })
    .catch(() => {
      if (seq === skinViewerSeq) preview.innerHTML = skinModelHtml(profile);
    });
}

async function setSkinModel(model) {
  if (!lavunioLoggedIn() || !api.setSkinModel) return;
  const select = $('skin-modal-model');
  if (select) select.disabled = true;
  try {
    S.lavunio = await api.setSkinModel(model);
    skinModalProfile = S.lavunio && S.lavunio.user ? S.lavunio.user : skinModalProfile;
    renderSkinModal();
    profileActions.renderLavunioPane();
    profileActions.renderAccountChip();
    toast(tKey("skin.model.updated"), 'ok');
    if (S.section === 'profile' && S.profileUsername) await openProfile(S.profileUsername);
  } catch (err) {
    toast(tKey("failed.to.save.profile") + " " + err, 'error');
    if (select) select.value = (skinModalProfile && skinModalProfile.skinModel) || 'classic';
  } finally {
    if (select) select.disabled = false;
  }
}

export async function savePlayerProfile() {
  const username = $('profile-username') ? $('profile-username').value.trim().toLowerCase() : '';
  const displayName = $('profile-display-name') ? $('profile-display-name').value.trim() : '';
  const bio = $('profile-bio') ? $('profile-bio').value.trim() : '';
  const error = $('profile-error');
  if (!/^[a-z0-9]{3,20}$/.test(username)) {
    if (error) {
      error.textContent = tKey("profile.id.invalid");
      error.hidden = false;
    }
    return;
  }
  if (!displayName || displayName.length > 16) {
    if (error) {
      error.textContent = tKey("display.name.hint");
      error.hidden = false;
    }
    return;
  }
  const button = $('profile-save');
  if (button) button.disabled = true;
  if (error) error.hidden = true;
  try {
    await api.playerUpdateProfile(username, displayName, bio);
    if (api.lavunioRefreshProfile) {
      try { S.lavunio = await api.lavunioRefreshProfile(); } catch (_) {}
    }
    if (S.lavunio && S.lavunio.user) S.profileUsername = S.lavunio.user.username;
    profileActions.renderAccountChip();
    profileActions.renderLavunioPane();
    profileActions.loadFriends(true).catch(() => {});
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
    : ($('skin-modal-model') || $('lavunio-skin-model'));
  const buttons = [$('profile-save'), $('lavunio-skin-upload'), $('skin-modal-upload')].filter(Boolean);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    S.lavunio = await api.uploadSkin(path, modelEl ? modelEl.value : 'classic');
    skinModalProfile = S.lavunio && S.lavunio.user ? S.lavunio.user : skinModalProfile;
    profileActions.renderLavunioPane();
    profileActions.renderAccountChip();
    renderSkinModal();
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
    skinModalProfile = S.lavunio && S.lavunio.user ? S.lavunio.user : skinModalProfile;
    profileActions.renderLavunioPane();
    profileActions.renderAccountChip();
    renderSkinModal();
    toast(tKey("skin.deleted"), 'ok');
    if (S.section === 'profile' && S.profileUsername) await openProfile(S.profileUsername);
  } catch (err) {
    toast(tKey("failed.to.delete.skin") + " " + err, 'error');
  }
}
