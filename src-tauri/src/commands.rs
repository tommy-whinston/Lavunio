use crate::auth;
use crate::game;
use crate::models::{Account, LavunioSession, LavunioUser, Mode, Settings};
use crate::net;
use crate::publisher as build_publisher;
use crate::state::AppState;
use crate::util::{now_ms, open_path, open_url, path_string};
use serde_json::{json, Value};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, Window};

async fn blocking<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("Ошибка выполнения: {e}"))
}

async fn load_modes(state: &AppState) -> Vec<Mode> {
    let (repo, token, cached) = {
        let store = state.store.lock().unwrap();
        (
            store.settings.github_repo.clone(),
            store.settings.github_token.clone(),
            store.read_cached_modes(),
        )
    };

    let remote: Result<Vec<Mode>, String> = match blocking(move || {
        if let Some(api_base) = net::api_base_url() {
            match net::fetch_api_modes(&api_base) {
                Ok(modes) if !modes.is_empty() => {
                    crate::logging::log(format!("catalog: API loaded {} modes", modes.len()));
                    return Ok(modes);
                }
                Ok(_) => crate::logging::log("catalog: API returned no modes; using GitHub"),
                Err(err) => crate::logging::error("catalog API", &err),
            }
        }
        net::fetch_remote_modes(
            &repo,
            net::CATALOG_URL,
            Some(token.as_str()).filter(|value| !value.trim().is_empty()),
        )
    })
    .await
    {
        Ok(result) => result,
        Err(err) => Err(err),
    };

    let modes = match remote {
        Ok(modes) => {
            crate::logging::log(format!("catalog: loaded {} modes", modes.len()));
            let store = state.store.lock().unwrap();
            let _ = store.cache_modes(&modes);
            modes
        }
        Err(err) => {
            crate::logging::error("catalog", &err);
            cached
        }
    };

    *state.modes.lock().unwrap() = modes.clone();
    modes
}

fn save_window_size(window: &Window, state: &AppState) {
    if window.is_maximized().unwrap_or(false) {
        return;
    }
    let Ok(size) = window.inner_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let width = (size.width as f64 / scale) as f32;
    let height = (size.height as f64 / scale) as f32;
    if width < 980.0 || height < 640.0 {
        return;
    }
    let mut store = state.store.lock().unwrap();
    store.settings.launcher_width = width;
    store.settings.launcher_height = height;
    let _ = store.save_settings();
}

// ---------------------------------------------------------------- окно

#[tauri::command]
pub fn win_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn win_close(window: Window, state: State<'_, AppState>) -> Result<(), String> {
    save_window_size(&window, state.inner());
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn win_splash(window: Window) -> Result<(), String> {
    window
        .set_min_size(Some(tauri::LogicalSize::new(360.0, 520.0)))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(380.0, 620.0))
        .map_err(|e| e.to_string())?;
    window.set_resizable(false).map_err(|e| e.to_string())?;
    window.center().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn win_ready(window: Window) -> Result<(), String> {
    const WIDTH: f64 = 1280.0;
    const HEIGHT: f64 = 800.0;
    window
        .set_size(tauri::LogicalSize::new(WIDTH, HEIGHT))
        .map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(WIDTH, HEIGHT)))
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Some(tauri::LogicalSize::new(WIDTH, HEIGHT)))
        .map_err(|e| e.to_string())?;
    window.set_resizable(false).map_err(|e| e.to_string())?;
    window.set_maximizable(false).map_err(|e| e.to_string())?;
    window.center().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

// ---------------------------------------------------------------- данные

#[tauri::command]
pub async fn modes_get(state: State<'_, AppState>) -> Result<Vec<Mode>, String> {
    Ok(load_modes(state.inner()).await)
}

#[tauri::command]
pub fn modes_cached(state: State<'_, AppState>) -> Result<Vec<Mode>, String> {
    let store = state.store.lock().unwrap();
    Ok(store.read_cached_modes())
}

