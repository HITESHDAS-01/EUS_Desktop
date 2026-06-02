import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui/basic';
import { useAuth } from '@/lib/AuthContext';
import { useSettings } from '@/lib/SettingsContext';

export default function Login() {
  const { login } = useAuth();
  const { brand } = useSettings();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) return setError('Enter your password.');
    setLoading(true);
    try {
      await login(password);
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
          <p className="text-xs text-white/60 mt-2">Admin Login</p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Please wait…' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
}
