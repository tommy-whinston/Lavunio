'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { createTestHtml } = require('./mock');
const { checkKeys } = require('./key-check');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
  const candidates = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const where = spawnSync('where', ['msedge.exe'], { encoding: 'utf8' });
  if (where.status === 0) {
    const found = where.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (found && fs.existsSync(found)) return found;
  }
  throw new Error('Не найден Edge/Chrome. Укажи EDGE_PATH.');
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/__headless.html') {
        const scenario = url.searchParams.get('scenario') || 'admin';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(createTestHtml(scenario));
        return;
      }
      const file = path.join(SRC, decodeURIComponent(url.pathname).replace(/^[/\\]+/, ''));
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(file) });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function getTarget(debugPort) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1500) });
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && String(target.url).includes('__headless.html'));
      if (page) return page;
    } catch (_) {}
    await sleep(200);
  }
  throw new Error('Не удалось подключиться к headless-браузеру');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 0;
    const events = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) item.reject(new Error(JSON.stringify(message.error)));
        else item.resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        events.push({ type: 'exception', text: message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text });
      }
      if (message.method === 'Log.entryAdded' && message.params.entry?.level === 'error') {
        const text = message.params.entry.text || '';
        if (message.params.entry.source !== 'network' && !text.includes('favicon.ico')) events.push({ type: 'console', text });
      }
    };
    ws.onerror = () => reject(new Error('WebSocket error'));
    ws.onopen = async () => {
      const send = (method, params = {}) => new Promise((res, rej) => {
        const id = ++nextId;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
      try {
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Page.enable');
        resolve({
          ws,
          events,
          send,
          evaluate: async (expression) => {
            const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (result.exceptionDetails) {
              throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            }
            return result.result.value;
          },
          navigate: async (url) => {
            await send('Page.navigate', { url });
            await sleep(100);
          }
        });
      } catch (error) {
        reject(error);
      }
    };
  });
}

async function waitReady(cdp, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const ready = await cdp.evaluate('Boolean(window.LavunioDebug) && !window.LavunioDebug.S.loading');
      if (ready) return;
    } catch (_) {}
    await sleep(200);
  }
  throw new Error('Приложение не загрузилось за 15 секунд');
}

const VISIBLE_SCAN = `(() => {
  const cyr = /[А-Яа-яЁё]/;
  const visible = (el) => !!(el && el.getClientRects && el.getClientRects().length);
  const texts = new Set();
  const attrs = new Set();
  const leaks = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el)) return;
    if (!el.children.length) {
      const text = (el.textContent || '').trim().replace(/\\s+/g, ' ');
      if (text && cyr.test(text)) texts.add(text);
    }
    for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
      const value = el.getAttribute(attr);
      if (value && cyr.test(value)) attrs.add(attr + '=' + value);
    }
    if (el.hasAttribute('data-i18n')) {
      const text = (el.textContent || '').trim();
      if (/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(text)) leaks.add(text);
    }
  });
  return { texts: [...texts], attrs: [...attrs], leaks: [...leaks] };
})()`;

async function scan(cdp, name) {
  const result = await cdp.evaluate(VISIBLE_SCAN);
  if (result.texts.length || result.attrs.length || result.leaks.length) {
    throw new Error(`${name}: найден непереведённый текст: ${JSON.stringify(result)}`);
  }
}

async function check(cdp, results, name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`  FAIL ${name}: ${error.message}`);
  }
}

async function setLanguage(cdp, lang) {
  await cdp.evaluate(`window.I18n.setLang(${JSON.stringify(lang)})`);
  await sleep(80);
}

