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

-- =========================================================================
-- Product-EMI tables
-- =========================================================================

CREATE TABLE IF NOT EXISTS vendors (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emi_customers (
  id                   TEXT PRIMARY KEY,
  customer_code        TEXT UNIQUE,
  full_name            TEXT NOT NULL,
  phone                TEXT,
  address              TEXT,
  father_husband_name  TEXT,
  date_of_birth        TEXT,
  aadhaar_vid          TEXT,
  pan_number           TEXT,
  occupation           TEXT,
  monthly_income       REAL,
  nominee_name         TEXT,
  photo_url            TEXT,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emi_loans (
  id                     TEXT PRIMARY KEY,
  loan_code              TEXT UNIQUE,
  customer_id            TEXT NOT NULL REFERENCES emi_customers(id) ON DELETE RESTRICT,
  vendor_id              TEXT NOT NULL REFERENCES vendors(id)        ON DELETE RESTRICT,
  product_name           TEXT NOT NULL,
  product_category       TEXT,
  product_price          REAL NOT NULL CHECK (product_price > 0),
  downpayment            REAL NOT NULL DEFAULT 0 CHECK (downpayment >= 0),
  financed_amount        REAL NOT NULL,
  interest_rate          REAL NOT NULL,
  tenure_months          INTEGER NOT NULL CHECK (tenure_months > 0),
  emi_amount             REAL NOT NULL,
  total_payable          REAL NOT NULL,
  total_interest         REAL NOT NULL,
  vendor_paid_amount     REAL NOT NULL,
  vendor_paid_date       TEXT NOT NULL,
  vendor_invoice_number  TEXT,
  disbursed_date         TEXT NOT NULL,
  first_emi_date         TEXT NOT NULL,
  remaining_principal    REAL NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','closed','defaulted','foreclosed')),
  notes                  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_emi_loans_customer ON emi_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_emi_loans_vendor   ON emi_loans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_emi_loans_status   ON emi_loans(status);

CREATE TABLE IF NOT EXISTS emi_payments (
  id                TEXT PRIMARY KEY,
  loan_id           TEXT NOT NULL REFERENCES emi_loans(id) ON DELETE CASCADE,
  amount_paid       REAL NOT NULL CHECK (amount_paid > 0),
  principal_portion REAL NOT NULL DEFAULT 0,
  interest_portion  REAL NOT NULL DEFAULT 0,
  penalty_portion   REAL NOT NULL DEFAULT 0,
  payment_date      TEXT NOT NULL,
  due_date          TEXT NOT NULL,
  month_year        TEXT NOT NULL,
  receipt_number    TEXT UNIQUE NOT NULL,
  payment_method    TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_emi_payments_loan ON emi_payments(loan_id);
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

fn read_prefix(conn: &Connection) -> String {
    conn.query_row(
        "SELECT value FROM app_text_settings WHERE key = 'member_code_prefix'",
        [],
        |r| r.get(0),
    )
    .unwrap_or_else(|_| "EUS".to_string())
}

fn mm_yyyy(date_str: &str) -> String {
    if date_str.len() >= 10 {
        let yyyy = &date_str[0..4];
        let mm = &date_str[5..7];
        format!("{mm}{yyyy}")
    } else {
        chrono::Local::now().format("%m%Y").to_string()
    }
}

/// Member code: <PREFIX>/MMYYYY/<CAT>/<NNN>.
pub fn generate_member_code(
    conn: &Connection,
    category: &str,
    join_date: &str,
) -> AppResult<String> {
    let prefix = read_prefix(conn);
    let key = mm_yyyy(join_date);
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM members
         WHERE category = ?1
           AND substr(join_date, 6, 2) || substr(join_date, 1, 4) = ?2",
        params![category, key],
        |r| r.get(0),
    )?;
    let seq = count + 1;
    Ok(format!("{prefix}/{key}/{category}/{:03}", seq))
}

/// EMI customer code: <PREFIX>/EMI/C/MMYYYY/NNN — bucketed by created_at month.
pub fn generate_emi_customer_code(conn: &Connection) -> AppResult<String> {
    let prefix = read_prefix(conn);
    let key = chrono::Local::now().format("%m%Y").to_string();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM emi_customers
         WHERE substr(created_at, 6, 2) || substr(created_at, 1, 4) = ?1",
        params![key],
        |r| r.get(0),
    )?;
    let seq = count + 1;
    Ok(format!("{prefix}/EMI/C/{key}/{:03}", seq))
}

/// EMI loan code: <PREFIX>/EMI/L/MMYYYY/NNN — bucketed by disbursed_date month.
pub fn generate_emi_loan_code(conn: &Connection, disbursed_date: &str) -> AppResult<String> {
    let prefix = read_prefix(conn);
    let key = mm_yyyy(disbursed_date);
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM emi_loans
         WHERE substr(disbursed_date, 6, 2) || substr(disbursed_date, 1, 4) = ?1",
        params![key],
        |r| r.get(0),
    )?;
    let seq = count + 1;
    Ok(format!("{prefix}/EMI/L/{key}/{:03}", seq))
}
