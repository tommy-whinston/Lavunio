use super::{blocking, lavunio_access_token, lavunio_api, publisher_request};
use crate::net;
use crate::publisher as build_publisher;
use crate::state::AppState;
use crate::util::path_string;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

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
pub async fn publisher_appeal_release(
    state: State<'_, AppState>,
    release_id: String,
    message: String,
) -> Result<Value, String> {
    let path = format!("/v1/publisher/releases/{release_id}/appeal");
    publisher_request(
        state.inner(),
        "POST",
        path,
        Some(json!({ "message": message })),
    )
    .await
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
