'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');

function createMockScript(scenario) {
  const now = Date.now();
  const admin = { id: 'admin', username: 'admin', displayName: 'Admin', role: 'admin', email: 'admin@example.com', emailVerified: true, skinUrl: '', skinModel: 'classic' };
  const player = { id: 'steve', username: 'steve', displayName: 'Steve', role: 'player', email: 'steve@example.com', emailVerified: true, skinUrl: '', skinModel: 'classic' };
  const offline = scenario === 'offline';
  const user = (scenario === 'guest' || offline) ? null : scenario === 'player' ? player : admin;

  const mode = {
    id: 'night-demon',
    slug: 'night-demon',
    title: 'Night Demon',
    shortDescription: 'A dark mode for testing',
    description: '# Night Demon\n\nA dark mode for testing **Lavunio**.',
    mcVersion: '1.20.1',
    version: '1.0.0',
    loader: 'forge',
    size: '58 MB',
    tags: ['pvp', 'horror'],
    screenshots: ['https://example.com/shot1.png', 'https://example.com/shot2.png'],
    coverUrl: 'https://example.com/cover.png',
    imageUrl: 'https://example.com/image.png',
    accent: '#e5322b',
    installs: 12,
    rating: 4.5,
    reviewsCount: 1,
    status: 'published',
    updatedAt: now,
    changelog: '1.0.0\n- Added stuff',
    history: [{ version: '1.0.0', title: 'Initial release', tags: ['release'], date: '2026-11-01', changes: ['Added stuff'] }],
    authors: [{ id: 'steve', username: 'steve', displayName: 'Steve', name: 'Steve', verified: true }],
    author: { id: 'steve', username: 'steve', displayName: 'Steve', name: 'Steve', verified: true },
    team: { title: 'My Team', verified: true },
    releases: [
      { id: 'r1', version: '1.2.0', status: 'draft', channel: 'stable', changelog: 'Changes', assets: [{ kind: 'archive', url: 'https://example.com/build.zip', size: 2048, fileName: 'build.zip' }] },
      { id: 'r2', version: '1.1.0', status: 'pending', channel: 'stable', changelog: 'Changes', assets: [] },
      { id: 'r3', version: '1.0.0', status: 'published', channel: 'stable', changelog: 'Changes', assets: [], publishedAt: now },
      { id: 'r4', version: '0.9.0', status: 'rejected', channel: 'stable', changelog: 'Changes', assets: [], rejectionNote: 'Bad build', appealStatus: 'open' },
      { id: 'r5', version: '0.8.0', status: 'rejected', channel: 'stable', changelog: 'Changes', assets: [], rejectionNote: 'Bad build' }
    ],
    stats: { downloads: 5, installs: 3, updates: 2, uniqueUsers: 4 }
  };

  const team = { id: 't1', slug: 'my-team', title: 'My Team', role: 'owner', status: 'active', verified: true, description: 'Team description', links: 'https://example.com', joinMode: 'open', members: [], modes: [], news: [] };
  const friend = { id: 'f1', username: 'alex', displayName: 'Alex', online: true };
  const profile = {
    username: 'steve',
    displayName: 'Steve',
    role: 'author',
    online: true,
    lastSeenAt: now,
    createdAt: now - 86400000,
    bio: 'Hello from Steve',
    skinUrl: '',
    stats: { modes: 1, downloads: 5, installs: 3 },
    modes: [{ slug: 'night-demon', title: 'Night Demon', installs: 12 }],
    teams: [{ id: 't1', slug: 'my-team', title: 'My Team', role: 'owner', verified: true }],
    followers: 7
  };
  const queue = { modeTitle: 'Night Demon', modeSlug: 'night-demon', version: '1.2.0', authorName: 'Steve', authorUsername: 'steve', createdAt: now, changelog: 'Changes', releaseId: 'r1', scan: { checkedAt: now, files: 3, bytes: 2048, suspicious: ['a.exe', 'b.exe', 'c.exe', 'd.exe', 'e.exe', 'f.exe'] } };
  const moderationMode = { id: 'm1', title: 'Night Demon', slug: 'night-demon', status: 'draft', authorName: 'Steve', authorUsername: 'steve', updatedAt: now };
  const review = { id: 'rev1', modeTitle: 'Night Demon', modeSlug: 'night-demon', rating: 5, authorName: 'Steve', authorUsername: 'steve', createdAt: now, text: 'Great mode', status: 'pending' };
  const report = { id: 'rep1', targetTitle: 'Night Demon', targetSlug: 'night-demon', reporterName: 'Steve', reporterUsername: 'steve', createdAt: now, reason: 'Spam' };
  const appeal = { id: 'a1', modeTitle: 'Night Demon', modeSlug: 'night-demon', version: '1.0.0', authorName: 'Steve', authorUsername: 'steve', createdAt: now, rejectionNote: 'Bad', message: 'Fix' };
  const application = { id: 'ap1', displayName: 'Steve', username: 'steve', createdAt: now, message: 'Hi', links: '' };
  const history = { action: 'approve', moderatorName: 'Mod', targetType: 'mode', targetId: '1234567890', createdAt: now };
  const news = [{ title: 'Store news', body: 'Body text', authorName: 'Admin', createdAt: now }];
  const modeNews = [{ title: 'Mode news', body: 'Body text', authorName: 'Steve', createdAt: now }];
  const storeModes = Array.from({ length: 30 }, (_, index) => ({
    ...mode,
    id: `mode-${index + 1}`,
    slug: `mode-${index + 1}`,
    title: `Night Mode ${index + 1}`,
    installs: index + 1
  }));

  const data = {
    user,
    enabled: scenario === 'admin' || scenario === 'player',
    offline,
    mode,
    team,
    friend,
    profile,
    queue,
    moderationMode,
    review,
    report,
    appeal,
    application,
    history,
    news,
    modeNews,
    storeModes
  };

  return `<script>
window.__errors = [];
window.__scenario = ${JSON.stringify(scenario)};
window.addEventListener('error', (event) => window.__errors.push(String(event.message || event.error)));
window.addEventListener('unhandledrejection', (event) => window.__errors.push(String(event.reason)));
const data = ${JSON.stringify(data)};
const now = Date.now();
const nav = (name) => window.__scenario === 'guest' ? null : window.__scenario === 'player' ? data.profile : data.user;
const base = {
  minimize: async () => {}, toggleMaximize: async () => true, toggleFullscreen: async () => true,
  isWindowVisible: async () => true, hide: async () => {}, close: async () => {},
  windowSplash: async () => {}, windowReady: async () => {},
  getModes: async () => { if (data.offline) throw new Error('offline'); return [data.mode]; },
  getCachedModes: async () => [data.mode],
  refreshModes: async () => { if (data.offline) throw new Error('offline'); return [data.mode]; },
  searchModes: async (query) => {
    if (data.offline) throw new Error('offline');
    const page = Math.max(1, Number(query && query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query && query.limit) || 24));
    const q = String((query && query.q) || '').trim().toLowerCase();
    const filtered = data.storeModes.filter((mode) => !q || mode.title.toLowerCase().includes(q));
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), page, limit, total: filtered.length };
  },
  getState: async () => ({ 'night-demon': { installed: true, library: true, version: '1.0.0', installedAt: now } }),
  getSettings: async () => ({ lang: 'en', ramGb: 4 }), saveSettings: async (p) => ({ ...p }),
  getSystemRam: async () => 16, diskInfo: async () => ({ availableBytes: 1024 * 1024 * 1024, totalBytes: 4 * 1024 * 1024 * 1024, libraryBytes: 1024 * 1024 }),
  checkUpdate: async () => { if (data.offline) throw new Error('offline'); return { available: false }; }, onUpdateProgress: async () => () => {},
  lavunioStatus: async () => ({ configured: true, hasSession: !!data.user, user: data.user }),
  lavunioRefreshProfile: async () => ({ configured: true, hasSession: !!data.user, user: data.user }),
  lavunioLogin: async () => {
    if (window.__loginChallenge) {
      return { requiresCode: true, challengeId: 'ch1', email: 'steve@example.com' };
    }
    return { configured: true, hasSession: true, user: { ...(data.user || data.profile), emailVerified: true } };
  },
  lavunioVerifyLogin: async () => ({ configured: true, hasSession: true, user: { ...(data.user || data.profile), emailVerified: true } }),
  lavunioRegister: async () => {
    const user = data.user || data.profile;
    return { configured: true, hasSession: true, user: { ...user, emailVerified: !window.__unverifiedRegister } };
  },
  lavunioVerifyEmail: async (code) => ({ configured: true, hasSession: true, user: { ...(data.user || data.profile), emailVerified: code === '123456' } }),
  lavunioLogout: async () => ({ configured: true, hasSession: false, user: null }),
  onGameEvent: async () => {}, presenceHeartbeat: async () => {},
  notificationsList: async () => ({ items: data.user ? [{ id: 'n1', kind: 'mode', title: 'Night Demon updated', body: 'Version 1.0.0', createdAt: now, readAt: null, linkType: 'mode', linkId: 'night-demon' }] : [], unread: data.user ? 1 : 0 }),
  notificationsRead: async () => ({ items: [], unread: 0 }),
  followsGet: async () => data.user ? ['steve'] : [], feedGet: async () => data.user ? [{ modeSlug: 'night-demon', modeTitle: 'Night Demon', version: '1.0.0', authorName: 'Steve', publishedAt: now, changelog: 'Changes' }] : [],
  friendsList: async () => data.user ? [data.friend] : [],
  friendRequests: async () => ({ incoming: data.user ? [{ id: 'fr1', username: 'alex' }] : [], outgoing: [] }),
  chatDirect: async () => [{ id: 'c1', senderId: 'steve', senderUsername: 'steve', senderDisplayName: 'Steve', body: 'Hi', createdAt: now }],
  chatTeam: async () => [],
  teamsMine: async () => data.user ? [data.team] : [],
  teamsPending: async () => [],
  teamInvitations: async () => data.user ? [{ id: 'inv1', teamTitle: 'My Team', inviterName: 'Alex', role: 'member' }] : [],
  teamProfile: async () => ({ members: [{ userId: 'u1', username: 'alex', displayName: 'Alex', role: 'member' }] }),
  teamProfilePublic: async () => ({ team: data.team, stats: { modes: 1, downloads: 5, installs: 3, uniqueUsers: 2, published: 1 }, members: [{ username: 'alex', displayName: 'Alex', role: 'member' }], modes: [data.mode], news: [{ title: 'Team news', createdAt: now }], followers: 7 }),
  playerProfile: async () => data.profile,
  playerUpdateProfile: async (username, displayName, bio) => {
    window.__profileUpdates = window.__profileUpdates || [];
    window.__profileUpdates.push([username, displayName, bio]);
    return { ok: true, status: 'updated' };
  },
  pickSkin: async () => 'C:\\test-skin.png',
  uploadSkin: async (path, model) => {
    window.__skinUploaded = { path, model };
    return {
      configured: true,
      hasSession: true,
      user: { ...(data.user || data.profile), skinUrl: 'https://example.com/skin.png', skinModel: model }
    };
  },
  setSkinModel: async (model) => {
    window.__skinModel = model;
    return {
      configured: true,
      hasSession: true,
      user: { ...(data.user || data.profile), skinModel: model }
    };
  },
  publisherMyModes: async () => data.user ? [data.mode] : [],
  adminQueue: async () => [data.queue], adminModes: async () => [data.moderationMode],
  adminReports: async () => [data.report], adminReviews: async () => [data.review],
  adminHistory: async () => [data.history], adminAppeals: async () => [data.appeal],
  adminAuthorApplications: async () => [data.application], adminStoreNews: async () => data.news,
  newsStore: async () => data.news, newsMode: async () => data.modeNews,
  reviewsGet: async () => ({ items: [{ id: 'rev1', authorName: 'Steve', authorUsername: 'steve', rating: 5, text: 'Great mode', createdAt: now, authorReply: 'Thanks' }], count: 1, averageRating: 5 }),
  authorApplicationStatus: async () => null,
  openUrl: async () => {}, openModeFolder: async () => {}, openGameFolder: async () => {}, openLogs: async () => {}
};
window.tm = new Proxy(base, { get(target, prop) { return prop in target ? target[prop] : async () => undefined; } });
</script>`;
}

function createTestHtml(scenario) {
  const indexHtml = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const mock = createMockScript(scenario);
  return indexHtml.replace('<script type="module" src="main.js"></script>', `${mock}\n<script type="module" src="main.js"></script>`);
}

module.exports = { createMockScript, createTestHtml };
