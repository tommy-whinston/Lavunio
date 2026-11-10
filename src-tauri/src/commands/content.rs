use super::{blocking, lavunio_api, publisher_request};
use crate::net;
use crate::state::AppState;
use serde_json::{json, Value};
use tauri::State;

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
pub async fn admin_appeals(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/admin/appeals".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn admin_resolve_appeal(
    state: State<'_, AppState>,
    appeal_id: String,
    action: String,
    note: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/appeals/{appeal_id}/resolve");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "action": action, "note": note })),
    )
    .await
}

#[tauri::command]
pub async fn author_application_status(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/me/author-application".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn author_application_apply(
    state: State<'_, AppState>,
    message: String,
    links: String,
) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "POST",
        "/v1/me/author-application".to_string(),
        Some(json!({ "message": message, "links": links })),
    )
    .await
}

#[tauri::command]
pub async fn admin_author_applications(state: State<'_, AppState>) -> Result<Value, String> {
    publisher_request(
        state.inner(),
        "GET",
        "/v1/admin/author-applications".to_string(),
        None,
    )
    .await
}

#[tauri::command]
pub async fn admin_approve_author_application(
    state: State<'_, AppState>,
    application_id: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/author-applications/{application_id}/approve");
    publisher_request(state.inner(), "POST", path, None).await
}

#[tauri::command]
pub async fn admin_reject_author_application(
    state: State<'_, AppState>,
    application_id: String,
    note: String,
) -> Result<Value, String> {
    let path = format!("/v1/admin/author-applications/{application_id}/reject");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "note": note })),
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
