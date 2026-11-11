'use strict';

import { api } from '../../api/client.js';
import { S } from '../../core/state.js';
import { $, normalizeIdInput } from '../../core/dom.js';
import { els } from '../../core/elements.js';
import { lavunioName, applyLavunioAvatar } from '../../core/lavunio.js';
import { tKey } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { openProfile, uploadLavunioSkin, deleteLavunioSkin } from '../profile/actions.js';
import { loadNotifications, updateNotificationsBadge, closeNotifications } from '../notifications/index.js';

let accountActions = {
  updateSocialNav: () => {},
  updatePublisherNav: () => {},
  updateModerationNav: () => {},
  loadFollows: () => {},
  heartbeatPresence: () => {},
  loadFriends: () => {},
  showSection: () => {},
  renderStore: () => {},
  openModal: () => {}
};

export function configureAccount(actions) {
  accountActions = { ...accountActions, ...actions };
}

export function renderAccountChip() {
  const user = S.lavunio && S.lavunio.user;
  if (els.sidebarName) els.sidebarName.textContent = user ? lavunioName(user) : tKey("guest");
  if (els.sidebarStatus) {
    els.sidebarStatus.textContent = user
      ? (user.role === 'admin' ? tKey("administrator")
        : user.role === 'author' ? tKey("author")
          : user.role === 'moderator' ? tKey("moderator.2") : tKey("player.2"))
      : tKey("sign.in.to.lavunio.3");
  }
  applyLavunioAvatar(els.sidebarAvatar, user);
  if (els.sidebarMessages) els.sidebarMessages.hidden = !user;
  accountActions.updateSocialNav();
}

export function bindAccountModal() {
  $('lavunio-form').onsubmit = (event) => {
    event.preventDefault();
    submitLavunioForm();
  };
  $('lavunio-switch').onclick = () => {
    S.lavunioRegisterMode = !S.lavunioRegisterMode;
    renderLavunioPane();
    $('lavunio-email').focus();
  };
  const usernameInput = $('lavunio-username');
  if (usernameInput) usernameInput.addEventListener('input', () => normalizeIdInput(usernameInput));
  $('lavunio-logout').onclick = () => logoutLavunio();
  $('lavunio-profile').onclick = () => {
    const user = S.lavunio && S.lavunio.user;
    if (!user) return;
    $('modal-account').hidden = true;
    openProfile(user.username);
  };
  $('lavunio-verify-btn').onclick = () => confirmLavunioEmail();
  $('lavunio-verify-resend').onclick = () => resendLavunioVerification();
  $('lavunio-login-code-btn').onclick = () => verifyLavunioLoginCode();
  $('lavunio-login-cancel').onclick = () => {
    S.loginChallenge = null;
    renderLavunioPane();
  };
  const verifyInput = $('lavunio-verify-code');
  if (verifyInput) verifyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); confirmLavunioEmail(); }
  });
  const loginCodeInput = $('lavunio-login-code');
  if (loginCodeInput) loginCodeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); verifyLavunioLoginCode(); }
  });
  $('lavunio-skin-upload').onclick = () => uploadLavunioSkin();
  $('lavunio-skin-delete').onclick = () => deleteLavunioSkin();
  const applyBtn = $('author-apply-btn');
  if (applyBtn) applyBtn.onclick = () => openAuthorApplyModal();
  const applyForm = $('author-apply-form');
  if (applyForm) applyForm.onsubmit = (event) => {
    event.preventDefault();
    submitAuthorApplication();
  };
}

export async function refreshLavunioStatus() {
  if (!api.lavunioStatus) return;
  try {
    S.lavunio = api.lavunioRefreshProfile
      ? await api.lavunioRefreshProfile()
      : await api.lavunioStatus();
    renderLavunioPane();
    renderAccountChip();
    accountActions.loadFollows();
    loadAuthorApplication();
    accountActions.heartbeatPresence();
    loadNotifications();
    accountActions.updateSocialNav();
  } catch (_) {}
}

