import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type {
  AdminProfile,
  DashboardStats,
  LoanInput,
  LoanRow,
  MemberInput,
  MemberRow,
  RepaymentInput,
  RepaymentRow,
  SavingsInput,
  SavingsRow,
  SavingsUpdate,
  StatementBundle,
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

  // ---------- loans ----------
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

  // ---------- backup ----------
  exportBackupZip: (destPath: string) =>
    invoke<string>('export_backup_zip', { destPath }),
};

/**
 * Convert a stored absolute photo path into a src URL the webview can load.
 * Empty / null inputs pass through.
 */
export function photoSrc(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return convertFileSrc(path);
}
