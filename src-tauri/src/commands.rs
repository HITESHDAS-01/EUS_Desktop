use crate::auth;
use crate::db;
use crate::error::{msg, AppError, AppResult};
use crate::state::AppState;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

// ===========================================================================
// Types — DTOs returned to the React layer
// ===========================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemberProfile {
    pub full_name: Option<String>,
    pub phone: Option<String>,
    pub photo_url: Option<String>,
    pub address: Option<String>,
    pub father_husband_name: Option<String>,
    pub gender: Option<String>,
    pub date_of_birth: Option<String>,
    pub aadhaar_vid: Option<String>,
    pub nominee_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemberRow {
    pub id: String,
    pub member_code: Option<String>,
    pub category: String,
    pub status: String,
    pub join_date: String,
    pub initial_investment: Option<f64>,
    pub monthly_installment: Option<f64>,
    pub chosen_term_months: Option<i64>,
    pub profiles: Option<MemberProfile>,
}

#[derive(Debug, Deserialize)]
pub struct MemberInput {
    pub member_code: Option<String>,
    pub full_name: String,
    pub phone: Option<String>,
    pub photo_url: Option<String>,
    pub address: Option<String>,
    pub father_husband_name: Option<String>,
    pub gender: Option<String>,
    pub date_of_birth: Option<String>,
    pub aadhaar_vid: Option<String>,
    pub nominee_name: Option<String>,
    pub category: String,
    pub status: Option<String>,
    pub join_date: String,
    pub initial_investment: f64,
    pub monthly_installment: Option<f64>,
    pub chosen_term_months: Option<i64>,
}

// ===========================================================================
// Helpers
// ===========================================================================

fn require_login(state: &AppState) -> AppResult<()> {
    let logged = *state.logged_in.lock().unwrap();
    if !logged {
        return Err(msg("Not logged in"));
    }
    Ok(())
}

