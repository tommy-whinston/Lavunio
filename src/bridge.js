/* Tauri bridge: window.tm API для app.js */
(function () {
  const tauri = window.__TAURI__;
  if (!tauri) {
    console.error("Tauri API не найден");
    return;
  }

  const invoke = tauri.core.invoke;
  const listen = tauri.event.listen;

  window.tm = {
    // окно
    minimize: () => invoke("win_minimize"),
    close: () => invoke("win_close"),
    windowSplash: () => invoke("win_splash"),
    windowReady: () => invoke("win_ready"),

    // данные
    getModes: () => invoke("modes_get"),
    getCachedModes: () => invoke("modes_cached"),
    refreshModes: () => invoke("modes_refresh"),
    collectionsGet: () => invoke("collections_get"),
    getState: () => invoke("state_get"),
    getSystemRam: () => invoke("system_ram_gb"),
    getSettings: () => invoke("settings_get"),
    saveSettings: (patch) => invoke("settings_save", { patch }),
    chooseDir: () => invoke("settings_choose_dir"),
    openUrl: (url) => invoke("shell_open", { url }),
    openGameFolder: () => invoke("game_open_folder"),
    getAppDataPath: () => invoke("app_data_path"),
    openAppFolder: () => invoke("app_open_folder"),
    getLogsPath: () => invoke("app_logs_path"),
    openLogs: () => invoke("app_open_logs"),
    checkUpdate: () => invoke("check_update"),
    downloadUpdate: (url) => invoke("download_update", { url }),
    installUpdate: (url) => invoke("install_update", { url }),
    onUpdateProgress: (cb) => listen("update:progress", (e) => cb(e.payload)),

    // Lavunio ID
    lavunioStatus: () => invoke("lavunio_status"),
    lavunioRegister: (email, password, username) => invoke("lavunio_register", { email, password, username }),
    lavunioLogin: (email, password) => invoke("lavunio_login", { email, password }),
    lavunioLogout: () => invoke("lavunio_logout"),
    lavunioResendVerification: () => invoke("lavunio_resend_verification"),
    lavunioGameSession: () => invoke("lavunio_game_session"),

    // скины Lavunio
    pickSkin: () => invoke("lavunio_pick_skin"),
    uploadSkin: (path, model) => invoke("lavunio_upload_skin", { path, model }),
    deleteSkin: () => invoke("lavunio_delete_skin"),
    pickCape: () => invoke("lavunio_pick_cape"),
    uploadCape: (path) => invoke("lavunio_upload_cape", { path }),
    deleteCape: () => invoke("lavunio_delete_cape"),

    // публикатор
    publisherMyModes: () => invoke("publisher_my_modes"),
    publisherCreateMode: (payload) => invoke("publisher_create_mode", { payload }),
    publisherCreateRelease: (modeId, payload) => invoke("publisher_create_release", { modeId, payload }),
    publisherSubmit: (releaseId) => invoke("publisher_submit", { releaseId }),
    publisherPickFolder: () => invoke("publisher_pick_folder"),
    publisherPickArchive: () => invoke("publisher_pick_archive"),
    publisherPickCover: () => invoke("publisher_pick_cover"),
    publisherUploadCover: (modeId, path) => invoke("publisher_upload_cover", { modeId, path }),
    publisherDeleteCover: (modeId) => invoke("publisher_delete_cover", { modeId }),
    publisherPickScreenshot: () => invoke("publisher_pick_screenshot"),
    publisherUploadScreenshot: (releaseId, path) => invoke("publisher_upload_screenshot", { releaseId, path }),
    publisherUploadBuild: (modeId, releaseId, version, source) => invoke("publisher_upload_build", { modeId, releaseId, version, source }),
    onPublisherProgress: (cb) => listen("publisher:progress", (e) => cb(e.payload)),

    // модерация
    adminQueue: () => invoke("admin_queue"),
    adminModes: () => invoke("admin_modes"),
    adminHistory: () => invoke("admin_history"),
    adminApprove: (releaseId) => invoke("admin_approve", { releaseId }),
    adminReject: (releaseId, note) => invoke("admin_reject", { releaseId, note }),
    adminHideMode: (modeId, note) => invoke("admin_hide_mode", { modeId, note }),
    adminUnhideMode: (modeId) => invoke("admin_unhide_mode", { modeId }),

    // вишлист и отзывы
    wishlistGet: () => invoke("wishlist_get"),
    wishlistAdd: (slug) => invoke("wishlist_add", { slug }),
    wishlistRemove: (slug) => invoke("wishlist_remove", { slug }),
    reviewsGet: (slug) => invoke("reviews_get", { slug }),
    reviewSubmit: (slug, rating, text) => invoke("review_submit", { slug, rating, text }),
    reviewDelete: (slug) => invoke("review_delete", { slug }),
    reportMode: (slug, reason) => invoke("report_mode", { slug, reason }),
    followsGet: () => invoke("follows_get"),
    followAuthor: (username) => invoke("follow_author", { username }),
    unfollowAuthor: (username) => invoke("unfollow_author", { username }),
    feedGet: () => invoke("feed_get"),
    newsStore: () => invoke("news_store"),
    newsMode: (slug) => invoke("news_mode", { slug }),
    newsCreateStore: (title, body) => invoke("news_create_store", { title, body }),
    newsCreateMode: (modeId, title, body) => invoke("news_create_mode", { modeId, title, body }),
    adminReports: () => invoke("admin_reports"),
    adminCloseReport: (reportId, note) => invoke("admin_close_report", { reportId, note }),

    // игра
    install: (modeId) => invoke("game_install", { modeId }),
    play: (modeId) => invoke("game_play", { modeId }),
    stopGame: () => invoke("game_cancel"),
    cancel: () => invoke("game_cancel"),
    uninstall: (modeId) => invoke("game_uninstall", { modeId }),
    setLibrary: (modeId, library) => invoke("game_set_library", { modeId, library }),
    addPlaytime: (modeId, seconds) => invoke("game_add_playtime", { modeId, seconds }),
    openModeFolder: (modeId) => invoke("game_open_mode_folder", { modeId }),
    onGameEvent: (cb) => listen("game:event", (e) => cb(e.payload))
  };
})();
