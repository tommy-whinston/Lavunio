# Release automation

Скрипт собирает и публикует релиз одной командой:

```powershell
npm run release -- --version 0.23.35
```

Без `--version` версия поднимается на один patch автоматически.

## Опции

```text
--version <x.y.z>     версия релиза (по умолчанию +1 patch)
--notes <text>        текст release notes
--notes-file <path>   файл с release notes
--prerelease          пометить релиз как pre-release
--allow-dirty         не проверять чистоту рабочего дерева (не рекомендуется)
--skip-tests          не запускать headless-тесты
--dry-run             показать план без изменений и сборки
```

## Подпись релизов

Обновления проверяются по Ed25519-подписи. Приватный ключ **не хранится в репозитории**:

```text
%USERPROFILE%\.lavunio\release-signing-key.pem
```

Публичный ключ уже встроен в `src-tauri/src/update.rs`:

```text
n-1tsam-66L5uv5jBQoRapBQA6XIEBjSroOSbWwdALQ
```

Если потерять приватный ключ, новые обновления перестанут проверяться — сделай резервную копию в надёжном месте и не выкладывай её в интернет.

Скрипт релиза сам создаёт `lavunio-update.json`, подписывает его и прикладывает `lavunio-update.json.sig` к GitHub-релизу. Лаунчер принимает обновление только при валидной подписи и совпадении SHA-256 скачанного файла.

## Что делает

1. Проверяет, что git чистый и лаунчер закрыт.
2. Запускает headless-тесты и `cargo test`.
3. Поднимает версию в `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `tauri.conf.json`.
4. Запускает `build-installer.bat --no-pause`.
5. Копирует `Lavunio Setup.exe` в `Lavunio.Setup.exe` и `Lavunio.Setup.<version>.exe`.
6. Подписывает манифест обновления.
7. Делает commit `Release <version>`, тег `v<version>`, push в `main`.
8. Создаёт GitHub release с `Lavunio.exe`, installer-файлами, `lavunio-update.json` и подписью.

## Требования

- Закрытый Lavunio.
- Чистое git-дерево.
- Авторизованный `gh`.
- Node.js и собранный Tauri-тулчейн.

Если не передавать `--notes` или `--notes-file`, notes собираются из коммитов после предыдущего тега.
