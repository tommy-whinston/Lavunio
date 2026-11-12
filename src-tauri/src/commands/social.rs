use super::{blocking, lavunio_api, publisher_request};
use crate::net;
use crate::state::AppState;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn teams_mine(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(state.inner(), "GET", "/v1/me/teams".to_string(), None).await
}

#[tauri::command]
pub async fn teams_list(
    state: State<'_, AppState>,
    query: Option<String>,
    sort: Option<String>,
    filter: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let session = state.store.lock().unwrap().lavunio.clone();
    let offset = offset.unwrap_or(0).max(0);
    let limit = limit.unwrap_or(24).clamp(1, 60);
    let q = query.unwrap_or_default();
    let sort = sort.unwrap_or_else(|| "popular".to_string());
    let filter = filter.unwrap_or_else(|| "all".to_string());
    let path = format!(
        "/v1/teams?q={}&sort={}&filter={}&offset={}&limit={}",
        urlencode(&q),
        urlencode(&sort),
        urlencode(&filter),
        offset,
        limit
    );
    blocking(move || {
        let token = if session.access_token.is_empty() {
            None
        } else {
            Some(session.access_token.as_str())
        };
        net::api_request_json(&api, "GET", &path, token, None)
    })
    .await?
}

fn urlencode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            b' ' => "%20".to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

#[tauri::command]
pub async fn team_create(state: State<'_, AppState>, payload: Value) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "POST",
        "/v1/teams".to_string(),
        Some(payload),
    )
    .await
}

#[tauri::command]
pub async fn team_update(
    state: State<'_, AppState>,
    team_id: String,
    payload: Value,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}");
    publisher_request(state.inner(), "PUT", path, Some(payload)).await
}

#[tauri::command]
pub async fn team_archive(state: State<'_, AppState>, team_id: String) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn team_profile(state: State<'_, AppState>, slug: String) -> Result<Value, String> {
    let path = format!("/v1/teams/{slug}");
    publisher_request(state.inner(), "GET", path, None).await
}

#[tauri::command]
pub async fn team_profile_public(
    state: State<'_, AppState>,
    slug: String,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let session = state.store.lock().unwrap().lavunio.clone();
    let path = format!("/v1/teams/{slug}");
    blocking(move || {
        let token = if session.access_token.is_empty() {
            None
        } else {
            Some(session.access_token.as_str())
        };
        net::api_request_json(&api, "GET", &path, token, None)
    })
    .await?
}

#[tauri::command]
pub async fn player_profile(username: String) -> Result<Value, String> {
    let api = lavunio_api()?;
    let path = format!("/v1/users/{username}");
    blocking(move || net::api_request_json(&api, "GET", &path, None, None)).await?
}

#[tauri::command]
pub async fn player_posts(
    username: String,
    offset: Option<i64>,
    limit: Option<i64>,
) -> Result<Value, String> {
    let api = lavunio_api()?;
    let offset = offset.unwrap_or(0).max(0);
    let limit = limit.unwrap_or(20).clamp(1, 50);
    let path = format!("/v1/users/{username}/posts?offset={offset}&limit={limit}");
    blocking(move || net::api_request_json(&api, "GET", &path, None, None)).await?
}

#[tauri::command]
pub async fn profile_post_create(
    state: State<'_, AppState>,
    body: String,
) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "POST",
        "/v1/me/posts".to_string(),
        Some(json!({ "body": body })),
    )
    .await
}

#[tauri::command]
pub async fn profile_post_delete(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    let path = format!("/v1/me/posts/{id}");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn player_update_profile(
    state: State<'_, AppState>,
    username: String,
    display_name: String,
    bio: String,
) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "PUT",
        "/v1/me/profile".to_string(),
        Some(json!({ "username": username, "displayName": display_name, "bio": bio })),
    )
    .await
}

#[tauri::command]
pub async fn presence_heartbeat(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(state.inner(), "POST", "/v1/me/presence".to_string(), None).await
}

#[tauri::command]
pub async fn friends_list(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(state.inner(), "GET", "/v1/me/friends".to_string(), None).await
}

