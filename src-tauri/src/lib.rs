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
            // auth
            commands::is_first_run,
            commands::setup_admin,
            commands::login,
            commands::logout,
            commands::is_logged_in,
            commands::get_admin_profile,
            commands::update_admin_profile,
            commands::change_admin_password,
            // settings
            commands::list_settings,
            commands::list_text_settings,
            commands::save_settings,
            commands::save_text_settings,
            commands::get_setting,
            commands::set_setting,
            // members
            commands::list_members,
            commands::get_member,
            commands::create_member,
            commands::update_member,
            commands::delete_member,
            commands::bulk_delete_members,
            commands::save_member_photo,
            // savings
            commands::list_savings,
            commands::list_member_savings,
            commands::create_savings,
            commands::update_savings,
            commands::delete_savings,
            // loans (member)
            commands::list_active_loans,
            commands::list_member_loans,
            commands::disburse_loan,
            commands::record_loan_repayment,
            commands::list_repayments_for_loans,
            // member profile / statement
            commands::get_statement_bundle,
            // dashboard
            commands::get_dashboard_stats,
            // backup
            commands::export_backup_zip,
            commands::write_text_file,
            // reports
            commands::list_savings_in_range,
            commands::list_savings_by_month_year_range,
            commands::list_repayments_in_range,
            // EMI: vendors
            commands::list_vendors,
            commands::create_vendor,
            commands::update_vendor,
            commands::delete_vendor,
            // EMI: customers
            commands::list_emi_customers,
            commands::get_emi_customer,
            commands::create_emi_customer,
            commands::update_emi_customer,
            commands::delete_emi_customer,
            commands::save_emi_customer_photo,
            // EMI: loans
            commands::list_emi_loans,
            commands::get_emi_loan,
            commands::create_emi_loan,
            commands::update_emi_loan,
            commands::delete_emi_loan,
            // EMI: payments
            commands::list_emi_payments,
            commands::list_emi_payments_for_loan,
            commands::record_emi_payment,
            commands::delete_emi_payment,
            // EMI: bundle + dashboard
            commands::get_emi_loan_bundle,
            commands::get_emi_dashboard_stats,
            // Investments
            commands::list_investments,
            commands::list_investment_returns,
            commands::create_investment,
            commands::update_investment,
            commands::update_investment_status,
            commands::delete_investment,
            commands::add_investment_return,
            commands::delete_investment_return,
            // External personal loans
            commands::list_ext_loans,
            commands::list_ext_loan_txns,
            commands::create_ext_loan,
            commands::update_ext_loan,
            commands::delete_ext_loan,
            commands::add_ext_loan_payment,
            commands::delete_ext_loan_txn,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
