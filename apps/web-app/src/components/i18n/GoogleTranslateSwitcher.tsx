'use client';

/**
 * ============================================================================
 * GOOGLE TRANSLATE — Integration for automatic page translation (FR/EN)
 * ============================================================================
 *
 * Uses Google Translate's website widget to translate the entire page content
 * in real-time. The user clicks FR or EN, and Google Translate automatically
 * translates all visible text on the page.
 *
 * How it works:
 *   1. On mount, injects the Google Translate script (translate.google.com)
 *   2. Creates a hidden Google Translate widget
 *   3. When user clicks FR/EN, programmatically changes the Google Translate
 *      language selector and triggers the translation
 *   4. Google Translate modifies the DOM directly — no need to extract strings
 *
 * The Google Translate banner is hidden via CSS (we use our own FR/EN toggle).
 *
 * Persistence:
 *   - Google Translate stores its preference in a cookie `googtrans`
 *   - We also store in localStorage for our UI state
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'academia_helm_locale';
const GT_COOKIE_NAME = 'googtrans';

type Locale = 'fr' | 'en';

/**
 * Reads the current Google Translate language from the googtrans cookie.
 * Cookie format: "/auto/en" or "/fr/en"
 */
function getGTLanguage(): Locale {
  if (typeof document === 'undefined') return 'fr';
  const match = document.cookie.match(new RegExp(`${GT_COOKIE_NAME}=([^;]+)`));
  if (match) {
    const parts = decodeURIComponent(match[1]).split('/');
    const lang = parts[parts.length - 1];
    if (lang === 'en') return 'en';
  }
  return 'fr';
}

/**
 * Sets the Google Translate language by setting the googtrans cookie
 * and triggering the Google Translate dropdown change.
 */
function setGTLanguage(locale: Locale) {
  if (typeof document === 'undefined') return;

  // Set the googtrans cookie (format: /auto/en or /auto/fr)
  const value = `/auto/${locale}`;
  const domain = window.location.hostname.includes('academiahelm.com')
    ? `.academiahelm.com`
    : '';
  document.cookie = `${GT_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=31536000${domain ? `; domain=${domain}` : ''}`;

  // Also store in localStorage for our UI
  localStorage.setItem(STORAGE_KEY, locale);

  // Trigger Google Translate dropdown change
  setTimeout(() => {
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (select) {
      select.value = locale;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, 100);

  // Reload the page to apply the translation fully
  // (Google Translate needs a page reload to translate dynamically loaded content)
  setTimeout(() => {
    window.location.reload();
  }, 300);
}

/**
 * Injects the Google Translate script and creates a hidden widget.
 * Only runs once on mount.
 */
function injectGoogleTranslate() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('google-translate-script')) return;

  // Add the Google Translate script
  const script = document.createElement('script');
  script.id = 'google-translate-script';
  script.type = 'text/javascript';
  script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.head.appendChild(script);

  // Define the callback that creates the widget
  (window as any).googleTranslateElementInit = () => {
    new (window as any).google.translate.TranslateElement(
      {
        pageLanguage: 'fr',
        includedLanguages: 'fr,en',
        layout: (window as any).google?.translate?.TranslateElement?.InlineLayout?.SIMPLE,
        autoDisplay: false,
      },
      'google_translate_element',
    );
  };

  // Create the hidden container for the Google Translate widget
  if (!document.getElementById('google_translate_element')) {
    const div = document.createElement('div');
    div.id = 'google_translate_element';
    div.style.display = 'none';
    document.body.appendChild(div);
  }
}

/**
 * Injects CSS to hide the Google Translate banner (top bar).
 * Most CSS is already in globals.css, this is a backup.
 */
function injectGTHideStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('gt-hide-styles')) return;

  const style = document.createElement('style');
  style.id = 'gt-hide-styles';
  style.textContent = `
    /* Force-hide ALL Google Translate UI elements */
    .goog-te-banner-frame.skiptranslate,
    iframe.goog-te-banner-frame,
    iframe.skiptranslate,
    .goog-te-gadget,
    .goog-te-gadget-simple,
    .goog-te-gadget-icon,
    .goog-te-gadget-img,
    #google_translate_element,
    #goog-gt-tt,
    .goog-logo-link,
    .goog-te-balloon-frame,
    .goog-te-balloon,
    .goog-te-ftab-float,
    .goog-te-floating-tab,
    .goog-te-spinner,
    .goog-te-spinner-pos,
    .skiptranslate {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      width: 0 !important;
      opacity: 0 !important;
    }
    body { top: 0 !important; position: static !important; }
    .goog-tooltip, .goog-tooltip:hover, .goog-text-highlight {
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }
  `;
  document.head.appendChild(style);

  // Also use a MutationObserver to catch any GT elements added dynamically
  // after the page loads (Google Translate injects iframes/bars asynchronously)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Check if the added node is a GT element
          if (
            node.classList?.contains('skiptranslate') ||
            node.classList?.contains('goog-te-banner-frame') ||
            node.classList?.contains('goog-te-gadget') ||
            node.id === 'goog-gt-tt' ||
            (node.tagName === 'IFRAME' && node.classList?.contains('skiptranslate'))
          ) {
            node.style.display = 'none';
            node.style.visibility = 'hidden';
            node.style.height = '0';
            node.style.width = '0';
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Stop observing after 30 seconds (GT should have finished by then)
  setTimeout(() => observer.disconnect(), 30000);
}

/**
 * Language Switcher component — FR/EN toggle using Google Translate.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const [locale, setLocale] = useState<Locale>('fr');
  const [gtReady, setGtReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    // Inject Google Translate script + hide styles
    injectGoogleTranslate();
    injectGTHideStyles();

    // Read current language from cookie/localStorage
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    const current = stored || getGTLanguage();
    setLocale(current);

    // Wait for Google Translate to be ready
    const checkReady = setInterval(() => {
      if ((window as any).google?.translate?.TranslateElement) {
        setGtReady(true);
        clearInterval(checkReady);

        // If the user previously selected EN, apply it
        if (current === 'en') {
          setTimeout(() => {
            const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
            if (select) {
              select.value = 'en';
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, 500);
        }
      }
    }, 200);

    // Timeout after 10 seconds
    setTimeout(() => clearInterval(checkReady), 10000);

    return () => clearInterval(checkReady);
  }, []);

  const handleSwitch = useCallback((newLocale: Locale) => {
    if (newLocale === locale) return;
    setLocale(newLocale);
    setGTLanguage(newLocale);
  }, [locale]);

  return (
    <div className={`flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => handleSwitch('fr')}
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
        onClick={() => handleSwitch('en')}
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