#[tauri::command]
pub async fn modes_refresh(state: State<'_, AppState>) -> Result<Vec<Mode>, String> {
    Ok(load_modes(state.inner()).await)
}

#[tauri::command]
pub fn system_ram_gb() -> u32 {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    let gb = system.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    gb.round().max(2.0) as u32
}

#[tauri::command]
pub fn state_get(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let store = state.store.lock().unwrap();
    serde_json::to_value(&store.state).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>) -> Settings {
    state.store.lock().unwrap().settings.clone()
}

#[tauri::command]
pub fn settings_save(state: State<'_, AppState>, patch: Value) -> Result<Settings, String> {
    let mut store = state.store.lock().unwrap();
    let mut current = serde_json::to_value(&store.settings).map_err(|e| e.to_string())?;
    if let (Some(target), Some(source)) = (current.as_object_mut(), patch.as_object()) {
        for (key, value) in source {
            target.insert(key.clone(), value.clone());
        }
    }
    store.settings = serde_json::from_value(current).map_err(|e| e.to_string())?;
    store.save_settings()?;
    crate::logging::log("settings: saved");
    Ok(store.settings.clone())
}

#[tauri::command]
pub async fn settings_choose_dir() -> Result<Option<String>, String> {
    let picked = blocking(|| rfd::FileDialog::new().pick_folder()).await?;
    Ok(picked.map(|p| path_string(&p)))
}

#[tauri::command]
pub fn shell_open(url: String) -> Result<(), String> {
    open_url(&url)
}

#[tauri::command]
pub fn game_open_folder(state: State<'_, AppState>) -> Result<(), String> {
    let dir = state.store.lock().unwrap().settings.dir.clone();
    open_path(std::path::Path::new(&dir))
}

#[tauri::command]
pub fn app_data_path() -> String {
    path_string(&crate::store::app_data_dir())
}

#[tauri::command]
pub fn app_logs_path() -> String {
    path_string(&crate::logging::log_path())
}

#[tauri::command]
pub fn app_open_logs() -> Result<(), String> {
    let path = crate::logging::log_path();
    let Some(parent) = path.parent() else {
        return Err("Не удалось найти папку логов".to_string());
    };
    std::fs::create_dir_all(parent).map_err(|e| format!("Не удалось создать папку логов: {e}"))?;
    crate::util::open_path(parent)
}

#[tauri::command]
pub fn app_open_folder() -> Result<(), String> {
    open_path(&crate::store::app_data_dir())
}

#[tauri::command]
pub fn game_uninstall(state: State<'_, AppState>, mode_id: String) -> Value {
    if state.active_game.lock().unwrap().is_some() {
        return json!({ "ok": false, "error": "Сначала закрой игру" });
    }
    let settings = state.store.lock().unwrap().settings.clone();
    if let Err(err) = game::uninstall(&settings, &mode_id) {
        return json!({ "ok": false, "error": err });
    }
    let mut store = state.store.lock().unwrap();
    if let Some(mode_state) = store.state.get_mut(&mode_id) {
        mode_state.installed = false;
        mode_state.version = None;
        mode_state.installed_at = 0;
    }
    let _ = store.save_state();
    json!({ "ok": true })
}

#[tauri::command]
pub fn game_set_library(state: State<'_, AppState>, mode_id: String, library: bool) -> Value {
    let mut store = state.store.lock().unwrap();
    match store.set_mode_library(&mode_id, library) {
        Ok(()) => json!({ "ok": true }),
        Err(err) => json!({ "ok": false, "error": err }),
    }
}

#[tauri::command]
pub fn game_add_playtime(state: State<'_, AppState>, mode_id: String, seconds: u64) -> Value {
    let mut store = state.store.lock().unwrap();
    let mode_state = store.state.entry(mode_id).or_insert_with(Default::default);
    mode_state.playtime_secs = mode_state.playtime_secs.saturating_add(seconds);
    let playtime = mode_state.playtime_secs;
    match store.save_state() {
        Ok(()) => json!({ "ok": true, "playtimeSecs": playtime }),
        Err(err) => json!({ "ok": false, "error": err }),
    }
}

