import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui/basic';
import { useAuth } from '@/lib/AuthContext';
import { useSettings } from '@/lib/SettingsContext';

export default function Login() {
  const { mode, setupAdmin, login } = useAuth();
  const { brand } = useSettings();
  const isFirstRun = mode === 'first-run';

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isFirstRun) {
      if (!fullName.trim()) return setError('Please enter your name.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
      if (password !== confirm) return setError('Passwords do not match.');
    } else if (!password) {
      return setError('Enter your password.');
    }

    setLoading(true);
    try {
      if (isFirstRun) await setupAdmin(fullName.trim(), password);
      else await login(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b3b2f] to-[#1e5a48] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#0b3b2f] text-white p-6 text-center">
          <h1 className="text-2xl font-bold">{brand.orgName}</h1>
          <p className="text-sm text-white/80 mt-0.5">{brand.orgNameNative}</p>
          <p className="text-xs text-white/60 mt-2">
            {isFirstRun ? 'First-time setup — create your admin account' : 'Admin Login'}
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
              {error}
            </div>
          )}

          {isFirstRun && (
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Hitesh Das" autoFocus />
            </div>
          )}

          <div className="space-y-2">
            <Label>{isFirstRun ? 'Choose a Password' : 'Password'}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isFirstRun ? 'Min 6 characters' : ''}
              autoFocus={!isFirstRun}
            />
          </div>

          {isFirstRun && (
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Please wait…' : isFirstRun ? 'Create Admin Account' : 'Login'}
          </Button>

          {isFirstRun && (
            <p className="text-xs text-gray-500 text-center pt-2">
              This password protects your data. Write it down — there is no recovery flow yet.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
