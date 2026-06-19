'use client';

/**
 * ============================================================================
 * I18N PROVIDER — Real-time language switching (FR/EN)
 * ============================================================================
 *
 * Lightweight context-based i18n system that doesn't require Next.js middleware
 * changes (the existing middleware handles multi-tenant routing and auth).
 *
 * Features:
 *   - Stores locale in localStorage + cookie
 *   - Real-time language switching (all components re-render on locale change)
 *   - Falls back to French if a translation key is missing
 *   - Supports nested keys: t('jobs.title') → "Offres d'emploi" / "Job Offers"
 *   - Supports interpolation: t('common.welcome', { name: 'John' })
 *
 * Usage:
 *   // In a component:
 *   const { t, locale, setLocale } = useI18n();
 *   <h1>{t('jobs.title')}</h1>
 *   <button onClick={() => setLocale('en')}>EN</button>
 *
 *   // In layout (wrap once):
 *   <I18nProvider>{children}</I18nProvider>
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

export type Locale = 'fr' | 'en';

const STORAGE_KEY = 'academia_helm_locale';
const COOKIE_NAME = 'ah_locale';

// Import translation messages
import frMessages from '@/i18n/messages/fr.json';
import enMessages from '@/i18n/messages/en.json';

const MESSAGES: Record<Locale, Record<string, any>> = {
  fr: frMessages,
  en: enMessages,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Resolves a dotted key path in a nested object.
 * Example: resolveKey({ jobs: { title: "Hello" } }, "jobs.title") → "Hello"
 */
function resolveKey(obj: any, key: string): string | undefined {
  const parts = key.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolates params into a string.
 * Example: interpolate("Hello {name}", { name: "John" }) → "Hello John"
 */
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Detect initial locale from localStorage, cookie, or browser
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    // 1. Check localStorage
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'fr' || stored === 'en') {
      setLocaleState(stored);
      return;
    }
    // 2. Check cookie
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      if (match && (match[1] === 'fr' || match[1] === 'en')) {
        setLocaleState(match[1] as Locale);
        return;
      }
    }
    // 3. Check browser language
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('en')) {
        setLocaleState('en');
      }
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
    // Persist to cookie (1 year)
    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // Try current locale first
      const msg = resolveKey(MESSAGES[locale], key);
      if (msg !== undefined) {
        return interpolate(msg, params);
      }
      // Fallback to French
      const fallback = resolveKey(MESSAGES.fr, key);
      if (fallback !== undefined) {
        return interpolate(fallback, params);
      }
      // If no translation found, return the key itself (for debugging)
      return key;
    },
    [locale],
  );

  const value = useMemo<I18nContextType>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (context === undefined) {
    // Return a functional stub if provider is not mounted (avoids crash).
    // This should not happen in normal usage — the I18nProvider is in the
    // root layout and the app layout-client. If you see this warning, make
    // sure the component using useI18n is rendered inside an I18nProvider.
    if (typeof console !== 'undefined') {
      console.warn('[i18n] useI18n() called outside I18nProvider — using stub. Translations will not work.');
    }
    return {
      locale: 'fr',
      setLocale: () => {},
      t: (key: string) => key,
    };
  }
  return context;
}

/**
 * Language switcher component — can be placed anywhere in the app.
 * Shows a compact FR/EN toggle.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={`flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => setLocale('fr')}
        className={`px-2 py-1 rounded-md text-xs font-bold transition ${
          locale === 'fr'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Français"
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`px-2 py-1 rounded-md text-xs font-bold transition ${
          locale === 'en'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="English"
      >
        EN
      </button>
    </div>
  );
}
