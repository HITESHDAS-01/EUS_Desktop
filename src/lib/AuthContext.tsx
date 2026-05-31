import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

type AuthMode = 'loading' | 'first-run' | 'logged-out' | 'logged-in';

type AuthCtx = {
  mode: AuthMode;
  setupAdmin: (fullName: string, password: string) => Promise<void>;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('loading');

  const refresh = async () => {
    const firstRun = await api.isFirstRun();
    if (firstRun) {
      setMode('first-run');
      return;
    }
    const logged = await api.isLoggedIn();
    setMode(logged ? 'logged-in' : 'logged-out');
  };

  useEffect(() => {
    refresh().catch(() => setMode('logged-out'));
  }, []);

  const value: AuthCtx = {
    mode,
    setupAdmin: async (fullName, password) => {
      await api.setupAdmin(fullName, password);
      setMode('logged-in');
    },
    login: async (password) => {
      await api.login(password);
      setMode('logged-in');
    },
    logout: async () => {
      await api.logout();
      setMode('logged-out');
    },
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
