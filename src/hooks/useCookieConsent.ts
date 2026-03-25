import { useEffect, useMemo, useState } from 'react';

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const STORAGE_KEY = 'smeta-cookie-consent';

const defaultConsent: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: '',
};

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setConsent(null);
      return;
    }
    try {
      setConsent(JSON.parse(raw) as CookieConsent);
    } catch {
      setConsent(null);
    }
  }, []);

  const acceptAll = () => {
    const next: CookieConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConsent(next);
  };

  const save = (next: Omit<CookieConsent, 'updatedAt'>) => {
    const payload: CookieConsent = { ...next, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setConsent(payload);
  };

  const reset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setConsent(null);
  };

  return useMemo(
    () => ({ consent, acceptAll, save, reset }),
    [consent],
  );
}
