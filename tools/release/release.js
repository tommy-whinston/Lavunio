'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

const dryRun = hasFlag('--dry-run');
const prerelease = hasFlag('--prerelease');
const allowDirty = hasFlag('--allow-dirty');
const skipTests = hasFlag('--skip-tests');
const notesFile = argValue('--notes-file');
const notesArg = argValue('--notes');
const versionArg = argValue('--version');
const signingKeyFile = argValue('--signing-key')
  || process.env.LAVUNIO_SIGNING_KEY_FILE
  || path.join(os.homedir(), '.lavunio', 'release-signing-key.pem');

function fail(message) {
  console.error(`\n[release] ERROR: ${message}`);
  process.exit(1);
}

function run(command, argv, options = {}) {
  const line = [command, ...argv].join(' ');
  if (dryRun && options.mutating !== false) {
    console.log(`[release] dry-run: ${line}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  console.log(`[release] ${line}`);
  const result = spawnSync(command, argv, {
    cwd: root,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: false
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout || ''}` : '';
    fail(`${line} завершился с кодом ${result.status}${detail}`);
  }
  return result;
}

function git(argv, options = {}) {
  return run('git', argv, options);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, 'utf8');
}

function bumpPatch(value) {
  const parts = value.split('.').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    fail(`некорректная текущая версия: ${value}`);
  }
  parts[2] += 1;
  return parts.join('.');
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function replaceVersionInJson(file, current, next) {
  const text = read(file);
  const replaced = text.replaceAll(`"version": "${current}"`, `"version": "${next}"`);
  if (replaced === text) fail(`${file}: не найдена версия ${current}`);
  return replaced;
}

function buildNotes(version) {
  if (notesFile) {
    const file = path.isAbsolute(notesFile) ? notesFile : path.join(root, notesFile);
    if (!fs.existsSync(file)) fail(`notes-file не найден: ${file}`);
    return fs.readFileSync(file, 'utf8').trimEnd() + '\n';
  }
  if (notesArg) return `${notesArg.trimEnd()}\n`;

  const previous = git(['describe', '--tags', '--abbrev=0'], { capture: true, mutating: false });
  const previousTag = previous.stdout.trim();
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  const log = git(['log', range, '--no-merges', '--pretty=format:- %s'], { capture: true, mutating: false });
  const commits = log.stdout.trim();
  return `Lavunio ${version}\n\n${commits || '- Внутренние изменения.'}\n\nУстановщик и портативная версия приложены ниже.\n`;
}

function ensureCleanTree() {
  const status = git(['status', '--porcelain'], { capture: true, mutating: false }).stdout.trim();
  if (status) {
    fail(`рабочее дерево не чистое. Закоммить или убери изменения перед релизом:\n${status}`);
  }
}

function ensureLauncherClosed() {
  if (process.platform !== 'win32') return;
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    '(Get-Process Lavunio,lavunio -ErrorAction SilentlyContinue | Measure-Object).Count'
  ], { cwd: root, encoding: 'utf8' });
  const count = Number(String(result.stdout || '').trim());
  if (Number.isFinite(count) && count > 0) {
    fail('лаунчер запущен. Закрой Lavunio перед сборкой релиза.');
  }
}

function ensureTagMissing(version) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/v${version}`], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status === 0) fail(`тег v${version} уже существует`);
}

function loadSigningKey() {
  if (!fs.existsSync(signingKeyFile)) {
    fail(`ключ подписи релизов не найден: ${signingKeyFile}\nСоздай его командой из tools/release/README.md и сохрани в надёжном месте.`);
  }
  const pem = fs.readFileSync(signingKeyFile, 'utf8');
  const privateKey = crypto.createPrivateKey(pem);
  const publicKey = crypto.createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' });
  if (!jwk.x) fail('не удалось прочитать публичную часть ключа подписи');
  return { privateKey, publicKey, publicX: jwk.x };
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function buildSignedUpdate(version, keys) {
  const portable = path.join(root, 'Lavunio.exe');
  const installer = path.join(root, 'Lavunio.Setup.exe');
  if (!fs.existsSync(portable)) fail('не найден Lavunio.exe для подписи обновления');
  if (!fs.existsSync(installer)) fail('не найден Lavunio.Setup.exe для подписи обновления');
  const manifest = {
    version,
    portable: { name: 'Lavunio.exe', sha256: sha256File(portable) },
    installer: { name: 'Lavunio.Setup.exe', sha256: sha256File(installer) }
  };
  const text = JSON.stringify(manifest, null, 2) + '\n';
  const bytes = Buffer.from(text, 'utf8');
  const signature = crypto.sign(null, bytes, keys.privateKey);
  if (!crypto.verify(null, bytes, keys.publicKey, signature)) {
    fail('самопроверка подписи обновления не прошла');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavunio-update-'));
  const manifestPath = path.join(dir, 'lavunio-update.json');
  const signaturePath = path.join(dir, 'lavunio-update.json.sig');
  fs.writeFileSync(manifestPath, bytes);
  fs.writeFileSync(signaturePath, signature.toString('base64url'), 'utf8');
  console.log(`[release] signed update manifest: ${manifestPath}`);
  console.log(`[release] public key: ${keys.publicX}`);
  return { manifestPath, signaturePath, dir };
}

function main() {
  if (hasFlag('--help')) {
    console.log(`Usage: npm run release -- [options]

