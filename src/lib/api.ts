import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { MemberInput, MemberRow } from '@/types/db';

// ---------- auth ----------
export const api = {
  isFirstRun: () => invoke<boolean>('is_first_run'),
  setupAdmin: (full_name: string, password: string) =>
    invoke<void>('setup_admin', { fullName: full_name, password }),
  login: (password: string) => invoke<void>('login', { password }),
  logout: () => invoke<void>('logout'),
  isLoggedIn: () => invoke<boolean>('is_logged_in'),

  // ---------- settings ----------
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

  // ---------- photo upload ----------
  saveMemberPhoto: async (file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const buf = new Uint8Array(await file.arrayBuffer());
    return invoke<string>('save_member_photo', {
      photo: { bytes: Array.from(buf), ext },
    });
  },
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
