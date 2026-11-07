#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod events;
mod game;
mod logging;
mod models;
mod net;
mod publisher;
mod state;
mod store;
mod update;
mod util;

use state::AppState;
use tauri::Manager;

fn main() {
    logging::init();
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::win_minimize,
            commands::win_close,
            commands::win_splash,
            commands::win_ready,
            commands::modes_get,
            commands::modes_cached,
            commands::modes_refresh,
            commands::state_get,
            commands::system_ram_gb,
            commands::settings_get,
            commands::settings_save,
            commands::settings_choose_dir,
            commands::shell_open,
            commands::game_open_folder,
            commands::app_data_path,
            commands::app_open_folder,
            commands::app_logs_path,
            commands::app_open_logs,
            commands::lavunio_status,
            commands::lavunio_register,
            commands::lavunio_login,
            commands::lavunio_logout,
            commands::lavunio_resend_verification,
            commands::lavunio_game_session,
            commands::lavunio_pick_skin,
            commands::lavunio_upload_skin,
            commands::lavunio_delete_skin,
            commands::lavunio_pick_cape,
            commands::lavunio_upload_cape,
            commands::lavunio_delete_cape,
            commands::publisher_my_modes,
            commands::publisher_create_mode,
            commands::publisher_create_release,
            commands::publisher_submit,
            commands::publisher_pick_folder,
            commands::publisher_pick_archive,
            commands::publisher_upload_build,
            commands::game_install,
            commands::game_play,
            commands::game_cancel,
            commands::game_uninstall,
            commands::game_set_library,
            commands::game_add_playtime,
            commands::game_open_mode_folder,
            update::check_update,
            update::download_update,
            update::install_update,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        if let Some(win) = app_handle.get_webview_window("main") {
                            commands::save_window_size_for_event(&win, &app_handle);
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
