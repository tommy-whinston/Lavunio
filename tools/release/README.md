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
--dry-run             показать план без изменений и сборки
```

## Что делает

1. Проверяет, что git чистый и лаунчер закрыт.
2. Поднимает версию в `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `tauri.conf.json`.
3. Запускает `build-installer.bat --no-pause`.
4. Копирует `Lavunio Setup.exe` в `Lavunio.Setup.exe` и `Lavunio.Setup.<version>.exe`.
5. Делает commit `Release <version>`, тег `v<version>`, push в `main`.
6. Создаёт GitHub release с `Lavunio.exe` и обоими installer-файлами.
7. По умолчанию релиз обычный, не pre-release.

## Требования

- Закрытый Lavunio.
- Чистое git-дерево.
- Авторизованный `gh`.
- Node.js и собранный Tauri-тулчейн.

Если не передавать `--notes` или `--notes-file`, notes собираются из коммитов после предыдущего тега.
