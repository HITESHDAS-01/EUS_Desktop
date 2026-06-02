use crate::auth;
use crate::db;
use crate::error::{msg, AppError, AppResult};
use crate::state::AppState;
use chrono::{Datelike, NaiveDate};
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use tauri::State;
use uuid::Uuid;

// ===========================================================================
// Shared helpers
// ===========================================================================

fn require_login(state: &AppState) -> AppResult<()> {
    if !*state.logged_in.lock().unwrap() {
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

fn random_suffix() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..4)
        .map(|_| {
            let i: u8 = rng.gen_range(0..36);
            if i < 10 {
                (b'0' + i) as char
            } else {
                (b'A' + (i - 10)) as char
            }
        })
        .collect()
}

fn now_compact() -> String {
    chrono::Local::now().format("%Y%m%d%H%M%S").to_string()
}

fn get_setting_f64(conn: &rusqlite::Connection, key: &str, default: f64) -> f64 {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get::<_, String>(0),
    )
    .ok()
    .and_then(|s| s.parse::<f64>().ok())
    .unwrap_or(default)
}

fn get_setting_i64(conn: &rusqlite::Connection, key: &str, default: i64) -> i64 {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get::<_, String>(0),
    )
    .ok()
    .and_then(|s| s.parse::<i64>().ok())
    .unwrap_or(default)
}

// ===========================================================================
// Types — DTOs returned to React
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
    pub loan_interest_rate: Option<f64>,
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
    pub loan_interest_rate: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SavingsRow {
    pub id: String,
    pub member_id: String,
    pub amount: f64,
    pub penalty: f64,
    pub payment_date: String,
    pub due_date: String,
    pub month_year: String,
    pub receipt_number: String,
    pub member_code: Option<String>,
    pub member_full_name: Option<String>,
    pub member_photo_url: Option<String>,
    pub member_category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SavingsInput {
    pub member_id: String,
    pub amount: f64,
    pub penalty: f64,
    pub payment_date: String,
    pub due_date: String,
    pub month_year: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LoanRow {
    pub id: String,
    pub member_id: String,
    pub principal_amount: f64,
    pub interest_rate: f64,
    pub remaining_principal: f64,
    pub status: String,
    pub disbursed_date: String,
    pub member_code: Option<String>,
    pub member_full_name: Option<String>,
    pub member_photo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoanInput {
    pub member_id: String,
    pub principal_amount: f64,
    pub interest_rate: f64,
    pub disbursed_date: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct RepaymentRow {
    pub id: String,
    pub loan_id: String,
    pub amount_paid: f64,
    pub principal_portion: f64,
    pub interest_portion: f64,
    pub payment_date: String,
    pub receipt_number: String,
}

#[derive(Debug, Deserialize)]
pub struct RepaymentInput {
    pub loan_id: String,
    pub principal_portion: f64,
    pub interest_portion: f64,
    pub payment_date: String,
}

#[derive(Debug, Serialize)]
pub struct DashboardAlertRow {
    pub id: String,
    pub member_code: Option<String>,
    pub full_name: Option<String>,
    pub phone: Option<String>,
    pub maturity_date: Option<String>,
    pub months_remaining: Option<i64>,
    pub projected_amount: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct RecentTxRow {
    pub member_code: Option<String>,
    pub created_at: String,
    pub amount: f64,
    pub penalty: f64,
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_treasury: f64,
    pub active_loans: f64,
    pub total_members: i64,
    pub current_month_collection: f64,
    pub total_penalty_collected: f64,
    pub total_interest_earned: f64,
    pub matured_members_count: i64,
    pub pending_installments: i64,
    pub recent_tx: Vec<RecentTxRow>,
    pub overdue: Vec<DashboardAlertRow>,
    pub maturing: Vec<DashboardAlertRow>,
}

#[derive(Debug, Serialize)]
pub struct AdminProfile {
    pub full_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StatementBundle {
    pub member: MemberRow,
    pub savings: Vec<SavingsRow>,
    pub loans: Vec<LoanRow>,
    pub repayments: Vec<RepaymentRow>,
}

// ===========================================================================
// Auth
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
        return Err(msg("Admin already exists."));
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
    if !auth::verify_password(&password, &hash)? {
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

#[tauri::command]
pub fn get_admin_profile(state: State<'_, AppState>) -> AppResult<AdminProfile> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let name: Option<String> = conn
        .query_row("SELECT full_name FROM admin_account WHERE id = 1", [], |r| {
            r.get(0)
        })
        .optional()?
        .flatten();
    Ok(AdminProfile { full_name: name })
}

#[tauri::command]
pub fn update_admin_profile(state: State<'_, AppState>, full_name: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE admin_account SET full_name = ?1, updated_at = datetime('now') WHERE id = 1",
        params![full_name],
    )?;
    Ok(())
}

/// Wipe the admin row only — all business data (members, transactions,
/// loans, EMI, investments, settings) stays intact. App returns to the
/// first-run wizard so a new administrator can be created.
#[tauri::command]
pub fn reset_admin_only(state: State<'_, AppState>, password: String) -> AppResult<()> {
    require_login(&state)?;
    let stored: String = {
        let conn = state.db.lock().unwrap();
        conn.query_row("SELECT password_hash FROM admin_account WHERE id = 1", [], |r| {
            r.get(0)
        })?
    };
    if !auth::verify_password(&password, &stored)? {
        return Err(msg("Incorrect password."));
    }
    {
        let conn = state.db.lock().unwrap();
        conn.execute("DELETE FROM admin_account", [])?;
    }
    *state.logged_in.lock().unwrap() = false;
    Ok(())
}

/// Nuke everything: every business row, every photo, the admin account.
/// Re-seed default settings so the app is fresh-install state.
#[tauri::command]
pub fn factory_reset(state: State<'_, AppState>, password: String) -> AppResult<()> {
    require_login(&state)?;
    let stored: String = {
        let conn = state.db.lock().unwrap();
        conn.query_row("SELECT password_hash FROM admin_account WHERE id = 1", [], |r| {
            r.get(0)
        })?
    };
    if !auth::verify_password(&password, &stored)? {
        return Err(msg("Incorrect password."));
    }

    {
        let mut conn = state.db.lock().unwrap();
        let tx = conn.transaction()?;
        // Order respects FK dependencies (children before parents).
        tx.execute("DELETE FROM emi_payments", [])?;
        tx.execute("DELETE FROM emi_loans", [])?;
        tx.execute("DELETE FROM emi_customers", [])?;
        tx.execute("DELETE FROM vendors", [])?;
        tx.execute("DELETE FROM ext_loan_txns", [])?;
        tx.execute("DELETE FROM ext_loans", [])?;
        tx.execute("DELETE FROM investment_returns", [])?;
        tx.execute("DELETE FROM external_investments", [])?;
        tx.execute("DELETE FROM loan_repayments", [])?;
        tx.execute("DELETE FROM loans", [])?;
        tx.execute("DELETE FROM savings_installments", [])?;
        tx.execute("DELETE FROM members", [])?;
        tx.execute("DELETE FROM profiles", [])?;
        tx.execute("DELETE FROM settings", [])?;
        tx.execute("DELETE FROM app_text_settings", [])?;
        tx.execute("DELETE FROM admin_account", [])?;
        tx.commit()?;
        db::seed_defaults(&conn)?;
    }

    // Remove member photos on disk.
    if state.photos_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&state.photos_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    *state.logged_in.lock().unwrap() = false;
    Ok(())
}

#[tauri::command]
pub fn change_admin_password(
    state: State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> AppResult<()> {
    require_login(&state)?;
    if new_password.len() < 6 {
        return Err(msg("New password must be at least 6 characters."));
    }
    let conn = state.db.lock().unwrap();
    let stored: String =
        conn.query_row("SELECT password_hash FROM admin_account WHERE id = 1", [], |r| {
            r.get(0)
        })?;
    drop(conn);
    if !auth::verify_password(&current_password, &stored)? {
        return Err(msg("Current password is incorrect."));
    }
    let hash = auth::hash_password(&new_password)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE admin_account SET password_hash = ?1, updated_at = datetime('now') WHERE id = 1",
        params![hash],
    )?;
    Ok(())
}

// ===========================================================================
// Settings
// ===========================================================================

#[tauri::command]
pub fn list_settings(state: State<'_, AppState>) -> AppResult<HashMap<String, String>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut out = HashMap::new();
    for row in rows {
        let (k, v) = row?;
        out.insert(k, v);
    }
    Ok(out)
}

#[tauri::command]
pub fn list_text_settings(state: State<'_, AppState>) -> AppResult<HashMap<String, String>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT key, value FROM app_text_settings")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut out = HashMap::new();
    for row in rows {
        let (k, v) = row?;
        out.insert(k, v);
    }
    Ok(out)
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    values: HashMap<String, String>,
) -> AppResult<()> {
    require_login(&state)?;
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    for (k, v) in values {
        tx.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn save_text_settings(
    state: State<'_, AppState>,
    values: HashMap<String, String>,
) -> AppResult<()> {
    require_login(&state)?;
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    for (k, v) in values {
        tx.execute(
            "INSERT INTO app_text_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )?;
    }
    tx.commit()?;
    Ok(())
}

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
    Ok(conn.query_row(sql, params![key], |r| r.get(0)).optional()?)
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
// Members
// ===========================================================================

const MEMBER_SELECT_SQL: &str = "
SELECT m.id, m.member_code, m.category, m.status, m.join_date,
       m.initial_investment, m.monthly_installment, m.chosen_term_months,
       m.loan_interest_rate,
       p.full_name, p.phone, p.photo_url, p.address, p.father_husband_name,
       p.gender, p.date_of_birth, p.aadhaar_vid, p.nominee_name
FROM members m
LEFT JOIN profiles p ON p.id = m.id
";

fn row_to_member(row: &Row<'_>) -> rusqlite::Result<MemberRow> {
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
        loan_interest_rate: row.get(8)?,
        profiles: Some(profile),
    })
}

#[tauri::command]
pub fn list_members(state: State<'_, AppState>) -> AppResult<Vec<MemberRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} ORDER BY m.join_date DESC, m.member_code DESC",
        MEMBER_SELECT_SQL
    ))?;
    let rows = stmt.query_map([], row_to_member)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn get_member(state: State<'_, AppState>, id: String) -> AppResult<Option<MemberRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!("{} WHERE m.id = ?1", MEMBER_SELECT_SQL))?;
    Ok(stmt.query_row(params![id], row_to_member).optional()?)
}

#[tauri::command]
pub fn create_member(state: State<'_, AppState>, input: MemberInput) -> AppResult<MemberRow> {
    require_login(&state)?;
    let id = {
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
                initial_investment, monthly_installment, chosen_term_months,
                loan_interest_rate
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                final_code,
                input.category,
                input.status.clone().unwrap_or_else(|| "active".to_string()),
                input.join_date,
                input.initial_investment,
                input.monthly_installment,
                input.chosen_term_months,
                input.loan_interest_rate,
            ],
        )?;
        tx.commit()?;
        id
    };
    get_member(state, id).and_then(|m| m.ok_or_else(|| msg("Failed to read created member")))
}

#[tauri::command]
pub fn update_member(
    state: State<'_, AppState>,
    id: String,
    input: MemberInput,
) -> AppResult<MemberRow> {
    require_login(&state)?;
    {
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
                chosen_term_months = ?7,
                loan_interest_rate = ?8
             WHERE id = ?1",
            params![
                id,
                input.join_date,
                input.category,
                input.status.clone().unwrap_or_else(|| "active".to_string()),
                input.initial_investment,
                input.monthly_installment,
                input.chosen_term_months,
                input.loan_interest_rate,
            ],
        )?;
        tx.commit()?;
    }
    get_member(state, id).and_then(|m| m.ok_or_else(|| msg("Failed to read updated member")))
}

#[tauri::command]
pub fn delete_member(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
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

// ===========================================================================
// Savings (installments)
// ===========================================================================

const SAVINGS_SELECT_SQL: &str = "
SELECT s.id, s.member_id, s.amount, s.penalty, s.payment_date, s.due_date,
       s.month_year, s.receipt_number,
       m.member_code, p.full_name, p.photo_url, m.category
FROM savings_installments s
LEFT JOIN members m ON m.id = s.member_id
LEFT JOIN profiles p ON p.id = m.id
";

fn row_to_savings(row: &Row<'_>) -> rusqlite::Result<SavingsRow> {
    Ok(SavingsRow {
        id: row.get(0)?,
        member_id: row.get(1)?,
        amount: row.get(2)?,
        penalty: row.get(3)?,
        payment_date: row.get(4)?,
        due_date: row.get(5)?,
        month_year: row.get(6)?,
        receipt_number: row.get(7)?,
        member_code: row.get(8)?,
        member_full_name: row.get(9)?,
        member_photo_url: row.get(10)?,
        member_category: row.get(11)?,
    })
}

#[tauri::command]
pub fn list_savings(state: State<'_, AppState>) -> AppResult<Vec<SavingsRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} ORDER BY s.created_at DESC LIMIT 200",
        SAVINGS_SELECT_SQL
    ))?;
    let rows = stmt.query_map([], row_to_savings)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn list_member_savings(
    state: State<'_, AppState>,
    member_id: String,
) -> AppResult<Vec<SavingsRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} WHERE s.member_id = ?1 ORDER BY s.payment_date DESC",
        SAVINGS_SELECT_SQL
    ))?;
    let rows = stmt.query_map(params![member_id], row_to_savings)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn create_savings(state: State<'_, AppState>, input: SavingsInput) -> AppResult<SavingsRow> {
    require_login(&state)?;
    let id = Uuid::new_v4().to_string();
    let receipt = format!("RCPT-{}-{}", now_compact(), random_suffix());
    {
        let conn = state.db.lock().unwrap();
        conn.execute(
            "INSERT INTO savings_installments
              (id, member_id, amount, penalty, payment_date, due_date, month_year, receipt_number)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id,
                input.member_id,
                input.amount,
                input.penalty,
                input.payment_date,
                input.due_date,
                input.month_year,
                receipt,
            ],
        )?;
    }
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!("{} WHERE s.id = ?1", SAVINGS_SELECT_SQL))?;
    Ok(stmt.query_row(params![id], row_to_savings)?)
}

