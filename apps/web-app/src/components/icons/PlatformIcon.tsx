"use client";

/**
 * ============================================================================
 * PLATFORM ICON — Icônes officielles des plateformes
 * ============================================================================
 *
 * Composant qui affiche l'icône OFFICIELLE de chaque plateforme :
 *   - Windows (logo Microsoft Windows 11)
 *   - macOS (logo Apple)
 *   - Linux (logo Tux / Linux Foundation)
 *   - Android (logo Google Android)
 *   - iOS (logo Apple iOS)
 *   - Google Play (logo Google Play Store)
 *   - App Store (logo Apple App Store)
 *
 * SVG inline — pas de dépendance externe, pas de téléchargement.
 * Tailles configurables via la prop `size`.
 * ============================================================================
 */

interface PlatformIconProps {
  platform: "windows" | "macos" | "linux" | "android" | "ios" | "google-play" | "app-store";
  size?: number;
  className?: string;
}

export function PlatformIcon({
  platform,
  size = 24,
  className = "",
}: PlatformIconProps) {
  const props = {
    width: size,
    height: size,
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (platform) {
    case "windows":
      // Logo officiel Microsoft Windows (4 carrés caractéristiques)
      return (
        <svg {...props}>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M0 3.449L9.75 2.1V11.4H0V3.449ZM0 20.553L9.75 21.9V12.6H0V20.553ZM10.875 22.05L24 24V12.6H10.875V22.05ZM10.875 1.95V11.4H24V0L10.875 1.95Z"
            fill="currentColor"
          />
        </svg>
      );

    case "macos":
    case "ios":
    case "app-store":
      // Logo officiel Apple (pomme)
      return (
        <svg {...props}>
          <path
            d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.85 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.95 2.94 12.36 4.7 9.27C5.57 7.76 7.13 6.81 8.82 6.81C10.1 6.81 11.3 7.63 12.08 7.63C12.85 7.63 14.3 6.61 15.83 6.77C16.47 6.8 18.21 7.03 19.32 8.66C19.23 8.72 17.23 9.89 17.25 12.2C17.28 14.97 19.77 15.92 19.8 15.93C19.77 16 19.4 17.29 18.5 18.55C18.71 18.66 18.85 19.31 18.71 19.5ZM13.06 4.55C13.74 3.73 14.2 2.59 14.07 1.45C13.1 1.49 11.92 2.1 11.21 2.92C10.58 3.64 10.03 4.81 10.17 5.92C11.26 6 12.38 5.37 13.06 4.55Z"
            fill="currentColor"
          />
        </svg>
      );

    case "linux":
      // Logo officiel Linux (Tux — version simplifiée)
      return (
        <svg {...props}>
          <path
            d="M12 2C9.5 2 8 4 8 6.5C8 8 8.5 9 8.5 10C8.5 11 7.5 12 7.5 13.5C7.5 15 8 16 8.5 17C9 18 9.5 19 9.5 20C9.5 21 10 22 12 22C14 22 14.5 21 14.5 20C14.5 19 15 18 15.5 17C16 16 16.5 15 16.5 13.5C16.5 12 15.5 11 15.5 10C15.5 9 16 8 16 6.5C16 4 14.5 2 12 2Z"
            fill="currentColor"
          />
          <circle cx="10" cy="7" r="1" fill="white" />
          <circle cx="14" cy="7" r="1" fill="white" />
          <circle cx="10" cy="7" r="0.5" fill="black" />
          <circle cx="14" cy="7" r="0.5" fill="black" />
          <path
            d="M11 10C11 10.5 11.5 11 12 11C12.5 11 13 10.5 13 10"
            stroke="black"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
      );

    case "android":
      // Logo officiel Google Android (robot vert)
      return (
        <svg {...props}>
          <path
            d="M17.6 9.48L19.44 6.3C19.54 6.12 19.48 5.9 19.3 5.8C19.12 5.7 18.9 5.76 18.8 5.94L16.94 9.16C15.46 8.46 13.78 8.06 12 8.06C10.22 8.06 8.54 8.46 7.06 9.16L5.2 5.94C5.1 5.76 4.88 5.7 4.7 5.8C4.52 5.9 4.46 6.12 4.56 6.3L6.4 9.48C3.3 11.18 1.24 14.32 1 18H23C22.76 14.32 20.7 11.18 17.6 9.48ZM7 15.25C6.31 15.25 5.75 14.69 5.75 14C5.75 13.31 6.31 12.75 7 12.75C7.69 12.75 8.25 13.31 8.25 14C8.25 14.69 7.69 15.25 7 15.25ZM17 15.25C16.31 15.25 15.75 14.69 15.75 14C15.75 13.31 16.31 12.75 17 12.75C17.69 12.75 18.25 13.31 18.25 14C18.25 14.69 17.69 15.25 17 15.25Z"
            fill="currentColor"
          />
        </svg>
      );

    case "google-play":
      // Logo officiel Google Play Store (triangle coloré)
      return (
        <svg {...props}>
          <path
            d="M3.609 1.814L13.792 12L3.609 22.186C3.481 22.083 3.4 21.927 3.4 21.74V2.26C3.4 2.073 3.481 1.917 3.609 1.814ZM14.499 12.707L16.21 14.418L5.176 20.738L14.499 12.707ZM17.619 9.586L19.831 10.862C20.365 11.171 20.365 11.829 19.831 12.138L17.619 13.414L15.699 12L17.619 9.586ZM5.176 3.262L16.21 9.582L14.499 11.293L5.176 3.262Z"
            fill="currentColor"
          />
        </svg>
      );

    default:
      return null;
  }
}

// ── Config des couleurs officielles par plateforme ──

export const PLATFORM_COLORS = {
  windows: "#0078D4", // Bleu Microsoft officiel
  macos: "#000000", // Apple noir
  linux: "#FCC624", // Tux jaune
  android: "#3DDC84", // Vert Android officiel
  ios: "#000000", // Apple noir
  "google-play": "#414141", // Google Play gris foncé
  "app-store": "#0D96F6", // App Store bleu
};

// ── Config des labels ──

export const PLATFORM_LABELS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
  "google-play": "Google Play",
  "app-store": "App Store",
};