async function checkLanguage(cdp) {
  await setLanguage(cdp, 'en');
  const en = await cdp.evaluate(`({
    catalog: document.querySelector('[data-section="store"] span')?.textContent,
    library: document.querySelector('[data-section="library"] span')?.textContent,
    search: document.getElementById('search-input')?.placeholder
  })`);
  if (en.catalog !== 'Catalog' || en.library !== 'Library' || en.search !== 'Search modes') {
    throw new Error('EN labels не совпали: ' + JSON.stringify(en));
  }
  await setLanguage(cdp, 'ru');
  const ru = await cdp.evaluate(`({
    catalog: document.querySelector('[data-section="store"] span')?.textContent,
    library: document.querySelector('[data-section="library"] span')?.textContent,
    search: document.getElementById('search-input')?.placeholder
  })`);
  if (ru.catalog !== 'Каталог' || ru.library !== 'Библиотека' || ru.search !== 'Поиск режимов') {
    throw new Error('RU labels не совпали: ' + JSON.stringify(ru));
  }
  await setLanguage(cdp, 'en');
}

async function checkSections(cdp) {
  for (const section of ['store', 'library', 'publisher', 'team', 'moderation', 'messages']) {
    await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.showSection(${JSON.stringify(section)})`);
    await sleep(220);
    await scan(cdp, `section ${section}`);
  }
}

async function checkDetail(cdp) {
  await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.showSection('store'); window.LavunioDebug.openDetail('night-demon')`);
  await sleep(250);
  await scan(cdp, 'detail');
}

