# Lavunio — план разбиения монолита

Цель: убрать `src/app.js` на 6000+ строк и глобальное состояние, не меняя поведение приложения.
Сборщик на первом этапе не нужен — используем нативные ES-модули Tauri/WebView2.

## Целевая структура

```text
src/
  main.js
  core/
    state.js
    dom.js
    router.js
  api/
    client.js
  ui/
    toast.js
    select.js
    textarea.js
    modal.js
  features/
    catalog/
    detail/
    library/
    profile/
    messages/
    teams/
    publisher/
    moderation/
    settings/
  styles/
    tokens.css
    base.css
    layout.css
    components/
    features/
```

## Этапы

1. **Модульная точка входа**
   - `index.html` подключает только `main.js` как `type="module"`.
   - `bridge.js` и `i18n.js` загружаются через `main.js`.
   - `app.js` временно остаётся большим, но выполняется как модуль.
   - Для тестов экспортируется один `window.LavunioDebug`, без глобальных функций.

2. **Инфраструктура**
   - `core/state.js` — объект `S`.
   - `core/dom.js` — `$`, `escapeHtml`.
   - `ui/toast.js` — уведомления.
   - `ui/select.js` — кастомные выпадающие списки.
   - `ui/textarea.js` — автоувеличение textarea.

3. **Простые фичи**
   - `features/catalog`
   - `features/detail`
   - `features/library`
   - `features/downloads`

4. **Профиль и общение**
   - `features/profile`
   - `features/messages`

5. **Управление**
   - `features/teams`
   - `features/publisher`
   - `features/moderation`
   - `features/settings`

6. **CSS**
   - Вынести токены, базу и layout.
   - Разбить компоненты и фичи.
   - Подключать через `@import` или один `styles/main.css`.

7. **Rust**
   - `commands.rs` → `commands/{window,catalog,game,account,teams,social,publisher,admin}.rs`.
   - Бизнес-логику вынести в `services/*.rs`.
   - Tauri-команды оставить тонкими обёртками.

8. **i18n**
   - Перейти на ключи `library.hidden.empty`.
   - `locales/ru.json`, `locales/en.json`.
   - Убрать перевод DOM по русским фразам.

9. **TypeScript / Vite**
   - Только после разбиения, если понадобятся типы, HMR или npm-компоненты.
   - Не обязательны для поддержки кода.

## Статус

- [x] Этап 1 — модульная точка входа.
- [x] Этап 2 — вынесены `state`, `elements`, `api`, `dom`, `format`, `modes`, `toast`, `select`, `textarea`.
- [x] Этап 3 — каталог, страница режима, библиотека и загрузки.
- [~] Этап 4 — вынесены view профиля и сообщений; действия профиля пока в `app.js`.
- [ ] Этап 4 — профиль и сообщения.
- [ ] Этап 5 — команды, публикатор, модерация, настройки.
- [ ] Этап 6 — CSS.
- [ ] Этап 7 — Rust.
- [ ] Этап 8 — i18n.
- [ ] Этап 9 — TypeScript / Vite при необходимости.

## Правила

- Один этап — один коммит.
- Только перенос кода, без изменения поведения.
- После каждого этапа: `node --check`, headless-тест, сборка.
- Не запускать GUI-тесты во время игры пользователя.
- Не делать большой rewrite React/Svelte посреди релизов.