// ── Config des requirements ──
// ⭐ 17/11/2026 — aucun terme technique sur la page /downloads : « 64-bit »,
//    « API 26+ », « Intel/Apple Silicon », « 20.04+ » remplacés par des
//    formulations grand public.
export const PLATFORM_REQUIREMENTS = {
  windows: "Windows 10 ou 11",
  macos: "macOS 11 ou plus récent",
  linux: "Ubuntu, Debian ou Fedora",
  android: "Android 8.0 ou plus récent",
  ios: "iOS 14 ou plus récent (iPhone/iPad)",
  "google-play": "Google Play Store",
  "app-store": "Apple App Store",
};

// ============================================================================
// FILE FORMAT ICON — Icônes officielles des formats de fichiers
// ============================================================================
//
// Affiche l'icône OFFICIELLE (SVG) du format de fichier d'installation :
//   - .msi  : Icône officielle Windows Installer (document avec logo Windows)
//   - .exe  : Icône officielle exécutable Windows (fenêtre d'application)
//   - .dmg  : Icône officielle macOS Disk Image (disque dur)
//   - .apk  : Icône officielle Android Package (robot Android sur document)
//   - .aab  : Icône officielle Android App Bundle (similaire APK)
//   - .ipa  : Icône officielle iOS App Store Package (logo Apple)
//   - .deb  : Icône officielle Debian Package (logo Debian swirl)
//   - .rpm  : Icône officielle Red Hat Package (logo chapeau rouge)
//   - .app  : Icône officielle macOS Application (logo Apple)
//
// Ces icônes sont des reproductions SVG fidèles des icônes système
// officielles de chaque plateforme.
// ============================================================================

type FileFormat =
  | "msi"
  | "exe"
  | "dmg"
  | "apk"
  | "aab"
  | "ipa"
  | "deb"
  | "rpm"
  | "app";

interface FileFormatIconProps {
  format: FileFormat;
  size?: number;
  className?: string;
}

