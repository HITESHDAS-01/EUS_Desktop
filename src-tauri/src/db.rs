use crate::error::AppResult;
use rusqlite::{params, Connection};
use std::path::Path;

const SCHEMA_SQL: &str = r#"
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Single-admin auth row. id is forced to 1 — only one admin can ever exist.
CREATE TABLE IF NOT EXISTS admin_account (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  full_name       TEXT,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Member KYC + display info. id is a UUID v4 string.
CREATE TABLE IF NOT EXISTS profiles (
  id                  TEXT PRIMARY KEY,
  full_name           TEXT,
  phone               TEXT,
  photo_url           TEXT,
  address             TEXT,
  father_husband_name TEXT,
  gender              TEXT,
  date_of_birth       TEXT,
  aadhaar_vid         TEXT,
  nominee_name        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id                   TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  member_code          TEXT UNIQUE,
  category             TEXT NOT NULL CHECK (category IN ('A','B','C')),
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','inactive','matured','withdrawn','closed')),
  join_date            TEXT NOT NULL DEFAULT (date('now')),
  initial_investment   REAL NOT NULL DEFAULT 0,
  monthly_installment  REAL,
  chosen_term_months   INTEGER,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_category  ON members(category);
CREATE INDEX IF NOT EXISTS idx_members_status    ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_join_date ON members(join_date);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_text_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#;

const SEED_SETTINGS: &[(&str, &str)] = &[
    ("roi_24_months", "16"),
    ("roi_36_months", "27"),
    ("penalty_percentage", "5"),
    ("monthly_due_day", "10"),
    ("loan_interest_rate", "12"),
];

const SEED_TEXT_SETTINGS: &[(&str, &str)] = &[
    ("member_code_prefix", "EUS"),
    ("organisation_name", "Ekata Unnayan Sanstha"),
    ("organisation_short", "EUS"),
    ("organisation_tagline", "Together we grow"),
];

pub fn open_and_migrate(db_path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(SCHEMA_SQL)?;

    // Idempotent seed — only inserts when key is absent.
    for (k, v) in SEED_SETTINGS {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        )?;
    }
    for (k, v) in SEED_TEXT_SETTINGS {
        conn.execute(
            "INSERT OR IGNORE INTO app_text_settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        )?;
    }
    Ok(conn)
}

/// Generate the next member_code in the format <PREFIX>/MMYYYY/<CAT>/<NNN>.
/// Mirrors the Postgres trigger from eus/client-setup/sql/01-schema.sql.
pub fn generate_member_code(
    conn: &Connection,
    category: &str,
    join_date: &str, // ISO yyyy-mm-dd
) -> AppResult<String> {
    let prefix: String = conn
        .query_row(
            "SELECT value FROM app_text_settings WHERE key = 'member_code_prefix'",
            [],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "EUS".to_string());

    // join_date is yyyy-mm-dd -> we want MMYYYY
    let mm_yyyy = if join_date.len() >= 10 {
        let yyyy = &join_date[0..4];
        let mm = &join_date[5..7];
        format!("{mm}{yyyy}")
    } else {
        // Fallback: today
        let now = chrono::Local::now();
        now.format("%m%Y").to_string()
    };

    // Count members in the same category for that MMYYYY bucket.
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM members
         WHERE category = ?1
           AND substr(join_date, 6, 2) || substr(join_date, 1, 4) = ?2",
        params![category, mm_yyyy],
        |r| r.get(0),
    )?;

    let seq = count + 1;
    Ok(format!("{prefix}/{mm_yyyy}/{category}/{:03}", seq))
}