#[tauri::command]
pub async fn friend_requests(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/me/friend-requests".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn friend_add(state: State<'_, AppState>, username: String) -> Result<Value, String> {
    let path = format!("/v1/me/friends/{username}");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn friend_remove(state: State<'_, AppState>, username: String) -> Result<Value, String> {
    let path = format!("/v1/me/friends/{username}");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn friend_respond(
    state: State<'_, AppState>,
    request_id: String,
    action: String,
) -> Result<Value, String> {
    let path = format!("/v1/me/friend-requests/{request_id}/{action}");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn notifications_list(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/me/notifications".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn notifications_read(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "POST",
        "/v1/me/notifications".to_string(),
        Some(json!({ "ids": ids })),
    )
    .await
}

#[tauri::command]
pub async fn activity_feed() -> Result<Value, String> {
    let api = lavunio_api()?;
    blocking(move || net::api_request_json(&api, "GET", "/v1/feed?limit=30", None, None)).await?
}

#[tauri::command]
pub async fn chat_direct(state: State<'_, AppState>, username: String) -> Result<Value, String> {
    let path = format!("/v1/chat/direct/{username}");
    publisher_request(state.inner(), "GET", path, None).await
}

#[tauri::command]
pub async fn chat_send_direct(
    state: State<'_, AppState>,
    username: String,
    body: String,
) -> Result<Value, String> {
    let path = format!("/v1/chat/direct/{username}");
    publisher_request(state.inner(), "POST", path, Some(json!({ "body": body }))).await
}

#[tauri::command]
pub async fn chat_team(state: State<'_, AppState>, team_id: String) -> Result<Value, String> {
    let path = format!("/v1/chat/teams/{team_id}");
    publisher_request(state.inner(), "GET", path, None).await
}

#[tauri::command]
pub async fn chat_send_team(
    state: State<'_, AppState>,
    team_id: String,
    body: String,
) -> Result<Value, String> {
    let path = format!("/v1/chat/teams/{team_id}");
    publisher_request(state.inner(), "POST", path, Some(json!({ "body": body }))).await
}

#[tauri::command]
pub async fn team_invitations(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/me/team-invitations".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn team_invite(
    state: State<'_, AppState>,
    team_id: String,
    username: String,
    role: String,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/invitations");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "username": username, "role": role })),
    )
    .await
}

#[tauri::command]
pub async fn team_invitation_accept(
    state: State<'_, AppState>,
    invitation_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/me/team-invitations/{invitation_id}/accept");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn team_invitation_decline(
    state: State<'_, AppState>,
    invitation_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/me/team-invitations/{invitation_id}/decline");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn team_member_role(
    state: State<'_, AppState>,
    team_id: String,
    user_id: String,
    role: String,
    permissions: Option<Value>,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/members/{user_id}");
    publisher_request(
        state.inner(),
        "PUT",
        path,
        Some(json!({ "role": role, "permissions": permissions })),
    )
    .await
}

#[tauri::command]
pub async fn team_member_remove(
    state: State<'_, AppState>,
    team_id: String,
    user_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/members/{user_id}");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn team_join(
    state: State<'_, AppState>,
    team_id: String,
    message: String,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/join-requests");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "message": message })),
    )
    .await
}

#[tauri::command]
pub async fn team_join_requests(
    state: State<'_, AppState>,
    team_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/join-requests");
    publisher_request(state.inner(), "GET", path, None).await
}

#[tauri::command]
pub async fn team_resolve_join_request(
    state: State<'_, AppState>,
    team_id: String,
    request_id: String,
    action: String,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/join-requests/{request_id}/resolve");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "action": action })),
    )
    .await
}

#[tauri::command]
pub async fn team_transfer(
    state: State<'_, AppState>,
    team_id: String,
    username: String,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/transfer");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "username": username })),
    )
    .await
}

#[tauri::command]
pub async fn team_follow(state: State<'_, AppState>, team_id: String) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/follow");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn team_unfollow(state: State<'_, AppState>, team_id: String) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/follow");
    publisher_request(state.inner(), "DELETE", path, None).await
}

#[tauri::command]
pub async fn team_create_news(
    state: State<'_, AppState>,
    team_id: String,
    title: String,
    body: String,
) -> Result<Value, String> {
    let path = format!("/v1/teams/{team_id}/news");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "title": title, "body": body })),
    )
    .await
}

#[tauri::command]
pub async fn team_verify(
    state: State<'_, AppState>,
    team_id: String,
    verified: bool,
) -> Result<Value, String> {
    let path = format!("/v1/admin/teams/{team_id}/verify");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "verified": verified })),
    )
    .await
}
