use base64::Engine;

use super::{
    blocking, lavunio_access_token, lavunio_api, lavunio_status_value, load_modes, publisher_request,
    save_lavunio_session,
};
use crate::game;
use crate::models::{GameAccount, LavunioUser};
use crate::net;
use crate::state::AppState;
use crate::util::{now_ms, path_string};
use serde_json::{json, Value};
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

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

async fn refresh_game_token(state: &AppState) -> Result<(String, String, u64), String> {
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
    Ok((access_token, client_token, expires_in))
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
        match refresh_game_token(state).await {
            Ok((access_token, client_token, expires_in)) => {
                session.game_access_token = access_token;
                session.game_client_token = client_token;
                session.game_expires_at = now_ms().saturating_add(expires_in.saturating_mul(1000));
                save_lavunio_session(state, session.clone())?;
            }
            Err(error) => {
                crate::logging::error(
                    "game",
                    format!("game session refresh failed, using offline token: {error}"),
                );
                if session.game_access_token.is_empty() {
                    session.game_access_token = "0".to_string();
                }
            }
        }
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
pub async fn lavunio_set_skin_model(
    state: State<'_, AppState>,
    model: String,
) -> Result<Value, String> {
    let model = model.trim().to_lowercase();
    if !matches!(model.as_str(), "classic" | "slim") {
        return Err("Модель скина: classic или slim".to_string());
    }
    let data = publisher_request(
        state.inner(),
        "PUT",
        "/v1/me/skin/model".to_string(),
        Some(json!({ "model": model })),
    )
    .await?;
    save_lavunio_account(state.inner(), data)
}

#[tauri::command]
pub async fn lavunio_skin_data(state: State<'_, AppState>) -> Result<String, String> {
    let url = {
        let session = state.store.lock().unwrap().lavunio.clone();
        session
            .user
            .and_then(|user| user.skin_url)
            .filter(|value| value.starts_with("http://") || value.starts_with("https://"))
            .ok_or_else(|| "У аккаунта нет скина".to_string())?
    };
    let bytes = blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|error| format!("Не удалось создать HTTP-клиент: {error}"))?;
        let response = client
            .get(&url)
            .send()
            .map_err(|error| format!("Не удалось загрузить скин: {error}"))?;
        if !response.status().is_success() {
            return Err(format!("Сервер скина вернул {}", response.status()));
        }
        response
            .bytes()
            .map(|bytes| bytes.to_vec())
            .map_err(|error| format!("Не удалось прочитать скин: {error}"))
    })
    .await??;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("Файл скина больше 2 МБ".to_string());
    }
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
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

    let (mut settings, previous_install_dir) = {
        let store = state.store.lock().unwrap();
        (
            store.settings.clone(),
            store
                .state
                .get(&mode.id)
                .and_then(|mode_state| mode_state.install_dir.clone()),
        )
    };
    settings.install_base = previous_install_dir.clone();
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
    let install_dir_for_store = settings
        .install_base
        .clone()
        .unwrap_or_else(|| settings.dir.clone());
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
            let _ = store.set_mode_installed(
                &mode_id_for_store,
                &mode_version_for_store,
                Some(&install_dir_for_store),
            );
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
