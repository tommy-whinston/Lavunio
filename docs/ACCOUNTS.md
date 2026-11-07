# Lavunio Accounts and Skins

> Статус: Lavunio ID — основной и единственный аккаунт лаунчера. Ely.by удалён. Игровые сессии и скины работают через Lavunio API и `authlib-injector`, внешние скины не используются.

## 1. Цель

- Один аккаунт Lavunio для игры, магазина, публикации и облачных функций.
- Собственные скины и плащи Lavunio.
- Вход в игру через `authlib-injector` и Yggdrasil-совместимые endpoints Lavunio API.
- Не хранить пароли внешних сервисов и не зависеть от Ely.by.

## 2. Модель данных

```text
users
  id                uuid
  username          text unique
  display_name      text
  email             text unique
  password_hash     text (Argon2id)
  role              player | author | moderator | admin
  email_verified_at
  minecraft_uuid    uuid unique
  skin_url          text
  skin_model        classic | slim
  cape_url          text
  skin_updated_at
  created_at
  updated_at

sessions              сессии Lavunio ID (сайт/лаунчер)
  id, user_id, access_hash, refresh_hash,
  access_expires_at, refresh_expires_at,
  user_agent, ip, created_at, last_used_at, revoked_at

game_sessions         токены для Minecraft
  id, user_id, access_hash, client_hash,
  expires_at, created_at, last_used_at, revoked_at

game_joins            вход на authlib-серверы
  server_id, user_id, created_at

identities            зарезервировано под будущие внешние провайдеры
  id, user_id, provider, external_id, display_name, avatar_url, ...
```

`minecraft_uuid` создаётся при регистрации и не меняется. В играх используется UUID без дефисов.

## 3. Авторизация Lavunio

- Email + пароль.
- Пароль: **Argon2id**, уникальная соль.
- Access-токен Lavunio короткий, refresh-токен долгий; в БД хранятся только SHA-256-хеши.
- Подтверждение почты и сброс пароля.
- Игровая сессия (`game_sessions`) живёт 30 дней и выдаётся через `POST /v1/game/session`.
- Сброс пароля и выход отзывают игровые сессии.

## 4. Вход в Minecraft

Лаунчер передаёт `authlib-injector` адрес Lavunio API:

```text
-javaagent:authlib-injector.jar=<LAVUNIO_API_URL>
```

Authlib-injector читает метаданные с корня API и использует Yggdrasil-совместимые endpoints:

```text
POST /authserver/authenticate
POST /authserver/refresh
POST /authserver/validate
POST /authserver/invalidate
POST /authserver/signout

GET  /sessionserver/session/minecraft/profile/{uuid}
POST /sessionserver/session/minecraft/join
GET  /sessionserver/session/minecraft/hasJoined
```

Профиль содержит `textures`-свойство с URL скина и плаща. Подпись текстур не используется: metadata API не публикует `signaturePublickey`, поэтому клиент не требует подпись. В metadata включён `feature.non_email_login`, чтобы можно было входить по имени пользователя.

Лаунчер заранее загружает metadata и передаёт её в `-Dauthlibinjector.yggdrasil.prefetched=<base64>`, как рекомендует спецификация authlib-injector.

Для production в `SKIN_DOMAINS` нужно указать домены API и CDN, иначе Minecraft не загрузит скин.

## 5. Скины Lavunio

- `PUT /v1/me/skin?model=classic|slim` — загрузка PNG 64×64 или 64×32.
- `DELETE /v1/me/skin` — удалить скин.
- `PUT /v1/me/cape` — загрузка PNG 64×32 или 22×17.
- `DELETE /v1/me/cape` — удалить плащ.
- Файлы хранятся в локальном storage или S3/R2 как `skins/{sha256}.png`.
- Имя файла — SHA-256 очищенного PNG. Новый скин получает новый URL, поэтому клиент не кеширует старую картинку.
- Перед сохранением PNG декодируется и перекодируется: это убирает лишние чанки и защищает клиентов от вредоносных файлов.

Модель `classic` — обычные руки, `slim` — тонкие (Alex).

## 6. API аккаунта и игровой сессии

```text
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/refresh
POST /v1/auth/logout
POST /v1/auth/verify-email
POST /v1/auth/verify-email/resend
POST /v1/auth/password/forgot
POST /v1/auth/password/reset

GET  /v1/me
GET  /v1/me/identities
POST /v1/game/session
POST /v1/game/logout
PUT  /v1/me/skin
DELETE /v1/me/skin
PUT  /v1/me/cape
DELETE /v1/me/cape
```

`POST /v1/game/session` возвращает `accessToken`, `clientToken`, `expiresIn`, игровой профиль и данные скина. Лаунчер сохраняет токен до истечения и переиспользует его при запуске игры.

## 7. UI лаунчера

- Окно «Lavunio ID»:
  - вход и регистрация;
  - статус почты и роль;
  - загрузка/удаление скина и плаща;
  - предпросмотр скина.
- Ely.by полностью удалён: нет вкладок, OAuth-окна, device flow и внешних скинов.
- Без входа в Lavunio ID игра не запускается: сначала открывается окно аккаунта.
- Аватар в шапке и карточке аккаунта строится из головы Lavunio-скина.

## 8. Безопасность

- Argon2id для паролей.
- Хеширование access/refresh/game-токенов.
- Отзыв сессий при сбросе пароля и выходе.
- Ограничение размера скина 2 МБ.
- Проверка PNG-сигнатуры и размеров.
- Rate limit на login/register/reset — следующий этап.
- Не логировать токены и пароли.

## 9. Этапы

1. **A-01.** Lavunio ID: регистрация, вход, сессии, email verification. — готово.
2. **A-02.** Сессии и безопасность: refresh, отзыв, game sessions. — готово, rate limit и 2FA позже.
3. **A-03.** Собственные скины и плащи Lavunio. — готово.
4. **A-04.** Вход в Minecraft через authlib-injector. — готово, проверить на реальном сервере.
5. **A-05.** UI аккаунта и скинов в лаунчере. — готово.
6. **A-06.** 2FA, passkeys, управление устройствами. — позже.

## 10. Открытые вопросы

- Нужна ли модерация пользовательских скинов.
- Нужен ли Microsoft/Minecraft official как дополнительный провайдер в будущем.
- Нужно ли подписывать textures-свойство собственным ключом.
- Какой домен и CDN использовать для скинов в production.

## Связанные документы

- [Авторы и команды](TEAMS.md)
- [Встроенный публикатор](PUBLISHER.md)