#[derive(Debug, Deserialize)]
pub struct SavingsUpdate {
    pub amount: f64,
    pub penalty: f64,
    pub payment_date: String,
    pub due_date: String,
    pub month_year: String,
}

#[tauri::command]
pub fn update_savings(
    state: State<'_, AppState>,
    id: String,
    input: SavingsUpdate,
) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE savings_installments
         SET amount = ?2, penalty = ?3, payment_date = ?4, due_date = ?5, month_year = ?6
         WHERE id = ?1",
        params![
            id,
            input.amount,
            input.penalty,
            input.payment_date,
            input.due_date,
            input.month_year,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_savings(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM savings_installments WHERE id = ?1", params![id])?;
    Ok(())
}

// ===========================================================================
// Loans + repayments
// ===========================================================================

const LOAN_SELECT_SQL: &str = "
SELECT l.id, l.member_id, l.principal_amount, l.interest_rate, l.remaining_principal,
       l.status, l.disbursed_date, m.member_code, p.full_name, p.photo_url
FROM loans l
LEFT JOIN members m ON m.id = l.member_id
LEFT JOIN profiles p ON p.id = m.id
";

fn row_to_loan(row: &Row<'_>) -> rusqlite::Result<LoanRow> {
    Ok(LoanRow {
        id: row.get(0)?,
        member_id: row.get(1)?,
        principal_amount: row.get(2)?,
        interest_rate: row.get(3)?,
        remaining_principal: row.get(4)?,
        status: row.get(5)?,
        disbursed_date: row.get(6)?,
        member_code: row.get(7)?,
        member_full_name: row.get(8)?,
        member_photo_url: row.get(9)?,
    })
}

#[tauri::command]
pub fn list_active_loans(state: State<'_, AppState>) -> AppResult<Vec<LoanRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} WHERE l.status = 'active' ORDER BY l.disbursed_date DESC",
        LOAN_SELECT_SQL
    ))?;
    let rows = stmt.query_map([], row_to_loan)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn list_member_loans(
    state: State<'_, AppState>,
    member_id: String,
) -> AppResult<Vec<LoanRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} WHERE l.member_id = ?1 ORDER BY l.disbursed_date DESC",
        LOAN_SELECT_SQL
    ))?;
    let rows = stmt.query_map(params![member_id], row_to_loan)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn disburse_loan(state: State<'_, AppState>, input: LoanInput) -> AppResult<LoanRow> {
    require_login(&state)?;
    if input.principal_amount <= 0.0 {
        return Err(msg("Loan amount must be greater than 0."));
    }
    let id = Uuid::new_v4().to_string();
    {
        let conn = state.db.lock().unwrap();
        conn.execute(
            "INSERT INTO loans
              (id, member_id, principal_amount, interest_rate, remaining_principal,
               status, disbursed_date)
             VALUES (?1, ?2, ?3, ?4, ?3, 'active', ?5)",
            params![
                id,
                input.member_id,
                input.principal_amount,
                input.interest_rate,
                input.disbursed_date,
            ],
        )?;
    }
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!("{} WHERE l.id = ?1", LOAN_SELECT_SQL))?;
    Ok(stmt.query_row(params![id], row_to_loan)?)
}

/// Atomic repayment — inserts the loan_repayments row AND updates the
/// loan's remaining_principal + status in a single transaction. Mirrors
/// record_loan_repayment() from the original Postgres schema.
#[tauri::command]
pub fn record_loan_repayment(
    state: State<'_, AppState>,
    input: RepaymentInput,
) -> AppResult<RepaymentRow> {
    require_login(&state)?;
    if input.principal_portion < 0.0 || input.interest_portion < 0.0 {
        return Err(msg("Repayment amounts cannot be negative."));
    }
    let amount_paid = input.principal_portion + input.interest_portion;
    if amount_paid <= 0.0 {
        return Err(msg("Total payment must be greater than 0."));
    }

    let receipt = format!("LREP-{}-{}", now_compact(), random_suffix());
    let id = Uuid::new_v4().to_string();

    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;

    let remaining: f64 = tx.query_row(
        "SELECT remaining_principal FROM loans WHERE id = ?1",
        params![input.loan_id],
        |r| r.get(0),
    )?;

    if input.principal_portion > remaining + 0.005 {
        return Err(msg(format!(
            "Principal repayment ({:.2}) exceeds outstanding balance ({:.2}).",
            input.principal_portion, remaining
        )));
    }

    let new_rem = (remaining - input.principal_portion).max(0.0);
    let new_status = if new_rem <= 0.0 { "closed" } else { "active" };

    tx.execute(
        "INSERT INTO loan_repayments
          (id, loan_id, amount_paid, principal_portion, interest_portion,
           payment_date, receipt_number)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.loan_id,
            amount_paid,
            input.principal_portion,
            input.interest_portion,
            input.payment_date,
            receipt,
        ],
    )?;

    tx.execute(
        "UPDATE loans SET remaining_principal = ?1, status = ?2 WHERE id = ?3",
        params![new_rem, new_status, input.loan_id],
    )?;

    tx.commit()?;
    drop(conn);

    Ok(RepaymentRow {
        id,
        loan_id: input.loan_id,
        amount_paid,
        principal_portion: input.principal_portion,
        interest_portion: input.interest_portion,
        payment_date: input.payment_date,
        receipt_number: receipt,
    })
}