async function checkStaticPanels(cdp) {
  for (const id of ['modal-settings', 'modal-account']) {
    await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.openModal(${JSON.stringify(id)})`);
    await sleep(150);
    await scan(cdp, id);
  }
}

async function checkServerSearch(cdp) {
  await cdp.evaluate(`window.LavunioDebug.showSection('store')`);
  await cdp.evaluate(`(() => {
    const input = document.getElementById('search-input');
    input.value = 'Night';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(600);
  const first = await cdp.evaluate(`({
    cards: document.querySelectorAll('#modes-grid .mode-card').length,
    more: !document.getElementById('store-more-wrap').hidden
  })`);
  if (first.cards < 2 || !first.more) throw new Error('server search: ' + JSON.stringify(first));
  await cdp.evaluate(`document.getElementById('store-load-more').click()`);
  await sleep(600);
  const second = await cdp.evaluate(`({
    cards: document.querySelectorAll('#modes-grid .mode-card').length,
    more: !document.getElementById('store-more-wrap').hidden
  })`);
  if (second.cards <= first.cards) throw new Error('load more не добавил карточки: ' + JSON.stringify(second));
  await cdp.evaluate(`window.LavunioDebug.openDetail('mode-30')`);
  await sleep(300);
  const title = await cdp.evaluate(`document.getElementById('detail-title').textContent`);
  if (!title.includes('Night Mode 30')) throw new Error('detail из второй страницы не открылся: ' + title);
  await cdp.evaluate(`(() => {
    const input = document.getElementById('search-input');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.LavunioDebug.showSection('store');
  })()`);
  await sleep(500);
  await cdp.evaluate(`(() => {
    const sort = document.getElementById('store-sort');
    sort.value = 'title';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(600);
  const sorted = await cdp.evaluate(`({
    cards: document.querySelectorAll('#modes-grid .mode-card').length,
    more: !document.getElementById('store-more-wrap').hidden
  })`);
  if (sorted.cards < 2 || !sorted.more) throw new Error('server sort: ' + JSON.stringify(sorted));
  await cdp.evaluate(`(() => {
    const sort = document.getElementById('store-sort');
    sort.value = 'date';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(400);
}

async function runTeamFlows(cdp) {
  const cases = [
    ['team-new', `m.openTeamModal(null)`],
    ['team-edit', `m.openTeamModal({ id: 't1', title: 'My Team', slug: 'my-team', description: 'Desc', links: '', joinMode: 'open' })`],
    ['team-members', `m.openTeamMembers({ id: 't1', title: 'My Team', slug: 'my-team' })`],
    ['team-page', `m.openTeamPage({ id: 't1', title: 'My Team', slug: 'my-team' })`],
    ['team-join', `m.openTeamJoin({ id: 't1', title: 'My Team', slug: 'my-team' })`],
    ['team-news', `m.openTeamNews({ id: 't1', title: 'My Team', slug: 'my-team' })`],
    ['team-transfer', `m.openTeamTransfer({ id: 't1', title: 'My Team', slug: 'my-team' })`]
  ];
  for (const [name, code] of cases) {
    await cdp.evaluate(`window.LavunioDebug.closeModals(); import('/features/teams/index.js').then((m) => { ${code}; })`);
    await sleep(160);
    await scan(cdp, name);
  }
}

async function runPublisherFlows(cdp) {
  const cases = [
    ['publisher-mode', `m.openPublisherModeModal()`],
    ['publisher-news', `m.openPublisherNewsModal({ id: 'm1', title: 'Night Demon', slug: 'night-demon' })`],
    ['publisher-release', `m.openPublisherReleaseModal({ id: 'm1', title: 'Night Demon', slug: 'night-demon' })`],
    ['publisher-appeal', `m.openPublisherAppealModal({ id: 'm1', title: 'Night Demon', slug: 'night-demon' }, { id: 'r1', version: '1.0.0' })`]
  ];
  for (const [name, code] of cases) {
    await cdp.evaluate(`window.LavunioDebug.closeModals(); import('/features/publisher/index.js').then((m) => { ${code}; })`);
    await sleep(160);
    await scan(cdp, name);
  }
}

async function runModerationFlows(cdp) {
  for (const [name, kind] of [['moderation-reject', 'reject'], ['moderation-appeal', 'appeal-reject'], ['moderation-hide', 'hide']]) {
    await cdp.evaluate(`window.LavunioDebug.closeModals(); import('/features/moderation/index.js').then((m) => { m.openModerationNote(${JSON.stringify(kind)}, 'r1', 'Night Demon'); })`);
    await sleep(160);
    await scan(cdp, name);
  }
}

async function runConfirmFlow(cdp) {
  await cdp.evaluate(`window.LavunioDebug.closeModals(); import('/features/teams/index.js').then((m) => { m.archiveTeam({ id: 't1', title: 'My Team', slug: 'my-team' }); })`);
  await sleep(180);
  await scan(cdp, 'confirm');
  await cdp.evaluate(`window.LavunioDebug.closeModals()`);
}

async function runPublisherData(cdp) {
  await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.showSection('publisher')`);
  await sleep(300);
  await scan(cdp, 'publisher data');
}

async function runModerationData(cdp) {
  await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.showSection('moderation')`);
  await sleep(300);
  for (const tab of ['queue', 'modes', 'reviews', 'reports', 'appeals', 'applications', 'news', 'history']) {
    await cdp.evaluate(`import('/features/moderation/index.js').then((m) => m.setModerationTab(${JSON.stringify(tab)}))`);
    await sleep(120);
    await scan(cdp, 'moderation ' + tab);
  }
}

async function runProfileMessages(cdp) {
  await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.openProfile('steve')`);
  await sleep(300);
  await scan(cdp, 'profile');
  await cdp.evaluate(`window.LavunioDebug.showSection('messages')`);
  await sleep(250);
  await scan(cdp, 'messages');
}

async function checkRegistrationFields(cdp) {
  await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.openModal('modal-account'); window.LavunioDebug.S.lavunioRegisterMode = true; import('/features/account/index.js').then((m) => { m.renderLavunioPane(); })`);
  await sleep(200);
  const fields = await cdp.evaluate(`(() => {
    const id = document.getElementById('lavunio-username');
    const name = document.getElementById('lavunio-display-name');
    return {
      idVisible: !!id && !id.closest('.field').hidden,
      idMax: id ? id.maxLength : null,
      idPattern: id ? id.getAttribute('pattern') : null,
      nameVisible: !!name && !name.closest('.field').hidden,
      nameMax: name ? name.maxLength : null
    };
  })()`);
  if (!fields.idVisible || fields.idMax !== 20 || fields.idPattern !== '[a-z0-9]{3,20}') {
    throw new Error('registration ID field: ' + JSON.stringify(fields));
  }
  if (!fields.nameVisible || fields.nameMax !== 16) {
    throw new Error('registration nickname field: ' + JSON.stringify(fields));
  }
  await cdp.evaluate(`window.LavunioDebug.S.lavunioRegisterMode = false; window.LavunioDebug.closeModals()`);
}

async function checkProfileEditor(cdp) {
  await cdp.evaluate(`window.LavunioDebug.closeModals(); window.LavunioDebug.openProfile('steve')`);
  await sleep(300);
  const fields = await cdp.evaluate(`(() => {
    const id = document.getElementById('profile-username');
    const name = document.getElementById('profile-display-name');
    const title = document.querySelector('.profile-hero-main h1');
    const style = title ? getComputedStyle(title) : null;
    return {
      id: !!id,
      idMax: id ? id.maxLength : null,
      idPattern: id ? id.getAttribute('pattern') : null,
      nameMax: name ? name.maxLength : null,
      whiteSpace: style ? style.whiteSpace : null,
      overflow: style ? style.textOverflow : null
    };
  })()`);
  if (!fields.id || fields.idMax !== 20 || fields.idPattern !== '[a-z0-9]{3,20}') {
    throw new Error('profile ID field: ' + JSON.stringify(fields));
  }
  if (fields.nameMax !== 16) {
    throw new Error('profile nickname limit: ' + JSON.stringify(fields));
  }
  if (fields.whiteSpace !== 'nowrap' || fields.overflow !== 'ellipsis') {
    throw new Error('profile name wraps: ' + JSON.stringify(fields));
  }

  await cdp.evaluate(`(() => {
    document.getElementById('profile-username').value = 'Tommy_Whinston';
    document.querySelector('[data-profile-form="edit"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  await sleep(150);
  const invalid = await cdp.evaluate(`({
    hidden: document.getElementById('profile-error').hidden,
    updates: (window.__profileUpdates || []).length
  })`);
  if (invalid.hidden || invalid.updates !== 0) {
    throw new Error('invalid profile ID accepted: ' + JSON.stringify(invalid));
  }

  await cdp.evaluate(`(() => {
    document.getElementById('profile-username').value = 'tommywhinston';
    document.getElementById('profile-display-name').value = 'Tommy_Whinston';
    document.querySelector('[data-profile-form="edit"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  await sleep(500);
  const saved = await cdp.evaluate(`({
    updates: window.__profileUpdates || [],
    error: document.getElementById('profile-error') ? document.getElementById('profile-error').textContent : ''
  })`);
  const update = saved.updates[0];
  if (!update || update[0] !== 'tommywhinston' || update[1] !== 'Tommy_Whinston') {
    throw new Error('profile save: ' + JSON.stringify(saved));
  }
}

async function runNotifications(cdp) {
  await cdp.evaluate(`import('/features/notifications/index.js').then((m) => { m.openNotifications(); })`);
  await sleep(200);
  await scan(cdp, 'notifications');
  await cdp.evaluate(`import('/features/notifications/index.js').then((m) => { m.closeNotifications(); })`);
}

async function checkErrors(cdp, events) {
  const errors = await cdp.evaluate('window.__errors');
  if (Array.isArray(errors) && errors.length) throw new Error('window errors: ' + JSON.stringify(errors));
  const relevant = events.filter((event) => !String(event.text || '').includes('favicon.ico'));
  if (relevant.length) throw new Error('CDP errors: ' + JSON.stringify(relevant));
}

async function runScenario(cdp, scenario) {
  console.log(`\n[headless] scenario: ${scenario}`);
  cdp.events.length = 0;
  await cdp.navigate(`http://127.0.0.1:${cdp.port}/__headless.html?scenario=${scenario}`);
  await waitReady(cdp);
  await setLanguage(cdp, 'en');
  const results = [];
  const events = cdp.events.slice();

  await check(cdp, results, 'boot', async () => {
    const state = await cdp.evaluate(`({
      i18n: !!window.I18n,
      debug: !!window.LavunioDebug,
      loading: window.LavunioDebug ? window.LavunioDebug.S.loading : null,
      errors: window.__errors
    })`);
    if (!state.i18n || !state.debug || state.loading) throw new Error(JSON.stringify(state));
    if (state.errors?.length) throw new Error(JSON.stringify(state.errors));
  });
  if (scenario === 'offline') {
    await check(cdp, results, 'offline cached catalog', async () => {
      const count = await cdp.evaluate(`document.querySelectorAll('.mode-card').length`);
      if (!count) throw new Error('каталог не загрузился из кэша');
    });
  }
  await check(cdp, results, 'language switch', () => checkLanguage(cdp));
  await check(cdp, results, 'sections', () => checkSections(cdp));
  if (scenario !== 'offline') {
    await check(cdp, results, 'server search/pagination', () => checkServerSearch(cdp));
  }
  await check(cdp, results, 'detail', () => checkDetail(cdp));
  await check(cdp, results, 'settings/account', () => checkStaticPanels(cdp));
  if (scenario === 'guest') {
    await check(cdp, results, 'registration ID/nickname', () => checkRegistrationFields(cdp));
  }
  if (scenario === 'player') {
    await check(cdp, results, 'profile ID/nickname', () => checkProfileEditor(cdp));
  }

  if (scenario === 'admin') {
    await check(cdp, results, 'team flows', () => runTeamFlows(cdp));
    await check(cdp, results, 'publisher flows', () => runPublisherFlows(cdp));
    await check(cdp, results, 'moderation flows', () => runModerationFlows(cdp));
    await check(cdp, results, 'confirm', () => runConfirmFlow(cdp));
    await check(cdp, results, 'publisher data', () => runPublisherData(cdp));
    await check(cdp, results, 'moderation data', () => runModerationData(cdp));
    await check(cdp, results, 'profile/messages', () => runProfileMessages(cdp));
    await check(cdp, results, 'notifications', () => runNotifications(cdp));
  }

  await check(cdp, results, 'runtime errors', () => checkErrors(cdp, events));
  return results;
}

async function main() {
  const keyResult = checkKeys();
  console.log(`[headless] keys: used=${keyResult.used}, ru=${keyResult.ru}, en=${keyResult.en}`);
  const keyErrors = [];
  if (keyResult.missing.length) keyErrors.push('missing keys: ' + JSON.stringify(keyResult.missing));
  if (keyResult.empty.length) keyErrors.push('empty keys: ' + JSON.stringify(keyResult.empty));
  if (keyResult.ruOnly.length) keyErrors.push('ru-only keys: ' + keyResult.ruOnly.join(', '));
  if (keyResult.enOnly.length) keyErrors.push('en-only keys: ' + keyResult.enOnly.join(', '));
  if (keyResult.duplicatesRu.length) keyErrors.push('duplicate ru keys: ' + keyResult.duplicatesRu.join(', '));
  if (keyResult.duplicatesEn.length) keyErrors.push('duplicate en keys: ' + keyResult.duplicatesEn.join(', '));
  if (keyErrors.length) {
    console.error('[headless] KEY CHECK FAILED');
    for (const error of keyErrors) console.error('  ' + error);
    process.exit(1);
  }
  console.log('[headless] key check: PASS');

  const browser = findBrowser();
  const server = await startServer();
  const port = server.address().port;
  const debugPort = 9400 + Math.floor(Math.random() * 400);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavunio-headless-'));
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--no-proxy-server',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    `http://127.0.0.1:${port}/__headless.html?scenario=admin`
  ], { stdio: 'ignore' });

  let cdp = null;
  let failed = 0;
  try {
    const target = await getTarget(debugPort);
    cdp = await connect(target.webSocketDebuggerUrl);
    cdp.port = port;
    for (const scenario of ['guest', 'offline', 'player', 'admin']) {
      const results = await runScenario(cdp, scenario);
      failed += results.filter((result) => !result.ok).length;
    }
  } finally {
    if (cdp) {
      try { cdp.ws.close(); } catch (_) {}
    }
    try { child.kill('SIGKILL'); } catch (_) {}
    try { server.close(); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }

  if (failed) {
    console.error(`\n[headless] FAILED: ${failed} check(s)`);
    process.exit(1);
  }
  console.log('\n[headless] ALL CHECKS PASSED');
}

main().catch((error) => {
  console.error('[headless] ERROR:', error.message);
  process.exit(1);
});