fn empty_to_none(s: Option<String>) -> Option<String> {
    s.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

// ===========================================================================
// Auth commands
// ===========================================================================

#[tauri::command]
pub fn is_first_run(state: State<'_, AppState>) -> AppResult<bool> {
    let conn = state.db.lock().unwrap();
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM admin_account", [], |r| r.get(0))?;
    Ok(count == 0)
}

#[tauri::command]
pub fn setup_admin(
    state: State<'_, AppState>,
    full_name: String,
    password: String,
) -> AppResult<()> {
    if password.len() < 6 {
        return Err(msg("Password must be at least 6 characters."));
    }
    let conn = state.db.lock().unwrap();
    let exists: i64 = conn.query_row("SELECT COUNT(*) FROM admin_account", [], |r| r.get(0))?;
    if exists > 0 {
        return Err(msg("Admin already exists. Use change-password instead."));
    }
    let hash = auth::hash_password(&password)?;
    conn.execute(
        "INSERT INTO admin_account (id, full_name, password_hash) VALUES (1, ?1, ?2)",
        params![full_name, hash],
    )?;
    drop(conn);
    *state.logged_in.lock().unwrap() = true;
    Ok(())
}

#[tauri::command]
pub fn login(state: State<'_, AppState>, password: String) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    let stored: Option<String> = conn
        .query_row("SELECT password_hash FROM admin_account WHERE id = 1", [], |r| {
            r.get(0)
        })
        .optional()?;
    let Some(hash) = stored else {
        return Err(msg("No admin account exists yet."));
    };
    drop(conn);
    let ok = auth::verify_password(&password, &hash)?;
    if !ok {
        return Err(msg("Incorrect password."));
    }
    *state.logged_in.lock().unwrap() = true;
    Ok(())
}

#[tauri::command]
pub fn logout(state: State<'_, AppState>) -> AppResult<()> {
    *state.logged_in.lock().unwrap() = false;
    Ok(())
}

#[tauri::command]
pub fn is_logged_in(state: State<'_, AppState>) -> AppResult<bool> {
    Ok(*state.logged_in.lock().unwrap())
}

// ===========================================================================
// Settings commands
// ===========================================================================

#[tauri::command]
pub fn get_setting(
    state: State<'_, AppState>,
    table: String,
    key: String,
) -> AppResult<Option<String>> {
    let conn = state.db.lock().unwrap();
    let sql = match table.as_str() {
        "settings" => "SELECT value FROM settings WHERE key = ?1",
        "app_text_settings" => "SELECT value FROM app_text_settings WHERE key = ?1",
        _ => return Err(msg("Unknown settings table")),
    };
    let v: Option<String> = conn.query_row(sql, params![key], |r| r.get(0)).optional()?;
    Ok(v)
}

#[tauri::command]
pub fn set_setting(
    state: State<'_, AppState>,
    table: String,
    key: String,
    value: String,
) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let sql = match table.as_str() {
        "settings" => {
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        }
        "app_text_settings" => {
            "INSERT INTO app_text_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        }
        _ => return Err(msg("Unknown settings table")),
    };
    conn.execute(sql, params![key, value])?;
    Ok(())
}

// ===========================================================================
// Members commands
// ===========================================================================

fn row_to_member(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemberRow> {
    let profile = MemberProfile {
        full_name: row.get(9)?,
        phone: row.get(10)?,
        photo_url: row.get(11)?,
        address: row.get(12)?,
        father_husband_name: row.get(13)?,
        gender: row.get(14)?,
        date_of_birth: row.get(15)?,
        aadhaar_vid: row.get(16)?,
        nominee_name: row.get(17)?,
    };
    Ok(MemberRow {
        id: row.get(0)?,
        member_code: row.get(1)?,
        category: row.get(2)?,
        status: row.get(3)?,
        join_date: row.get(4)?,
        initial_investment: row.get(5)?,
        monthly_installment: row.get(6)?,
        chosen_term_months: row.get(7)?,
        // index 8 reserved (member.created_at, currently unused in DTO)
        profiles: Some(profile),
    })
}

const MEMBER_SELECT_SQL: &str = "
SELECT m.id, m.member_code, m.category, m.status, m.join_date,
       m.initial_investment, m.monthly_installment, m.chosen_term_months,
       m.created_at,
       p.full_name, p.phone, p.photo_url, p.address, p.father_husband_name,
       p.gender, p.date_of_birth, p.aadhaar_vid, p.nominee_name
FROM members m
LEFT JOIN profiles p ON p.id = m.id
";

#[tauri::command]
pub fn list_members(state: State<'_, AppState>) -> AppResult<Vec<MemberRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        &format!("{} ORDER BY m.join_date DESC, m.member_code DESC", MEMBER_SELECT_SQL),
    )?;
    let rows = stmt.query_map([], row_to_member)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
pub fn get_member(state: State<'_, AppState>, id: String) -> AppResult<Option<MemberRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!("{} WHERE m.id = ?1", MEMBER_SELECT_SQL))?;
    let r = stmt.query_row(params![id], row_to_member).optional()?;
    Ok(r)
}

#[tauri::command]
pub fn create_member(
    state: State<'_, AppState>,
    input: MemberInput,
) -> AppResult<MemberRow> {
    require_login(&state)?;
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO profiles (
            id, full_name, phone, photo_url, address, father_husband_name,
            gender, date_of_birth, aadhaar_vid, nominee_name, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
        params![
            id,
            input.full_name,
            empty_to_none(input.phone.clone()),
            empty_to_none(input.photo_url.clone()),
            empty_to_none(input.address.clone()),
            empty_to_none(input.father_husband_name.clone()),
            empty_to_none(input.gender.clone()),
            empty_to_none(input.date_of_birth.clone()),
            empty_to_none(input.aadhaar_vid.clone()),
            empty_to_none(input.nominee_name.clone()),
            now,
        ],
    )?;

    let final_code = match empty_to_none(input.member_code.clone()) {
        Some(c) => c,
        None => db::generate_member_code(&tx, &input.category, &input.join_date)?,
    };

    tx.execute(
        "INSERT INTO members (
            id, member_code, category, status, join_date,
            initial_investment, monthly_installment, chosen_term_months
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            final_code,
            input.category,
            input.status.unwrap_or_else(|| "active".to_string()),
            input.join_date,
            input.initial_investment,
            input.monthly_installment,
            input.chosen_term_months,
        ],
    )?;

    tx.commit()?;
    drop(conn);

    get_member(state, id).and_then(|m| m.ok_or_else(|| msg("Failed to read created member")))
}

#[tauri::command]
pub fn update_member(
    state: State<'_, AppState>,
    id: String,
    input: MemberInput,
) -> AppResult<MemberRow> {
    require_login(&state)?;
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;

    let now = chrono::Utc::now().to_rfc3339();

    tx.execute(
        "UPDATE profiles SET
            full_name = ?2,
            phone = ?3,
            photo_url = ?4,
            address = ?5,
            father_husband_name = ?6,
            gender = ?7,
            date_of_birth = ?8,
            aadhaar_vid = ?9,
            nominee_name = ?10,
            updated_at = ?11
         WHERE id = ?1",
        params![
            id,
            input.full_name,
            empty_to_none(input.phone.clone()),
            empty_to_none(input.photo_url.clone()),
            empty_to_none(input.address.clone()),
            empty_to_none(input.father_husband_name.clone()),
            empty_to_none(input.gender.clone()),
            empty_to_none(input.date_of_birth.clone()),
            empty_to_none(input.aadhaar_vid.clone()),
            empty_to_none(input.nominee_name.clone()),
            now,
        ],
    )?;

    // Only update member_code if caller provided one (non-empty).
    if let Some(code) = empty_to_none(input.member_code.clone()) {
        tx.execute(
            "UPDATE members SET member_code = ?2 WHERE id = ?1",
            params![id, code],
        )?;
    }

    tx.execute(
        "UPDATE members SET
            join_date = ?2,
            category = ?3,
            status = ?4,
            initial_investment = ?5,
            monthly_installment = ?6,
            chosen_term_months = ?7
         WHERE id = ?1",
        params![
            id,
            input.join_date,
            input.category,
            input.status.unwrap_or_else(|| "active".to_string()),
            input.initial_investment,
            input.monthly_installment,
            input.chosen_term_months,
        ],
    )?;

    tx.commit()?;
    drop(conn);
    get_member(state, id).and_then(|m| m.ok_or_else(|| msg("Failed to read updated member")))
}

#[tauri::command]
pub fn delete_member(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    // ON DELETE CASCADE on members.id -> profiles wipes members row.
    conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn bulk_delete_members(state: State<'_, AppState>, ids: Vec<String>) -> AppResult<i64> {
    require_login(&state)?;
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    let mut count: i64 = 0;
    for id in ids {
        count += tx.execute("DELETE FROM profiles WHERE id = ?1", params![id])? as i64;
    }
    tx.commit()?;
    Ok(count)
}

// ===========================================================================
// File: save_member_photo
// ===========================================================================
//
// React side reads the file bytes and sends them along with extension. We
// store under <appdata>/photos/<uuid>.<ext> and return an absolute path which
// the frontend converts to a usable src via tauri's convertFileSrc().

#[derive(Debug, Deserialize)]
pub struct PhotoInput {
    pub bytes: Vec<u8>,
    pub ext: String,
}

#[tauri::command]
pub fn save_member_photo(
    state: State<'_, AppState>,
    photo: PhotoInput,
) -> AppResult<String> {
    require_login(&state)?;
    let ext = photo.ext.trim_start_matches('.').to_lowercase();
    let allowed = ["jpg", "jpeg", "png", "webp", "gif"];
    if !allowed.contains(&ext.as_str()) {
        return Err(msg("Unsupported image type. Use JPG, PNG, WebP or GIF."));
    }
    if photo.bytes.len() > 2 * 1024 * 1024 {
        return Err(msg("Photo too large (max 2 MB)."));
    }
    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let path = state.photos_dir.join(&filename);
    std::fs::write(&path, &photo.bytes).map_err(AppError::from)?;
    Ok(path.to_string_lossy().to_string())
}
