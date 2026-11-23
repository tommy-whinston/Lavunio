'use strict';

// Быстрый предпросмотр интерфейса в обычном браузере.
// Отдаёт src/ с мок-API (как headless-тесты) и перезагружает страницу при изменениях файлов.
//
//   npm run preview
//   npm run preview -- --scenario guest
//
// Tauri-команды подменяются моком, поэтому установка и запуск игры здесь не работают —
// это только для проверки вёрстки и навигации.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { createTestHtml } = require('../headless/mock');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] || fallback;
}

const PORT = Number(argValue('--port', '7373')) || 7373;
const SCENARIO = argValue('--scenario', 'admin');
const OPEN = !args.includes('--no-open');

const LIVERELOAD = `<script>
  (() => {
    const source = new EventSource('/__livereload');
    source.onmessage = () => location.reload();
    source.onerror = () => setTimeout(() => location.reload(), 1500);
  })();
</script>`;

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.ttf') return 'font/ttf';
  return 'application/octet-stream';
}

function injectReload(html) {
  return html.includes('</body>') ? html.replace('</body>', `${LIVERELOAD}</body>`) : html + LIVERELOAD;
}

const clients = new Set();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/__preview.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(injectReload(createTestHtml(url.searchParams.get('scenario') || SCENARIO)));
    return;
  }

  const file = path.join(SRC, decodeURIComponent(url.pathname).replace(/^[/\\]+/, ''));
  if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

let timer = null;
function broadcast() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    for (const client of clients) {
      try { client.write('data: reload\n\n'); } catch (_) {}
    }
    console.log('[preview] reload');
  }, 120);
}

function watch() {
  try {
    fs.watch(SRC, { recursive: true }, (event, file) => {
      if (!file || file.includes('artifacts')) return;
      broadcast();
    });
  } catch (error) {
    console.warn('[preview] live reload disabled:', error.message);
  }
}

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/?scenario=${SCENARIO}`;
  console.log(`[preview] ${url}`);
  console.log('[preview] правь файлы в src/ — страница перезагрузится сама. Ctrl+C чтобы выйти.');
  watch();
  if (OPEN) {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  }
});

process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});
