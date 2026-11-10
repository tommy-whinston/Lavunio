'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { lavunioLoggedIn } from '../../core/lavunio.js';
import { tKey } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { loadNotifications } from '../notifications/index.js';
import { renderProfile } from '../profile/view.js';
import { renderMessagesList } from '../messages/view.js';

let socialActions = {
  askConfirm: async () => false
};

export function configureSocial(actions) {
  socialActions = { ...socialActions, ...actions };
}

export async function heartbeatPresence() {
  if (!lavunioLoggedIn() || !api.presenceHeartbeat) return;
  try { await api.presenceHeartbeat(); } catch (_) {}
}

export async function loadFriends(force = false) {
  if (!lavunioLoggedIn() || !api.friendsList) return;
  try {
    const [friends, requests] = await Promise.all([api.friendsList(), api.friendRequests()]);
    S.friends = Array.isArray(friends) ? friends : [];
    S.friendRequests = requests && typeof requests === 'object'
      ? { incoming: requests.incoming || [], outgoing: requests.outgoing || [] }
      : { incoming: [], outgoing: [] };
  } catch (err) {
    toast(tKey("failed.to.load.friends") + " " + err, 'error');
  }
  refreshFriendSurfaces();
}

export function refreshFriendSurfaces() {
  if (S.section === 'profile' && S.playerProfile) renderProfile(S.playerProfile);
  if (S.section === 'messages') renderMessagesList();
}

export async function respondFriendRequest(id, action) {
  try {
    await api.friendRespond(id, action);
    toast(action === 'accept' ? tKey("request.accepted") : tKey("request.declined"), 'ok');
    await loadFriends(true);
    await loadNotifications();
  } catch (err) {
    toast(tKey("failed.to.process.request") + " " + err, 'error');
  }
}

export async function removeFriend(username) {
  const confirmed = await socialActions.askConfirm(tKey("remove.friend"), tKey("app.friend.remove.warning", [username]), tKey("delete"));
  if (!confirmed) return;
  try {
    await api.friendRemove(username);
    toast(tKey("friend.removed"), 'ok');
    await loadFriends(true);
  } catch (err) {
    toast(tKey("failed.to.remove.friend") + " " + err, 'error');
  }
}
