import { useEffect, useState } from 'react';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { Button, Input, Label } from '@/components/ui/basic';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/SettingsContext';

const SETTING_LABELS: Record<string, string> = {
  penalty_percentage: 'Penalty Percentage (%)',
  loan_eligibility_percent: 'Loan Eligibility (%)',
  monthly_due_day: 'Monthly Due Day (Date)',
  grace_period_days: 'Late Fee Grace Period (Days)',
  roi_category_b: 'Category B Interest Rate (%)',
  roi_category_c_24: 'Category C (24 Months) Interest Rate (%)',
  roi_category_c_36: 'Category C (36 Months) Interest Rate (%)',
};

const TEXT_LABELS: Record<string, string> = {
  org_name: 'Organisation Name',
  org_short: 'Short Code (e.g. EUS)',
  org_name_native: 'Native-script Name (shown in header)',
  org_tagline: 'Tagline',
  org_email: 'Contact Email',
  org_phone: 'Support Phone',
  org_address: 'Registered Address',
  org_logo_url: 'Logo URL (optional)',
  member_code_prefix: 'Member Code Prefix',
};

const labelFor = (k: string) => SETTING_LABELS[k] || TEXT_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Settings() {
  const { numeric, text, reload } = useSettings();
  const [activeTab, setActiveTab] = useState<'system' | 'organization' | 'security' | 'backup'>('system');

  // local edit buffers
  const [numericLocal, setNumericLocal] = useState<Record<string, string>>({});
  const [textLocal, setTextLocal] = useState<Record<string, string>>({});

  useEffect(() => setNumericLocal(numeric), [numeric]);
  useEffect(() => setTextLocal(text), [text]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [orgMessage, setOrgMessage] = useState('');

  // security
  const [adminName, setAdminName] = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [secMessage, setSecMessage] = useState('');

  useEffect(() => {
    api.getAdminProfile().then((p) => setAdminName(p.full_name || '')).catch(() => {});
  }, []);

  // backup
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage('');
    try {
      await api.saveSettings(numericLocal);
      await reload();
      setMessage('Settings updated successfully.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setOrgMessage('');
    try {
      await api.saveTextSettings(textLocal);
      await reload();
      setOrgMessage('Organisation profile updated successfully.');
    } catch (err) {
      setOrgMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecMessage(''); setSaving(true);
    try {
      // 1. Name (always save if changed)
      await api.updateAdminProfile(adminName);
      // 2. Password (only if entered)
      if (newPwd || currentPwd || confirmPwd) {
        if (!currentPwd) throw new Error('Enter your current password to change it.');
        if (newPwd.length < 6) throw new Error('New password must be at least 6 characters.');
        if (newPwd !== confirmPwd) throw new Error('New passwords do not match.');
        await api.changeAdminPassword(currentPwd, newPwd);
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
        setSecMessage('Profile and password updated successfully.');
      } else {
        setSecMessage('Profile name updated successfully.');
      }
    } catch (err) {
      setSecMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true); setBackupMessage('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const defaultName = `${(text.org_short || 'eus').toLowerCase()}_backup_${today}.zip`;
      const dest = await saveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'Backup archive', extensions: ['zip'] }],
      });
      if (!dest) {
        setBackupMessage('Backup cancelled.');
        return;
      }
      const written = await api.exportBackupZip(dest);
      setBackupMessage(`Backup saved to: ${written}`);
    } catch (err) {
      setBackupMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
        <div className="flex bg-gray-200 p-1 rounded-lg">
          {(['system', 'organization', 'security', 'backup'] as const).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'system' && 'System Parameters'}
              {tab === 'organization' && 'Organisation Profile'}
              {tab === 'security' && 'Security'}
              {tab === 'backup' && 'Data Backup'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'system' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {message && (
            <div className={`mb-6 p-3 rounded-lg text-sm border ${message.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {message}
            </div>
          )}
          <form onSubmit={handleSaveSystem} className="space-y-6 max-w-2xl">
            {Object.keys(numericLocal).sort().map((key) => (
              <div key={key} className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-800">{labelFor(key)}</Label>
                  <p className="text-xs text-gray-500 mt-1">System configuration key: {key}</p>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    value={numericLocal[key] ?? ''}
                    onChange={(e) => setNumericLocal({ ...numericLocal, [key]: e.target.value })}
                    required
                  />
                </div>
              </div>
            ))}
            <div className="pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save All Settings'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'organization' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {orgMessage && (
              <div className={`p-3 rounded-lg text-sm border ${orgMessage.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                {orgMessage}
              </div>
            )}
            <form onSubmit={handleSaveOrg} className="space-y-4">
              {Object.keys(TEXT_LABELS).map((key) => (
                <div key={key} className="space-y-2">
                  <Label>{labelFor(key)}</Label>
                  <Input
                    value={textLocal[key] ?? ''}
                    onChange={(e) => setTextLocal({ ...textLocal, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Update Organisation Profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          {secMessage && (
            <div className={`mb-6 p-3 rounded-lg text-sm border ${secMessage.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {secMessage}
            </div>
          )}
          <form onSubmit={handleSaveSecurity} className="space-y-5">
            <div className="space-y-2">
              <Label>Administrator Name</Label>
              <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
              <p className="text-xs text-gray-500">Shown in the top-right header.</p>
            </div>
            <div className="border-t pt-5 space-y-4">
              <h3 className="text-base font-bold text-gray-800">Change Password (Optional)</h3>
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} minLength={6} autoComplete="new-password" placeholder="Min 6 characters" />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Updating…' : 'Update Profile'}
            </Button>
          </form>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">
              <i className="fas fa-file-archive"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Export Full Backup</h3>
              <p className="text-sm text-gray-500 mt-1">Save a complete snapshot of your database + member photos as a single .zip file.</p>
            </div>
          </div>

          {backupMessage && (
            <div className={`mb-6 p-4 rounded-xl text-sm border break-words ${backupMessage.includes('saved') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {backupMessage}
            </div>
          )}

          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 mb-6 space-y-3">
            <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <i className="fas fa-info-circle text-gray-400"></i>
              What's included
            </h4>
            <ul className="text-sm text-gray-600 space-y-2 ml-6 list-disc">
              <li>The full SQLite database (members, savings, loans, repayments, settings)</li>
              <li>All member photos</li>
            </ul>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
              <i className="fas fa-lightbulb mr-1"></i>
              Take a backup before any large change and copy the .zip to a USB drive or external location.
            </p>
          </div>

          <Button
            onClick={handleBackup}
            disabled={backupLoading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
          >
            {backupLoading ? (
              <><i className="fas fa-spinner fa-spin"></i> Generating Backup…</>
            ) : (
              <><i className="fas fa-download"></i> Backup Now</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
