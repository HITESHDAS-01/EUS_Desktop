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