#[tauri::command]
pub fn list_repayments_for_loans(
    state: State<'_, AppState>,
    loan_ids: Vec<String>,
) -> AppResult<Vec<RepaymentRow>> {
    require_login(&state)?;
    if loan_ids.is_empty() {
        return Ok(vec![]);
    }
    let conn = state.db.lock().unwrap();
    let placeholders = std::iter::repeat("?")
        .take(loan_ids.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT id, loan_id, amount_paid, principal_portion, interest_portion,
                payment_date, receipt_number
         FROM loan_repayments WHERE loan_id IN ({}) ORDER BY payment_date DESC",
        placeholders
    );
    let mut stmt = conn.prepare(&sql)?;
    let params_vec: Vec<&dyn rusqlite::ToSql> =
        loan_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    let rows = stmt.query_map(params_vec.as_slice(), |r| {
        Ok(RepaymentRow {
            id: r.get(0)?,
            loan_id: r.get(1)?,
            amount_paid: r.get(2)?,
            principal_portion: r.get(3)?,
            interest_portion: r.get(4)?,
            payment_date: r.get(5)?,
            receipt_number: r.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

// ===========================================================================
// MemberProfile / Statement bundle
// ===========================================================================

#[tauri::command]
pub fn get_statement_bundle(
    state: State<'_, AppState>,
    member_id: String,
) -> AppResult<StatementBundle> {
    require_login(&state)?;
    let member = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare(&format!("{} WHERE m.id = ?1", MEMBER_SELECT_SQL))?;
        stmt.query_row(params![member_id], row_to_member)
            .optional()?
    };
    let Some(member) = member else {
        return Err(msg("Member not found"));
    };

    let savings = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "{} WHERE s.member_id = ?1 ORDER BY s.payment_date ASC",
            SAVINGS_SELECT_SQL
        ))?;
        let rows = stmt.query_map(params![member_id], row_to_savings)?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let loans = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "{} WHERE l.member_id = ?1 ORDER BY l.disbursed_date ASC",
            LOAN_SELECT_SQL
        ))?;
        let rows = stmt.query_map(params![member_id], row_to_loan)?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let loan_ids: Vec<String> = loans.iter().map(|l| l.id.clone()).collect();
    let repayments = if loan_ids.is_empty() {
        vec![]
    } else {
        let conn = state.db.lock().unwrap();
        let placeholders = std::iter::repeat("?")
            .take(loan_ids.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT id, loan_id, amount_paid, principal_portion, interest_portion,
                    payment_date, receipt_number
             FROM loan_repayments WHERE loan_id IN ({}) ORDER BY payment_date ASC",
            placeholders
        );
        let mut stmt = conn.prepare(&sql)?;
        let params_vec: Vec<&dyn rusqlite::ToSql> =
            loan_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let rows = stmt.query_map(params_vec.as_slice(), |r| {
            Ok(RepaymentRow {
                id: r.get(0)?,
                loan_id: r.get(1)?,
                amount_paid: r.get(2)?,
                principal_portion: r.get(3)?,
                interest_portion: r.get(4)?,
                payment_date: r.get(5)?,
                receipt_number: r.get(6)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    Ok(StatementBundle {
        member,
        savings,
        loans,
        repayments,
    })
}

// ===========================================================================
// Dashboard stats
// ===========================================================================

#[tauri::command]
pub fn get_dashboard_stats(state: State<'_, AppState>) -> AppResult<DashboardStats> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();

    let total_members: i64 = conn.query_row("SELECT COUNT(*) FROM members", [], |r| r.get(0))?;
    let active_loans: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(remaining_principal), 0) FROM loans WHERE status = 'active'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);
    let total_initial: f64 = conn
        .query_row("SELECT COALESCE(SUM(initial_investment), 0) FROM members", [], |r| {
            r.get(0)
        })
        .unwrap_or(0.0);
    let total_installments: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount), 0) FROM savings_installments", [], |r| {
            r.get(0)
        })
        .unwrap_or(0.0);
    let total_penalty: f64 = conn
        .query_row("SELECT COALESCE(SUM(penalty), 0) FROM savings_installments", [], |r| {
            r.get(0)
        })
        .unwrap_or(0.0);
    let total_interest: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(interest_portion), 0) FROM loan_repayments",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let total_treasury =
        total_initial + total_installments + total_penalty + total_interest - active_loans;

    // current month collection
    let today = chrono::Local::now().date_naive();
    let month_start = format!("{:04}-{:02}-01", today.year(), today.month());
    let current_month_collection: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount + penalty), 0)
             FROM savings_installments WHERE payment_date >= ?1",
            params![month_start],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    // pending installments: active Cat A+C members who have NOT paid this month
    let total_ac: i64 = conn.query_row(
        "SELECT COUNT(*) FROM members
         WHERE category IN ('A','C') AND status = 'active'",
        [],
        |r| r.get(0),
    )?;
    let paid_this_month: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT member_id) FROM savings_installments
         WHERE payment_date >= ?1",
        params![month_start],
        |r| r.get(0),
    )?;
    let pending_installments = (total_ac - paid_this_month).max(0);

    // Recent transactions (5 most recent)
    let recent_tx: Vec<RecentTxRow> = {
        let mut stmt = conn.prepare(
            "SELECT m.member_code, s.created_at, s.amount, s.penalty
             FROM savings_installments s
             LEFT JOIN members m ON m.id = s.member_id
             ORDER BY s.created_at DESC LIMIT 5",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(RecentTxRow {
                member_code: r.get(0)?,
                created_at: r.get(1)?,
                amount: r.get(2)?,
                penalty: r.get(3)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // Overdue: only if today's date is past day 15
    let overdue: Vec<DashboardAlertRow> = if today.day() > 15 {
        let mut stmt = conn.prepare(
            "SELECT m.id, m.member_code, p.full_name, p.phone
             FROM members m LEFT JOIN profiles p ON p.id = m.id
             WHERE m.category IN ('A','C') AND m.status = 'active'
               AND m.id NOT IN (
                 SELECT member_id FROM savings_installments
                 WHERE payment_date >= ?1
               )",
        )?;
        let rows = stmt.query_map(params![month_start], |r| {
            Ok(DashboardAlertRow {
                id: r.get(0)?,
                member_code: r.get(1)?,
                full_name: r.get(2)?,
                phone: r.get(3)?,
                maturity_date: None,
                months_remaining: None,
                projected_amount: None,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    } else {
        vec![]
    };

    // ROI rates from settings
    let roi_cat_b = get_setting_f64(&conn, "roi_category_b", 36.0);
    let roi_c_24 = get_setting_f64(&conn, "roi_category_c_24", 16.0);
    let roi_c_36 = get_setting_f64(&conn, "roi_category_c_36", 27.0);

    // Maturity scan
    let mut matured_count: i64 = 0;
    let maturing: Vec<DashboardAlertRow> = {
        let mut stmt = conn.prepare(
            "SELECT m.id, m.member_code, m.join_date, m.category,
                    m.chosen_term_months, m.initial_investment,
                    p.full_name, p.phone,
                    COALESCE((SELECT SUM(amount) FROM savings_installments
                              WHERE member_id = m.id), 0)
             FROM members m LEFT JOIN profiles p ON p.id = m.id
             WHERE m.status = 'active'",
        )?;
        let rows: Vec<_> = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, Option<i64>>(4)?,
                    r.get::<_, f64>(5)?,
                    r.get::<_, Option<String>>(6)?,
                    r.get::<_, Option<String>>(7)?,
                    r.get::<_, f64>(8)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut out: Vec<DashboardAlertRow> = Vec::new();
        for (id, code, join_d, cat, term, init_inv, name, phone, total_inst) in rows {
            let term = term.unwrap_or(36);
            let join = NaiveDate::parse_from_str(&join_d, "%Y-%m-%d").unwrap_or(today);
            // months delta from join_date for `term`
            let mut y = join.year();
            let mut m = join.month() as i32 + term as i32;
            while m > 12 {
                m -= 12;
                y += 1;
            }
            while m < 1 {
                m += 12;
                y -= 1;
            }
            let maturity = NaiveDate::from_ymd_opt(y, m as u32, join.day().min(28))
                .unwrap_or(join);
            let months_remaining = months_between(today, maturity);

            let total_sav = match cat.as_str() {
                "A" => init_inv + total_inst,
                "B" => init_inv,
                "C" => total_inst,
                _ => 0.0,
            };
            let roi_pct = match (cat.as_str(), term) {
                ("B", _) => roi_cat_b,
                ("C", 24) => roi_c_24,
                ("C", 36) => roi_c_36,
                _ => 0.0,
            };
            let projected = total_sav * (1.0 + roi_pct / 100.0);

            if months_remaining <= 0 {
                matured_count += 1;
                out.push(DashboardAlertRow {
                    id,
                    member_code: code,
                    full_name: name,
                    phone,
                    maturity_date: Some(maturity.format("%Y-%m-%d").to_string()),
                    months_remaining: Some(months_remaining),
                    projected_amount: Some(projected),
                });
            } else if months_remaining <= 3 {
                out.push(DashboardAlertRow {
                    id,
                    member_code: code,
                    full_name: name,
                    phone,
                    maturity_date: Some(maturity.format("%Y-%m-%d").to_string()),
                    months_remaining: Some(months_remaining),
                    projected_amount: Some(projected),
                });
            }
        }
        out.sort_by_key(|a| a.months_remaining.unwrap_or(0));
        out
    };

    Ok(DashboardStats {
        total_treasury,
        active_loans,
        total_members,
        current_month_collection,
        total_penalty_collected: total_penalty,
        total_interest_earned: total_interest,
        matured_members_count: matured_count,
        pending_installments,
        recent_tx,
        overdue,
        maturing,
    })
}

fn months_between(from: NaiveDate, to: NaiveDate) -> i64 {
    let years = to.year() as i64 - from.year() as i64;
    let months = to.month() as i64 - from.month() as i64;
    years * 12 + months
}

// ===========================================================================
// Backup — export full DB + photos folder to a user-chosen .zip path
// ===========================================================================

#[tauri::command]
pub fn export_backup_zip(state: State<'_, AppState>, dest_path: String) -> AppResult<String> {
    require_login(&state)?;
    let dest = Path::new(&dest_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    // Resolve DB path. The connection is opened from <appdata>/eus.db — we mirror that.
    let appdata_dir = state.photos_dir.parent().ok_or_else(|| msg("Bad appdata dir"))?;
    let db_path = appdata_dir.join("eus.db");

    // Checkpoint WAL into the main DB file so the .zip captures the live state,
    // not just what's been flushed. TRUNCATE leaves a small WAL but ensures the
    // main file is fully up-to-date.
    {
        let conn = state.db.lock().unwrap();
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    }

    let file = std::fs::File::create(dest).map_err(AppError::from)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add eus.db
    if db_path.exists() {
        zip.start_file("eus.db", opts)?;
        let mut f = std::fs::File::open(&db_path).map_err(AppError::from)?;
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).map_err(AppError::from)?;
        zip.write_all(&buf).map_err(AppError::from)?;
    }

    // Add photos/
    if state.photos_dir.exists() {
        for entry in std::fs::read_dir(&state.photos_dir).map_err(AppError::from)? {
            let entry = entry.map_err(AppError::from)?;
            if entry.file_type().map_err(AppError::from)?.is_file() {
                let name = entry.file_name();
                let zip_name = format!("photos/{}", name.to_string_lossy());
                zip.start_file(zip_name, opts)?;
                let mut f = std::fs::File::open(entry.path()).map_err(AppError::from)?;
                let mut buf = Vec::new();
                f.read_to_end(&mut buf).map_err(AppError::from)?;
                zip.write_all(&buf).map_err(AppError::from)?;
            }
        }
    }

    zip.finish().map_err(|e| msg(format!("Zip finalize failed: {e}")))?;
    Ok(dest.to_string_lossy().to_string())
}

impl From<zip::result::ZipError> for AppError {
    fn from(e: zip::result::ZipError) -> Self {
        msg(format!("Zip error: {e}"))
    }
}

/// Generic write-text-to-file (admin-blessed via saveDialog on the JS side).
#[tauri::command]
pub fn write_text_file(state: State<'_, AppState>, path: String, content: String) -> AppResult<()> {
    require_login(&state)?;
    std::fs::write(&path, content.as_bytes()).map_err(AppError::from)?;
    Ok(())
}

// ===========================================================================
// Reports — helpers
// ===========================================================================

#[tauri::command]
pub fn list_savings_in_range(
    state: State<'_, AppState>,
    start: String,
    end: String,
) -> AppResult<Vec<SavingsRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} WHERE s.payment_date >= ?1 AND s.payment_date <= ?2
         ORDER BY s.payment_date DESC",
        SAVINGS_SELECT_SQL
    ))?;
    let rows = stmt.query_map(params![start, end], row_to_savings)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

/// Like list_savings_in_range but filters by month_year (the month the
/// installment is FOR, not when it was paid). Used for Defaulter +
/// Monthly Sheet reports — matches the eus original which a late payment
/// recorded next month must still count for the original month.
#[tauri::command]
pub fn list_savings_by_month_year_range(
    state: State<'_, AppState>,
    start: String,
    end: String,
) -> AppResult<Vec<SavingsRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} WHERE s.month_year >= ?1 AND s.month_year <= ?2
         ORDER BY s.month_year DESC, s.payment_date DESC",
        SAVINGS_SELECT_SQL
    ))?;
    let rows = stmt.query_map(params![start, end], row_to_savings)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[derive(Debug, Serialize)]
