import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type {
  AdminProfile,
  DashboardStats,
  EmiCustomer,
  EmiCustomerInput,
  EmiDashboardStats,
  EmiLoan,
  EmiLoanBundle,
  EmiLoanInput,
  EmiLoanUpdate,
  EmiPayment,
  EmiPaymentInput,
  ExtInvestment,
  ExtInvestmentInput,
  ExtLoan,
  ExtLoanEditInput,
  ExtLoanInput,
  ExtLoanPaymentInput,
  ExtLoanTxn,
  InvestmentReturn,
  InvestmentReturnInput,
  LoanInput,
  LoanRow,
  MemberInput,
  MemberRow,
  RepaymentInput,
  RepaymentReportRow,
  RepaymentRow,
  SavingsInput,
  SavingsRow,
  SavingsUpdate,
  StatementBundle,
  Vendor,
  VendorInput,
} from '@/types/db';

export const api = {
  // ---------- auth ----------
  isFirstRun: () => invoke<boolean>('is_first_run'),
  setupAdmin: (fullName: string, password: string) =>
    invoke<void>('setup_admin', { fullName, password }),
  login: (password: string) => invoke<void>('login', { password }),
  logout: () => invoke<void>('logout'),
  isLoggedIn: () => invoke<boolean>('is_logged_in'),
  getAdminProfile: () => invoke<AdminProfile>('get_admin_profile'),
  updateAdminProfile: (fullName: string) =>
    invoke<void>('update_admin_profile', { fullName }),
  changeAdminPassword: (currentPassword: string, newPassword: string) =>
    invoke<void>('change_admin_password', { currentPassword, newPassword }),
  resetAdminOnly: (password: string) =>
    invoke<void>('reset_admin_only', { password }),
  factoryReset: (password: string) =>
    invoke<void>('factory_reset', { password }),

  // ---------- settings ----------
  listSettings: () => invoke<Record<string, string>>('list_settings'),
  listTextSettings: () => invoke<Record<string, string>>('list_text_settings'),
  saveSettings: (values: Record<string, string>) =>
    invoke<void>('save_settings', { values }),
  saveTextSettings: (values: Record<string, string>) =>
    invoke<void>('save_text_settings', { values }),
  getSetting: (table: 'settings' | 'app_text_settings', key: string) =>
    invoke<string | null>('get_setting', { table, key }),
  setSetting: (table: 'settings' | 'app_text_settings', key: string, value: string) =>
    invoke<void>('set_setting', { table, key, value }),

  // ---------- members ----------
  listMembers: () => invoke<MemberRow[]>('list_members'),
  getMember: (id: string) => invoke<MemberRow | null>('get_member', { id }),
  createMember: (input: MemberInput) => invoke<MemberRow>('create_member', { input }),
  updateMember: (id: string, input: MemberInput) =>
    invoke<MemberRow>('update_member', { id, input }),
  deleteMember: (id: string) => invoke<void>('delete_member', { id }),
  bulkDeleteMembers: (ids: string[]) => invoke<number>('bulk_delete_members', { ids }),
  saveMemberPhoto: async (file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const buf = new Uint8Array(await file.arrayBuffer());
    return invoke<string>('save_member_photo', {
      photo: { bytes: Array.from(buf), ext },
    });
  },

  // ---------- savings ----------
  listSavings: () => invoke<SavingsRow[]>('list_savings'),
  listMemberSavings: (memberId: string) =>
    invoke<SavingsRow[]>('list_member_savings', { memberId }),
  createSavings: (input: SavingsInput) => invoke<SavingsRow>('create_savings', { input }),
  updateSavings: (id: string, input: SavingsUpdate) =>
    invoke<void>('update_savings', { id, input }),
  deleteSavings: (id: string) => invoke<void>('delete_savings', { id }),

  // ---------- member loans ----------
  listActiveLoans: () => invoke<LoanRow[]>('list_active_loans'),
  listMemberLoans: (memberId: string) =>
    invoke<LoanRow[]>('list_member_loans', { memberId }),
  disburseLoan: (input: LoanInput) => invoke<LoanRow>('disburse_loan', { input }),
  recordLoanRepayment: (input: RepaymentInput) =>
    invoke<RepaymentRow>('record_loan_repayment', { input }),
  listRepaymentsForLoans: (loanIds: string[]) =>
    invoke<RepaymentRow[]>('list_repayments_for_loans', { loanIds }),

  // ---------- statement / member profile ----------
  getStatementBundle: (memberId: string) =>
    invoke<StatementBundle>('get_statement_bundle', { memberId }),

  // ---------- dashboard ----------
  getDashboardStats: () => invoke<DashboardStats>('get_dashboard_stats'),

  // ---------- backup / file write ----------
  exportBackupZip: (destPath: string) =>
    invoke<string>('export_backup_zip', { destPath }),
  writeTextFile: (path: string, content: string) =>
    invoke<void>('write_text_file', { path, content }),

  // ---------- reports ----------
  listSavingsInRange: (start: string, end: string) =>
    invoke<SavingsRow[]>('list_savings_in_range', { start, end }),
  listSavingsByMonthYearRange: (start: string, end: string) =>
    invoke<SavingsRow[]>('list_savings_by_month_year_range', { start, end }),
  listRepaymentsInRange: (start: string, end: string) =>
    invoke<RepaymentReportRow[]>('list_repayments_in_range', { start, end }),

  // ---------- EMI: vendors ----------
  listVendors: () => invoke<Vendor[]>('list_vendors'),
  createVendor: (input: VendorInput) => invoke<Vendor>('create_vendor', { input }),
  updateVendor: (id: string, input: VendorInput) =>
    invoke<void>('update_vendor', { id, input }),
  deleteVendor: (id: string) => invoke<void>('delete_vendor', { id }),

  // ---------- EMI: customers ----------
  listEmiCustomers: () => invoke<EmiCustomer[]>('list_emi_customers'),
  getEmiCustomer: (id: string) =>
    invoke<EmiCustomer | null>('get_emi_customer', { id }),
  createEmiCustomer: (input: EmiCustomerInput) =>
    invoke<EmiCustomer>('create_emi_customer', { input }),
  updateEmiCustomer: (id: string, input: EmiCustomerInput) =>
    invoke<void>('update_emi_customer', { id, input }),
  deleteEmiCustomer: (id: string) =>
    invoke<void>('delete_emi_customer', { id }),
  saveEmiCustomerPhoto: async (file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const buf = new Uint8Array(await file.arrayBuffer());
    return invoke<string>('save_emi_customer_photo', {
      photo: { bytes: Array.from(buf), ext },
    });
  },

  // ---------- EMI: loans ----------
  listEmiLoans: () => invoke<EmiLoan[]>('list_emi_loans'),
  getEmiLoan: (id: string) => invoke<EmiLoan | null>('get_emi_loan', { id }),
  createEmiLoan: (input: EmiLoanInput) =>
    invoke<EmiLoan>('create_emi_loan', { input }),
  updateEmiLoan: (id: string, input: EmiLoanUpdate) =>
    invoke<void>('update_emi_loan', { id, input }),
  deleteEmiLoan: (id: string) => invoke<void>('delete_emi_loan', { id }),

  // ---------- EMI: payments ----------
  listEmiPayments: () => invoke<EmiPayment[]>('list_emi_payments'),
  listEmiPaymentsForLoan: (loanId: string) =>
    invoke<EmiPayment[]>('list_emi_payments_for_loan', { loanId }),
  recordEmiPayment: (input: EmiPaymentInput) =>
    invoke<EmiPayment>('record_emi_payment', { input }),
  deleteEmiPayment: (id: string) =>
    invoke<void>('delete_emi_payment', { id }),

  // ---------- EMI: bundle + dashboard ----------
  getEmiLoanBundle: (loanId: string) =>
    invoke<EmiLoanBundle>('get_emi_loan_bundle', { loanId }),
  getEmiDashboardStats: () =>
    invoke<EmiDashboardStats>('get_emi_dashboard_stats'),

  // ---------- Investments ----------
  listInvestments: () => invoke<ExtInvestment[]>('list_investments'),
  listInvestmentReturns: () => invoke<InvestmentReturn[]>('list_investment_returns'),
  createInvestment: (input: ExtInvestmentInput) =>
    invoke<void>('create_investment', { input }),
  updateInvestment: (id: string, input: ExtInvestmentInput) =>
    invoke<void>('update_investment', { id, input }),
  updateInvestmentStatus: (id: string, status: string) =>
    invoke<void>('update_investment_status', { id, status }),
  deleteInvestment: (id: string) => invoke<void>('delete_investment', { id }),
  addInvestmentReturn: (input: InvestmentReturnInput) =>
    invoke<void>('add_investment_return', { input }),
  deleteInvestmentReturn: (id: string) =>
    invoke<void>('delete_investment_return', { id }),

  // ---------- External personal loans ----------
  listExtLoans: () => invoke<ExtLoan[]>('list_ext_loans'),
  listExtLoanTxns: () => invoke<ExtLoanTxn[]>('list_ext_loan_txns'),
  createExtLoan: (input: ExtLoanInput) => invoke<void>('create_ext_loan', { input }),
  updateExtLoan: (id: string, input: ExtLoanEditInput) =>
    invoke<void>('update_ext_loan', { id, input }),
  deleteExtLoan: (id: string) => invoke<void>('delete_ext_loan', { id }),
  addExtLoanPayment: (input: ExtLoanPaymentInput) =>
    invoke<ExtLoanTxn>('add_ext_loan_payment', { input }),
  deleteExtLoanTxn: (id: string) => invoke<void>('delete_ext_loan_txn', { id }),
};

export function photoSrc(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return convertFileSrc(path);
}
