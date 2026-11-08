use crate::game;
use crate::models::{GameAccount, LavunioSession, LavunioUser, Mode, Settings};
use crate::net;
use crate::publisher as build_publisher;
use crate::state::AppState;
use crate::util::{now_ms, open_path, open_url, path_string};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
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
pub async fn collections_get() -> Result<Value, String> {
    let Some(api_base) = net::api_base_url() else {
        return Ok(json!([]));
    };
    match blocking(move || net::fetch_api_collections(&api_base)).await {
        Ok(Ok(value)) => Ok(value),
        Ok(Err(err)) => {
            crate::logging::error("collections API", &err);
            Ok(json!([]))
        }
        Err(err) => {
            crate::logging::error("collections API", &err);
            Ok(json!([]))
        }
    }
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
pub async fn game_verify(state: State<'_, AppState>, mode_id: String) -> Result<Value, String> {
    let settings = state.store.lock().unwrap().settings.clone();
    blocking(move || game::verify_files(&settings, &mode_id)).await?
}

#[tauri::command]
pub fn game_prepare_repair(state: State<'_, AppState>, mode_id: String) -> Result<Value, String> {
    let settings = state.store.lock().unwrap().settings.clone();
    game::prepare_repair(&settings, &mode_id)?;
    Ok(json!({ "ok": true }))
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
        game_access_token: String::new(),
        game_client_token: String::new(),
        game_expires_at: 0,
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
            let game_api = api.clone();
            if !session.access_token.is_empty() {
                let game_access = session.access_token.clone();
                let _ = blocking(move || {
                    net::api_request_json(
                        &game_api,
                        "POST",
                        "/v1/game/logout",
                        Some(&game_access),
                        None,
                    )
                })
                .await;
            }
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
    let mut refreshed = parse_lavunio_session(&data)?;
    refreshed.game_access_token = session.game_access_token.clone();
    refreshed.game_client_token = session.game_client_token.clone();
    refreshed.game_expires_at = session.game_expires_at;
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
pub async fn admin_queue(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/admin/moderation/queue".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn admin_modes(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(state.inner(), "GET", "/v1/admin/modes".to_string(), None).await
}

#[tauri::command]
pub async fn admin_history(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/admin/moderation/history?limit=100".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn admin_approve(
    state: State<'_, AppState>,
    release_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/moderation/{release_id}/approve");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn admin_reject(
    state: State<'_, AppState>,
    release_id: String,
    note: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/moderation/{release_id}/reject");
    publisher_request(state.inner(), "POST", path, Some(json!({ "note": note }))).await
}

#[tauri::command]
pub async fn admin_hide_mode(
    state: State<'_, AppState>,
    mode_id: String,
    note: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/modes/{mode_id}/hide");
    publisher_request(state.inner(), "POST", path, Some(json!({ "note": note }))).await
}

#[tauri::command]
pub async fn admin_unhide_mode(
    state: State<'_, AppState>,
    mode_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/modes/{mode_id}/unhide");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn wishlist_get(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(state.inner(), "GET", "/v1/me/wishlist".to_string(), None).await
}

#[tauri::command]
pub async fn wishlist_add(state: State<'_, AppState>, slug: String) -> Result<Value, String> {
    let path = format!("/v1/me/wishlist/{slug}");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn wishlist_remove(state: State<'_, AppState>, slug: String) -> Result<Value, String> {
    let path = format!("/v1/me/wishlist/{slug}");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn reviews_get(_state: State<'_, AppState>, slug: String) -> Result<Value, String> {
    let api = lavunio_api()?;
    let path = format!("/v1/modes/{slug}/reviews");
    blocking(move || net::api_request_json(&api, "GET", &path, None, None)).await?
}

#[tauri::command]
pub async fn review_submit(
    state: State<'_, AppState>,
    slug: String,
    rating: i64,
    text: String,
) -> Result<Value, String> {
    let path = format!("/v1/modes/{slug}/reviews");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "rating": rating, "text": text })),
    )
    .await
}

#[tauri::command]
pub async fn review_delete(state: State<'_, AppState>, slug: String) -> Result<Value, String> {
    let path = format!("/v1/me/reviews/{slug}");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn report_mode(
    state: State<'_, AppState>,
    slug: String,
    reason: String,
) -> Result<Value, String> {
    let path = format!("/v1/modes/{slug}/reports");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "reason": reason })),
    )
    .await
}