#[tauri::command]
pub fn game_open_mode_folder(state: State<'_, AppState>, mode_id: String) -> Result<(), String> {
    if mode_id.is_empty() || mode_id == ".." || mode_id.contains('/') || mode_id.contains('\\') {
        return Err("Некорректный режим".to_string());
    }
    let settings = state.store.lock().unwrap().settings.clone();
    let base = std::path::Path::new(&settings.dir);
    let new_dir = base.join("games").join(&mode_id);
    let old_dir = base.join(&mode_id);
    let dir = if new_dir.exists() {
        new_dir
    } else if old_dir.exists() {
        old_dir
    } else {
        std::fs::create_dir_all(&new_dir)
            .map_err(|e| format!("Не удалось создать папку режима: {e}"))?;
        new_dir
    };
    open_path(&dir)
}

// ---------------------------------------------------------------- аккаунты

#[tauri::command]
pub fn accounts_get(state: State<'_, AppState>) -> Vec<Account> {
    state.store.lock().unwrap().accounts.clone()
}

#[tauri::command]
pub fn accounts_current(state: State<'_, AppState>) -> Option<Account> {
    state.store.lock().unwrap().current_account()
}

#[tauri::command]
pub async fn accounts_device_start(state: State<'_, AppState>) -> Result<Value, String> {
    let client_id = state
        .store
        .lock()
        .unwrap()
        .settings
        .ely_client_id
        .trim()
        .to_string();
    if client_id.is_empty() {
        return Err("Не настроен Ely.by client_id. Добавь его в настройках.".to_string());
    }
    let data = blocking(move || auth::device_start(&client_id))
        .await
        .map_err(|e| format!("Не удалось начать вход: {e}"))??;
    Ok(json!({
        "deviceCode": data.device_code,
        "verificationUriComplete": data.verification_uri_complete,
        "interval": data.interval,
    }))
}

#[tauri::command]
pub async fn accounts_device_poll(
    state: State<'_, AppState>,
    device_code: String,
) -> Result<Value, String> {
    let client_id = state
        .store
        .lock()
        .unwrap()
        .settings
        .ely_client_id
        .trim()
        .to_string();
    if client_id.is_empty() {
        return Err("Не настроен Ely.by client_id. Добавь его в настройках.".to_string());
    }
    let code = device_code.clone();
    let poll = blocking(move || auth::device_poll(&client_id, &code))
        .await
        .map_err(|e| format!("Не удалось проверить вход: {e}"))??;
    match poll {
        auth::DevicePoll::Pending => Ok(json!({ "status": "pending" })),
        auth::DevicePoll::SlowDown => Ok(json!({ "status": "slow_down" })),
        auth::DevicePoll::Token(token) => {
            let access = token.access_token.clone();
            let info = blocking(move || auth::user_info(&access))
                .await
                .map_err(|e| format!("Не удалось получить профиль Ely.by: {e}"))??;
            let client_token = state.store.lock().unwrap().client_token.clone();
            let refresh_token = token.refresh_token.clone();
            let account = Account {
                id: uuid::Uuid::new_v4().to_string(),
                kind: "ely".to_string(),
                name: info.username,
                uuid: info.uuid.replace('-', ""),
                access_token: token.access_token,
                client_token,
                added_at: now_ms(),
                session_error: false,
                expires_at: now_ms().saturating_add(token.expires_in.saturating_mul(1000)),
            };
            let mut store = state.store.lock().unwrap();
            let account = store.upsert_account(account)?;
            if let Some(refresh) = refresh_token {
                store.refresh_tokens.insert(account.id.clone(), refresh);
                let _ = store.save_refresh_tokens();
            }
            store.set_current_account(Some(account.id.clone()))?;
            Ok(json!({ "status": "ok", "account": account }))
        }
    }
}