pub struct RepaymentReportRow {
    pub id: String,
    pub loan_id: String,
    pub amount_paid: f64,
    pub principal_portion: f64,
    pub interest_portion: f64,
    pub payment_date: String,
    pub receipt_number: String,
    pub member_code: Option<String>,
    pub member_full_name: Option<String>,
    pub member_photo_url: Option<String>,
}

#[tauri::command]
pub fn list_repayments_in_range(
    state: State<'_, AppState>,
    start: String,
    end: String,
) -> AppResult<Vec<RepaymentReportRow>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT r.id, r.loan_id, r.amount_paid, r.principal_portion, r.interest_portion,
                r.payment_date, r.receipt_number,
                m.member_code, p.full_name, p.photo_url
         FROM loan_repayments r
         LEFT JOIN loans l ON l.id = r.loan_id
         LEFT JOIN members m ON m.id = l.member_id
         LEFT JOIN profiles p ON p.id = m.id
         WHERE r.payment_date >= ?1 AND r.payment_date <= ?2
         ORDER BY r.payment_date DESC",
    )?;
    let rows = stmt.query_map(params![start, end], |r| {
        Ok(RepaymentReportRow {
            id: r.get(0)?,
            loan_id: r.get(1)?,
            amount_paid: r.get(2)?,
            principal_portion: r.get(3)?,
            interest_portion: r.get(4)?,
            payment_date: r.get(5)?,
            receipt_number: r.get(6)?,
            member_code: r.get(7)?,
            member_full_name: r.get(8)?,
            member_photo_url: r.get(9)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

// ===========================================================================
// EMI: Vendors
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct Vendor {
    pub id: String,
    pub name: String,
    pub address: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct VendorInput {
    pub name: String,
    pub address: Option<String>,
}

fn row_to_vendor(row: &Row<'_>) -> rusqlite::Result<Vendor> {
    Ok(Vendor {
        id: row.get(0)?,
        name: row.get(1)?,
        address: row.get(2)?,
        created_at: row.get(3)?,
    })
}

#[tauri::command]
pub fn list_vendors(state: State<'_, AppState>) -> AppResult<Vec<Vendor>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, address, created_at FROM vendors ORDER BY name ASC")?;
    let rows = stmt.query_map([], row_to_vendor)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn create_vendor(state: State<'_, AppState>, input: VendorInput) -> AppResult<Vendor> {
    require_login(&state)?;
    if input.name.trim().is_empty() {
        return Err(msg("Vendor name is required"));
    }
    let id = Uuid::new_v4().to_string();
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO vendors (id, name, address) VALUES (?1, ?2, ?3)",
        params![id, input.name.trim(), empty_to_none(input.address)],
    )?;
    let mut stmt = conn.prepare("SELECT id, name, address, created_at FROM vendors WHERE id = ?1")?;
    Ok(stmt.query_row(params![id], row_to_vendor)?)
}

#[tauri::command]
pub fn update_vendor(
    state: State<'_, AppState>,
    id: String,
    input: VendorInput,
) -> AppResult<()> {
    require_login(&state)?;
    if input.name.trim().is_empty() {
        return Err(msg("Vendor name is required"));
    }
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE vendors SET name = ?2, address = ?3, updated_at = datetime('now') WHERE id = ?1",
        params![id, input.name.trim(), empty_to_none(input.address)],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_vendor(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    // Check FK
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM emi_loans WHERE vendor_id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    if count > 0 {
        return Err(msg(
            "This vendor has loans linked to it. Delete or reassign those loans first.",
        ));
    }
    conn.execute("DELETE FROM vendors WHERE id = ?1", params![id])?;
    Ok(())
}

// ===========================================================================
// EMI: Customers
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct EmiCustomer {
    pub id: String,
    pub customer_code: Option<String>,
    pub full_name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub father_husband_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub aadhaar_vid: Option<String>,
    pub pan_number: Option<String>,
    pub occupation: Option<String>,
    pub monthly_income: Option<f64>,
    pub nominee_name: Option<String>,
    pub photo_url: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct EmiCustomerInput {
    pub full_name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub father_husband_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub aadhaar_vid: Option<String>,
    pub pan_number: Option<String>,
    pub occupation: Option<String>,
    pub monthly_income: Option<f64>,
    pub nominee_name: Option<String>,
    pub photo_url: Option<String>,
    pub notes: Option<String>,
}

const EMI_CUST_COLS: &str = "id, customer_code, full_name, phone, address, father_husband_name,
        date_of_birth, aadhaar_vid, pan_number, occupation, monthly_income,
        nominee_name, photo_url, notes, created_at";

fn row_to_emi_customer(row: &Row<'_>) -> rusqlite::Result<EmiCustomer> {
    Ok(EmiCustomer {
        id: row.get(0)?,
        customer_code: row.get(1)?,
        full_name: row.get(2)?,
        phone: row.get(3)?,
        address: row.get(4)?,
        father_husband_name: row.get(5)?,
        date_of_birth: row.get(6)?,
        aadhaar_vid: row.get(7)?,
        pan_number: row.get(8)?,
        occupation: row.get(9)?,
        monthly_income: row.get(10)?,
        nominee_name: row.get(11)?,
        photo_url: row.get(12)?,
        notes: row.get(13)?,
        created_at: row.get(14)?,
    })
}

#[tauri::command]
pub fn list_emi_customers(state: State<'_, AppState>) -> AppResult<Vec<EmiCustomer>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM emi_customers ORDER BY created_at DESC",
        EMI_CUST_COLS
    ))?;
    let rows = stmt.query_map([], row_to_emi_customer)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn get_emi_customer(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<Option<EmiCustomer>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM emi_customers WHERE id = ?1",
        EMI_CUST_COLS
    ))?;
    Ok(stmt
        .query_row(params![id], row_to_emi_customer)
        .optional()?)
}

#[tauri::command]
pub fn create_emi_customer(
    state: State<'_, AppState>,
    input: EmiCustomerInput,
) -> AppResult<EmiCustomer> {
    require_login(&state)?;
    if input.full_name.trim().is_empty() {
        return Err(msg("Customer name is required"));
    }
    let id = Uuid::new_v4().to_string();
    {
        let conn = state.db.lock().unwrap();
        let code = db::generate_emi_customer_code(&conn)?;
        conn.execute(
            "INSERT INTO emi_customers (
                id, customer_code, full_name, phone, address, father_husband_name,
                date_of_birth, aadhaar_vid, pan_number, occupation, monthly_income,
                nominee_name, photo_url, notes
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                id,
                code,
                input.full_name.trim(),
                empty_to_none(input.phone.clone()),
                empty_to_none(input.address.clone()),
                empty_to_none(input.father_husband_name.clone()),
                empty_to_none(input.date_of_birth.clone()),
                empty_to_none(input.aadhaar_vid.clone()),
                empty_to_none(input.pan_number.clone()),
                empty_to_none(input.occupation.clone()),
                input.monthly_income,
                empty_to_none(input.nominee_name.clone()),
                empty_to_none(input.photo_url.clone()),
                empty_to_none(input.notes.clone()),
            ],
        )?;
    }
    get_emi_customer(state, id).and_then(|m| m.ok_or_else(|| msg("Failed to read created customer")))
}

#[tauri::command]
pub fn update_emi_customer(
    state: State<'_, AppState>,
    id: String,
    input: EmiCustomerInput,
) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE emi_customers SET
            full_name = ?2, phone = ?3, address = ?4, father_husband_name = ?5,
            date_of_birth = ?6, aadhaar_vid = ?7, pan_number = ?8, occupation = ?9,
            monthly_income = ?10, nominee_name = ?11, photo_url = ?12, notes = ?13,
            updated_at = datetime('now')
         WHERE id = ?1",
        params![
            id,
            input.full_name.trim(),
            empty_to_none(input.phone),
            empty_to_none(input.address),
            empty_to_none(input.father_husband_name),
            empty_to_none(input.date_of_birth),
            empty_to_none(input.aadhaar_vid),
            empty_to_none(input.pan_number),
            empty_to_none(input.occupation),
            input.monthly_income,
            empty_to_none(input.nominee_name),
            empty_to_none(input.photo_url),
            empty_to_none(input.notes),
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_emi_customer(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM emi_loans WHERE customer_id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    if count > 0 {
        return Err(msg(
            "This customer has EMI loans. Delete or reassign those loans first.",
        ));
    }
    conn.execute("DELETE FROM emi_customers WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn save_emi_customer_photo(
    state: State<'_, AppState>,
    photo: PhotoInput,
) -> AppResult<String> {
    require_login(&state)?;
    let ext = photo.ext.trim_start_matches('.').to_lowercase();
    let allowed = ["jpg", "jpeg", "png", "webp", "gif"];
    if !allowed.contains(&ext.as_str()) {
        return Err(msg("Unsupported image type."));
    }
    if photo.bytes.len() > 2 * 1024 * 1024 {
        return Err(msg("Photo too large (max 2 MB)."));
    }
    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let path = state.photos_dir.join(&filename);
    std::fs::write(&path, &photo.bytes).map_err(AppError::from)?;
    Ok(path.to_string_lossy().to_string())
}

// ===========================================================================
// EMI: Loans
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct EmiLoan {
    pub id: String,
    pub loan_code: Option<String>,
    pub customer_id: String,
    pub vendor_id: String,
    pub product_name: String,
    pub product_category: Option<String>,
    pub product_price: f64,
    pub downpayment: f64,
    pub financed_amount: f64,
    pub interest_rate: f64,
    pub tenure_months: i64,
    pub emi_amount: f64,
    pub total_payable: f64,
    pub total_interest: f64,
    pub vendor_paid_amount: f64,
    pub vendor_paid_date: String,
    pub vendor_invoice_number: Option<String>,
    pub disbursed_date: String,
    pub first_emi_date: String,
    pub remaining_principal: f64,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub customer_code: Option<String>,
    pub customer_name: Option<String>,
    pub vendor_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EmiLoanInput {
    pub customer_id: String,
    pub vendor_id: String,
    pub product_name: String,
    pub product_category: Option<String>,
    pub product_price: f64,
    pub downpayment: f64,
    pub interest_rate: f64,
    pub tenure_months: i64,
    pub disbursed_date: String,
    pub first_emi_date: String,
    pub vendor_invoice_number: Option<String>,
    pub notes: Option<String>,
}

const EMI_LOAN_SELECT_SQL: &str = "
SELECT l.id, l.loan_code, l.customer_id, l.vendor_id, l.product_name, l.product_category,
       l.product_price, l.downpayment, l.financed_amount, l.interest_rate, l.tenure_months,
       l.emi_amount, l.total_payable, l.total_interest, l.vendor_paid_amount,
       l.vendor_paid_date, l.vendor_invoice_number, l.disbursed_date, l.first_emi_date,
       l.remaining_principal, l.status, l.notes, l.created_at,
       c.customer_code, c.full_name, v.name
FROM emi_loans l
LEFT JOIN emi_customers c ON c.id = l.customer_id
LEFT JOIN vendors v ON v.id = l.vendor_id
";

fn row_to_emi_loan(row: &Row<'_>) -> rusqlite::Result<EmiLoan> {
    Ok(EmiLoan {
        id: row.get(0)?,
        loan_code: row.get(1)?,
        customer_id: row.get(2)?,
        vendor_id: row.get(3)?,
        product_name: row.get(4)?,
        product_category: row.get(5)?,
        product_price: row.get(6)?,
        downpayment: row.get(7)?,
        financed_amount: row.get(8)?,
        interest_rate: row.get(9)?,
        tenure_months: row.get(10)?,
        emi_amount: row.get(11)?,
        total_payable: row.get(12)?,
        total_interest: row.get(13)?,
        vendor_paid_amount: row.get(14)?,
        vendor_paid_date: row.get(15)?,
        vendor_invoice_number: row.get(16)?,
        disbursed_date: row.get(17)?,
        first_emi_date: row.get(18)?,
        remaining_principal: row.get(19)?,
        status: row.get(20)?,
        notes: row.get(21)?,
        created_at: row.get(22)?,
        customer_code: row.get(23)?,
        customer_name: row.get(24)?,
        vendor_name: row.get(25)?,
    })
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

#[tauri::command]
pub fn list_emi_loans(state: State<'_, AppState>) -> AppResult<Vec<EmiLoan>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "{} ORDER BY l.created_at DESC",
        EMI_LOAN_SELECT_SQL
    ))?;
    let rows = stmt.query_map([], row_to_emi_loan)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn get_emi_loan(state: State<'_, AppState>, id: String) -> AppResult<Option<EmiLoan>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!("{} WHERE l.id = ?1", EMI_LOAN_SELECT_SQL))?;
    Ok(stmt.query_row(params![id], row_to_emi_loan).optional()?)
}

#[tauri::command]
pub fn create_emi_loan(state: State<'_, AppState>, input: EmiLoanInput) -> AppResult<EmiLoan> {
    require_login(&state)?;
    if input.product_name.trim().is_empty() {
        return Err(msg("Product name is required"));
    }
    if input.product_price <= 0.0 {
        return Err(msg("Product price must be greater than 0"));
    }
    if input.downpayment < 0.0 || input.downpayment > input.product_price {
        return Err(msg("Downpayment must be between 0 and product price"));
    }
    if input.tenure_months <= 0 {
        return Err(msg("Tenure must be at least 1 month"));
    }
    let financed = input.product_price - input.downpayment;
    if financed <= 0.0 {
        return Err(msg("Financed amount must be greater than 0"));
    }
    let total_interest = (financed * input.interest_rate * (input.tenure_months as f64)) / (12.0 * 100.0);
    let total_payable = financed + total_interest;
    let emi = total_payable / (input.tenure_months as f64);

    let id = Uuid::new_v4().to_string();
    {
        let conn = state.db.lock().unwrap();
        let code = db::generate_emi_loan_code(&conn, &input.disbursed_date)?;
        conn.execute(
            "INSERT INTO emi_loans (
                id, loan_code, customer_id, vendor_id, product_name, product_category,
                product_price, downpayment, financed_amount, interest_rate, tenure_months,
                emi_amount, total_payable, total_interest, vendor_paid_amount,
                vendor_paid_date, vendor_invoice_number, disbursed_date, first_emi_date,
                remaining_principal, status, notes
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?9,
                       ?15, ?16, ?15, ?17, ?9, 'active', ?18)",
            params![
                id,
                code,
                input.customer_id,
                input.vendor_id,
                input.product_name.trim(),
                empty_to_none(input.product_category.clone()),
                round2(input.product_price),
                round2(input.downpayment),
                round2(financed),
                input.interest_rate,
                input.tenure_months,
                round2(emi),
                round2(total_payable),
                round2(total_interest),
                input.disbursed_date,
                empty_to_none(input.vendor_invoice_number.clone()),
                input.first_emi_date,
                empty_to_none(input.notes.clone()),
            ],
        )?;
    }
    get_emi_loan(state, id).and_then(|m| m.ok_or_else(|| msg("Failed to read created loan")))
}

#[derive(Debug, Deserialize)]
pub struct EmiLoanUpdateInput {
    pub status: String,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn update_emi_loan(
    state: State<'_, AppState>,
    id: String,
    input: EmiLoanUpdateInput,
) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE emi_loans SET status = ?2, notes = ?3, updated_at = datetime('now') WHERE id = ?1",
        params![id, input.status, empty_to_none(input.notes)],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_emi_loan(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM emi_loans WHERE id = ?1", params![id])?;
    Ok(())
}

// ===========================================================================
// EMI: Payments
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct EmiPayment {
    pub id: String,
    pub loan_id: String,
    pub amount_paid: f64,
    pub principal_portion: f64,
    pub interest_portion: f64,
    pub penalty_portion: f64,
    pub payment_date: String,
    pub due_date: String,
    pub month_year: String,
    pub receipt_number: String,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EmiPaymentInput {
    pub loan_id: String,
    pub amount_paid: f64,
    pub principal_portion: f64,
    pub interest_portion: f64,
    pub penalty_portion: f64,
    pub payment_date: String,
    pub due_date: String,
    pub month_year: String,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

fn row_to_emi_payment(row: &Row<'_>) -> rusqlite::Result<EmiPayment> {
    Ok(EmiPayment {
        id: row.get(0)?,
        loan_id: row.get(1)?,
        amount_paid: row.get(2)?,
        principal_portion: row.get(3)?,
        interest_portion: row.get(4)?,
        penalty_portion: row.get(5)?,
        payment_date: row.get(6)?,
        due_date: row.get(7)?,
        month_year: row.get(8)?,
        receipt_number: row.get(9)?,
        payment_method: row.get(10)?,
        notes: row.get(11)?,
    })
}

const EMI_PAYMENT_COLS: &str = "id, loan_id, amount_paid, principal_portion, interest_portion,
        penalty_portion, payment_date, due_date, month_year, receipt_number,
        payment_method, notes";

#[tauri::command]
pub fn list_emi_payments(state: State<'_, AppState>) -> AppResult<Vec<EmiPayment>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM emi_payments ORDER BY payment_date DESC LIMIT 500",
        EMI_PAYMENT_COLS
    ))?;
    let rows = stmt.query_map([], row_to_emi_payment)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn list_emi_payments_for_loan(
    state: State<'_, AppState>,
    loan_id: String,
) -> AppResult<Vec<EmiPayment>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM emi_payments WHERE loan_id = ?1 ORDER BY payment_date ASC",
        EMI_PAYMENT_COLS
    ))?;
    let rows = stmt.query_map(params![loan_id], row_to_emi_payment)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

/// Atomic EMI payment — insert + update outstanding + auto-close at 0.
#[tauri::command]
pub fn record_emi_payment(
    state: State<'_, AppState>,
    input: EmiPaymentInput,
) -> AppResult<EmiPayment> {
    require_login(&state)?;
    if input.amount_paid <= 0.0 {
        return Err(msg("Payment amount must be greater than 0."));
    }
    if input.principal_portion < 0.0 || input.interest_portion < 0.0 || input.penalty_portion < 0.0 {
        return Err(msg("Portions cannot be negative."));
    }

    let receipt = format!("EMI-{}-{}", now_compact(), random_suffix());
    let id = Uuid::new_v4().to_string();

    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    let remaining: f64 = tx.query_row(
        "SELECT remaining_principal FROM emi_loans WHERE id = ?1",
        params![input.loan_id],
        |r| r.get(0),
    )?;
    if input.principal_portion > remaining + 0.005 {
        return Err(msg(format!(
            "Principal portion ({:.2}) exceeds outstanding balance ({:.2}).",
            input.principal_portion, remaining
        )));
    }
    let new_rem = (remaining - input.principal_portion).max(0.0);
    let new_status = if new_rem <= 0.0 { "closed" } else { "active" };

    tx.execute(
        "INSERT INTO emi_payments
          (id, loan_id, amount_paid, principal_portion, interest_portion, penalty_portion,
           payment_date, due_date, month_year, receipt_number, payment_method, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id,
            input.loan_id,
            input.amount_paid,
            input.principal_portion,
            input.interest_portion,
            input.penalty_portion,
            input.payment_date,
            input.due_date,
            input.month_year,
            receipt,
            empty_to_none(input.payment_method.clone()),
            empty_to_none(input.notes.clone()),
        ],
    )?;

    tx.execute(
        "UPDATE emi_loans SET remaining_principal = ?1, status = ?2, updated_at = datetime('now')
         WHERE id = ?3",
        params![new_rem, new_status, input.loan_id],
    )?;
    tx.commit()?;
    drop(conn);

    Ok(EmiPayment {
        id,
        loan_id: input.loan_id,
        amount_paid: input.amount_paid,
        principal_portion: input.principal_portion,
        interest_portion: input.interest_portion,
        penalty_portion: input.penalty_portion,
        payment_date: input.payment_date,
        due_date: input.due_date,
        month_year: input.month_year,
        receipt_number: receipt,
        payment_method: input.payment_method,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn delete_emi_payment(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    // Reverse the principal portion onto the loan.
    let row: Option<(String, f64)> = tx
        .query_row(
            "SELECT loan_id, principal_portion FROM emi_payments WHERE id = ?1",
            params![id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)),
        )
        .optional()?;
    let Some((loan_id, principal_back)) = row else {
        return Err(msg("Payment not found"));
    };
    tx.execute("DELETE FROM emi_payments WHERE id = ?1", params![id])?;
    tx.execute(
        "UPDATE emi_loans
         SET remaining_principal = remaining_principal + ?1,
             status = CASE WHEN remaining_principal + ?1 > 0 THEN 'active' ELSE status END,
             updated_at = datetime('now')
         WHERE id = ?2",
        params![principal_back, loan_id],
    )?;
    tx.commit()?;
    Ok(())
}

// ===========================================================================
// EMI: Loan bundle (for profile page)
// ===========================================================================

#[derive(Debug, Serialize)]
pub struct EmiLoanBundle {
    pub loan: EmiLoan,
    pub customer: EmiCustomer,
    pub vendor: Vendor,
    pub payments: Vec<EmiPayment>,
}

#[tauri::command]
pub fn get_emi_loan_bundle(
    state: State<'_, AppState>,
    loan_id: String,
) -> AppResult<EmiLoanBundle> {
    require_login(&state)?;
    let loan = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare(&format!("{} WHERE l.id = ?1", EMI_LOAN_SELECT_SQL))?;
        stmt.query_row(params![loan_id], row_to_emi_loan).optional()?
    };
    let Some(loan) = loan else {
        return Err(msg("Loan not found"));
    };
    let customer = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM emi_customers WHERE id = ?1",
            EMI_CUST_COLS
        ))?;
        stmt.query_row(params![loan.customer_id], row_to_emi_customer)?
    };
    let vendor = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, address, created_at FROM vendors WHERE id = ?1")?;
        stmt.query_row(params![loan.vendor_id], row_to_vendor)?
    };
    let payments = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM emi_payments WHERE loan_id = ?1 ORDER BY payment_date ASC",
            EMI_PAYMENT_COLS
        ))?;
        let rows = stmt.query_map(params![loan_id], row_to_emi_payment)?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    Ok(EmiLoanBundle {
        loan,
        customer,
        vendor,
        payments,
    })
}

