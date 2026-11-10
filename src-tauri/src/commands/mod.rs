mod account;
mod content;
mod game;
mod library;
mod publisher;
mod social;
mod system;
mod window;

pub use account::*;
pub use content::*;
pub use game::*;
pub use library::*;
pub use publisher::*;
pub use social::*;
pub use system::*;
pub use window::*;

use crate::models::{GameAccount, LavunioSession, LavunioUser, Mode, ModeState, PlaySession, Settings};
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

pub(crate) async fn blocking<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("Ошибка выполнения: {e}"))
}

pub(crate) async fn load_modes(state: &AppState) -> Vec<Mode> {
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
