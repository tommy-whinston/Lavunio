/* Lavunio i18n: Russian source strings -> English, live DOM translation. */
(function () {
  "use strict";

  const STORAGE_KEY = "lavunio.lang";
  const LEGAL_BASE = "https://lavunio.pro/legal";

  const EN = {
    // ---------- static UI (index.html) ----------
    "4 ГБ": "4 GB",
    "8 ГБ": "8 GB",
    "Lavunio API не настроен. Задайте": "Lavunio API is not configured. Set",
    "при запуске лаунчера.": "when launching the launcher.",
    "Lavunio ID — это игровой аккаунт, скины и публикация режимов. Пароль хранится только на сервере Lavunio.":
      "Lavunio ID is your game account, skins and mode publishing. The password is stored only on the Lavunio server.",
    "Аватар (URL)": "Avatar (URL)",
    "Автор": "Author",
    "Администратор": "Administrator",
    "Активно": "Active",
    "Апелляции": "Appeals",
    "Баннер (URL)": "Banner (URL)",
    "Без команды": "No team",
    "Библиотека": "Library",
    "Библиотека пуста": "Library is empty",
    "В библиотеке": "In library",
    "В очереди": "Queued",
    "В разработке": "In development",
    "В список желаемого": "Add to wishlist",
    "Версия": "Version",
    "Версия Minecraft": "Minecraft version",
    "Версия ядра": "Loader version",
    "Видеокарта": "GPU",
    "Войдите в Lavunio ID, чтобы оставить отзыв.": "Sign in to Lavunio ID to leave a review.",
    "Войти": "Sign in",
    "Все": "All",
    "Все режимы": "All modes",
    "Все режимы автора": "All author modes",
    "Вступление": "Joining",
    "Вся история →": "Full history →",
    "Выбирай режимы, ставь одной кнопкой и следи за обновлениями.":
      "Pick modes, install with one click and follow updates.",
    "Выйти из Lavunio": "Sign out of Lavunio",
    "Гость": "Guest",
    "Дизайнер": "Designer",
    "Добавить": "Add",
    "Добавь друзей или вступи в команду.": "Add friends or join a team.",
    "Добавь игрока по username, чтобы видеть его статус и общаться.":
      "Add a player by username to see their status and chat.",
    "Добавь режим в библиотеку из каталога, и он появится здесь":
      "Add a mode to your library from the catalog and it will appear here",
    "Дополнительно": "Advanced",
    "Доступно обновление": "Update available",
    "Доступны обновления режимов:": "Mode updates available:",
    "Другая папка": "Another folder",
    "Другие режимы": "Other modes",
    "Друзей пока нет": "No friends yet",
    "Друзья": "Friends",
    "Жалобы": "Reports",
    "Желаемое": "Wishlist",
    "Журнал": "Log",
    "Завершено": "Completed",
    "Заголовок": "Title",
    "Загружаем режимы и аккаунт…": "Loading modes and account…",
    "Загрузить плащ": "Upload cape",
    "Загрузить скин": "Upload skin",
    "Загрузка": "Loading",
    "Загрузка списка…": "Loading list…",
    "Загрузка…": "Loading…",
    "Загрузки": "Downloads",
    "Загрузок нет": "No downloads",
    "Заявка в команду": "Team application",
    "Заявки": "Applications",
    "Заявки, друзья и их присутствие.": "Requests, friends and their presence.",
    "Избранное": "Favorites",
    "Имя пользователя": "Username",
    "История обновлений": "Update history",
    "История сессий": "Session history",
    "Канал": "Channel",
    "Каталог": "Catalog",
    "Каталог режимов": "Mode catalog",
    "Коллекции": "Collections",
    "Команд": "Teams",
    "Команд пока нет": "No teams yet",
    "Команда": "Team",
    "Комментарии": "Comments",
    "Короткое описание": "Short description",
    "Лента": "Feed",
    "Сообщество": "Community",
    "Управление": "Management",
    "Лента подписок": "Following feed",
    "Личные сообщения и чаты команд.": "Direct messages and team chats.",
    "Логи": "Logs",
    "Логи хранятся локально и помогают найти причину ошибки.":
      "Logs are stored locally and help diagnose errors.",
    "Меньше лагов и стабильнее запуск. Отключи, если Java не стартует или сборка несовместима.":
      "Fewer stutters and more stable startup. Disable if Java fails to start or the build is incompatible.",
    "Место на диске": "Disk space",
    "Модель скина": "Skin model",
    "Модерация": "Moderation",
    "Мои режимы": "My modes",
    "Мой профиль": "My profile",
    "На модерации": "Pending review",
    "Назад в каталог": "Back to catalog",
    "Название": "Name",
    "Наиграно": "Playtime",
    "Настройки": "Settings",
    "Не закрывай лаунчер": "Do not close the launcher",
    "Не удалось загрузить режимы. Проверь подключение и попробуй обновить список.":
      "Failed to load modes. Check your connection and try refreshing the list.",
    "Нет аккаунта?": "No account?",
    "Новая версия": "New version",
    "Новая команда": "New team",
    "Новости": "News",
    "Новости магазина": "Store news",
    "Новости режима": "Mode news",
    "Новость команды": "Team news",
    "Новость режима": "Mode news",
    "Новые релизы, отзывы и новости команд.": "New releases, reviews and team news.",
    "Новый владелец должен состоять в команде. Ты станешь администратором.":
      "The new owner must be a team member. You will become an administrator.",
    "Новый режим": "New mode",
    "Новый релиз": "New release",
    "О себе": "About you",
    "ОЗУ": "RAM",
    "Об игре": "About the game",
    "Обложка (URL)": "Cover (URL)",
    "Обнови установленные режимы до актуальных версий.":
      "Update installed modes to the latest versions.",
    "Обновить": "Refresh",
    "Обновить все": "Update all",
    "Обновление": "Update",
    "Обновлений": "Updates",
    "Окно игры": "Game window",
    "Оперативная память:": "Memory:",
    "Описание": "Description",
    "Оптимизированные JVM-флаги (G1GC)": "Optimized JVM flags (G1GC)",
    "Опубликовать": "Publish",
    "Оспорить отклонение": "Appeal rejection",
    "Оставь пустым — лаунчер найдёт подходящую Java сам. Указывай путь, только если нужно выбрать конкретную версию.":
      "Leave empty and the launcher will find a suitable Java. Specify a path only to use a particular version.",
    "Ответ": "Reply",
    "Ответ на отзыв": "Reply to review",
    "Отзывы": "Reviews",
    "Отзывы публикуются после проверки модератором.":
      "Reviews are published after moderator approval.",
    "Отклонить": "Reject",
    "Отклонить релиз": "Reject release",
    "Открыть": "Open",
    "Открыть в браузере": "Open in browser",
    "Открыть папку": "Open folder",
    "Отложить обновление": "Postpone update",
    "Отмена": "Cancel",
    "Отображаемое имя": "Display name",
    "Отправить": "Send",
    "Отправить апелляцию": "Submit appeal",
    "Отправить жалобу": "Submit report",
    "Отправить заявку": "Submit application",
    "Отправить ответ": "Send reply",
    "Отправить отзыв": "Submit review",
    "Очередь": "Queue",
    "Очередь релизов, скрытие режимов и журнал действий.":
      "Release queue, mode hiding and action log.",
    "Очередь установок и обновлений. Можно ставить несколько режимов подряд.":
      "Install and update queue. You can install several modes in a row.",
    "Очистить завершённые": "Clear completed",
    "Папка игры": "Game folder",
    "Пароль": "Password",
    "Передать": "Transfer",
    "Передать владение": "Transfer ownership",
    "Плащ": "Cape",
    "По времени игры": "By playtime",
    "По дате": "By date",
    "По заявке": "By application",
    "По названию": "By name",
    "По размеру": "By size",
    "По умолчанию": "Default",
    "По установке": "By install",
    "Подборки": "Collections",
    "Подписаться": "Follow",
    "Подписки": "Following",
    "Подробнее": "Details",
    "Подтвердить": "Confirm",
    "Пожаловаться": "Report",
    "Позже": "Later",
    "Полный экран": "Fullscreen",
    "Последнее обновление": "Latest update",
    "Почему релиз стоит пересмотреть": "Why the release should be reconsidered",
    "Почта не подтверждена": "Email not verified",
    "Пригласить": "Invite",
    "Причина": "Reason",
    "Проверить файлы": "Verify files",
    "Проверяю обновление…": "Checking for updates…",
    "Профиль": "Profile",
    "Профиль команды, участники и режимы.": "Team profile, members and modes.",
    "Процессор": "CPU",
    "Прочитать все": "Mark all as read",
    "Публикатор": "Publisher",
    "Публикация": "Publishing",
    "Публикация режимов": "Mode publishing",
    "Путь к Java": "Java path",
    "РЕКОМЕНДУЕМ": "FEATURED",
    "Развернуть всё": "Expand all",
    "Размер": "Size",
    "Расскажи, что планируешь публиковать, и приложи ссылки на портфолио или сборки.":
      "Tell us what you plan to publish and include links to your portfolio or builds.",
    "Регистрация": "Sign up",
    "Режим и его файлы будут удалены.": "The mode and its files will be deleted.",
    "Режимов пока нет": "No modes yet",
    "Режимы": "Modes",
    "Роль": "Role",
    "Сбор на релиз": "Crowdfunding",
    "Свободно: — · Библиотека: —": "Free: — · Library: —",
    "Свободное": "Open",
    "Сейчас": "Current",
    "Системные требования": "System requirements",
    "Скачать обновление": "Download update",
    "Сколько ОЗУ отдать игре. 4–8 ГБ — нормально для сборок":
      "How much RAM to give the game. 4–8 GB is fine for modpacks",
    "Скриншоты": "Screenshots",
    "Скрыто": "Hidden",
    "Скрытые": "Hidden",
    "Соавторы": "Co-authors",
    "Создай команду, чтобы публиковать режимы от её имени.":
      "Create a team to publish modes under its name.",
    "Создай первый черновик, загрузи сборку и отправь её на модерацию.":
      "Create your first draft, upload a build and submit it for review.",
    "Создать команду": "Create team",
    "Создать релиз": "Create release",
    "Создать черновик": "Create draft",
    "Сообщение": "Message",
    "Сохранить": "Save",
    "Ссылки": "Links",
    "Статус": "Status",
    "Стать автором": "Become an author",
    "Твоя коллекция режимов. Всё, что добавлено, всегда под рукой.":
      "Your mode collection. Everything you add is always at hand.",
    "Теги": "Tags",
    "Текст": "Text",
    "Только по приглашению": "Invite only",
    "Трейлер": "Trailer",
    "Трейлер (URL)": "Trailer (URL)",
    "Уведомления": "Notifications",
    "Удалить": "Delete",
    "Удалить плащ": "Delete cape",
    "Удалить режим?": "Delete mode?",
    "Удалить скин": "Delete skin",
    "Установи режим из каталога, и он появится в очереди":
      "Install a mode from the catalog and it will appear in the queue",
    "Установить": "Install",
    "Установленные": "Installed",
    "Установлено": "Installed",
    "Участник": "Member",
    "Участники": "Members",
    "Хочешь публиковать свои режимы в Lavunio?":
      "Want to publish your modes on Lavunio?",
    "Чат": "Chat",
    "Чатов пока нет": "No chats yet",
    "Черновики, релизы и статусы модерации.": "Drafts, releases and moderation statuses.",
    "Ядро": "Loader",
    "NVIDIA GeForce GTX 1650 / AMD Radeon RX 570 (4 ГБ)":
      "NVIDIA GeForce GTX 1650 / AMD Radeon RX 570 (4 GB)",
    "pvp, хоррор, ролевой": "pvp, horror, roleplay",
    "Автоматически": "Automatic",
    "Аккаунт": "Account",
    "Минимум 8 символов": "At least 8 characters",
    "Написать комментарий": "Write a comment",
    "Например, Night Demon": "For example, Night Demon",
    "Например, Night Studio": "For example, Night Studio",
    "Обновить список режимов": "Refresh mode list",
    "Одна строка для карточки": "One line for the card",
    "Опиши, что было исправлено или почему отклонение ошибочно":
      "Describe what was fixed or why the rejection is wrong",
    "Опыт, режимы, команда, планы": "Experience, modes, team, plans",
    "Ответь игроку": "Reply to the player",
    "Пара слов о себе": "A few words about yourself",
    "Поделись впечатлением о режиме": "Share your impressions of the mode",
    "Подробно о режиме": "Details about the mode",
    "Поиск режимов": "Search modes",
    "Политику конфиденциальности": "Privacy Policy",
    "Портфолио, GitHub, Discord, примеры сборок":
      "Portfolio, GitHub, Discord, build examples",
    "Расскажи игрокам о новости": "Tell players about the news",
    "Расскажи, чем можешь помочь команде": "Tell us how you can help the team",
    "Русский": "Russian",
    "Сайт, Discord, YouTube": "Website, Discord, YouTube",
    "Свернуть": "Minimize",
    "Скин": "Skin",
    "Скриншот режима": "Mode screenshot",
    "Чем занимается команда": "What the team does",
    "Что изменилось в этом релизе": "What changed in this release",
    "Что не так с режимом": "What is wrong with the mode",
    "Что нового": "What is new",
    "Что нужно исправить": "What needs to be fixed",

    // ---------- dynamic UI (app.js) ----------
    "Автообновление не удалось:": "Auto-update failed:",
    "автор": "author",
    "Автор режима": "Mode author",
    "администратор": "administrator",
    "Аккаунт Lavunio создан": "Lavunio account created",
    "Баланс": "Balance",
    "Без названия": "Untitled",
    "Без описания": "No description",
    "Без статуса": "No status",
    "Без текста": "No text",
    "Без changelog": "No changelog",
    "В желаемом": "In wishlist",
    "В игре": "In game",
    "В избранное": "Add to favorites",
    "В избранном пусто": "No favorites",
    "В коллекциях пусто": "No collections",
    "В архиве": "Archived",
    "Активна": "Active",
    "Входим…": "Signing in…",
    "Вы вышли из Lavunio": "You signed out of Lavunio",
    "Вы отписались от автора": "You unfollowed the author",
    "Вы подписались на автора": "You followed the author",
    "Вы подписаны": "Following",
    "Вышла": "Released",
    "ГБ": "GB",
    "МБ": "MB",
    "КБ": "KB",
    "Б": "B",
    "ч": "h",
    "мин": "min",
    "сек": "s",
    "Готов к запуску": "Ready to launch",
    "Готово": "Done",
    "Готово к игре": "Ready to play",
    "Действия": "Actions",
    "Добавить в библиотеку": "Add to library",
    "Добавлено в желаемое": "Added to wishlist",
    "Добавлено в избранное": "Added to favorites",
    "Добавляй режимы в список желаемого, чтобы они появились здесь":
      "Add modes to your wishlist and they will appear here",
    "Добавь режим в библиотеку, чтобы он появился здесь":
      "Add a mode to your library and it will appear here",
    "Дождитесь завершения текущей операции": "Wait for the current operation to finish",
    "Дождитесь остановки загрузки": "Wait for the download to stop",
    "Доступ автора выдан": "Author access granted",
    "Доступно": "Available",
    "Жалоба отправлена": "Report submitted",
    "жалобу": "report",
    "Загружаю файлы…": "Uploading files…",
    "Загрузка добавлена в очередь": "Download queued",
    "Загрузка на паузе": "Download paused",
    "Загрузка приостановлена": "Download paused",
    "Загрузка профиля…": "Loading profile…",
    "Загрузка модерации…": "Loading moderation…",
    "Закрываю игру…": "Closing the game…",
    "Закрыть игру": "Close game",
    "Заполните email и пароль": "Fill in email and password",
    "Запуск": "Launch",
    "Запускаю Minecraft…": "Launching Minecraft…",
    "Запущено": "Launched",
    "Заявка на рассмотрении": "Application pending",
    "Заявка отправлена на рассмотрение": "Application submitted for review",
    "Заявка отправлена": "Request sent",
    "Заявка принята": "Request accepted",
    "Заявка отклонена": "Request declined",
    "Здесь пока пусто": "Nothing here yet",
    "Игра закрыта": "Game closed",
    "Игра запущена": "Game launched",
    "Игра запущена!": "Game launched!",
    "Играть": "Play",
    "игрок": "player",
    "Игрок": "Player",
    "Изменить ответ": "Edit reply",
    "Исправить": "Repair",
    "Исправление": "Fix",
    "Исправление добавлено в очередь": "Repair queued",
    "Контент": "Content",
    "модератор": "moderator",
    "Назад в библиотеку": "Back to library",
    "Напиши текст ответа": "Write a reply",
    "Настройки сохранены": "Settings saved",
    "Не удалось выбрать папку:": "Failed to select folder:",
    "Не удалось выбрать файл:": "Failed to select file:",
    "Не удалось выполнить вход": "Failed to sign in",
    "Не удалось выполнить загрузку": "Failed to upload",
    "Не удалось добавить режим:": "Failed to add mode:",
    "Не удалось загрузить данные:": "Failed to load data:",
    "Не удалось загрузить команду:": "Failed to load team:",
    "Не удалось загрузить команды:": "Failed to load teams:",
    "Не удалось загрузить ленту:": "Failed to load feed:",
    "Не удалось загрузить друзей:": "Failed to load friends:",
    "Не удалось загрузить заявки:": "Failed to load applications:",
    "Не удалось загрузить профиль:": "Failed to load profile:",
    "Не удалось загрузить плащ:": "Failed to upload cape:",
    "Не удалось загрузить скин:": "Failed to upload skin:",
    "Не удалось загрузить чат:": "Failed to load chat:",
    "Не удалось закрыть игру:": "Failed to close the game:",
    "Не удалось запустить исправление:": "Failed to start repair:",
    "Не удалось начать операцию": "Failed to start operation",
    "Не удалось обновить желаемое:": "Failed to update wishlist:",
    "Не удалось обновить избранное:": "Failed to update favorites:",
    "Не удалось обновить подписку:": "Failed to update follow:",
    "Не удалось обновить список:": "Failed to refresh list:",
    "Не удалось открыть папку логов:": "Failed to open logs folder:",
    "Не удалось открыть папку:": "Failed to open folder:",
    "Не удалось отложить обновление:": "Failed to postpone update:",
    "Не удалось отправить жалобу": "Failed to submit report",
    "Не удалось отправить заявку": "Failed to submit application",
    "Не удалось отправить ответ": "Failed to send reply",
    "Не удалось отправить сообщение:": "Failed to send message:",
    "Не удалось отправить комментарий:": "Failed to send comment:",
    "Не удалось подтвердить почту:": "Failed to verify email:",
    "Не удалось показать режим:": "Failed to show mode:",
    "Не удалось проверить файлы:": "Failed to verify files:",
    "Не удалось сохранить настройки:": "Failed to save settings:",
    "Не удалось сохранить отзыв": "Failed to save review",
    "Не удалось сохранить профиль": "Failed to save profile",
    "Не удалось убрать режим:": "Failed to remove mode:",
    "Не удалось удалить отзыв:": "Failed to delete review:",
    "Не удалось удалить плащ:": "Failed to delete cape:",
    "Не удалось удалить режим:": "Failed to delete mode:",
    "Не удалось удалить скин:": "Failed to delete skin:",
    "Не удалось удалить друга:": "Failed to remove friend:",
    "Не удалось добавить друга:": "Failed to add friend:",
    "Не удалось обработать заявку:": "Failed to process request:",
    "Не удалось рассмотреть заявку:": "Failed to resolve application:",
    "Не удалось принять приглашение:": "Failed to accept invitation:",
    "Не удалось отклонить приглашение:": "Failed to decline invitation:",
    "Не удалось прочитать уведомления:": "Failed to mark notifications as read:",
    "Не удалось удалить комментарий:": "Failed to delete comment:",
    "Не удалось выполнить действие": "Failed to perform action",
    "Не установлено": "Not installed",
    "Нельзя подписаться на себя": "You cannot follow yourself",
    "Ничего не найдено": "Nothing found",
    "Новинки": "New",
    "Обновление добавлено в очередь": "Update queued",
    "Обновление отложено до следующей версии":
      "Update postponed until the next version",
    "Обновление режима": "Mode update",
    "Обновлений нет": "No updates",
    "Обновления": "Updates",
    "Обновлено": "Updated",
    "Операция отменена": "Operation cancelled",
    "Описание пока не заполнено.": "No description yet.",
    "Опиши причину жалобы": "Describe the reason for the report",
    "Ответ опубликован": "Reply published",
    "Ответить": "Reply",
    "Отзыв должен быть не длиннее 2000 символов":
      "Review must be at most 2000 characters",
    "Отзыв отправлен на модерацию": "Review submitted for moderation",
    "Отзыв сохранён": "Review saved",
    "Отзыв удалён": "Review deleted",
    "Отзывов пока нет": "No reviews yet",
    "Отзывов на модерации нет.": "No reviews pending moderation.",
    "Открыть релиз": "Open release",
    "Отменено": "Cancelled",
    "Отменить": "Cancel",
    "Отправляем…": "Sending…",
    "Ошибка": "Error",
    "Пауза": "Pause",
    "Письмо отправлено. Проверьте почту.": "Email sent. Check your inbox.",
    "Плащ обновлён": "Cape updated",
    "Плащ удалён": "Cape deleted",
    "Подать заново": "Submit again",
    "Подготовка": "Preparing",
    "Подготовка…": "Preparing…",
    "Показать": "Show",
    "Попробуй другой фильтр или нажми «Обновить»":
      "Try another filter or press Refresh",
    "Попробуй изменить запрос или выбрать другой фильтр":
      "Try changing the query or choosing another filter",
    "Популярное": "Popular",
    "Последний запуск": "Last launch",
    "почта не подтверждена": "email not verified",
    "почта подтверждена": "email verified",
    "Почта подтверждена": "Email verified",
    "Придумайте имя пользователя": "Choose a username",
    "Проверенный автор": "Verified author",
    "Проверяем…": "Checking…",
    "Прогресс": "Progress",
    "Продолжить": "Resume",
    "Профиль сохранён": "Profile saved",
    "Пустой ответ проверки": "Empty verification response",
    "Расскажи о себе — минимум 20 символов":
      "Tell us about yourself — at least 20 characters",
    "Режим": "Mode",
    "Режим добавлен в библиотеку": "Mode added to library",
    "Режим не добавлен в библиотеку": "Mode not added to library",
    "Режим не найден": "Mode not found",
    "Режим снова в каталоге": "Mode is back in the catalog",
    "Режим убран из библиотеки": "Mode removed from library",
    "Режим удалён с устройства": "Mode deleted from device",
    "Режим установлен": "Mode installed",
    "Режим скрыт": "Mode hidden",
    "Режимы из подборок появятся здесь": "Modes from collections will appear here",
    "Режимы, убранные из библиотеки, появятся здесь":
      "Modes removed from the library will appear here",
    "Результаты поиска": "Search results",
    "Рейтинг": "Rating",
    "Рекомендуем": "Featured",
    "Релиз": "Release",
    "Релиз опубликован": "Release published",
    "Релиз отклонён": "Release rejected",
    "Свернуть всё": "Collapse all",
    "Скачивание обновления…": "Downloading update…",
    "Скачиваю…": "Downloading…",
    "Скин обновлён": "Skin updated",
    "Скин удалён": "Skin deleted",
    "Скачивания": "Downloads",
    "Установки": "Installs",
    "Игроки": "Players",
    "Подписчики": "Followers",
    "Команды": "Teams",
    "Моя библиотека": "My library",
    "Опубликованных режимов нет": "No published modes yet",
    "Пока нет записей об обновлениях.": "No update entries yet.",
    "Стань первым, кто оставит отзыв.": "Be the first to leave a review.",
    "владелец": "owner",
    "публикатор": "publisher",
    "дизайнер": "designer",
    "участник": "member",
    "Выживание": "Survival",
    "Космос": "Space",
    "Хоррор": "Horror",
    "Шутер": "Shooter",
    "Побег": "Escape",
    "Чужой": "Alien",
    "Тесты игры": "Game tests",
    "Заявка в друзья": "Friend request",
    "Заявка в друзья принята": "Friend request accepted",
    "Новый комментарий": "New comment",
    "Релиз одобрен": "Release approved",
    "Приглашение в команду": "Team invitation",
    "Твой релиз опубликован в каталоге": "Your release has been published in the catalog",

    // ---------- API errors shown in the launcher ----------
    "Автор не найден": "Author not found",
    "Администратор не может менять другого администратора": "An administrator cannot change another administrator",
    "Администратор не может удалить другого администратора": "An administrator cannot remove another administrator",
    "Апелляция должна быть от 10 до 2000 символов": "Appeal must be 10 to 2000 characters",
    "Апелляция не найдена": "Appeal not found",
    "Апелляция по этому релизу уже отправлена": "An appeal for this release has already been submitted",
    "Апелляция уже рассмотрена": "The appeal has already been reviewed",
    "Архив не содержит файлов": "The archive contains no files",
    "Архив распаковывается в слишком большой размер": "The archive expands to an excessively large size",
    "Архивировать команду может только владелец": "Only the owner can archive the team",
    "База данных недоступна": "Database is unavailable",
    "В архиве есть файл с недопустимым именем": "The archive contains a file with an invalid name",
    "Владелец не может покинуть команду. Сначала передай владение": "The owner cannot leave the team. Transfer ownership first",
    "Владельца нельзя удалить из команды": "The owner cannot be removed from the team",
    "Внутренняя ошибка сервера": "Internal server error",
    "Вы уже друзья": "You are already friends",
    "Жалоба не найдена или уже закрыта": "Report not found or already closed",
    "Заголовок новости слишком длинный": "News title is too long",
    "Заголовок новости слишком короткий": "News title is too short",
    "Заголовок новости: от 3 до 120 символов": "News title: 3 to 120 characters",
    "Заявка доступна только игрокам без доступа к публикации": "Application is available only to players without publishing access",
    "Заявка не найдена": "Application not found",
    "Заявка уже обработана": "Application already processed",
    "Заявка уже отправлена": "Application already sent",
    "Заявка уже отправлена и ждёт рассмотрения": "Application already sent and awaiting review",
    "Заявка уже рассмотрена": "Application already reviewed",
    "Заявки видят владелец и администратор команды": "Applications are visible to the team owner and administrator",
    "Игрок не найден": "Player not found",
    "Изменять команду могут владелец и администратор команды": "Only the team owner and administrator can edit the team",
    "Имя пользователя уже занято": "Username is already taken",
    "Имя пользователя: 3–20 символов, латиница, цифры и подчёркивание": "Username: 3–20 characters, Latin letters, digits and underscore",
    "Команда в архиве": "Team is archived",
    "Команда не найдена": "Team not found",
    "Команда принимает только по приглашениям": "The team accepts invitations only",
    "Команда с таким slug уже существует": "A team with this slug already exists",
    "Комментарий не найден": "Comment not found",
    "Комментарий: от 1 до 2000 символов": "Comment: 1 to 2000 characters",
    "Локальное хранилище недоступно": "Local storage is unavailable",
    "Менять роли могут владелец и администратор команды": "Only the team owner and administrator can change roles",
    "Можно изменять только свои режимы": "You can only edit your own modes",
    "Можно удалять только свои комментарии": "You can only delete your own comments",
    "На модерацию можно отправить только черновик": "Only a draft can be submitted for review",
    "Название команды: от 1 до 100 символов": "Team name: 1 to 100 characters",
    "Название подборки должно быть от 3 до 120 символов": "Collection name must be 3 to 120 characters",
    "Назначать администраторов может только владелец": "Only the owner can assign administrators",
    "Не удалось обновить сессию": "Failed to refresh the session",
    "Не удалось подтвердить почту": "Failed to verify email",
    "Неверный логин или пароль": "Invalid login or password",
    "Неверный email или пароль": "Invalid email or password",
    "Нельзя добавить себя в друзья": "You cannot add yourself as a friend",
    "Нельзя писать самому себе": "You cannot message yourself",
    "Нельзя пригласить самого себя": "You cannot invite yourself",
    "Новости может публиковать только автор режима": "Only the mode author can publish news",
    "Новость не найдена": "News not found",
    "Нужен токен": "Token required",
    "Нужен Bearer-токен": "Bearer token required",
    "Нужно принять условия использования и политику конфиденциальности": "You must accept the Terms of Use and Privacy Policy",
    "Нужны логин и пароль": "Login and password required",
    "Нужны права администратора": "Administrator rights required",
    "Обложка больше 8 МБ": "Cover is larger than 8 MB",
    "Обложка должна быть не больше 4096×4096": "Cover must be at most 4096×4096",
    "Обложка должна быть PNG, JPEG или WebP": "Cover must be PNG, JPEG or WebP",
    "Одобрить можно только релиз на модерации": "Only a release pending review can be approved",
    "Описание команды слишком длинное": "Team description is too long",
    "Описание подборки слишком длинное": "Collection description is too long",
    "Опиши причину жалобы (минимум 3 символа)": "Describe the report reason (at least 3 characters)",
    "Опубликованный релиз нельзя изменить": "A published release cannot be changed",
    "Оспорить можно только отклонённый релиз": "Only a rejected release can be appealed",
    "Ответ должен быть не длиннее 2000 символов": "Reply must be at most 2000 characters",
    "Ответить на отзыв может только автор режима": "Only the mode author can reply to a review",
    "Отзыв не найден": "Review not found",
    "Отзыв не найден или уже рассмотрен": "Review not found or already reviewed",
    "Отклонить можно только релиз на модерации": "Only a release pending review can be rejected",
    "Отображаемое имя: от 1 до 48 символов": "Display name: 1 to 48 characters",
    "Оценка должна быть от 1 до 5": "Rating must be from 1 to 5",
    "Пароль должен быть от 8 до 128 символов": "Password must be 8 to 128 characters",
    "Передать владение может только владелец": "Only the owner can transfer ownership",
    "Плащ должен быть 64×32 или 22×17": "Cape must be 64×32 or 22×17",
    "Плащ должен быть PNG-файлом": "Cape must be a PNG file",
    "Подборка не найдена": "Collection not found",
    "Подборка с таким slug уже существует": "A collection with this slug already exists",
    "Подтвердите почту в Lavunio": "Verify your email in Lavunio",
    "Пользователь не найден": "User not found",
    "Пользователь не состоит в команде": "User is not a team member",
    "Пользователь уже владелец": "User is already the owner",
    "Пользователь уже состоит в команде": "User is already a team member",
    "Приглашать участников могут владелец и администратор команды": "Only the team owner and administrator can invite members",
    "Приглашение не найдено": "Invitation not found",
    "Приглашение не найдено или уже обработано": "Invitation not found or already processed",
    "Приглашение уже обработано": "Invitation already processed",
    "Приглашение уже отправлено": "Invitation already sent",
    "Причина жалобы слишком длинная": "Report reason is too long",
    "Профиль не совпадает с сессией": "Profile does not match the session",
    "Публикация доступна только авторам": "Publishing is available only to authors",
    "Публиковать новости могут владелец и администратор команды": "Only the team owner and administrator can publish news",
    "Размер PNG не совпадает с заголовком": "PNG size does not match the header",
    "Рассматривать заявки могут владелец и администратор команды": "Only the team owner and administrator can review applications",
    "Релиз не найден": "Release not found",
    "Релиз уже не находится в статусе отклонённого": "The release is no longer in rejected status",
    "Родительский комментарий не найден": "Parent comment not found",
    "Роль владельца нельзя изменить": "The owner role cannot be changed",
    "Сессия истекла, войдите заново": "Session expired, sign in again",
    "Сессия недействительна": "Session is invalid",
    "Сессия уже завершена": "Session already ended",
    "Скин должен быть 64×64 или 64×32": "Skin must be 64×64 or 64×32",
    "Скин должен быть PNG-файлом": "Skin must be a PNG file",
    "Сначала загрузи сборку режима": "Upload the mode build first",
    "Создавать команды могут только авторы": "Only authors can create teams",
    "Создавать режимы команды могут владелец, админ и публикатор": "Only the owner, administrator and publisher can create team modes",
    "Сообщение слишком длинное": "Message is too long",
    "Сообщение: от 1 до 2000 символов": "Message: 1 to 2000 characters",
    "Ссылка на аватар": "Avatar link",
    "Ссылка на баннер": "Banner link",
    "Ссылка на трейлер должна начинаться с http:// или https://": "Trailer link must start with http:// or https://",
    "Ссылка на трейлер слишком длинная": "Trailer link is too long",
    "Ссылка подтверждения недействительна или истекла": "Verification link is invalid or expired",
    "Ссылка сброса пароля недействительна или истекла": "Password reset link is invalid or expired",
    "Ссылки слишком длинные": "Links are too long",
    "Статус: не больше 500 символов": "Status: at most 500 characters",
    "Такая запись уже существует": "This entry already exists",
    "Текст новости слишком длинный": "News text is too long",
    "Текст новости слишком короткий": "News text is too short",
    "Текст новости: от 3 до 5000 символов": "News text: 3 to 5000 characters",
    "Ты не состоишь в команде": "You are not a team member",
    "Ты уже владелец команды": "You are already the team owner",
    "Ты уже состоишь в команде": "You are already a team member",
    "У аккаунта не задан пароль": "The account has no password set",
    "У аккаунта нет email": "The account has no email",
    "У аккаунта нет Minecraft UUID": "The account has no Minecraft UUID",
    "У сборки нет файла в хранилище": "The build has no file in storage",
    "Удалить новость может только автор или администратор": "Only the author or administrator can delete news",
    "Удалять участников могут владелец и администратор команды": "Only the team owner and administrator can remove members",
    "Укажи имя файла": "Enter a file name",
    "Укажи корректную версию релиза": "Enter a valid release version",
    "Укажи причину отклонения": "Enter a rejection reason",
    "Укажи причину отклонения (минимум 5 символов)": "Enter a rejection reason (at least 5 characters)",
    "Укажи причину скрытия": "Enter a hiding reason",
    "Укажите корректный email": "Enter a valid email",
    "Участник не найден": "Member not found",
    "Файл должен быть PNG": "File must be PNG",
    "Файл не найден": "File not found",
    "Эта заявка адресована другому пользователю": "This request is addressed to another user",
    "Это приглашение адресовано другому пользователю": "This invitation is addressed to another user",
    "Этот slug зарезервирован для автоматических подборок": "This slug is reserved for automatic collections",
    "Email или имя пользователя уже заняты": "Email or username is already taken",
    "Email уже зарегистрирован": "Email is already registered",
    "sha256 файла не совпадает": "File sha256 does not match",
    "slug: только строчные латинские буквы, цифры и дефис": "slug: only lowercase Latin letters, digits and hyphen",
    "Опубликовано": "Published",
    "Опубликована": "Published",
    "Скрытых режимов нет": "No hidden modes",
    "Сначала войдите в Lavunio ID": "Sign in to Lavunio ID first",
    "Сначала отмените загрузку": "Cancel the download first",
    "Создаём…": "Creating…",
    "Создать аккаунт": "Create account",
    "Список изменений появится позже.": "Changelog will appear later.",
    "Список режимов обновлён": "Mode list refreshed",
    "Страница режима": "Mode page",
    "Твой отзыв будет удалён.": "Your review will be deleted.",
    "Текущая версия": "Current version",
    "Техническое": "Technical",
    "Убрано из желаемого": "Removed from wishlist",
    "Убрано из избранного": "Removed from favorites",
    "Убрать из библиотеки": "Remove from library",
    "Убрать из избранного": "Remove from favorites",
    "Удалить отзыв?": "Delete review?",
    "Удалить с устройства": "Delete from device",
    "Уже есть аккаунт?": "Already have an account?",
    "Укажи отображаемое имя": "Enter a display name",
    "Устанавливаю обновление. Лаунчер сейчас закроется…":
      "Installing the update. The launcher will close now…",
    "Установка": "Install",
    "Установщик открыт. Заверши установку обновления.":
      "The installer is open. Complete the update installation.",
    "Файлы ещё не скачаны": "Files not downloaded yet",
    "Файлы повреждены": "Files are corrupted",
    "Этот режим уже в очереди": "This mode is already queued",
    "Этот режим уже скачивается": "This mode is already downloading",
    "Lavunio API не настроен": "Lavunio API is not configured",
    "Язык": "Language",
    "Язык интерфейса": "Launcher interface language",
    "Язык изменён": "Language changed",
    "Условия": "Terms",
    "Конфиденциальность": "Privacy",
    "Правила": "Rules",
    "Условия использования": "Terms of Use",
    "Политика конфиденциальности": "Privacy Policy",
    "Правила сообщества": "Community Rules",
    "Согласие": "Consent",
    "Я принимаю": "I accept the",
    "и": "and",
    "Подтвердите согласие с условиями и политикой конфиденциальности":
      "Please accept the Terms and Privacy Policy",
    "Загрузка аватара…": "Loading avatar…",
    "Загрузка скина…": "Loading skin…",
    "Загрузка плаща…": "Loading cape…",
    "Онлайн": "Online",
    "Офлайн": "Offline",
    "в сети": "online",
    "не в сети": "offline",
    "Личный чат": "Direct chat",
    "Чат команды": "Team chat",
    "личный чат": "direct chat",
    "чат команды": "team chat",
    "Хочет добавить тебя в друзья": "Wants to add you as a friend",
    "Удалить друга?": "Remove friend?",
    "Друг удалён": "Friend removed",
    "Уведомлений нет.": "No notifications.",
    "Комментариев пока нет.": "No comments yet.",
    "Комментарий удалён": "Comment deleted",
    "Сообщений пока нет.": "No messages yet.",
    "Лента пуста.": "The feed is empty.",
    "Ручных подборок пока нет.": "No manual collections yet.",
    "Очередь пуста. Новые релизы появятся здесь после отправки автором.":
      "The queue is empty. New releases will appear here after authors submit them.",
    "Апелляций нет.": "No appeals.",
    "Открытых жалоб нет.": "No open reports.",
    "Заявок нет": "No applications",
    "Заявок на автора нет.": "No author applications.",
    "Новостей пока нет": "No news yet",
    "Новостей магазина пока нет.": "No store news yet.",
    "Журнал пока пуст.": "The log is empty.",
    "Релизов пока нет. Создай первый релиз и загрузи сборку.":
      "No releases yet. Create your first release and upload a build.",
    "Опубликованных режимов пока нет": "No published modes yet",
    "Не состоит в командах": "Not a member of any team",
    "Режимы (slug через запятую)": "Modes (comma-separated slugs)",
    "Порядок": "Order",
    "Создать подборку": "Create collection",
    "Подборка создана": "Collection created",
    "Подборка удалена": "Collection deleted",
    "Удалить подборку?": "Delete collection?",
    "Укажи название подборки": "Enter a collection name",
    "Не удалось создать подборку": "Failed to create collection",
    "Не удалось удалить подборку:": "Failed to delete collection:",
    "Укажи причину": "Enter a reason",
    "Заполни заголовок и текст": "Fill in the title and text",
    "Укажи заголовок новости": "Enter the news title",
    "Напиши текст новости": "Write the news text",
    "Публикуем…": "Publishing…",
    "Новость магазина опубликована": "Store news published",
    "Не удалось опубликовать новость": "Failed to publish news",
    "Ты вступил в команду": "You joined the team",
    "Приглашение принято": "Invitation accepted",
    "Приглашение отклонено": "Invitation declined",
    "Редактировать команду": "Edit team",
    "Редактировать": "Edit",
    "Укажи название команды": "Enter a team name",
    "Укажи название режима": "Enter a mode name",
    "Slug: 3–64 символа, строчные латинские буквы, цифры и дефис":
      "Slug: 3–64 characters, lowercase Latin letters, digits and hyphens",
    "Черновик создан": "Draft created",
    "Не удалось создать режим": "Failed to create mode",
    "Загрузить обложку": "Upload cover",
    "Убрать обложку": "Remove cover",
    "Папка": "Folder",
    "Скриншот": "Screenshot",
    "Сборка не загружена": "No build uploaded",
    "Сборка:": "Build:",
    "Одобрить": "Approve",
    "Принять": "Accept",
    "Принять и опубликовать": "Accept and publish",
    "Оспорить": "Appeal",
    "Скрыть": "Hide",
    "На проверке": "Under review",
    "Ожидает проверки модератором": "Awaiting moderator review",
    "Апелляция на рассмотрении": "Appeal under review",
    "Апелляция отклонена": "Appeal rejected",
    "Апелляция отклонена. Исправь сборку и создай новый релиз.":
      "Appeal rejected. Fix the build and create a new release.",
    "Причина отклонения:": "Rejection reason:",
    "Скриншотов:": "Screenshots:",
    "Архив проверен:": "Archive checked:",
    "Подозрительные файлы:": "Suspicious files:",
    "и ещё": "and",
    "Одобрить релиз?": "Approve release?",
    "Принять апелляцию?": "Accept appeal?",
    "Релиз будет опубликован и появится в каталоге.":
      "The release will be published and appear in the catalog.",
    "Отклонить отзыв?": "Reject review?",
    "Отзыв не будет опубликован. Действие попадёт в журнал.":
      "The review will not be published. The action will be logged.",
    "Отзыв опубликован": "Review published",
    "Отзыв отклонён": "Review rejected",
    "Закрыть жалобу?": "Close report?",
    "Жалоба будет убрана из очереди, действие попадёт в журнал.":
      "The report will be removed from the queue and the action will be logged.",
    "Жалоба закрыта": "Report closed",
    "Не удалось закрыть жалобу:": "Failed to close report:",
    "Не удалось одобрить релиз:": "Failed to approve release:",
    "Не удалось одобрить отзыв:": "Failed to approve review:",
    "Не удалось отклонить отзыв:": "Failed to reject review:",
    "Не удалось рассмотреть апелляцию:": "Failed to resolve appeal:",
    "Выдать доступ автора?": "Grant author access?",
    "Выдать": "Grant",
    "Отклонить заявку": "Reject application",
    "Отклонить апелляцию": "Reject appeal",
    "Скрыть режим": "Hide mode",
    "Показать режим?": "Show mode?",
    "Участники ·": "Members ·",
    "Участников:": "Members:",
    "Команда «": "Team \"",
    "Приглашение в «": "Invitation to \"",
    "приглашает на роль": "invites you as",
    "В Lavunio с": "On Lavunio since",
    "Отправлен": "Submitted",
    "Отправлена": "Submitted",
    "Обновлён": "Updated",
    "Опубликован": "Published",
    "Чат ·": "Chat ·",
    "Личный чат с @": "Direct chat with @",
    "Lavunio ID": "Lavunio ID",
    "Закрыть": "Close",
    "Звезда": "star",
    "звезды": "stars",
    "звёзд": "stars"
  };

  // Patterns with * wildcards, applied after exact matches.
  const EN_PATTERNS = [
    // specific sentences first, so unit patterns do not eat them
    ["Участники · *", "Members · *"],
    ["Участников: *", "Members: *"],
    ["Команда «*»", "Team \"*\""],
    ["Приглашение в «*»", "Invitation to \"*\""],
    ["* приглашает на роль «*»", "* invites you as \"*\""],
    ["В Lavunio с *", "On Lavunio since *"],
    ["Чат · *", "Chat · *"],
    ["Личный чат с @*", "Direct chat with @*"],
    ["* · в сети", "* · online"],
    ["* · не в сети", "* · offline"],
    ["* · личный чат", "* · direct chat"],
    ["* · чат команды", "* · team chat"],
    ["* · администратор", "* · administrator"],
    ["* · автор", "* · author"],
    ["* · модератор", "* · moderator"],
    ["* · игрок", "* · player"],
    ["* · владелец", "* · owner"],
    ["* · публикатор", "* · publisher"],
    ["* · дизайнер", "* · designer"],
    ["* · участник", "* · member"],
    ["Отправлен *", "Submitted *"],
    ["Отправлена *", "Submitted *"],
    ["Обновлено *", "Updated *"],
    ["Обновлён *", "Updated *"],
    ["Опубликован *", "Published *"],
    ["Причина отклонения: *", "Rejection reason: *"],
    ["Скриншотов: *", "Screenshots: *"],
    ["Сборка: *", "Build: *"],
    ["Архив проверен: *", "Archive checked: *"],
    ["Подозрительные файлы: *", "Suspicious files: *"],
    ["Свободно: * из * · Библиотека: *", "Free: * of * · Library: *"],
    ["* и ещё *", "* and * more"],
    ["Доступны обновления режимов: *", "Mode updates available: *"],
    ["* установлен", "* installed"],
    ["* установок", "* installs"],
    ["* в библиотеке", "* in library"],
    ["Автор: *", "Author: *"],
    ["От: *", "From: *"],
    ["Режимы: *", "Modes: *"],
    ["Порядок: *", "Order: *"],
    ["* отзывов", "* reviews"],
    ["* отзыв", "* review"],
    ["* скачиваний", "* downloads"],
    ["* подписчиков", "* followers"],
    ["* режимов", "* modes"],
    ["* участников", "* members"],
    ["* обновлений", "* updates"],
    ["* игроков", "* players"],
    ["* файлов", "* files"],
    ["* символов", "* characters"],
    ["* звезда", "* star"],
    ["* звезды", "* stars"],
    ["* звёзд", "* stars"],
    ["Режим «*»", "Mode \"*\""],
    ["Подборка «*»", "Collection \"*\""],
    ["Пользователь «*»", "User \"*\""],
    ["Пользователь не найден: *", "User not found: *"],
    ["Соавтор не найден: *", "Co-author not found: *"],
    ["Опубликованный режим * не найден", "Published mode * not found"],
    ["Слишком много попыток. Повторите через * сек.", "Too many attempts. Try again in * seconds."],
    ["Файл слишком большой: *", "File is too large: *"],
    ["В архиве слишком много файлов: *", "Too many files in the archive: *"],
    ["Неизвестная роль: *", "Unknown role: *"],
    ["* хочет добавить тебя в друзья", "* wants to add you as a friend"],
    ["* теперь у тебя в друзьях", "* is now your friend"],
    ["* принял заявку в друзья", "* accepted your friend request"],
    ["* оставил комментарий к режиму", "* commented on the mode"],
    ["* ответил на твой отзыв", "* replied to your review"],
    ["* приглашает тебя в команду «*»", "* invites you to the team \"*\""],
    // size and duration suffixes last
    ["* ч * мин", "* h * min"],
    ["* ч", "* h"],
    ["* мин", "* min"],
    ["* сек", "* s"],
    ["* ГБ", "* GB"],
    ["* МБ", "* MB"],
    ["* КБ", "* KB"],
    ["* Б", "* B"]
  ];

  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  let LANG = "ru";
  let observer = null;
  const trackedText = new Set();
  const trackedElements = new Set();

  function hasCyrillic(value) {
    return /[А-Яа-яЁё]/.test(value);
  }

  function exact(text) {
    return Object.prototype.hasOwnProperty.call(EN, text) ? EN[text] : null;
  }

  function applyPatterns(text) {
    for (const pair of EN_PATTERNS) {
      const pattern = pair[0];
      if (!pattern.includes("*")) continue;
      const parts = pattern.split("*");
      if (parts.length === 2) {
        const start = parts[0];
        const end = parts[1];
        if (!text.startsWith(start) || !text.endsWith(end)) continue;
        if (text.length < start.length + end.length) continue;
        const middle = text.slice(start.length, text.length - end.length);
        if (!middle) continue;
        return pair[1].replace("*", middle);
      }
      let index = 0;
      let ok = true;
      const captures = [];
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (i === 0) {
          if (!text.startsWith(part)) { ok = false; break; }
          index = part.length;
        } else if (i === parts.length - 1) {
          if (!text.endsWith(part)) { ok = false; break; }
          const endIndex = text.length - part.length;
          if (endIndex < index) { ok = false; break; }
          captures.push(text.slice(index, endIndex));
          index = text.length;
        } else {
          const found = text.indexOf(part, index);
          if (found < 0) { ok = false; break; }
          captures.push(text.slice(index, found));
          index = found + part.length;
        }
      }
      if (!ok) continue;
      let result = pair[1];
      captures.forEach((capture) => {
        result = result.replace("*", capture);
      });
      return result;
    }
    return null;
  }

  function replaceUnits(text) {
    return text
      .replace(/(\d+(?:[.,]\d+)?)\s*ГБ/g, "$1 GB")
      .replace(/(\d+(?:[.,]\d+)?)\s*МБ/g, "$1 MB")
      .replace(/(\d+(?:[.,]\d+)?)\s*КБ/g, "$1 KB")
      .replace(/(\d+)\s*байт/g, "$1 bytes")
      .replace(/(\d+)\s*Б(?![А-Яа-яЁё])/g, "$1 B")
      .replace(/(\d+)\s*ч(?![А-Яа-яЁё])/g, "$1 h")
      .replace(/(\d+)\s*мин(?![А-Яа-яЁё])/g, "$1 min")
      .replace(/(\d+)\s*сек(?![А-Яа-яЁё])/g, "$1 s");
  }

  function translatePhrase(text) {
    let current = text;
    for (let pass = 0; pass < 5; pass += 1) {
      const direct = exact(current);
      if (direct !== null) {
        current = direct;
        if (!hasCyrillic(current)) break;
        continue;
      }
      const colon = current.indexOf(": ");
      if (colon > 0) {
        const prefix = exact(current.slice(0, colon + 1));
        if (prefix !== null) {
          current = `${prefix} ${current.slice(colon + 2)}`;
          if (!hasCyrillic(current)) break;
          continue;
        }
      }
      const patterned = applyPatterns(current);
      if (patterned !== null && patterned !== current) {
        current = patterned;
        if (!hasCyrillic(current)) break;
        continue;
      }
      const withUnits = replaceUnits(current);
      if (withUnits !== current) {
        current = withUnits;
        if (!hasCyrillic(current)) break;
        continue;
      }
      return current;
    }
    return current;
  }

  function translateText(raw) {
    if (LANG !== "en") return raw;
    const text = String(raw);
    const trimmed = text.trim();
    if (!trimmed || !hasCyrillic(trimmed)) return text;
    const translated = translatePhrase(trimmed);
    if (translated === trimmed) return text;
    const start = text.indexOf(trimmed);
    return text.slice(0, start) + translated + text.slice(start + trimmed.length);
  }

  function shouldSkip(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.closest("[data-i18n-skip]")) return true;
    const tag = element.tagName;
    return tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA";
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    if (node.parentElement && shouldSkip(node.parentElement)) return;
    const current = node.nodeValue;
    let source = node.__i18nSrc;
    if (source !== undefined) {
      const previous = translateText(source);
      if (current !== previous) {
        source = current;
        node.__i18nSrc = source;
      }
    } else {
      source = current;
      node.__i18nSrc = source;
    }
    if (!hasCyrillic(source)) return;
    const translated = translateText(source);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    if (translated !== source) trackedText.add(node);
  }

  function translateAttribute(element, attr) {
    if (!element.hasAttribute(attr)) return;
    const current = element.getAttribute(attr);
    let store = element.__i18nAttrs;
    if (!store) {
      store = {};
      element.__i18nAttrs = store;
    }
    let source = store[attr];
    if (source !== undefined) {
      const previous = translateText(source);
      if (current !== previous) {
        source = current;
        store[attr] = source;
      }
    } else {
      source = current;
      store[attr] = source;
    }
    if (!hasCyrillic(source)) return;
    const translated = translateText(source);
    if (translated !== current) element.setAttribute(attr, translated);
    if (translated !== source) trackedElements.add(element);
  }

  function translateElement(element) {
    if (!element) return;
    if (element.closest("[data-i18n-skip]")) return;
    for (const attr of ATTRS) translateAttribute(element, attr);
    const children = element.childNodes;
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.nodeType === 3) translateTextNode(child);
      else if (child.nodeType === 1) translateElement(child);
    }
  }

  function restoreTextNode(node) {
    if (node.__i18nSrc !== undefined) {
      node.nodeValue = node.__i18nSrc;
    }
  }

  function restoreElement(element) {
    const store = element.__i18nAttrs;
    if (!store) return;
    for (const attr of Object.keys(store)) element.setAttribute(attr, store[attr]);
  }

  function translateAll() {
    if (!document.body) return;
    if (LANG === "en") translateElement(document.body);
    else {
      trackedText.forEach(restoreTextNode);
      trackedElements.forEach(restoreElement);
    }
  }

  function setLang(next, options) {
    const lang = String(next || "").toLowerCase() === "en" ? "en" : "ru";
    if (lang === LANG) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
      return LANG;
    }
    LANG = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    document.documentElement.lang = lang;
    translateAll();
    if (!options || options.announce !== false) {
      document.dispatchEvent(new CustomEvent("lavunio:lang", { detail: { lang } }));
    }
    return LANG;
  }

  function t(text) {
    if (LANG !== "en") return text;
    const value = String(text);
    if (!hasCyrillic(value)) return value;
    const trimmed = value.trim();
    const translated = translatePhrase(trimmed);
    if (translated === trimmed) return value;
    const start = value.indexOf(trimmed);
    return value.slice(0, start) + translated + value.slice(start + trimmed.length);
  }

  function locale() {
    return LANG === "en" ? "en-US" : "ru-RU";
  }

  function legalUrl(kind) {
    return `${LEGAL_BASE}/${kind}?lang=${LANG}`;
  }

  function init() {
    let saved = "ru";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "ru";
    } catch (_) {}
    LANG = saved === "en" ? "en" : "ru";
    document.documentElement.lang = LANG;
    if (document.body && LANG === "en") translateElement(document.body);

    if (!observer && document.body) {
      observer = new MutationObserver((mutations) => {
        if (LANG !== "en") return;
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 3) translateTextNode(node);
              else if (node.nodeType === 1) translateElement(node);
            });
          } else if (mutation.type === "characterData") {
            translateTextNode(mutation.target);
          } else if (mutation.type === "attributes") {
            translateAttribute(mutation.target, mutation.attributeName);
          }
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATTRS
      });
    }

    document.querySelectorAll(".modal-close").forEach((button) => {
      if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", "Закрыть");
    });

    document.addEventListener("click", (event) => {
      const link = event.target.closest("[data-legal]");
      if (!link) return;
      event.preventDefault();
      const kind = link.dataset.legal;
      const url = legalUrl(kind);
      if (window.tm && window.tm.openUrl) window.tm.openUrl(url).catch(() => {});
      else window.open(url, "_blank");
    });
  }

  window.I18n = {
    t,
    lang: () => LANG,
    locale,
    setLang,
    translate: translateAll,
    legalUrl,
    init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