#[tauri::command]
pub async fn open_ely_window(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://account.ely.by/") {
        return Err("Некорректный адрес Ely.by".to_string());
    }
    let parsed = url::Url::parse(&url).map_err(|e| format!("Некорректный адрес Ely.by: {e}"))?;
    if let Some(window) = app.get_webview_window("ely-login") {
        let _ = window.navigate(parsed);
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    let window =
        tauri::WebviewWindowBuilder::new(&app, "ely-login", tauri::WebviewUrl::External(parsed))
            .title("Ely.by")
            .inner_size(520.0, 720.0)
            .center()
            .resizable(true)
            .build()
            .map_err(|e| format!("Не удалось открыть окно Ely.by: {e}"))?;
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
pub async fn close_ely_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("ely-login") {
        let _ = window.close();
    }
}

#[tauri::command]
pub fn accounts_select(state: State<'_, AppState>, id: String) -> Result<Option<Account>, String> {
    let mut store = state.store.lock().unwrap();
    store.set_current_account(Some(id))?;
    Ok(store.current_account())
}

#[tauri::command]
pub fn accounts_remove(state: State<'_, AppState>, id: String) -> Value {
    let mut store = state.store.lock().unwrap();
    let _ = store.remove_account(&id);
    json!({
        "accounts": store.accounts.clone(),
        "current": store.current_account()
    })
}

// ---------------------------------------------------------------- Lavunio ID

fn lavunio_api() -> Result<String, String> {
    net::api_base_url()
        .ok_or_else(|| "Lavunio API не настроен. Для входа нужен LAVUNIO_API_URL.".to_string())
}

fn lavunio_status_value(configured: bool, session: &LavunioSession) -> Value {
    json!({
        "configured": configured,
        "hasSession": !session.access_token.is_empty(),
        "user": session.user,
    })
}

fn parse_lavunio_session(data: &Value) -> Result<LavunioSession, String> {
    let user: LavunioUser = serde_json::from_value(
        data.get("user")
            .cloned()
            .ok_or_else(|| "API не вернул профиль Lavunio".to_string())?,
    )
    .map_err(|error| format!("Некорректный профиль Lavunio: {error}"))?;
    let tokens = data
        .get("tokens")
        .ok_or_else(|| "API не вернул токены Lavunio".to_string())?;
    let access_token = tokens
        .get("accessToken")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "API не вернул access-токен".to_string())?
        .to_string();
    let refresh_token = tokens
        .get("refreshToken")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "API не вернул refresh-токен".to_string())?
        .to_string();
    let expires_in = tokens
        .get("expiresIn")
        .and_then(Value::as_i64)
        .unwrap_or(900)
        .max(0) as u64;

    Ok(LavunioSession {
        user: Some(user),
        access_token,
        refresh_token,
        access_expires_at: now_ms().saturating_add(expires_in.saturating_mul(1000)),
    })
}

fn save_lavunio_session(state: &AppState, session: LavunioSession) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    store.lavunio = session;
    store.save_lavunio()
}

#[tauri::command]
pub fn lavunio_status(state: State<'_, AppState>) -> Value {
    let session = state.store.lock().unwrap().lavunio.clone();
    lavunio_status_value(net::api_base_url().is_some(), &session)
}

#[tauri::command]
pub async fn lavunio_register(
    state: State<'_, AppState>,
    email: String,
    password: String,
    username: Option<String>,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let payload = json!({
        "email": email,
        "password": password,
        "username": username,
    });
    let data = blocking(move || {
        net::api_request_json(&api, "POST", "/v1/auth/register", None, Some(payload))
    })
    .await??;

    let mut session = parse_lavunio_session(&data)?;

    if let Some(token) = data
        .get("verificationToken")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        let api = lavunio_api()?;
        let verified = blocking(move || {
            net::api_request_json(
                &api,
                "POST",
                "/v1/auth/verify-email",
                None,
                Some(json!({ "token": token })),
            )
        })
        .await;
        if matches!(verified, Ok(Ok(_))) {
            if let Some(user) = session.user.as_mut() {
                user.email_verified = true;
            }
        }
    }

    save_lavunio_session(state.inner(), session.clone())?;
    crate::logging::log(format!(
        "lavunio: registered {}",
        session
            .user
            .as_ref()
            .map(|user| user.username.as_str())
            .unwrap_or("?")
    ));
    Ok(lavunio_status_value(true, &session))
}

