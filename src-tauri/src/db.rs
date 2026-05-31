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
  loan_interest_rate   REAL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_category  ON members(category);
CREATE INDEX IF NOT EXISTS idx_members_status    ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_join_date ON members(join_date);

-- Monthly savings deposits (Cat A + Cat C).
CREATE TABLE IF NOT EXISTS savings_installments (
  id              TEXT PRIMARY KEY,
  member_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount          REAL NOT NULL CHECK (amount > 0),
  penalty         REAL NOT NULL DEFAULT 0 CHECK (penalty >= 0),
  payment_date    TEXT NOT NULL,
  due_date        TEXT NOT NULL,
  month_year      TEXT NOT NULL,
  receipt_number  TEXT UNIQUE NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_si_member       ON savings_installments(member_id);
CREATE INDEX IF NOT EXISTS idx_si_payment_date ON savings_installments(payment_date);
CREATE INDEX IF NOT EXISTS idx_si_month_year   ON savings_installments(month_year);

-- Member loans against savings.
CREATE TABLE IF NOT EXISTS loans (
  id                  TEXT PRIMARY KEY,
  member_id           TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  principal_amount    REAL NOT NULL CHECK (principal_amount > 0),
  interest_rate       REAL NOT NULL,
  remaining_principal REAL NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','closed')),
  disbursed_date      TEXT NOT NULL DEFAULT (date('now')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id                TEXT PRIMARY KEY,
  loan_id           TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount_paid       REAL NOT NULL CHECK (amount_paid > 0),
  principal_portion REAL NOT NULL DEFAULT 0,
  interest_portion  REAL NOT NULL DEFAULT 0,
  payment_date      TEXT NOT NULL,
  receipt_number    TEXT UNIQUE NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lr_loan ON loan_repayments(loan_id);

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
    ("penalty_percentage", "5"),
    ("monthly_due_day", "10"),
    ("grace_period_days", "3"),
    ("loan_eligibility_percent", "80"),
    ("roi_category_b", "36"),
    ("roi_category_c_24", "16"),
    ("roi_category_c_36", "27"),
];

const SEED_TEXT_SETTINGS: &[(&str, &str)] = &[
    ("member_code_prefix", "EUS"),
    ("org_name", "Ekata Unnayan Sanstha"),
    ("org_short", "EUS"),
    ("org_name_native", "একতা উন্নয়ন সংস্থা"),
    ("org_tagline", "Member-owned cooperative savings"),
    ("org_email", ""),
    ("org_phone", ""),
    ("org_address", ""),
    ("org_logo_url", ""),
];

pub fn open_and_migrate(db_path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(SCHEMA_SQL)?;

    // Per-version column migrations — safe to re-run.
    add_column_if_missing(&conn, "members", "loan_interest_rate", "REAL")?;

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

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    col_type: &str,
) -> AppResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let exists = stmt
        .query_map([], |r| r.get::<_, String>(1))?
        .filter_map(Result::ok)
        .any(|name| name.eq_ignore_ascii_case(column));
    if !exists {
        conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, col_type),
            [],
        )?;
    }
    Ok(())
}

/// Generate the next member_code in the format <PREFIX>/MMYYYY/<CAT>/<NNN>.
/// Mirrors the Postgres trigger from eus/client-setup/sql/01-schema.sql.
pub fn generate_member_code(
    conn: &Connection,
    category: &str,
    join_date: &str,
) -> AppResult<String> {
    let prefix: String = conn
        .query_row(
            "SELECT value FROM app_text_settings WHERE key = 'member_code_prefix'",
            [],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "EUS".to_string());

    let mm_yyyy = if join_date.len() >= 10 {
        let yyyy = &join_date[0..4];
        let mm = &join_date[5..7];
        format!("{mm}{yyyy}")
    } else {
        let now = chrono::Local::now();
        now.format("%m%Y").to_string()
    };

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