// ===========================================================================
// EMI: Dashboard stats
// ===========================================================================

#[derive(Debug, Serialize)]
pub struct EmiDashboardStats {
    pub total_disbursed: f64,
    pub outstanding: f64,
    pub total_collected: f64,
    pub active_count: i64,
    pub closed_count: i64,
    pub foreclosed_count: i64,
    pub defaulted_count: i64,
    pub expected_emi_this_month: f64,
    pub collected_this_month: f64,
    pub overdue: Vec<EmiOverdueRow>,
    pub recent_payments: Vec<EmiPaymentRecent>,
}

#[derive(Debug, Serialize)]
pub struct EmiOverdueRow {
    pub loan_id: String,
    pub loan_code: Option<String>,
    pub customer_name: Option<String>,
    pub customer_code: Option<String>,
    pub product_name: String,
    pub emi_amount: f64,
    pub unpaid_count: i64,
    pub overdue_amount: f64,
    pub earliest_due_date: String,
    pub days_overdue: i64,
}

#[derive(Debug, Serialize)]
pub struct EmiPaymentRecent {
    pub id: String,
    pub loan_id: String,
    pub amount_paid: f64,
    pub payment_date: String,
    pub receipt_number: String,
    pub loan_code: Option<String>,
    pub product_name: Option<String>,
    pub customer_name: Option<String>,
}

