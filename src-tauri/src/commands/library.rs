use super::blocking;
use crate::game;
use crate::models::{ModeState, PlaySession};
use crate::state::AppState;
use crate::util::{now_ms, open_path};
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub fn game_uninstall(state: State<'_, AppState>, mode_id: String) -> Value {
    if state.active_game.lock().unwrap().is_some() {
        return json!({ "ok": false, "error": "Сначала закрой игру" });
    }
    let settings = state.store.lock().unwrap().settings.clone();
    let mut settings = settings;
    settings.install_base = state
        .store
        .lock()
        .unwrap()
        .state
        .get(&mode_id)
        .and_then(|mode_state| mode_state.install_dir.clone());
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
    let mut settings = settings;
    settings.install_base = state
        .store
        .lock()
        .unwrap()
        .state
        .get(&mode_id)
        .and_then(|mode_state| mode_state.install_dir.clone());
    blocking(move || game::verify_files(&settings, &mode_id)).await?
}

#[tauri::command]
pub fn game_prepare_repair(state: State<'_, AppState>, mode_id: String) -> Result<Value, String> {
    let settings = state.store.lock().unwrap().settings.clone();
    let mut settings = settings;
    settings.install_base = state
        .store
        .lock()
        .unwrap()
        .state
        .get(&mode_id)
        .and_then(|mode_state| mode_state.install_dir.clone());
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
pub fn game_set_hidden(state: State<'_, AppState>, mode_id: String, hidden: bool) -> Value {
    let mut store = state.store.lock().unwrap();
    match store.set_mode_hidden(&mode_id, hidden) {
        Ok(()) => json!({ "ok": true }),
        Err(err) => json!({ "ok": false, "error": err }),
    }
}

#[tauri::command]
pub fn game_skip_update(
    state: State<'_, AppState>,
    mode_id: String,
    version: Option<String>,
) -> Value {
    let mut store = state.store.lock().unwrap();
    let mode_state = store
        .state
        .entry(mode_id)
        .or_insert_with(ModeState::default);
    mode_state.skipped_version = version.filter(|value| !value.trim().is_empty());
    match store.save_state() {
        Ok(()) => json!({ "ok": true }),
        Err(err) => json!({ "ok": false, "error": err }),
    }
}

#[tauri::command]
pub fn game_mark_launched(state: State<'_, AppState>, mode_id: String) -> Value {
    let mut store = state.store.lock().unwrap();
    let mode_state = store.state.entry(mode_id).or_insert_with(Default::default);
    mode_state.last_played_at = now_ms();
    let last_played_at = mode_state.last_played_at;
    match store.save_state() {
        Ok(()) => json!({ "ok": true, "lastPlayedAt": last_played_at }),
        Err(err) => json!({ "ok": false, "error": err }),
    }
}

#[tauri::command]
pub fn game_add_playtime(
    state: State<'_, AppState>,
    mode_id: String,
    seconds: u64,
    started_at: Option<u64>,
) -> Value {
    let mut store = state.store.lock().unwrap();
    let mode_state = store.state.entry(mode_id).or_insert_with(Default::default);
    mode_state.playtime_secs = mode_state.playtime_secs.saturating_add(seconds);
    let ended_at = now_ms();
    if seconds > 0 {
        mode_state.sessions.push(PlaySession {
            started_at: started_at
                .unwrap_or_else(|| ended_at.saturating_sub(seconds.saturating_mul(1000))),
            ended_at,
            seconds,
        });
        if mode_state.sessions.len() > 20 {
            mode_state.sessions.remove(0);
        }
    }
    mode_state.last_played_at = ended_at;
    let response = json!({
        "ok": true,
        "playtimeSecs": mode_state.playtime_secs,
        "lastPlayedAt": mode_state.last_played_at,
        "sessions": &mode_state.sessions,
    });
    match store.save_state() {
        Ok(()) => response,
        Err(err) => json!({ "ok": false, "error": err }),
    }
}

#[tauri::command]
pub fn game_open_mode_folder(state: State<'_, AppState>, mode_id: String) -> Result<(), String> {
    if mode_id.is_empty() || mode_id == ".." || mode_id.contains('/') || mode_id.contains('\\') {
        return Err("Некорректный режим".to_string());
    }
    let (settings, install_dir) = {
        let store = state.store.lock().unwrap();
        (
            store.settings.clone(),
            store
                .state
                .get(&mode_id)
                .and_then(|mode_state| mode_state.install_dir.clone()),
        )
    };
    let base = std::path::Path::new(install_dir.as_deref().unwrap_or(&settings.dir));
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