Options:
  --version <x.y.z>     версия релиза (по умолчанию +1 patch)
  --notes <text>        текст release notes
  --notes-file <path>   файл с release notes
  --signing-key <path>  путь к приватному ключу подписи (по умолчанию ~/.lavunio/release-signing-key.pem)
  --prerelease          пометить релиз как pre-release
  --allow-dirty         не проверять чистоту рабочего дерева (не рекомендуется)
  --skip-tests          не запускать headless-тесты перед сборкой
  --dry-run             показать план без изменений и сборки

Требования: закрытый Lavunio, чистый git, авторизованный gh, установленный Node.`);
    return;
  }

  const pkg = JSON.parse(read('package.json'));
  const current = String(pkg.version);
  const version = versionArg || bumpPatch(current);

  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`некорректная версия: ${version}`);
  if (compareVersions(version, current) <= 0) fail(`версия ${version} должна быть больше текущей ${current}`);

  const notes = buildNotes(version);
  ensureTagMissing(version);
  if (!dryRun && !allowDirty) ensureCleanTree();
  if (!dryRun) ensureLauncherClosed();
  const signing = dryRun ? null : loadSigningKey();

  console.log(`\n[release] ${current} -> ${version}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`[release] notes:\n${notes}`);

  if (!skipTests) {
    run('node', ['tools/headless/run.js']);
    run('cmd', ['/c', 'call build-env.bat && cd src-tauri && cargo test --bin lavunio']);
  }

  if (!dryRun) {
    write('package.json', replaceVersionInJson('package.json', current, version));
    write('package-lock.json', replaceVersionInJson('package-lock.json', current, version));

    const cargoText = read('src-tauri/Cargo.toml');
    const cargoMarker = `version = "${current}"`;
    const cargoIndex = cargoText.indexOf(cargoMarker);
    if (cargoIndex < 0) fail(`src-tauri/Cargo.toml: не найдена версия ${current}`);
    write('src-tauri/Cargo.toml', cargoText.slice(0, cargoIndex) + `version = "${version}"` + cargoText.slice(cargoIndex + cargoMarker.length));

    write('src-tauri/tauri.conf.json', replaceVersionInJson('src-tauri/tauri.conf.json', current, version));

    const lock = read('src-tauri/Cargo.lock');
    const lockMarker = `name = "lavunio"\nversion = "${current}"`;
    const lockMarkerCrlf = `name = "lavunio"\r\nversion = "${current}"`;
    let lockNext = lock;
    if (lock.includes(lockMarker)) lockNext = lock.replace(lockMarker, `name = "lavunio"\nversion = "${version}"`);
    else if (lock.includes(lockMarkerCrlf)) lockNext = lock.replace(lockMarkerCrlf, `name = "lavunio"\r\nversion = "${version}"`);
    else fail('src-tauri/Cargo.lock: не найдена версия lavunio');
    write('src-tauri/Cargo.lock', lockNext);
  }

  run('cmd', ['/c', 'build-installer.bat', '--no-pause']);

  const portable = path.join(root, 'Lavunio.exe');
  const setup = path.join(root, 'Lavunio Setup.exe');
  let signedUpdate = null;
  if (!dryRun) {
    if (!fs.existsSync(portable)) fail('не найден Lavunio.exe после сборки');
    if (!fs.existsSync(setup)) fail('не найден Lavunio Setup.exe после сборки');
    fs.copyFileSync(setup, path.join(root, 'Lavunio.Setup.exe'));
    fs.copyFileSync(setup, path.join(root, `Lavunio.Setup.${version}.exe`));
    signedUpdate = buildSignedUpdate(version, signing);
  } else {
    console.log('[release] dry-run: copy Lavunio Setup.exe -> Lavunio.Setup.exe');
    console.log(`[release] dry-run: copy Lavunio Setup.exe -> Lavunio.Setup.${version}.exe`);
  }

  git(['add', 'package.json', 'package-lock.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/tauri.conf.json']);
  git(['-c', 'user.name=TM', '-c', 'user.email=tm@local', 'commit', '-m', `Release ${version}`]);
  git(['tag', `v${version}`]);
  git(['push', 'origin', 'main']);
  git(['push', 'origin', `v${version}`]);

  const notesPath = path.join(os.tmpdir(), `lavunio-release-${version}.md`);
  if (!dryRun) fs.writeFileSync(notesPath, notes, 'utf8');
  const releaseAssets = [
    'Lavunio.exe',
    'Lavunio.Setup.exe',
    `Lavunio.Setup.${version}.exe`
  ];
  if (signedUpdate) {
    releaseAssets.push(signedUpdate.manifestPath, signedUpdate.signaturePath);
  }
  const releaseArgs = [
    'release', 'create', `v${version}`,
    ...releaseAssets,
    '--title', `Lavunio ${version}`,
    '--notes-file', notesPath,
    '--verify-tag'
  ];
  if (prerelease) releaseArgs.push('--prerelease');
  run('gh', releaseArgs);
  if (!dryRun) {
    try { fs.unlinkSync(notesPath); } catch (_) {}
    if (signedUpdate) {
      try { fs.rmSync(signedUpdate.dir, { recursive: true, force: true }); } catch (_) {}
    }
  }

  console.log(`\n[release] done: https://github.com/tommy-whinston/Lavunio/releases/tag/v${version}`);
}

main();