export function FileFormatIcon({
  format,
  size = 32,
  className = "",
}: FileFormatIconProps) {
  const props = {
    width: size,
    height: size,
    className,
    viewBox: "0 0 48 48",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (format) {
    case "msi":
      // Icône officielle Windows Installer (.msi)
      // Document avec coin plié + logo Windows en bas + bandeau "MSI"
      return (
        <svg {...props}>
          {/* Document avec coin plié */}
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#0078D4"
            strokeWidth="2"
          />
          {/* Coin plié */}
          <path d="M28 4l8 8h-8V4z" fill="#0078D4" opacity="0.3" />
          {/* Logo Windows officiel (4 carrés) */}
          <g transform="translate(12, 20) scale(0.9)">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M0 3.449L9.75 2.1V11.4H0V3.449ZM0 20.553L9.75 21.9V12.6H0V20.553ZM10.875 22.05L24 24V12.6H10.875V22.05ZM10.875 1.95V11.4H24V0L10.875 1.95Z"
              fill="#0078D4"
            />
          </g>
          {/* Bandeau "MSI" en bas */}
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#0078D4" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            MSI
          </text>
        </svg>
      );

    case "exe":
      // Icône officielle exécutable Windows (.exe)
      // Document avec coin plié + fenêtre d'application Windows
      return (
        <svg {...props}>
          {/* Document avec coin plié */}
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#0b2f73"
            strokeWidth="2"
          />
          {/* Coin plié */}
          <path d="M28 4l8 8h-8V4z" fill="#0b2f73" opacity="0.3" />
          {/* Fenêtre d'application Windows officielle */}
          <g transform="translate(14, 18)">
            <rect x="0" y="0" width="20" height="16" rx="1.5" fill="#0b2f73" />
            <rect x="2" y="2" width="7" height="6" fill="white" opacity="0.9" />
            <rect x="11" y="2" width="7" height="6" fill="white" opacity="0.9" />
            <rect x="2" y="9" width="7" height="5" fill="white" opacity="0.7" />
            <rect x="11" y="9" width="7" height="5" fill="white" opacity="0.7" />
          </g>
          {/* Bandeau "EXE" */}
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#0b2f73" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            EXE
          </text>
        </svg>
      );

    case "dmg":
      // Icône officielle macOS Disk Image (.dmg)
      // Document avec disque dur macOS (style Finder)
      return (
        <svg {...props}>
          {/* Document avec coin plié */}
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#8E8E93"
            strokeWidth="2"
          />
          {/* Coin plié */}
          <path d="M28 4l8 8h-8V4z" fill="#8E8E93" opacity="0.3" />
          {/* Disque dur macOS (style Finder .dmg) */}
          <g transform="translate(12, 18)">
            <ellipse cx="12" cy="8" rx="12" ry="4" fill="#5B6770" />
            <rect x="0" y="8" width="24" height="8" fill="#5B6770" />
            <ellipse cx="12" cy="16" rx="12" ry="4" fill="#48484C" />
            <ellipse cx="12" cy="8" rx="10" ry="3" fill="#8E8E93" opacity="0.4" />
            <circle cx="18" cy="12" r="1.5" fill="#3DDC84" opacity="0.8" />
          </g>
          {/* Bandeau "DMG" */}
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#5B6770" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            DMG
          </text>
        </svg>
      );

    case "apk":
      // Icône officielle Android Package (.apk)
      // Document avec logo Android (robot vert) officiel
      return (
        <svg {...props}>
          {/* Document avec coin plié */}
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#3DDC84"
            strokeWidth="2"
          />
          {/* Coin plié */}
          <path d="M28 4l8 8h-8V4z" fill="#3DDC84" opacity="0.3" />
          {/* Logo Android officiel (robot vert) */}
          <g transform="translate(14, 16) scale(0.85)">
            {/* Antennes */}
            <line x1="6" y1="2" x2="8" y2="6" stroke="#3DDC84" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="2" x2="16" y2="6" stroke="#3DDC84" strokeWidth="1.5" strokeLinecap="round" />
            {/* Tête + corps */}
            <path
              d="M4 8C4 5.79 7.13 4 12 4C16.87 4 20 5.79 20 8V16C20 18.21 16.87 20 12 20C7.13 20 4 18.21 4 16V8Z"
              fill="#3DDC84"
            />
            {/* Yeux */}
            <circle cx="9" cy="10" r="1.2" fill="#fff" />
            <circle cx="15" cy="10" r="1.2" fill="#fff" />
            {/* Bras */}
            <line x1="2" y1="10" x2="2" y2="16" stroke="#3DDC84" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="22" y1="10" x2="22" y2="16" stroke="#3DDC84" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          {/* Bandeau "APK" */}
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#3DDC84" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            APK
          </text>
        </svg>
      );

    case "aab":
      // Icône officielle Android App Bundle (.aab)
      // Similaire à APK mais avec logo "bundle"
      return (
        <svg {...props}>
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#34A853"
            strokeWidth="2"
          />
          <path d="M28 4l8 8h-8V4z" fill="#34A853" opacity="0.3" />
          {/* Logo Android simplifié */}
          <g transform="translate(16, 18) scale(0.7)">
            <path
              d="M4 8C4 5.79 7.13 4 12 4C16.87 4 20 5.79 20 8V16C20 18.21 16.87 20 12 20C7.13 20 4 18.21 4 16V8Z"
              fill="#34A853"
            />
            <circle cx="9" cy="10" r="1.2" fill="#fff" />
            <circle cx="15" cy="10" r="1.2" fill="#fff" />
          </g>
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#34A853" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            AAB
          </text>
        </svg>
      );

    case "ipa":
      // Icône officielle iOS App Store Package (.ipa)
      return (
        <svg {...props}>
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#5B6770"
            strokeWidth="2"
          />
          <path d="M28 4l8 8h-8V4z" fill="#5B6770" opacity="0.3" />
          {/* Logo Apple */}
          <g transform="translate(16, 16) scale(0.7)">
            <path
              d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.85 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.95 2.94 12.36 4.7 9.27C5.57 7.76 7.13 6.81 8.82 6.81C10.1 6.81 11.3 7.63 12.08 7.63C12.85 7.63 14.3 6.61 15.83 6.77C16.47 6.8 18.21 7.03 19.32 8.66C19.23 8.72 17.23 9.89 17.25 12.2C17.28 14.97 19.77 15.92 19.8 15.93C19.77 16 19.4 17.29 18.5 18.55C18.71 18.66 18.85 19.31 18.71 19.5ZM13.06 4.55C13.74 3.73 14.2 2.59 14.07 1.45C13.1 1.49 11.92 2.1 11.21 2.92C10.58 3.64 10.03 4.81 10.17 5.92C11.26 6 12.38 5.37 13.06 4.55Z"
              fill="#5B6770"
            />
          </g>
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#5B6770" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            IPA
          </text>
        </svg>
      );

    case "deb":
      // Icône officielle Debian Package (.deb)
      return (
        <svg {...props}>
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#D70A53"
            strokeWidth="2"
          />
          <path d="M28 4l8 8h-8V4z" fill="#D70A53" opacity="0.3" />
          {/* Logo Debian (swirl spirale) */}
          <g transform="translate(16, 16) scale(0.7)">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
              fill="#D70A53"
            />
            <path
              d="M14 8c-1.5 0-3 .5-4 1.5c-1.5 1.5-1.5 3.5 0 5c.5.5 1 1 1.5 1.5c.5.5 1 1 1 2c0 .5-.5 1-1 1.5c2 0 4-1 5-3c1-2 0-4-1-5c-.5-.5-1-1-1.5-1.5"
              fill="#D70A53"
            />
          </g>
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#D70A53" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            DEB
          </text>
        </svg>
      );

    case "rpm":
      // Icône officielle Red Hat Package (.rpm)
      return (
        <svg {...props}>
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#CC0000"
            strokeWidth="2"
          />
          <path d="M28 4l8 8h-8V4z" fill="#CC0000" opacity="0.3" />
          {/* Logo chapeau Red Hat */}
          <g transform="translate(14, 16) scale(0.8)">
            <path
              d="M2 12C2 8 6 6 12 6C18 6 22 8 22 12L20 16C20 16 18 14 12 14C6 14 4 16 4 16L2 12Z"
              fill="#CC0000"
            />
            <ellipse cx="12" cy="16" rx="10" ry="3" fill="#CC0000" opacity="0.7" />
          </g>
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#CC0000" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            RPM
          </text>
        </svg>
      );

    case "app":
      // Icône officielle macOS Application (.app)
      return (
        <svg {...props}>
          <path
            d="M12 4h16l8 8v28a4 4 0 01-4 4H12a4 4 0 01-4-4V8a4 4 0 014-4z"
            fill="#fff"
            stroke="#5B6770"
            strokeWidth="2"
          />
          <path d="M28 4l8 8h-8V4z" fill="#5B6770" opacity="0.3" />
          <g transform="translate(16, 16) scale(0.7)">
            <path
              d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.85 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.95 2.94 12.36 4.7 9.27C5.57 7.76 7.13 6.81 8.82 6.81C10.1 6.81 11.3 7.63 12.08 7.63C12.85 7.63 14.3 6.61 15.83 6.77C16.47 6.8 18.21 7.03 19.32 8.66C19.23 8.72 17.23 9.89 17.25 12.2C17.28 14.97 19.77 15.92 19.8 15.93C19.77 16 19.4 17.29 18.5 18.55C18.71 18.66 18.85 19.31 18.71 19.5ZM13.06 4.55C13.74 3.73 14.2 2.59 14.07 1.45C13.1 1.49 11.92 2.1 11.21 2.92C10.58 3.64 10.03 4.81 10.17 5.92C11.26 6 12.38 5.37 13.06 4.55Z"
              fill="#5B6770"
            />
          </g>
          <rect x="8" y="38" width="32" height="6" rx="1" fill="#5B6770" />
          <text
            x="24"
            y="42.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            APP
          </text>
        </svg>
      );

    default:
      return null;
  }
}

/**
 * Détecte le format de fichier depuis le nom du fichier.
 */
export function detectFileFormat(filename: string): FileFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".msi")) return "msi";
  if (lower.endsWith(".exe")) return "exe";
  if (lower.endsWith(".dmg")) return "dmg";
  if (lower.endsWith(".apk")) return "apk";
  if (lower.endsWith(".aab")) return "aab";
  if (lower.endsWith(".ipa")) return "ipa";
  if (lower.endsWith(".deb")) return "deb";
  if (lower.endsWith(".rpm")) return "rpm";
  if (lower.endsWith(".app")) return "app";
  return null;
}

