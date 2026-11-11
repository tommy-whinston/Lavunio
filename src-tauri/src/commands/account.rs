use super::{
    blocking, lavunio_access_token, lavunio_api, lavunio_status_value, parse_lavunio_session,
    publisher_request, save_lavunio_session,
};
use crate::models::{LavunioSession, LavunioUser};
use crate::net;
use crate::state::AppState;
use crate::util::now_ms;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn lavunio_status(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.store.lock().unwrap().lavunio.clone();
    if !session.access_token.is_empty()
        && !session.refresh_token.is_empty()
        && session.access_expires_at <= now_ms().saturating_add(60_000)
    {
        let _ = lavunio_access_token(state.inner()).await;
        let refreshed = state.store.lock().unwrap().lavunio.clone();
        return Ok(lavunio_status_value(
            net::api_base_url().is_some(),
            &refreshed,
        ));
    }
    Ok(lavunio_status_value(
        net::api_base_url().is_some(),
        &session,
    ))
}

#[tauri::command]
pub async fn lavunio_refresh_profile(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.store.lock().unwrap().lavunio.clone();
    if session.access_token.is_empty() {
        return Ok(lavunio_status_value(true, &session));
    }
    let data = publisher_request(state.inner(), "GET", "/v1/me".to_string(), None).await?;
    let user: LavunioUser = serde_json::from_value(data)
        .map_err(|error| format!("Некорректный профиль Lavunio: {error}"))?;
    let mut session = state.store.lock().unwrap().lavunio.clone();
    session.user = Some(user);
    save_lavunio_session(state.inner(), session.clone())?;
    Ok(lavunio_status_value(true, &session))
}

#[tauri::command]
pub async fn lavunio_register(
    state: State<'_, AppState>,
    email: String,
    password: String,
    username: Option<String>,
    display_name: Option<String>,
    accept_terms: Option<bool>,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let payload = json!({
        "email": email,
        "password": password,
        "username": username,
        "displayName": display_name,
        "acceptTerms": accept_terms.unwrap_or(true),
    });
    let data = blocking(move || {
        net::api_request_json(&api, "POST", "/v1/auth/register", None, Some(payload))
    })
    .await??;

    let Some(code) = data
        .get("verificationToken")
        .and_then(Value::as_str)
        .map(str::to_string)
    else {
        return Ok(data);
    };
    let email = data
        .get("email")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let api = lavunio_api()?;
    let verified = blocking(move || {
        net::api_request_json(
            &api,
            "POST",
            "/v1/auth/register/verify",
            None,
            Some(json!({ "email": email, "code": code })),
        )
    })
    .await??;

    let session = parse_lavunio_session(&verified)?;
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

    if data
        .get("requiresCode")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || data
            .get("requiresVerification")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    {
        return Ok(data);
    }
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
pub async fn lavunio_verify_login(
    state: State<'_, AppState>,
    challenge_id: String,
    code: String,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let payload = json!({ "challengeId": challenge_id, "code": code });
    let data = blocking(move || {
        net::api_request_json(&api, "POST", "/v1/auth/login/verify", None, Some(payload))
    })
    .await??;

    let session = parse_lavunio_session(&data)?;
    save_lavunio_session(state.inner(), session.clone())?;
    crate::logging::log(format!(
        "lavunio: logged in from new place {}",
        session
            .user
            .as_ref()
            .map(|user| user.username.as_str())
            .unwrap_or("?")
    ));
    Ok(lavunio_status_value(true, &session))
}

#[tauri::command]
pub async fn lavunio_verify_registration(
    state: State<'_, AppState>,
    email: String,
    code: String,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let payload = json!({ "email": email, "code": code });
    let data = blocking(move || {
        net::api_request_json(
            &api,
            "POST",
            "/v1/auth/register/verify",
            None,
            Some(payload),
        )
    })
    .await??;

    let session = parse_lavunio_session(&data)?;
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
pub async fn lavunio_resend_registration(email: String) -> Result<Value, String> {
    let api = lavunio_api()?;
    let payload = json!({ "email": email });
    blocking(move || {
        net::api_request_json(
            &api,
            "POST",
            "/v1/auth/register/resend",
            None,
            Some(payload),
        )
    })
    .await?
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

#[tauri::command]
pub async fn lavunio_verify_email(
    state: State<'_, AppState>,
    code: String,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let payload = json!({ "token": code });
    blocking(move || {
        net::api_request_json(&api, "POST", "/v1/auth/verify-email", None, Some(payload))
    })
    .await??;

    let mut session = state.store.lock().unwrap().lavunio.clone();
    if let Some(user) = session.user.as_mut() {
        user.email_verified = true;
    }
    save_lavunio_session(state.inner(), session.clone())?;
    crate::logging::log("lavunio: email verified");
    Ok(lavunio_status_value(true, &session))
}
