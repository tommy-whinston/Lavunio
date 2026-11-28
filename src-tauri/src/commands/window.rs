use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager, State, Window};

fn save_window_size(window: &Window, state: &AppState) {
    if window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
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
pub fn win_toggle_maximize(window: Window) -> Result<bool, String> {
    let maximized = window.is_maximized().unwrap_or(false);
    if maximized {
        window.unmaximize().map_err(|e| e.to_string())?;
    } else {
        window.maximize().map_err(|e| e.to_string())?;
    }
    Ok(!maximized)
}

#[tauri::command]
pub fn win_toggle_fullscreen(window: Window) -> Result<bool, String> {
    let fullscreen = window.is_fullscreen().unwrap_or(false);
    window
        .set_fullscreen(!fullscreen)
        .map_err(|e| e.to_string())?;
    Ok(!fullscreen)
}

#[tauri::command]
pub fn win_is_visible(window: Window) -> bool {
    window.is_visible().unwrap_or(false)
}

#[tauri::command]
pub fn win_hide(window: Window, state: State<'_, AppState>) -> Result<(), String> {
    save_window_size(&window, state.inner());
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn win_close(app: AppHandle, window: Window, state: State<'_, AppState>) -> Result<(), String> {
    save_window_size(&window, state.inner());
    app.exit(0);
    Ok(())
}

// ---------------------------------------------------------------- трей-меню

#[tauri::command]
pub fn tray_hide(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/* Действия из кастомного меню трея. Окно меню прячем всегда: размеры
   основного окна сохраняем только для main, чтобы трей-меню их не затирало. */
#[tauri::command]
pub fn tray_action(app: AppHandle, window: Window, action: String) -> Result<(), String> {
    let _ = window.hide();
    match action.as_str() {
        "show" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }
        "hide" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
        "updates" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("lavunio:tray-updates", ());
        }
        "quit" => {
            if let Some(w) = app.get_webview_window("main") {
                save_window_size_for_event(&w, &app);
            }
            app.exit(0);
        }
        _ => {}
    }
    Ok(())
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
pub fn win_ready(window: Window, state: State<'_, AppState>) -> Result<(), String> {
    let (saved_width, saved_height) = {
        let store = state.store.lock().unwrap();
        (
            store.settings.launcher_width,
            store.settings.launcher_height,
        )
    };
    let width = saved_width.clamp(980.0, 3840.0);
    let height = saved_height.clamp(640.0, 2160.0);
    let minimized = window.is_minimized().unwrap_or(false);
    let visible = window.is_visible().unwrap_or(true);
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(980.0, 640.0)))
        .map_err(|e| e.to_string())?;
    window.set_resizable(true).map_err(|e| e.to_string())?;
    window.set_maximizable(true).map_err(|e| e.to_string())?;
    if !minimized && visible {
        window.center().map_err(|e| e.to_string())?;
        let _ = window.set_focus();
    }
    Ok(())
}

pub fn save_window_size_for_event(window: &tauri::WebviewWindow, app: &AppHandle) {
    if window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
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