#[tauri::command]
pub async fn lavunio_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let payload = json!({ "email": email, "password": password });
    let data = blocking(move || {
        net::api_request_json(&api, "POST", "/v1/auth/login", None, Some(payload))
    })
    .await??;

    let session = parse_lavunio_session(&data)?;
    save_lavunio_session(state.inner(), session.clone())?;
    crate::logging::log(format!(
        "lavunio: logged in {}",
        session
            .user
            .as_ref()
            .map(|user| user.username.as_str())
            .unwrap_or("?")
    ));
    Ok(lavunio_status_value(true, &session))
}

#[tauri::command]
pub async fn lavunio_logout(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.store.lock().unwrap().lavunio.clone();
    if let Some(api) = net::api_base_url() {
        if !session.access_token.is_empty() || !session.refresh_token.is_empty() {
            let access = session.access_token.clone();
            let refresh = session.refresh_token.clone();
            let _ = blocking(move || {
                net::api_request_json(
                    &api,
                    "POST",
                    "/v1/auth/logout",
                    Some(&access),
                    Some(json!({ "refreshToken": refresh })),
                )
            })
            .await;
        }
    }
    save_lavunio_session(state.inner(), LavunioSession::default())?;
    crate::logging::log("lavunio: logged out");
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn lavunio_resend_verification(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.store.lock().unwrap().lavunio.clone();
    if session.access_token.is_empty() {
        return Err("Сначала войдите в аккаунт Lavunio".to_string());
    }
    let api = lavunio_api()?;
    let access = session.access_token.clone();
    let data = blocking(move || {
        net::api_request_json(
            &api,
            "POST",
            "/v1/auth/verify-email/resend",
            Some(&access),
            None,
        )
    })
    .await??;

    let mut session = session;
    if let Some(token) = data
        .get("verificationToken")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        let api = lavunio_api()?;
        let verified = blocking(move || {
            net::api_request_json(
                &api,
                "POST",
                "/v1/auth/verify-email",
                None,
                Some(json!({ "token": token })),
            )
        })
        .await;
        if matches!(verified, Ok(Ok(_))) {
            if let Some(user) = session.user.as_mut() {
                user.email_verified = true;
            }
        }
    }

    save_lavunio_session(state.inner(), session.clone())?;
    Ok(lavunio_status_value(true, &session))
}

async fn lavunio_access_token(state: &AppState) -> Result<String, String> {
    let session = state.store.lock().unwrap().lavunio.clone();
    if session.access_token.is_empty() {
        return Err("Сначала войдите в аккаунт Lavunio".to_string());
    }
    if session.access_expires_at > now_ms().saturating_add(60_000) {
        return Ok(session.access_token);
    }
    if session.refresh_token.is_empty() {
        return Err("Сессия истекла — войдите в Lavunio заново".to_string());
    }

    let api = lavunio_api()?;
    let refresh = session.refresh_token.clone();
    let data = blocking(move || {
        net::api_request_json(
            &api,
            "POST",
            "/v1/auth/refresh",
            None,
            Some(json!({ "refreshToken": refresh })),
        )
    })
    .await??;
    let refreshed = parse_lavunio_session(&data)?;
    save_lavunio_session(state, refreshed.clone())?;
    Ok(refreshed.access_token)
}

async fn publisher_request(
    state: &AppState,
    method: &'static str,
    path: String,
    body: Option<Value>,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let token = lavunio_access_token(state).await?;
    blocking(move || net::api_request_json(&api, method, &path, Some(&token), body)).await?
}

