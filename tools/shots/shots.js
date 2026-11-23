'use strict';

// Снимает скриншоты разделов интерфейса в headless-браузере на мок-данных.
// Используется для визуальной проверки вёрстки после изменений стилей.
//
//   node tools/shots/shots.js [--width 1280] [--height 800] [--scenario admin]

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { createTestHtml } = require('../headless/mock');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(__dirname, 'artifacts');
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] || fallback;
}

const WIDTH = Number(argValue('--width', '1280')) || 1280;
const HEIGHT = Number(argValue('--height', '800')) || 800;
const SCENARIO = argValue('--scenario', 'admin');
const LANG = argValue('--lang', 'en');
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
  throw new Error('Не найден Edge/Chrome. Укажи EDGE_PATH или CHROME_PATH.');
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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(createTestHtml(url.searchParams.get('scenario') || 'admin'));
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
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error)));
      else item.resolve(message.result);
    };
    ws.onerror = () => reject(new Error('WebSocket error'));
    ws.onopen = async () => {
      const send = (method, params = {}) => new Promise((res, rej) => {
        const id = ++nextId;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
      try {
        await send('Page.enable');
        await send('Runtime.enable');
        resolve({
          ws,
          send,
          evaluate: async (expression) => {
            const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (result.exceptionDetails) {
              throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            }
            return result.result.value;
          }
        });
      } catch (error) {
        reject(error);
      }
    };
  });
}

const VIEWS = [
  { name: 'store', code: `window.LavunioDebug.showSection('store')` },
  { name: 'library', code: `window.LavunioDebug.showSection('library')` },
  { name: 'detail', code: `window.LavunioDebug.showSection('store'); window.LavunioDebug.openDetail('night-demon')` },
  { name: 'teams', code: `window.LavunioDebug.showSection('team')` },
  { name: 'team-page', code: `window.LavunioDebug.showSection('team'); document.querySelector('#team-list [data-team-action="page"]').click()` },
  { name: 'team-page-team', code: `(async () => { window.LavunioDebug.showSection('team'); document.querySelector('#team-list [data-team-action="page"]').click(); await new Promise((r) => setTimeout(r, 600)); document.querySelector('#team-page-content [data-team-tab="team"]').click(); })()` },
  { name: 'team-settings', code: `(async () => { window.LavunioDebug.showSection('team'); document.querySelector('#team-list [data-team-action="page"]').click(); await new Promise((r) => setTimeout(r, 600)); document.querySelector('#team-page-content [data-team-page-action="settings"]').click(); })()` },
  { name: 'team-settings-roles', code: `(async () => { window.LavunioDebug.showSection('team'); document.querySelector('#team-list [data-team-action="page"]').click(); await new Promise((r) => setTimeout(r, 600)); document.querySelector('#team-page-content [data-team-page-action="settings"]').click(); await new Promise((r) => setTimeout(r, 200)); document.querySelector('[data-team-settings-tab="roles"]').click(); })()` },
  { name: 'team-settings-members', code: `(async () => { window.LavunioDebug.showSection('team'); document.querySelector('#team-list [data-team-action="page"]').click(); await new Promise((r) => setTimeout(r, 600)); document.querySelector('#team-page-content [data-team-page-action="settings"]').click(); await new Promise((r) => setTimeout(r, 200)); document.querySelector('[data-team-settings-tab="members"]').click(); await new Promise((r) => setTimeout(r, 400)); })()` },
  { name: 'publisher', code: `window.LavunioDebug.showSection('publisher')` },
  { name: 'moderation', code: `window.LavunioDebug.showSection('moderation')` },
  { name: 'messages', code: `window.LavunioDebug.showSection('messages')` },
  { name: 'profile', code: `window.LavunioDebug.openProfile('steve')` },
  { name: 'settings', code: `window.LavunioDebug.openModal('modal-settings')` },
  { name: 'account', code: `window.LavunioDebug.openModal('modal-account')` },
  { name: 'update', code: `window.LavunioDebug.openModal('modal-update')` }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = findBrowser();
  const server = await startServer();
  const port = server.address().port;
  const debugPort = 9800 + Math.floor(Math.random() * 150);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavunio-shots-'));
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--hide-scrollbars',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    `http://127.0.0.1:${port}/__headless.html?scenario=${SCENARIO}`
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    const target = await getTarget(debugPort);
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false
    });

    for (let i = 0; i < 80; i += 1) {
      const ready = await cdp.evaluate('Boolean(window.LavunioDebug) && !window.LavunioDebug.S.loading');
      if (ready) break;
      await sleep(200);
    }
    if (LANG !== 'en') {
      await cdp.evaluate(`window.I18n.setLang(${JSON.stringify(LANG)})`);
      await sleep(300);
    }
    await sleep(600);

    for (const view of VIEWS) {
      try {
        await cdp.evaluate(`window.LavunioDebug.closeModals(); ${view.code}`);
        await sleep(500);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(OUT, `${view.name}.png`);
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
        console.log(`saved ${path.relative(ROOT, file)}`);
      } catch (error) {
        console.error(`FAIL ${view.name}: ${error.message}`);
      }
    }

    // Сплэш живёт меньше секунды, поэтому его снимаем сразу после перезагрузки.
    try {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/__headless.html?scenario=${SCENARIO}` });
      await sleep(350);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, 'splash.png');
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log(`saved ${path.relative(ROOT, file)}`);
    } catch (error) {
      console.error(`FAIL splash: ${error.message}`);
    }
  } finally {
    if (cdp) {
      try { cdp.ws.close(); } catch (_) {}
    }
    try { child.kill('SIGKILL'); } catch (_) {}
    try { server.close(); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
})().catch((error) => {
  console.error('[shots] ERROR:', error.message);
  process.exit(1);
});