#[tauri::command]
pub async fn admin_reports(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/admin/reports?status=open".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn admin_close_report(
    state: State<'_, AppState>,
    report_id: String,
    note: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/reports/{report_id}/close");
    publisher_request(state.inner(), "POST", path, Some(json!({ "note": note }))).await
}

#[tauri::command]
pub async fn follows_get(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(state.inner(), "GET", "/v1/me/follows".to_string(), None).await
}

#[tauri::command]
pub async fn follow_author(state: State<'_, AppState>, username: String) -> Result<Value, String> {
    let path = format!("/v1/follows/{username}");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn unfollow_author(
    state: State<'_, AppState>,
    username: String,
) -> Result<Value, String> {
    let path = format!("/v1/follows/{username}");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn feed_get(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/me/feed?limit=20".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn news_store(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(state.inner(), "GET", "/v1/news?limit=20".to_string(), None).await
}

#[tauri::command]
pub async fn news_mode(state: State<'_, AppState>, slug: String) -> Result<Value, String> {
    let path = format!("/v1/modes/{slug}/news?limit=20");
    publisher_request(state.inner(), "GET", path, None).await
}

#[tauri::command]
pub async fn news_create_store(
    state: State<'_, AppState>,
    title: String,
    body: String,
) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "POST",
        "/v1/news".to_string(),
        Some(json!({ "title": title, "body": body })),
    )
    .await
}

#[tauri::command]
pub async fn news_create_mode(
    state: State<'_, AppState>,
    mode_id: String,
    title: String,
    body: String,
) -> Result<Value, String> {
    let path = format!("/v1/publisher/modes/{mode_id}/news");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "title": title, "body": body })),
    )
    .await
}

#[tauri::command]
pub async fn admin_reviews(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/admin/reviews?status=pending".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn admin_approve_review(
    state: State<'_, AppState>,
    review_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/reviews/{review_id}/approve");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn admin_reject_review(
    state: State<'_, AppState>,
    review_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/reviews/{review_id}/reject");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn review_reply(
    state: State<'_, AppState>,
    slug: String,
    review_id: String,
    text: String,
) -> Result<Value, String> {
    let path = format!("/v1/modes/{slug}/reviews/{review_id}/reply");
    publisher_request(state.inner(), "POST", path, Some(json!({ "text": text }))).await
}

#[tauri::command]
pub async fn admin_collections(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/admin/collections".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn admin_create_collection(
    state: State<'_, AppState>,
    payload: Value,
) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "POST",
        "/v1/admin/collections".to_string(),
        Some(payload),
    )
    .await
}

#[tauri::command]
pub async fn admin_delete_collection(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/collections/{collection_id}");
    publisher_request(state.inner(), "DELETE", path, None).await
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

#[tauri::command]
pub async fn publisher_pick_cover() -> Result<Option<String>, String> {
    let picked = blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Изображение", &["png", "jpg", "jpeg", "webp"])
            .pick_file()
    })
    .await?;
    Ok(picked.map(|path| path_string(&path)))
}

#[tauri::command]
pub async fn publisher_pick_screenshot() -> Result<Option<String>, String> {
    let picked = blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Изображение", &["png", "jpg", "jpeg", "webp"])
            .pick_file()
    })
    .await?;
    Ok(picked.map(|path| path_string(&path)))
}

#[tauri::command]
pub async fn publisher_upload_cover(
    state: State<'_, AppState>,
    mode_id: String,
    path: String,
) -> Result<Value, String> {
    let bytes =
        std::fs::read(&path).map_err(|error| format!("Не удалось прочитать файл: {error}"))?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("Обложка больше 8 МБ".to_string());
    }
    let api = lavunio_api()?;
    let token = lavunio_access_token(state.inner()).await?;
    let endpoint = format!("/v1/publisher/modes/{mode_id}/cover");
    blocking(move || {
        net::api_request_bytes(
            &api,
            "PUT",
            &endpoint,
            Some(&token),
            bytes,
            "application/octet-stream",
        )
    })
    .await?
}