#[tauri::command]
pub async fn publisher_my_modes(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/publisher/modes".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn publisher_create_mode(
    state: State<'_, AppState>,
    payload: Value,
) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "POST",
        "/v1/publisher/modes".to_string(),
        Some(payload),
    )
    .await
}

#[tauri::command]
pub async fn publisher_create_release(
    state: State<'_, AppState>,
    mode_id: String,
    payload: Value,
) -> Result<Value, String> {
    let path = format!("/v1/publisher/modes/{mode_id}/releases");
    publisher_request(state.inner(), "POST", path, Some(payload)).await
}

#[tauri::command]
pub async fn publisher_submit(
    state: State<'_, AppState>,
    release_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/publisher/releases/{release_id}/submit");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn publisher_pick_folder() -> Result<Option<String>, String> {
    let picked = blocking(|| rfd::FileDialog::new().pick_folder()).await?;
    Ok(picked.map(|path| path_string(&path)))
}

#[tauri::command]
pub async fn publisher_pick_archive() -> Result<Option<String>, String> {
    let picked = blocking(|| {
        rfd::FileDialog::new()
            .add_filter("ZIP-архив", &["zip"])
            .pick_file()
    })
    .await?;
    Ok(picked.map(|path| path_string(&path)))
}

async fn upload_package(
    app: &AppHandle,
    state: &AppState,
    release_id: &str,
    package: &build_publisher::BuildPackage,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let token = lavunio_access_token(state).await?;
    let path = format!("/v1/publisher/releases/{release_id}/assets/upload-url");
    let body = json!({
        "kind": "archive",
        "fileName": "build.zip",
        "size": package.size,
        "sha256": package.sha256,
        "manifest": package.manifest,
    });
    let request_api = api.clone();
    let request_token = token.clone();
    let data = blocking(move || {
        net::api_request_json(
            &request_api,
            "POST",
            &path,
            Some(&request_token),
            Some(body),
        )
    })
    .await??;

    let upload_url = data
        .get("uploadUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "API не вернул URL загрузки".to_string())?
        .to_string();
    let asset_id = data
        .get("assetId")
        .and_then(Value::as_str)
        .ok_or_else(|| "API не вернул assetId".to_string())?
        .to_string();
    let storage = data
        .get("storage")
        .and_then(Value::as_str)
        .unwrap_or("local")
        .to_string();
    let complete_url = data
        .get("completeUrl")
        .and_then(Value::as_str)
        .map(str::to_string);

    let upload_token = if storage == "s3" {
        None
    } else {
        Some(token.clone())
    };
    let upload_path = package.path.clone();
    let size = package.size;
    let sha256 = package.sha256.clone();
    let app_handle = app.clone();
    blocking(move || {
        net::upload_file(
            &upload_url,
            &upload_path,
            upload_token.as_deref(),
            size,
            move |done, total| {
                let percent = if total > 0 {
                    done as f64 / total as f64 * 100.0
                } else {
                    0.0
                };
                let _ = app_handle.emit(
                    "publisher:progress",
                    json!({
                        "stage": "Загрузка сборки",
                        "done": done,
                        "total": total,
                        "percent": percent,
                    }),
                );
            },
        )
    })
    .await??;

    let _ = app.emit(
        "publisher:progress",
        json!({
            "stage": "Загрузка завершена",
            "done": size,
            "total": size,
            "percent": 100.0,
        }),
    );

    if let Some(complete_url) = complete_url.filter(|value| !value.is_empty()) {
        let api = lavunio_api()?;
        let access = lavunio_access_token(state).await?;
        let body = json!({ "size": size, "sha256": sha256 });
        let data = blocking(move || {
            net::api_request_json(&api, "POST", &complete_url, Some(&access), Some(body))
        })
        .await??;
        return Ok(json!({
            "ok": true,
            "asset": data,
            "files": package.files,
            "bytes": package.bytes
        }));
    }

    Ok(json!({
        "ok": true,
        "assetId": asset_id,
        "files": package.files,
        "bytes": package.bytes
    }))
}

#[tauri::command]
pub async fn publisher_upload_build(
    app: AppHandle,
    state: State<'_, AppState>,
    mode_id: String,
    release_id: String,
    version: String,
    source: String,
) -> Result<Value, String> {
    let busy = state.publisher_busy.clone();
    if busy.swap(true, Ordering::SeqCst) {
        return Err("Загрузка уже идёт".to_string());
    }

    let result = async {
        let _ = app.emit(
            "publisher:progress",
            json!({ "stage": "Подготовка сборки", "done": 0, "total": 0, "percent": 0.0 }),
        );
        let source_path = Path::new(&source).to_path_buf();
        let mode = mode_id.clone();
        let release_version = version.clone();
        let package =
            blocking(move || build_publisher::build_package(&source_path, &mode, &release_version))
                .await??;

        let result = upload_package(&app, state.inner(), &release_id, &package).await;
        build_publisher::cleanup_package(&package);
        result
    }
    .await;

    busy.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub async fn accounts_refresh(state: State<'_, AppState>) -> Result<Option<Account>, String> {
    let Some(mut account) = state.store.lock().unwrap().current_account() else {
        return Ok(None);
    };
    if !account.is_ely() {
        return Ok(Some(account));
    }
    if account.expires_at > 0 {
        let (client_id, refresh) = {
            let store = state.store.lock().unwrap();
            (
                store.settings.ely_client_id.clone(),
                store.refresh_tokens.get(&account.id).cloned(),
            )
        };
        if let Some(refresh) = refresh {
            let result = blocking(move || auth::oauth_refresh(&client_id, &refresh))
                .await
                .map_err(|e| format!("Не удалось обновить сессию: {e}"))?;
            match result {
                Ok(token) => {
                    account.access_token = token.access_token;
                    account.expires_at =
                        now_ms().saturating_add(token.expires_in.saturating_mul(1000));
                    account.session_error = false;
                    let mut store = state.store.lock().unwrap();
                    if let Some(existing) = store.accounts.iter_mut().find(|a| a.id == account.id) {
                        *existing = account.clone();
                    }
                    if let Some(new_refresh) = token.refresh_token {
                        store.refresh_tokens.insert(account.id.clone(), new_refresh);
                    }
                    let _ = store.save_accounts();
                    let _ = store.save_refresh_tokens();
                    return Ok(store.current_account());
                }
                Err(_) => {
                    account.session_error = true;
                    let mut store = state.store.lock().unwrap();
                    if let Some(existing) = store.accounts.iter_mut().find(|a| a.id == account.id) {
                        existing.session_error = true;
                    }
                    let _ = store.save_accounts();
                    return Ok(Some(account));
                }
            }
        }
        account.session_error = now_ms() >= account.expires_at;
        let mut store = state.store.lock().unwrap();
        if let Some(existing) = store.accounts.iter_mut().find(|a| a.id == account.id) {
            existing.session_error = account.session_error;
            let _ = store.save_accounts();
        }
        return Ok(Some(account));
    }

    let access = account.access_token.clone();
    let client = account.client_token.clone();
    let result = blocking(move || {
        if auth::ely_validate(&access, &client) {
            return Ok(None);
        }
        auth::ely_refresh(&access, &client).map(Some)
    })
    .await
    .map_err(|e| format!("Не удалось проверить сессию: {e}"))?;

    match result {
        Ok(Some(data)) => {
            account.access_token = data.access_token;
            if let Some(token) = data.client_token {
                account.client_token = token;
            }
            if let Some(profile) = data.selected_profile {
                account.name = profile.name;
                account.uuid = profile.id;
            }
            account.session_error = false;
        }
        Ok(None) => {
            account.session_error = false;
        }
        Err(_) => {
            account.session_error = true;
        }
    }

    let mut store = state.store.lock().unwrap();
    if let Some(existing) = store.accounts.iter_mut().find(|a| a.id == account.id) {
        *existing = account.clone();
        let _ = store.save_accounts();
    }
    Ok(store.current_account())
}

// ---------------------------------------------------------------- игра

async fn start_game(app: AppHandle, state: &AppState, mode_id: &str, install_only: bool) -> Value {
    crate::logging::log(format!(
        "game: requested mode={mode_id} install_only={install_only}"
    ));
    if state.active_game.lock().unwrap().is_some() {
        crate::logging::log("game: rejected, another operation is running");
        return json!({ "ok": false, "error": "Дождитесь завершения текущей операции" });
    }

    let mut mode = state
        .modes
        .lock()
        .unwrap()
        .iter()
        .find(|m| m.id == mode_id)
        .cloned();
    if mode.is_none() {
        load_modes(state).await;
        mode = state
            .modes
            .lock()
            .unwrap()
            .iter()
            .find(|m| m.id == mode_id)
            .cloned();
    }
    let Some(mode) = mode else {
        crate::logging::error("game", format!("mode not found: {mode_id}"));
        return json!({ "ok": false, "error": "Режим не найден" });
    };

    let (account, settings) = {
        let store = state.store.lock().unwrap();
        (store.current_account(), store.settings.clone())
    };
    let Some(account) = account else {
        crate::logging::error("game", "no active account");
        return json!({ "ok": false, "error": "Сначала войдите в аккаунт" });
    };

    let mode_id_for_store = mode.id.clone();
    let mode_version_for_store = mode.version.clone();
    let cancel = Arc::new(AtomicBool::new(false));
    *state.active_game.lock().unwrap() = Some(cancel.clone());
    let app_for_thread = app.clone();
    let app_for_store = app.clone();
    let active = state.active_game.clone();
    std::thread::spawn(move || {
        let result = game::start(
            mode,
            account,
            settings,
            install_only,
            app_for_thread,
            cancel,
        );
        match &result {
            Ok(()) => crate::logging::log(format!(
                "game: finished mode={mode_id_for_store} install_only={install_only}"
            )),
            Err(err) => crate::logging::error(
                "game",
                format!("mode={mode_id_for_store} install_only={install_only}: {err}"),
            ),
        }
        if install_only && result.is_ok() {
            let state = app_for_store.state::<AppState>();
            let mut store = state.store.lock().unwrap();
            let _ = store.set_mode_installed(&mode_id_for_store, &mode_version_for_store);
        }
        *active.lock().unwrap() = None;
    });

    json!({ "ok": true })
}

#[tauri::command]
pub async fn game_install(
    app: AppHandle,
    state: State<'_, AppState>,
    mode_id: String,
) -> Result<Value, String> {
    Ok(start_game(app, state.inner(), &mode_id, true).await)
}

#[tauri::command]
pub async fn game_play(
    app: AppHandle,
    state: State<'_, AppState>,
    mode_id: String,
) -> Result<Value, String> {
    Ok(start_game(app, state.inner(), &mode_id, false).await)
}

#[tauri::command]
pub fn game_cancel(state: State<'_, AppState>) {
    if let Some(cancel) = state.active_game.lock().unwrap().as_ref() {
        cancel.store(true, Ordering::Relaxed);
    }
}

// ---------------------------------------------------------------- утилиты

pub fn save_window_size_for_event(window: &tauri::WebviewWindow, app: &AppHandle) {
    if window.is_maximized().unwrap_or(false) {
        return;
    }
    let Ok(size) = window.inner_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let width = (size.width as f64 / scale) as f32;
    let height = (size.height as f64 / scale) as f32;
    if width < 980.0 || height < 640.0 {
        return;
    }
    let state = app.state::<AppState>();
    let mut store = state.store.lock().unwrap();
    store.settings.launcher_width = width;
    store.settings.launcher_height = height;
    let _ = store.save_settings();
}