export function renderAccountModal() {
  renderLavunioPane();
}

export function renderLavunioPane() {
  const available = !!(S.lavunio && S.lavunio.configured);
  const user = S.lavunio && S.lavunio.user;
  const challenge = S.loginChallenge;
  const form = $('lavunio-form');
  const signed = $('lavunio-signed');
  const current = $('lavunio-current');
  const hint = $('lavunio-api-hint');
  const error = $('lavunio-error');
  const challengeBox = $('lavunio-login-challenge');

  if (!form) return;
  if (hint) hint.hidden = available;
  if (current) current.hidden = !user;
  if (challengeBox) challengeBox.hidden = !challenge || !!user;
  if (form) form.hidden = !!user || !!challenge;
  if (signed) signed.hidden = !user;
  if (challenge) {
    const text = $('lavunio-login-challenge-text');
    if (text) text.textContent = tKey("login.code.sent.to", [challenge.email || '']);
  }

  if (user) {
    $('lavunio-name').textContent = lavunioName(user);
    const bits = [];
    if (user.email) bits.push(user.email);
    bits.push(user.emailVerified ? tKey("email.verified") : tKey("email.not.verified.2"));
    bits.push(
      user.role === 'admin' ? tKey("administrator.2") :
      user.role === 'author' ? tKey("author.2") :
      user.role === 'moderator' ? tKey("moderator") : tKey("player")
    );
    const sub = $('lavunio-sub');
    sub.innerHTML = '';
    bits.forEach((text, index) => {
      if (index) sub.appendChild(document.createTextNode(' · '));
      const span = document.createElement('span');
      span.textContent = text;
      if (index === 1) span.className = user.emailVerified ? 'ok' : 'warn';
      sub.appendChild(span);
    });
    applyLavunioAvatar($('lavunio-avatar'), user);
    $('lavunio-verify').hidden = !!user.emailVerified;
    if (user.emailVerified) $('lavunio-verify-code').value = '';
    renderAuthorApply(user);

    const skinImg = $('lavunio-skin-img');
    if (user.skinUrl) {
      skinImg.src = user.skinUrl;
      skinImg.hidden = false;
    } else {
      skinImg.removeAttribute('src');
      skinImg.hidden = true;
    }
    $('lavunio-skin-model').value = user.skinModel || 'classic';
    $('lavunio-skin-delete').hidden = !user.skinUrl;
  } else {
    $('lavunio-verify').hidden = true;
    const register = !!S.lavunioRegisterMode;
    $('lavunio-username-field').hidden = !register;
    $('lavunio-display-name-field').hidden = !register;
    if (els.consentRow) els.consentRow.hidden = !register;
    $('lavunio-password').autocomplete = register ? 'new-password' : 'current-password';
    $('lavunio-submit').textContent = register ? tKey("create.account") : tKey("sign.in");
    $('lavunio-switch-text').textContent = register ? tKey("already.have.an.account") : tKey("no.account");
    $('lavunio-switch').textContent = register ? tKey("sign.in") : tKey("sign.up");
    if (error) error.hidden = true;
  }
  accountActions.updatePublisherNav();
  accountActions.updateModerationNav();
}

