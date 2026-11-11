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
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let lang = app
        .state::<AppState>()
        .store
        .lock()
        .unwrap()
        .settings
        .lang
        .clone();
    let (show_label, quit_label) = if lang == "en" {
        ("Open Lavunio", "Quit")
    } else {
        ("Открыть Lavunio", "Выход")
    };
    let show_item = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    let Some(icon) = app.default_window_icon().cloned() else {
        return Ok(());
    };

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Lavunio")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "quit" => {
                if let Some(window) = app.get_webview_window("main") {
                    commands::save_window_size_for_event(&window, app);
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        show_main(app);
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    logging::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::win_minimize,
            commands::win_toggle_maximize,
            commands::win_toggle_fullscreen,
            commands::win_is_visible,
            commands::win_hide,
            commands::win_close,
            commands::win_splash,
            commands::win_ready,
            commands::modes_get,
            commands::modes_cached,
            commands::modes_refresh,
            commands::modes_search,
            commands::collections_get,
            commands::state_get,
            commands::system_ram_gb,
            commands::disk_info,
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
            commands::lavunio_refresh_profile,
            commands::lavunio_register,
            commands::lavunio_login,
            commands::lavunio_verify_login,
            commands::lavunio_logout,
            commands::lavunio_resend_verification,
            commands::lavunio_verify_email,
            commands::lavunio_game_session,
            commands::lavunio_pick_skin,
            commands::lavunio_upload_skin,
            commands::lavunio_delete_skin,
            commands::publisher_my_modes,
            commands::publisher_create_mode,
            commands::publisher_create_release,
            commands::publisher_submit,
            commands::publisher_pick_folder,
            commands::publisher_pick_archive,
            commands::publisher_pick_cover,
            commands::publisher_upload_cover,
            commands::publisher_delete_cover,
            commands::publisher_pick_screenshot,
            commands::publisher_upload_screenshot,
            commands::publisher_upload_build,
            commands::admin_queue,
            commands::publisher_appeal_release,
            commands::admin_appeals,
            commands::admin_resolve_appeal,
            commands::author_application_status,
            commands::author_application_apply,
            commands::admin_author_applications,
            commands::admin_approve_author_application,
            commands::admin_reject_author_application,
            commands::teams_mine,
            commands::team_create,
            commands::team_update,
            commands::team_archive,
            commands::team_profile,
            commands::team_profile_public,
            commands::player_profile,
            commands::player_update_profile,
            commands::presence_heartbeat,
            commands::friends_list,
            commands::friend_requests,
            commands::friend_add,
            commands::friend_remove,
            commands::friend_respond,
            commands::notifications_list,
            commands::notifications_read,
            commands::activity_feed,
            commands::chat_direct,
            commands::chat_send_direct,
            commands::chat_team,
            commands::chat_send_team,
            commands::team_invitations,
            commands::team_invite,
            commands::team_invitation_accept,
            commands::team_invitation_decline,
            commands::team_member_role,
            commands::team_member_remove,
            commands::team_join,
            commands::team_join_requests,
            commands::team_resolve_join_request,
            commands::team_transfer,
            commands::team_follow,
            commands::team_unfollow,
            commands::team_create_news,
            commands::team_verify,
            commands::admin_modes,
            commands::admin_history,
            commands::admin_approve,
            commands::admin_reject,
            commands::admin_hide_mode,
            commands::admin_unhide_mode,
            commands::wishlist_get,
            commands::wishlist_add,
            commands::wishlist_remove,
            commands::reviews_get,
            commands::review_submit,
            commands::review_delete,
            commands::report_mode,
            commands::follows_get,
            commands::follow_author,
            commands::unfollow_author,
            commands::feed_get,
            commands::news_store,
            commands::news_mode,
            commands::news_create_store,
            commands::news_create_mode,
            commands::admin_reviews,
            commands::admin_approve_review,
            commands::admin_reject_review,
            commands::review_reply,
            commands::admin_collections,
            commands::admin_create_collection,
            commands::admin_delete_collection,
            commands::admin_reports,
            commands::admin_close_report,
            commands::game_install,
            commands::game_play,
            commands::game_cancel,
            commands::game_uninstall,
            commands::game_verify,
            commands::game_prepare_repair,
            commands::game_set_library,
            commands::game_set_hidden,
            commands::game_skip_update,
            commands::game_add_playtime,
            commands::game_mark_launched,
            commands::game_open_mode_folder,
            update::check_update,
            update::install_update,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(win) = app_handle.get_webview_window("main") {
                            commands::save_window_size_for_event(&win, &app_handle);
                            let _ = win.hide();
                        }
                    }
                });
            }
            setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
