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

export const PLATFORM_REQUIREMENTS = {
  windows: "Windows 10/11 (64-bit)",
  macos: "macOS 11+ (Intel/Apple Silicon)",
  linux: "Ubuntu 20.04+ / Debian / Fedora",
  android: "Android 8.0+ (API 26+)",
  ios: "iOS 14+ (iPhone/iPad)",
  "google-play": "Google Play Store",
  "app-store": "Apple App Store",
};