#[tauri::command]
pub async fn publisher_upload_screenshot(
    state: State<'_, AppState>,
    release_id: String,
    path: String,
) -> Result<Value, String> {
    let bytes =
        std::fs::read(&path).map_err(|error| format!("Не удалось прочитать файл: {error}"))?;
    if bytes.len() > 20 * 1024 * 1024 {
        return Err("Скриншот больше 20 МБ".to_string());
    }
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("screenshot.png")
        .to_string();
    let sha256 = Sha256::digest(&bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let size = bytes.len() as i64;

    let api = lavunio_api()?;
    let token = lavunio_access_token(state.inner()).await?;
    let endpoint = format!("/v1/publisher/releases/{release_id}/assets/upload-url");
    let request_token = token.clone();
    let payload = json!({
        "kind": "screenshot",
        "fileName": file_name,
        "size": size,
        "sha256": sha256.clone(),
    });
    let data = blocking(move || {
        net::api_request_json(&api, "POST", &endpoint, Some(&request_token), Some(payload))
    })
    .await??;

    let upload_url = data
        .get("uploadUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "API не вернул URL загрузки".to_string())?
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
    let asset_id = data
        .get("assetId")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let upload_token = if storage == "s3" {
        None
    } else {
        Some(token.clone())
    };
    let upload_path = Path::new(&path).to_path_buf();
    blocking(move || {
        net::upload_file(
            &upload_url,
            &upload_path,
            upload_token.as_deref(),
            size as u64,
            |_, _| {},
        )
    })
    .await??;

    if let Some(complete_url) = complete_url.filter(|value| !value.is_empty()) {
        let api = lavunio_api()?;
        let access = lavunio_access_token(state.inner()).await?;
        let body = json!({ "size": size, "sha256": sha256 });
        let data = blocking(move || {
            net::api_request_json(&api, "POST", &complete_url, Some(&access), Some(body))
        })
        .await??;
        return Ok(json!({ "ok": true, "asset": data }));
    }

    Ok(json!({ "ok": true, "assetId": asset_id }))
}

#[tauri::command]
pub async fn publisher_delete_cover(
    state: State<'_, AppState>,
    mode_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/publisher/modes/{mode_id}/cover");
    publisher_request(state.inner(), "DELETE", path, None).await
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

// ---------------------------------------------------------------- игра

async fn report_mode_event(state: &AppState, mode_id: &str, event: &str, version: &str) {
    let Some(api) = net::api_base_url() else {
        return;
    };
    let Ok(token) = lavunio_access_token(state).await else {
        return;
    };
    let path = format!("/v1/modes/{mode_id}/events");
    let body = json!({ "event": event, "version": version });
    let _ = blocking(move || net::api_request_json(&api, "POST", &path, Some(&token), Some(body)))
        .await;
}

async fn ensure_game_account(state: &AppState) -> Result<GameAccount, String> {
    let mut session = state.store.lock().unwrap().lavunio.clone();
    let Some(user) = session.user.clone() else {
        return Err("Сначала войдите в Lavunio ID".to_string());
    };
    let Some(uuid) = user
        .minecraft_uuid
        .clone()
        .filter(|value| !value.trim().is_empty())
    else {
        return Err("У аккаунта нет Minecraft UUID".to_string());
    };

    if session.game_access_token.is_empty() || session.game_expires_at <= now_ms() + 60_000 {
        let api = lavunio_api()?;
        let access = lavunio_access_token(state).await?;
        let data = blocking(move || {
            net::api_request_json(&api, "POST", "/v1/game/session", Some(&access), None)
        })
        .await??;
        let access_token = data
            .get("accessToken")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "API не вернул игровой токен".to_string())?
            .to_string();
        let client_token = data
            .get("clientToken")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let expires_in = data
            .get("expiresIn")
            .and_then(Value::as_i64)
            .unwrap_or(30 * 24 * 60 * 60)
            .max(60) as u64;
        session.game_access_token = access_token;
        session.game_client_token = client_token;
        session.game_expires_at = now_ms().saturating_add(expires_in.saturating_mul(1000));
        save_lavunio_session(state, session.clone())?;
    }

    Ok(GameAccount {
        name: user.username,
        uuid,
        access_token: session.game_access_token,
    })
}

#[tauri::command]
pub async fn lavunio_game_session(state: State<'_, AppState>) -> Result<Value, String> {
    let account = ensure_game_account(state.inner()).await?;
    let session = state.store.lock().unwrap().lavunio.clone();
    Ok(json!({
        "profile": {
            "name": account.name,
            "uuid": account.uuid,
        },
        "expiresAt": session.game_expires_at,
    }))
}

fn save_lavunio_account(state: &AppState, data: Value) -> Result<Value, String> {
    let user: LavunioUser = serde_json::from_value(data)
        .map_err(|error| format!("Некорректный профиль Lavunio: {error}"))?;
    let mut session = state.store.lock().unwrap().lavunio.clone();
    session.user = Some(user);
    save_lavunio_session(state, session.clone())?;
    Ok(lavunio_status_value(true, &session))
}

#[tauri::command]
pub async fn lavunio_pick_skin() -> Result<Option<String>, String> {
    let picked = blocking(|| {
        rfd::FileDialog::new()
            .add_filter("PNG-скин", &["png"])
            .pick_file()
    })
    .await?;
    Ok(picked.map(|path| path_string(&path)))
}

#[tauri::command]
pub async fn lavunio_pick_cape() -> Result<Option<String>, String> {
    let picked = blocking(|| {
        rfd::FileDialog::new()
            .add_filter("PNG-плащ", &["png"])
            .pick_file()
    })
    .await?;
    Ok(picked.map(|path| path_string(&path)))
}

async fn lavunio_upload_image(
    state: &AppState,
    path: String,
    endpoint: String,
) -> Result<Value, String> {
    let bytes =
        std::fs::read(&path).map_err(|error| format!("Не удалось прочитать файл: {error}"))?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("Файл больше 2 МБ".to_string());
    }
    let api = lavunio_api()?;
    let token = lavunio_access_token(state).await?;
    let data = blocking(move || {
        net::api_request_bytes(&api, "PUT", &endpoint, Some(&token), bytes, "image/png")
    })
    .await??;
    save_lavunio_account(state, data)
}

#[tauri::command]
pub async fn lavunio_upload_skin(
    state: State<'_, AppState>,
    path: String,
    model: String,
) -> Result<Value, String> {
    let model = model.trim().to_lowercase();
    if !matches!(model.as_str(), "classic" | "slim") {
        return Err("Модель скина: classic или slim".to_string());
    }
    let endpoint = format!("/v1/me/skin?model={model}");
    lavunio_upload_image(state.inner(), path, endpoint).await
}

#[tauri::command]
pub async fn lavunio_delete_skin(state: State<'_, AppState>) -> Result<Value, String> {
    let data = publisher_request(state.inner(), "DELETE", "/v1/me/skin".to_string(), None).await?;
    save_lavunio_account(state.inner(), data)
}

#[tauri::command]
pub async fn lavunio_upload_cape(
    state: State<'_, AppState>,
    path: String,
) -> Result<Value, String> {
    lavunio_upload_image(state.inner(), path, "/v1/me/cape".to_string()).await
}

#[tauri::command]
pub async fn lavunio_delete_cape(state: State<'_, AppState>) -> Result<Value, String> {
    let data = publisher_request(state.inner(), "DELETE", "/v1/me/cape".to_string(), None).await?;
    save_lavunio_account(state.inner(), data)
}

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

    let settings = state.store.lock().unwrap().settings.clone();
    let account = match ensure_game_account(state).await {
        Ok(account) => account,
        Err(error) => {
            crate::logging::error("game", format!("no game account: {error}"));
            return json!({ "ok": false, "error": error });
        }
    };

    let (was_installed, installed_version) = {
        let store = state.store.lock().unwrap();
        store
            .state
            .get(&mode.id)
            .map(|mode_state| (mode_state.installed, mode_state.version.clone()))
            .unwrap_or((false, None))
    };
    let update = was_installed && installed_version.as_deref() != Some(mode.version.as_str());
    let install = !was_installed;
    if install || update {
        report_mode_event(state, &mode.id, "download", &mode.version).await;
        report_mode_event(
            state,
            &mode.id,
            if update { "update" } else { "install" },
            &mode.version,
        )
        .await;
    }

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
