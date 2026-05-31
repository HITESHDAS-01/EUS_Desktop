use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub photos_dir: PathBuf,
    pub logged_in: Mutex<bool>,
}
