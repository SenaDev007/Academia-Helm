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
import { getUserScope, isMonoTrack } from '@/lib/auth/user-scope';

export type Locale = 'fr' | 'en' | 'ar';

const STORAGE_KEY = 'academia_helm_locale';
const COOKIE_NAME = 'ah_locale';

// Import translation messages
import frMessages from '@/i18n/messages/fr.json';
import enMessages from '@/i18n/messages/en.json';
import arMessages from '@/i18n/messages/ar.json';

const MESSAGES: Record<Locale, Record<string, any>> = {
  fr: frMessages,
  en: enMessages,
  ar: arMessages,
};

/** RTL (right-to-left) languages. Arabic, Hebrew, Persian, Urdu, etc. */
const RTL_LOCALES: Locale[] = ['ar'];

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Text direction: 'ltr' for French/English, 'rtl' for Arabic. */
  dir: 'ltr' | 'rtl';
  /** True if the current locale is an RTL language. */
  isRTL: boolean;
  /** ⭐ P4 : le changement de langue UI est-il autorisé ? (mono-piste = verrouillé) */
  canSwitchLocale: boolean;
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
  // Detect initial locale: localStorage, cookie, or browser
  const [locale, setLocaleState] = useState<Locale>('fr');
  // ⭐ P4 : mono-piste → changement de langue UI verrouillé (décision D5)
  const [canSwitchLocale, setCanSwitchLocale] = useState<boolean>(true);

  useEffect(() => {
    // 0. ⭐ P4 — LOCALE DU PROFIL (source de vérité serveur) :
    //    un utilisateur mono-piste EN a l'UI en anglais, mono-piste FR en
    //    français. La priorité : profil > localStorage > cookie > navigateur.
    const scope = getUserScope();
    if (scope?.locale === 'en' || scope?.locale === 'fr') {
      setLocaleState(scope.locale);
      // Mono-piste → UI verrouillée sur la langue du profil
      if (isMonoTrack(scope)) {
        setCanSwitchLocale(false);
      }
      return;
    }
    // 1. Check localStorage
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'fr' || stored === 'en' || stored === 'ar') {
      setLocaleState(stored);
      return;
    }
    // 2. Check cookie
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      if (match && (match[1] === 'fr' || match[1] === 'en' || match[1] === 'ar')) {
        setLocaleState(match[1] as Locale);
        return;
      }
    }
    // 3. Check browser language
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('en')) {
        setLocaleState('en');
      } else if (browserLang.startsWith('ar')) {
        setLocaleState('ar');
      }
    }
  }, []);

  // ⭐ RTL support: apply the `dir` attribute to <html> so the entire page
  //    flips to right-to-left layout for Arabic and other RTL languages.
  //    Tailwind CSS 4 respects `dir="rtl"` via logical properties (ms-, me-, ps-, pe-).
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isRTL = RTL_LOCALES.includes(locale);
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    // ⭐ P4 : verrou mono-piste — la langue UI suit le profil utilisateur
    if (!canSwitchLocale) return;
    setLocaleState(newLocale);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
    // Persist to cookie (1 year)
    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [canSwitchLocale]);

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

  const isRTL = RTL_LOCALES.includes(locale);
  const dir = isRTL ? 'rtl' : 'ltr';

  const value = useMemo<I18nContextType>(
    () => ({ locale, setLocale, t, dir, isRTL, canSwitchLocale }),
    [locale, setLocale, t, dir, isRTL, canSwitchLocale],
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
      dir: 'ltr' as const,
      isRTL: false,
      canSwitchLocale: true,
    };
  }
  return context;
}

/**
 * Language switcher component — can be placed anywhere in the app.
 * Shows a compact FR/EN toggle.
 * ⭐ P4 : masqué (null) si l'utilisateur est mono-piste — sa langue UI est
 *    imposée par son profil (piste FR → français, piste EN → anglais).
 *    Un compte bi-piste (ou promoteur) voit le toggle FR/EN.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, canSwitchLocale } = useI18n();

  if (!canSwitchLocale) {
    return null; // mono-piste : langue UI verrouillée sur le profil
  }

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