async function submitLavunioForm() {
  const error = $('lavunio-error');
  const email = $('lavunio-email').value.trim();
  const password = $('lavunio-password').value;
  const username = $('lavunio-username').value.trim().toLowerCase();
  const displayName = $('lavunio-display-name').value.trim();
  const register = !!S.lavunioRegisterMode;

  error.hidden = true;
  if (!email || !password) {
    error.textContent = tKey("fill.in.email.and");
    error.hidden = false;
    return;
  }
  if (register && !/^[a-z0-9]{3,20}$/.test(username)) {
    error.textContent = tKey("profile.id.invalid");
    error.hidden = false;
    return;
  }
  if (register && displayName.length > 16) {
    error.textContent = tKey("display.name.hint");
    error.hidden = false;
    return;
  }
  if (register && els.consent && !els.consent.checked) {
    error.textContent = tKey("please.accept.the.terms");
    error.hidden = false;
    els.consent.focus();
    return;
  }
  if (!S.lavunio || !S.lavunio.configured) {
    error.textContent = tKey("lavunio.api.is.not.2");
    error.hidden = false;
    return;
  }

  const button = $('lavunio-submit');
  button.disabled = true;
  button.textContent = register ? tKey("creating") : tKey("signing.in");
  try {
    const status = register
      ? await api.lavunioRegister(email, password, username || null, displayName || null, !!(els.consent && els.consent.checked))
      : await api.lavunioLogin(email, password);
    if (!register && status && status.requiresCode) {
      S.loginChallenge = { id: status.challengeId, email: status.email || email };
      $('lavunio-password').value = '';
      renderLavunioPane();
      toast(tKey("login.code.sent"), 'warn');
      const codeInput = $('lavunio-login-code');
      codeInput.value = '';
      codeInput.focus();
      return;
    }
    applyLavunioSession(status, register);
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.sign.in"));
    error.hidden = false;
  } finally {
    button.disabled = false;
    if (!S.lavunio || !S.lavunio.user) {
      button.textContent = register ? tKey("create.account") : tKey("sign.in");
    }
  }
}

function applyLavunioSession(status, register) {
  S.loginChallenge = null;
  S.lavunio = status;
  $('lavunio-password').value = '';
  renderLavunioPane();
  renderAccountChip();
  accountActions.loadFollows();
  accountActions.heartbeatPresence();
  loadNotifications();
  accountActions.loadFriends(true);
  accountActions.updateSocialNav();
  const user = status && status.user;
  const needsCode = !!(user && !user.emailVerified);
  const name = user ? lavunioName(user) : '';
  toast(
    needsCode
      ? tKey("email.code.sent")
      : (register ? tKey("lavunio.account.created") : tKey("app.welcome.back", [name || tKey("player")])),
    needsCode ? 'warn' : 'ok'
  );
  if (needsCode) {
    $('modal-account').hidden = false;
    $('lavunio-verify-code').value = '';
    $('lavunio-verify-code').focus();
    if (!register) {
      api.lavunioResendVerification()
        .then((next) => {
          S.lavunio = next;
          renderLavunioPane();
        })
        .catch(() => {});
    }
  } else if (user) {
    $('modal-account').hidden = true;
  }
  if (S.profileAfterLogin && user) {
    S.profileAfterLogin = false;
    openProfile(user.username);
  }
}

export async function logoutLavunio() {
  try {
    await api.lavunioLogout();
  } catch (_) {}
  S.lavunio = { configured: true, hasSession: false, user: null };
  S.loginChallenge = null;
  S.lavunioRegisterMode = false;
  S.reviews = {};
  S.follows = [];
  S.feed = [];
  S.friends = [];
  S.notifications = [];
  S.notificationsUnread = 0;
  S.playerProfile = null;
  S.profileUsername = null;
  S.chatKind = null;
  S.chatTarget = null;
  S.chatMessages = [];
  updateNotificationsBadge();
  closeNotifications();
  accountActions.updateSocialNav();
  if (S.section === 'profile' || S.section === 'messages') accountActions.showSection('store');
  renderLavunioPane();
  renderAccountChip();
  accountActions.renderStore();
  toast(tKey("you.signed.out.of"), 'ok');
}

