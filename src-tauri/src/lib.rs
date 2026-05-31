mod auth;
mod commands;
mod db;
mod error;
mod state;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            std::fs::create_dir_all(app_data_dir.join("photos")).ok();

            let db_path = app_data_dir.join("eus.db");
            let conn = db::open_and_migrate(&db_path)
                .expect("failed to open/migrate database");

            app.manage(state::AppState {
                db: Mutex::new(conn),
                photos_dir: app_data_dir.join("photos"),
                logged_in: Mutex::new(false),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::is_first_run,
            commands::setup_admin,
            commands::login,
            commands::logout,
            commands::is_logged_in,
            commands::get_setting,
            commands::set_setting,
            commands::list_members,
            commands::get_member,
            commands::create_member,
            commands::update_member,
            commands::delete_member,
            commands::bulk_delete_members,
            commands::save_member_photo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
