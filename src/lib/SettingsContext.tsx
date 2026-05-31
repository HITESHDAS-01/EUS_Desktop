import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from './api';
import { brandingDefaults } from '@/config/branding';

type SettingsCtx = {
  numeric: Record<string, string>;
  text: Record<string, string>;
  reload: () => Promise<void>;
  brand: {
    orgName: string;
    orgShort: string;
    orgNameNative: string;
    tagline: string;
  };
};

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [numeric, setNumeric] = useState<Record<string, string>>({});
  const [text, setText] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const [s, t] = await Promise.all([api.listSettings(), api.listTextSettings()]);
    setNumeric(s);
    setText(t);
  }, []);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const brand = {
    orgName: text.org_name || brandingDefaults.orgName,
    orgShort: text.org_short || brandingDefaults.orgShort,
    orgNameNative: text.org_name_native || brandingDefaults.orgNameNative,
    tagline: text.org_tagline || brandingDefaults.tagline,
  };

  return <Ctx.Provider value={{ numeric, text, reload, brand }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside <SettingsProvider>');
  return v;
}