async function confirmLavunioEmail() {
  const input = $('lavunio-verify-code');
  const code = input.value.trim();
  if (!/^\d{6}$/.test(code)) {
    toast(tKey("enter.code.from.email"), 'error');
    input.focus();
    return;
  }
  const button = $('lavunio-verify-btn');
  button.disabled = true;
  button.textContent = tKey("checking");
  try {
    const status = await api.lavunioVerifyEmail(code);
    S.lavunio = status;
    input.value = '';
    renderLavunioPane();
    renderAccountChip();
    toast(tKey("email.verified.2"), 'ok');
  } catch (err) {
    toast(tKey("invalid.email.code") + " " + err, 'error');
  } finally {
    button.disabled = false;
    button.textContent = tKey("confirm");
  }
}

async function resendLavunioVerification() {
  const button = $('lavunio-verify-resend');
  button.disabled = true;
  try {
    const status = await api.lavunioResendVerification();
    S.lavunio = status;
    renderLavunioPane();
    toast(tKey("email.sent.check.your"), 'warn');
    $('lavunio-verify-code').focus();
  } catch (err) {
    toast(tKey("failed.to.verify.email") + " " + err, 'error');
  } finally {
    button.disabled = false;
  }
}

async function verifyLavunioLoginCode() {
  const challenge = S.loginChallenge;
  if (!challenge) return;
  const input = $('lavunio-login-code');
  const code = input.value.trim();
  if (!/^\d{6}$/.test(code)) {
    toast(tKey("enter.code.from.email"), 'error');
    input.focus();
    return;
  }
  const button = $('lavunio-login-code-btn');
  button.disabled = true;
  try {
    const status = await api.lavunioVerifyLogin(challenge.id, code);
    input.value = '';
    applyLavunioSession(status, false);
  } catch (err) {
    toast(tKey("invalid.login.code") + " " + err, 'error');
  } finally {
    button.disabled = false;
  }
}

function renderAuthorApply(user) {
  const box = $('author-apply');
  if (!box) return;
  const isPlayer = !!(user && user.role === 'player');
  box.hidden = !isPlayer;
  if (!isPlayer) return;
  const text = $('author-apply-text');
  const button = $('author-apply-btn');
  const application = S.authorApplication;
  if (!application) {
    text.textContent = tKey("want.to.publish.your");
    button.hidden = false;
    button.textContent = tKey("become.an.author");
  } else if (application.status === 'open') {
    text.textContent = tKey("application.pending");
    button.hidden = true;
  } else if (application.status === 'rejected') {
    text.textContent = tKey("app.application.rejected.note", [application.note || tKey("app.without.reason")]);
    button.hidden = false;
    button.textContent = tKey("submit.again");
  } else {
    text.textContent = tKey("author.access.granted");
    button.hidden = true;
  }
}

async function loadAuthorApplication() {
  const user = S.lavunio && S.lavunio.user;
  if (!user || user.role !== 'player' || !api.authorApplicationStatus) {
    S.authorApplication = null;
    renderAuthorApply(user);
    return;
  }
  try {
    S.authorApplication = await api.authorApplicationStatus();
  } catch (_) {
    S.authorApplication = null;
  }
  renderAuthorApply(user);
}

function openAuthorApplyModal() {
  $('author-apply-message').value = '';
  $('author-apply-links').value = '';
  $('author-apply-error').hidden = true;
  accountActions.openModal('modal-author-apply');
  setTimeout(() => $('author-apply-message').focus(), 50);
}

async function submitAuthorApplication() {
  const message = $('author-apply-message').value.trim();
  const links = $('author-apply-links').value.trim();
  const error = $('author-apply-error');
  if (message.length < 20) {
    error.textContent = tKey("tell.us.about.yourself");
    error.hidden = false;
    return;
  }
  const button = $('author-apply-submit');
  button.disabled = true;
  button.textContent = tKey("sending");
  error.hidden = true;
  try {
    S.authorApplication = await api.authorApplicationApply(message, links);
    $('modal-author-apply').hidden = true;
    toast(tKey("application.submitted.for.review"), 'ok');
    renderLavunioPane();
  } catch (err) {
    error.textContent = String(err || tKey("failed.to.submit.application"));
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = tKey("submit.application");
  }
}
