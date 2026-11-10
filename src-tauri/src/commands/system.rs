use super::{blocking, load_modes};
use crate::models::{Mode, Settings};
use crate::net;
use crate::state::AppState;
use crate::util::{open_path, open_url, path_string};
use serde_json::{json, Value};
use tauri::State;

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

fn directory_size(path: &std::path::Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    let mut total = 0u64;
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.is_dir() {
            total = total.saturating_add(directory_size(&entry.path()));
        } else if meta.is_file() {
            total = total.saturating_add(meta.len());
        }
    }
    total
}

#[tauri::command]
pub fn disk_info(state: State<'_, AppState>, path: Option<String>) -> Value {
    let store = state.store.lock().unwrap();
    let target = path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| store.settings.dir.clone());
    let normalized = target
        .trim_start_matches("\\\\?\\")
        .to_lowercase();
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk = disks
        .iter()
        .filter(|disk| {
            let mount = disk.mount_point().to_string_lossy().to_lowercase();
            !mount.is_empty() && normalized.starts_with(&mount)
        })
        .max_by_key(|disk| disk.mount_point().as_os_str().len());
    let (total_bytes, available_bytes) = disk
        .map(|disk| (disk.total_space(), disk.available_space()))
        .unwrap_or((0, 0));

    let mut library_bytes = 0u64;
    for (mode_id, mode_state) in &store.state {
        if !mode_state.installed {
            continue;
        }
        let base = mode_state
            .install_dir
            .as_deref()
            .unwrap_or(&store.settings.dir);
        let current = std::path::Path::new(base).join("games").join(mode_id);
        let legacy = std::path::Path::new(base).join(mode_id);
        let dir = if current.is_dir() { current } else { legacy };
        if dir.is_dir() {
            library_bytes = library_bytes.saturating_add(directory_size(&dir));
        }
    }

    json!({
        "path": target,
        "totalBytes": total_bytes,
        "availableBytes": available_bytes,
        "libraryBytes": library_bytes,
    })
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
    store.settings.remember_install_dir();
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

