import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui/basic';
import { useAuth } from '@/lib/AuthContext';
import { useSettings } from '@/lib/SettingsContext';
import { api } from '@/lib/api';
import { brandingDefaults } from '@/config/branding';

type Step = 'welcome' | 'org' | 'admin' | 'rates' | 'finishing';

const SETTINGS_DEFAULTS = {
  penalty_percentage: '5',
  monthly_due_day: '10',
  grace_period_days: '3',
  loan_eligibility_percent: '80',
  roi_category_b: '36',
  roi_category_c_24: '16',
  roi_category_c_36: '27',
};

export default function WelcomeWizard() {
  const { setupAdmin } = useAuth();
  const { reload: reloadSettings } = useSettings();

  const [step, setStep] = useState<Step>('welcome');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Org details
  const [orgName, setOrgName] = useState(brandingDefaults.orgName);
  const [orgShort, setOrgShort] = useState(brandingDefaults.orgShort);
  const [orgNameNative, setOrgNameNative] = useState(brandingDefaults.orgNameNative);
  const [orgTagline, setOrgTagline] = useState(brandingDefaults.tagline);

  // Admin
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Rates (numeric settings)
  const [rates, setRates] = useState({ ...SETTINGS_DEFAULTS });

  const next = () => {
    setError('');
    if (step === 'welcome') return setStep('org');
    if (step === 'org') {
      if (!orgName.trim()) return setError('Organisation name is required.');
      if (!orgShort.trim()) return setError('Short code is required (used in member IDs).');
      return setStep('admin');
    }
    if (step === 'admin') {
      if (!fullName.trim()) return setError('Please enter your name.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
      if (password !== confirm) return setError('Passwords do not match.');
      return setStep('rates');
    }
    if (step === 'rates') return finish();
  };

  const back = () => {
    setError('');
    if (step === 'org') setStep('welcome');
    else if (step === 'admin') setStep('org');
    else if (step === 'rates') setStep('admin');
  };

  const finish = async () => {
    setSaving(true);
    setError('');
    setStep('finishing');
    try {
      // 1. Create admin (this also sets logged_in = true server-side)
      await setupAdmin(fullName.trim(), password);

      // 2. Save org details to app_text_settings
      await api.saveTextSettings({
        org_name: orgName.trim(),
        org_short: orgShort.trim(),
        org_name_native: orgNameNative.trim(),
        org_tagline: orgTagline.trim(),
        member_code_prefix: orgShort.trim().toUpperCase(),
      });

      // 3. Save numeric settings
      await api.saveSettings(rates);

      // 4. Reload settings context so brand updates immediately
      await reloadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Park user back on the admin step so they can retry without re-typing org
      setStep('admin');
    } finally {
      setSaving(false);
    }
  };

  const stepNumber = step === 'welcome' ? 0 : step === 'org' ? 1 : step === 'admin' ? 2 : 3;
  const totalSteps = 4;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b3b2f] to-[#1e5a48] p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header with step indicator */}
        <div className="bg-[#0b3b2f] text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Welcome to EUS Desktop</h1>
              <p className="text-sm text-white/70 mt-1">
                {step === 'welcome' && 'Let’s get you set up in a few steps.'}
                {step === 'org' && 'Tell us about your organisation.'}
                {step === 'admin' && 'Create your administrator account.'}
                {step === 'rates' && 'Review default ROI and penalty rates.'}
                {step === 'finishing' && 'Setting things up…'}
              </p>
            </div>
            <div className="text-right text-xs text-white/80 font-mono shrink-0 ml-4">
              Step {stepNumber} / {totalSteps - 1}
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f7b05e] transition-all duration-300"
              style={{ width: `${(stepNumber / (totalSteps - 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
              {error}
            </div>
          )}

          {step === 'welcome' && (
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-[#1e5a48]/10 text-[#1e5a48] flex items-center justify-center text-4xl mb-4">
                <i className="fas fa-seedling"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Set up your cooperative</h2>
              <p className="text-gray-600 max-w-md mx-auto text-sm leading-relaxed">
                This wizard will help you configure your organisation, create your admin
                account, and set the default rates for savings, loans, and EMI. You can
                change everything later from <strong>Settings</strong>.
              </p>
              <ul className="text-left max-w-md mx-auto mt-6 space-y-2 text-sm text-gray-700">
                <li><i className="fas fa-check text-green-600 mr-2"></i> Offline-first: all data stays on this computer</li>
                <li><i className="fas fa-check text-green-600 mr-2"></i> Backup whenever you want from Settings → Data Backup</li>
                <li><i className="fas fa-check text-green-600 mr-2"></i> No subscription, no cloud, no email needed</li>
              </ul>
            </div>
          )}

          {step === 'org' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Organisation Name (English)</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Ekata Unnayan Sanstha" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Short Code</Label>
                  <Input value={orgShort} onChange={(e) => setOrgShort(e.target.value.toUpperCase())} maxLength={6} placeholder="EUS" />
                  <p className="text-xs text-gray-500">Used as prefix in member IDs (e.g. <code className="bg-gray-100 px-1 rounded">{orgShort || 'EUS'}/052026/C/001</code>).</p>
                </div>
                <div className="space-y-2">
                  <Label>Native-script Name <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input value={orgNameNative} onChange={(e) => setOrgNameNative(e.target.value)} placeholder="একতা উন্নয়ন সংস্থা" />
                  <p className="text-xs text-gray-500">Shown in the top header.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tagline <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input value={orgTagline} onChange={(e) => setOrgTagline(e.target.value)} placeholder="Member-owned cooperative savings" />
              </div>
            </div>
          )}

          {step === 'admin' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Hitesh Das" autoFocus />
                <p className="text-xs text-gray-500">Shown in the top-right of the dashboard.</p>
              </div>
              <div className="space-y-2">
                <Label>Choose a Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2">
                <i className="fas fa-exclamation-triangle mt-0.5"></i>
                <div>
                  <strong>Write this password down.</strong> There is no password recovery flow — if you lose it, you will lose access to all data on this machine.
                </div>
              </div>
            </div>
          )}

          {step === 'rates' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                These are the defaults used across Members, Loans, and Penalty calculations.
                Anything you change here goes straight into <strong>Settings → System Parameters</strong>;
                you can revisit it any time.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <RateField label="Penalty %" value={rates.penalty_percentage} onChange={(v) => setRates({ ...rates, penalty_percentage: v })} />
                <RateField label="Monthly Due Day" value={rates.monthly_due_day} onChange={(v) => setRates({ ...rates, monthly_due_day: v })} hint="Day of month installments are due" />
                <RateField label="Grace Period (days)" value={rates.grace_period_days} onChange={(v) => setRates({ ...rates, grace_period_days: v })} hint="No penalty if paid within this many days after due day" />
                <RateField label="Loan Eligibility %" value={rates.loan_eligibility_percent} onChange={(v) => setRates({ ...rates, loan_eligibility_percent: v })} hint="Max loan = % of net savings" />
                <RateField label="Cat B Maturity ROI %" value={rates.roi_category_b} onChange={(v) => setRates({ ...rates, roi_category_b: v })} />
                <RateField label="Cat C ROI % (24 mo)" value={rates.roi_category_c_24} onChange={(v) => setRates({ ...rates, roi_category_c_24: v })} />
                <RateField label="Cat C ROI % (36 mo)" value={rates.roi_category_c_36} onChange={(v) => setRates({ ...rates, roi_category_c_36: v })} />
              </div>
            </div>
          )}

          {step === 'finishing' && (
            <div className="text-center py-10">
              <i className="fas fa-spinner fa-spin text-4xl text-[#1e5a48]"></i>
              <p className="mt-4 text-gray-600">Saving your settings…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'finishing' && (
          <div className="border-t border-gray-100 p-4 flex justify-between items-center bg-gray-50/60">
            <Button
              variant="outline"
              onClick={back}
              disabled={step === 'welcome'}
              className={step === 'welcome' ? 'invisible' : ''}
            >
              ← Back
            </Button>
            <Button onClick={next} disabled={saving}>
              {step === 'rates' ? 'Finish & Login' : 'Continue →'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RateField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.1" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] text-gray-500 leading-tight">{hint}</p>}
    </div>
  );
}