#[tauri::command]
pub fn get_emi_dashboard_stats(state: State<'_, AppState>) -> AppResult<EmiDashboardStats> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();

    let total_disbursed: f64 = conn
        .query_row("SELECT COALESCE(SUM(vendor_paid_amount), 0) FROM emi_loans", [], |r| {
            r.get(0)
        })
        .unwrap_or(0.0);
    let outstanding: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(remaining_principal), 0) FROM emi_loans WHERE status = 'active'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);
    let total_collected: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount_paid), 0) FROM emi_payments", [], |r| {
            r.get(0)
        })
        .unwrap_or(0.0);

    let counts = |status: &str| -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM emi_loans WHERE status = ?1",
            params![status],
            |r| r.get(0),
        )
        .unwrap_or(0)
    };
    let active_count = counts("active");
    let closed_count = counts("closed");
    let foreclosed_count = counts("foreclosed");
    let defaulted_count = counts("defaulted");

    let today = chrono::Local::now().date_naive();
    let month_start = format!("{:04}-{:02}-01", today.year(), today.month());
    let month_end = {
        let (y, m) = if today.month() == 12 {
            (today.year() + 1, 1)
        } else {
            (today.year(), today.month() + 1)
        };
        let first_next =
            chrono::NaiveDate::from_ymd_opt(y, m, 1).unwrap_or(today);
        let last_day = first_next.pred_opt().unwrap_or(today);
        last_day.format("%Y-%m-%d").to_string()
    };

    let collected_this_month: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_paid), 0) FROM emi_payments
             WHERE payment_date >= ?1 AND payment_date <= ?2",
            params![month_start, month_end],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    // Walk active loans to compute expected EMI count this month + overdue.
    let mut stmt = conn.prepare(
        "SELECT l.id, l.loan_code, c.full_name, c.customer_code,
                l.product_name, l.emi_amount, l.tenure_months, l.first_emi_date
         FROM emi_loans l
         LEFT JOIN emi_customers c ON c.id = l.customer_id
         WHERE l.status = 'active'",
    )?;
    let loan_rows: Vec<(
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        String,
        f64,
        i64,
        String,
    )> = stmt
        .query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
                r.get(7)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(stmt);

    let grace: i64 = get_setting_i64(&conn, "grace_period_days", 3);

    let mut expected_emi_this_month = 0.0;
    let mut overdue: Vec<EmiOverdueRow> = Vec::new();
    let month_start_d = chrono::NaiveDate::parse_from_str(&month_start, "%Y-%m-%d").ok();
    let month_end_d = chrono::NaiveDate::parse_from_str(&month_end, "%Y-%m-%d").ok();

    for (loan_id, loan_code, cust_name, cust_code, product_name, emi_amount, tenure, first_emi) in
        loan_rows
    {
        let first = match chrono::NaiveDate::parse_from_str(&first_emi, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        // List of paid month_years for this loan
        let mut paid_months_stmt =
            conn.prepare("SELECT substr(due_date, 1, 7) FROM emi_payments WHERE loan_id = ?1")?;
        let paid_months: std::collections::HashSet<String> = paid_months_stmt
            .query_map(params![loan_id], |r| r.get::<_, String>(0))?
            .filter_map(Result::ok)
            .collect();
        drop(paid_months_stmt);

        let mut unpaid_due_dates: Vec<chrono::NaiveDate> = Vec::new();
        for i in 0..tenure {
            let due = add_months_naive(first, i);
            let due_key = due.format("%Y-%m").to_string();
            if let (Some(ms), Some(me)) = (month_start_d, month_end_d) {
                if due >= ms && due <= me {
                    expected_emi_this_month += emi_amount;
                }
            }
            if !paid_months.contains(&due_key) {
                let graced = due + chrono::Duration::days(grace);
                if today > graced {
                    unpaid_due_dates.push(due);
                }
            }
        }

        if !unpaid_due_dates.is_empty() {
            let earliest = *unpaid_due_dates.first().unwrap();
            let days = (today - earliest).num_days();
            overdue.push(EmiOverdueRow {
                loan_id,
                loan_code,
                customer_name: cust_name,
                customer_code: cust_code,
                product_name,
                emi_amount,
                unpaid_count: unpaid_due_dates.len() as i64,
                overdue_amount: emi_amount * (unpaid_due_dates.len() as f64),
                earliest_due_date: earliest.format("%Y-%m-%d").to_string(),
                days_overdue: days,
            });
        }
    }
    overdue.sort_by(|a, b| b.days_overdue.cmp(&a.days_overdue));

    // Recent payments
    let mut recent_stmt = conn.prepare(
        "SELECT p.id, p.loan_id, p.amount_paid, p.payment_date, p.receipt_number,
                l.loan_code, l.product_name, c.full_name
         FROM emi_payments p
         LEFT JOIN emi_loans l ON l.id = p.loan_id
         LEFT JOIN emi_customers c ON c.id = l.customer_id
         ORDER BY p.payment_date DESC LIMIT 10",
    )?;
    let recent_payments: Vec<EmiPaymentRecent> = recent_stmt
        .query_map([], |r| {
            Ok(EmiPaymentRecent {
                id: r.get(0)?,
                loan_id: r.get(1)?,
                amount_paid: r.get(2)?,
                payment_date: r.get(3)?,
                receipt_number: r.get(4)?,
                loan_code: r.get(5)?,
                product_name: r.get(6)?,
                customer_name: r.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(EmiDashboardStats {
        total_disbursed,
        outstanding,
        total_collected,
        active_count,
        closed_count,
        foreclosed_count,
        defaulted_count,
        expected_emi_this_month,
        collected_this_month,
        overdue,
        recent_payments,
    })
}

fn add_months_naive(d: chrono::NaiveDate, months: i64) -> chrono::NaiveDate {
    let mut y = d.year();
    let mut m = d.month() as i64 + months;
    while m > 12 {
        m -= 12;
        y += 1;
    }
    while m < 1 {
        m += 12;
        y -= 1;
    }
    chrono::NaiveDate::from_ymd_opt(y, m as u32, d.day().min(28)).unwrap_or(d)
}

// ===========================================================================
// External Investments
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct ExtInvestment {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub principal_amount: f64,
    pub expected_roi: Option<f64>,
    pub start_date: String,
    pub maturity_date: Option<String>,
    pub payout_frequency: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub total_returns: f64,
}

#[derive(Debug, Deserialize)]
pub struct ExtInvestmentInput {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub principal_amount: f64,
    pub expected_roi: Option<f64>,
    pub start_date: String,
    pub maturity_date: Option<String>,
    pub payout_frequency: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct InvestmentReturn {
    pub id: String,
    pub investment_id: String,
    pub amount: f64,
    pub return_date: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct InvestmentReturnInput {
    pub investment_id: String,
    pub amount: f64,
    pub return_date: String,
    pub description: Option<String>,
}

#[tauri::command]
pub fn list_investments(state: State<'_, AppState>) -> AppResult<Vec<ExtInvestment>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT i.id, i.name, i.type, i.principal_amount, i.expected_roi,
                i.start_date, i.maturity_date, i.payout_frequency, i.status,
                i.notes, i.created_at,
                COALESCE((SELECT SUM(amount) FROM investment_returns
                          WHERE investment_id = i.id), 0)
         FROM external_investments i
         ORDER BY i.created_at DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ExtInvestment {
            id: r.get(0)?,
            name: r.get(1)?,
            r#type: r.get(2)?,
            principal_amount: r.get(3)?,
            expected_roi: r.get(4)?,
            start_date: r.get(5)?,
            maturity_date: r.get(6)?,
            payout_frequency: r.get(7)?,
            status: r.get(8)?,
            notes: r.get(9)?,
            created_at: r.get(10)?,
            total_returns: r.get(11)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn list_investment_returns(state: State<'_, AppState>) -> AppResult<Vec<InvestmentReturn>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, investment_id, amount, return_date, description, created_at
         FROM investment_returns ORDER BY return_date DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(InvestmentReturn {
            id: r.get(0)?,
            investment_id: r.get(1)?,
            amount: r.get(2)?,
            return_date: r.get(3)?,
            description: r.get(4)?,
            created_at: r.get(5)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn create_investment(
    state: State<'_, AppState>,
    input: ExtInvestmentInput,
) -> AppResult<()> {
    require_login(&state)?;
    if input.name.trim().is_empty() {
        return Err(msg("Investment name is required"));
    }
    if input.principal_amount <= 0.0 {
        return Err(msg("Principal must be greater than 0"));
    }
    let id = Uuid::new_v4().to_string();
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO external_investments
            (id, name, type, principal_amount, expected_roi, start_date,
             maturity_date, payout_frequency, status, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Active', ?9)",
        params![
            id,
            input.name.trim(),
            input.r#type,
            input.principal_amount,
            input.expected_roi,
            input.start_date,
            empty_to_none(input.maturity_date),
            empty_to_none(input.payout_frequency),
            empty_to_none(input.notes),
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn update_investment(
    state: State<'_, AppState>,
    id: String,
    input: ExtInvestmentInput,
) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE external_investments
         SET name = ?2, type = ?3, principal_amount = ?4, expected_roi = ?5,
             start_date = ?6, maturity_date = ?7, payout_frequency = ?8,
             notes = ?9, updated_at = datetime('now')
         WHERE id = ?1",
        params![
            id,
            input.name.trim(),
            input.r#type,
            input.principal_amount,
            input.expected_roi,
            input.start_date,
            empty_to_none(input.maturity_date),
            empty_to_none(input.payout_frequency),
            empty_to_none(input.notes),
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn update_investment_status(
    state: State<'_, AppState>,
    id: String,
    status: String,
) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE external_investments SET status = ?2, updated_at = datetime('now')
         WHERE id = ?1",
        params![id, status],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_investment(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM external_investments WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn add_investment_return(
    state: State<'_, AppState>,
    input: InvestmentReturnInput,
) -> AppResult<()> {
    require_login(&state)?;
    if input.amount <= 0.0 {
        return Err(msg("Return amount must be greater than 0"));
    }
    let id = Uuid::new_v4().to_string();
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO investment_returns
          (id, investment_id, amount, return_date, description)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            id,
            input.investment_id,
            input.amount,
            input.return_date,
            empty_to_none(input.description),
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_investment_return(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM investment_returns WHERE id = ?1", params![id])?;
    Ok(())
}

// ===========================================================================
// External Personal Loans (ext_loans + ext_loan_txns)
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct ExtLoan {
    pub id: String,
    pub borrower_name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub id_proof: Option<String>,
    pub principal_amount: f64,
    pub interest_rate: f64,
    pub start_date: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ExtLoanInput {
    pub borrower_name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub id_proof: Option<String>,
    pub principal_amount: f64,
    pub interest_rate: f64,
    pub start_date: String,
}

#[derive(Debug, Deserialize)]
pub struct ExtLoanEditInput {
    pub borrower_name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub id_proof: Option<String>,
    pub interest_rate: f64,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ExtLoanTxn {
    pub id: String,
    pub loan_id: String,
    pub r#type: String,
    pub amount: f64,
    pub txn_date: String,
    pub receipt_number: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ExtLoanPaymentInput {
    pub loan_id: String,
    pub r#type: String,
    pub amount: f64,
    pub txn_date: String,
    pub notes: Option<String>,
}

fn row_to_ext_loan(r: &Row<'_>) -> rusqlite::Result<ExtLoan> {
    Ok(ExtLoan {
        id: r.get(0)?,
        borrower_name: r.get(1)?,
        phone: r.get(2)?,
        address: r.get(3)?,
        id_proof: r.get(4)?,
        principal_amount: r.get(5)?,
        interest_rate: r.get(6)?,
        start_date: r.get(7)?,
        status: r.get(8)?,
        created_at: r.get(9)?,
    })
}

const EXT_LOAN_COLS: &str = "id, borrower_name, phone, address, id_proof,
        principal_amount, interest_rate, start_date, status, created_at";

#[tauri::command]
pub fn list_ext_loans(state: State<'_, AppState>) -> AppResult<Vec<ExtLoan>> {
    require_login(&state)?;
    // Auto-generate any missing monthly Interest Due rows first.
    auto_generate_ext_interest(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM ext_loans ORDER BY created_at DESC",
        EXT_LOAN_COLS
    ))?;
    let rows = stmt.query_map([], row_to_ext_loan)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn list_ext_loan_txns(state: State<'_, AppState>) -> AppResult<Vec<ExtLoanTxn>> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, loan_id, type, amount, txn_date, receipt_number, notes, created_at
         FROM ext_loan_txns ORDER BY txn_date DESC, created_at DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ExtLoanTxn {
            id: r.get(0)?,
            loan_id: r.get(1)?,
            r#type: r.get(2)?,
            amount: r.get(3)?,
            txn_date: r.get(4)?,
            receipt_number: r.get(5)?,
            notes: r.get(6)?,
            created_at: r.get(7)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn create_ext_loan(state: State<'_, AppState>, input: ExtLoanInput) -> AppResult<()> {
    require_login(&state)?;
    if input.borrower_name.trim().is_empty() {
        return Err(msg("Borrower name is required"));
    }
    if input.principal_amount <= 0.0 {
        return Err(msg("Principal must be greater than 0"));
    }
    let id = Uuid::new_v4().to_string();
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO ext_loans
            (id, borrower_name, phone, address, id_proof, principal_amount,
             interest_rate, start_date, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Active')",
        params![
            id,
            input.borrower_name.trim(),
            empty_to_none(input.phone),
            empty_to_none(input.address),
            empty_to_none(input.id_proof),
            input.principal_amount,
            input.interest_rate,
            input.start_date,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn update_ext_loan(
    state: State<'_, AppState>,
    id: String,
    input: ExtLoanEditInput,
) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE ext_loans SET
            borrower_name = ?2, phone = ?3, address = ?4, id_proof = ?5,
            interest_rate = ?6, status = ?7, updated_at = datetime('now')
         WHERE id = ?1",
        params![
            id,
            input.borrower_name.trim(),
            empty_to_none(input.phone),
            empty_to_none(input.address),
            empty_to_none(input.id_proof),
            input.interest_rate,
            input.status,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_ext_loan(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM ext_loans WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn add_ext_loan_payment(
    state: State<'_, AppState>,
    input: ExtLoanPaymentInput,
) -> AppResult<ExtLoanTxn> {
    require_login(&state)?;
    if !matches!(
        input.r#type.as_str(),
        "Interest Paid" | "Principal Paid"
    ) {
        return Err(msg("Payment type must be 'Interest Paid' or 'Principal Paid'"));
    }
    if input.amount <= 0.0 {
        return Err(msg("Amount must be greater than 0"));
    }
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let n: u32 = rng.gen_range(100_000..1_000_000);
    let receipt = format!("REC-{}", n);
    let id = Uuid::new_v4().to_string();
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO ext_loan_txns
          (id, loan_id, type, amount, txn_date, receipt_number, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.loan_id,
            input.r#type,
            input.amount,
            input.txn_date,
            receipt,
            empty_to_none(input.notes.clone()),
        ],
    )?;
    Ok(ExtLoanTxn {
        id,
        loan_id: input.loan_id,
        r#type: input.r#type,
        amount: input.amount,
        txn_date: input.txn_date,
        receipt_number: Some(receipt),
        notes: input.notes,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn delete_ext_loan_txn(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_login(&state)?;
    let conn = state.db.lock().unwrap();
    // Only allow deleting non-auto rows (Interest Due rows are auto-managed)
    let row: Option<String> = conn
        .query_row(
            "SELECT type FROM ext_loan_txns WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    let Some(t) = row else { return Err(msg("Transaction not found")); };
    if t == "Interest Due" {
        return Err(msg(
            "Interest Due rows are auto-generated and cannot be deleted.",
        ));
    }
    conn.execute("DELETE FROM ext_loan_txns WHERE id = ?1", params![id])?;
    Ok(())
}

/// Walk each active ext_loan and INSERT one 'Interest Due' row per month
/// since start_date+1 month, up to today, if none exists for that month.
fn auto_generate_ext_interest(state: &AppState) -> AppResult<()> {
    let mut conn = state.db.lock().unwrap();
    let loans: Vec<(String, f64, f64, String)> = {
        let mut stmt = conn.prepare(
            "SELECT id, principal_amount, interest_rate, start_date
             FROM ext_loans WHERE status = 'Active'",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, f64>(1)?,
                r.get::<_, f64>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let today = chrono::Local::now().date_naive();
    let tx = conn.transaction()?;
    for (loan_id, principal, rate, start_date) in loans {
        let start = match chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        let monthly_interest = (principal * rate) / 100.0;
        let mut cur = add_months_naive(start, 1);
        while cur <= today {
            let month_key = cur.format("%Y-%m").to_string();
            let exists: i64 = tx.query_row(
                "SELECT COUNT(*) FROM ext_loan_txns
                 WHERE loan_id = ?1 AND type = 'Interest Due'
                   AND substr(txn_date, 1, 7) = ?2",
                params![loan_id, month_key],
                |r| r.get(0),
            )?;
            if exists == 0 {
                tx.execute(
                    "INSERT INTO ext_loan_txns
                      (id, loan_id, type, amount, txn_date, notes)
                     VALUES (?1, ?2, 'Interest Due', ?3, ?4, ?5)",
                    params![
                        Uuid::new_v4().to_string(),
                        loan_id,
                        monthly_interest,
                        cur.format("%Y-%m-%d").to_string(),
                        format!("Auto-generated interest for {}", cur.format("%B %Y")),
                    ],
                )?;
            }
            cur = add_months_naive(cur, 1);
        }
    }
    tx.commit()?;
    Ok(())
}
