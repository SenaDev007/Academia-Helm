"use client";

/**
 * ============================================================================
 * PAGE DE TÉLÉCHARGEMENT — Academia Helm Desktop + Mobile
 * ============================================================================
 *
 * Page publique moderne qui présente :
 *   - L'app desktop Windows/macOS/Linux (Tauri)
 *   - L'app mobile iOS/Android (Flutter)
 *   - Les dernières mises à jour disponibles
 *   - Le changelog
 *
 * URL : /downloads
 *
 * Design : palette Academia Helm (Navy/Blue/Gold), moderne, glassmorphism,
 * animations subtiles, responsive.
 * ============================================================================
 */

import { useState, useEffect } from "react";
import {
  Download, CheckCircle2, AlertCircle,
  Loader2, ChevronRight, Calendar, Tag, Github, Shield, Zap, WifiOff,
  RefreshCw, FileCode,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  PlatformIcon,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  PLATFORM_REQUIREMENTS,
} from "@/components/icons/PlatformIcon";

// ── Palette Academia Helm ──
const NAVY = "#0b2f73";
const BLUE = "#1d4fa5";
const GOLD = "#f5b335";
const EMERALD = "#0d7c66";

// ── Types ──

interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: string;
  platform: "windows" | "macos" | "linux" | "android" | "ios";
}

interface Release {
  version: string;
  date: string;
  notes: string[];
  assets: ReleaseAsset[];
}

// ── Releases statiques (sera enrichi par GitHub API plus tard) ──
// TODO: remplacer par fetch depuis GitHub API /repos/SenaDev007/Academia-Helm/releases

const LATEST_RELEASE: Release = {
  version: "1.0.0",
  date: "2026-07-28",
  notes: [
    "Application desktop Windows (Tauri 2) avec auto-update",
    "Base de données locale SQLite pour mode hors connexion",
    "Synchronisation automatique avec Neon PostgreSQL (toutes les 60s)",
    "Bouton 'Synchroniser' manuel dans le header",
    "Application mobile Flutter (iOS + Android)",
    "Même UI que la version web — pas de recodage",
    "Sécurité : JWT + ownership checks sur tous les endpoints",
  ],
  assets: [
    {
      name: "Academia-Helm-Setup-1.0.0.exe",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-Setup-1.0.0.exe",
      size: "~10 MB",
      platform: "windows",
    },
    {
      name: "Academia-Helm-1.0.0.msi",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0.msi",
      size: "~12 MB",
      platform: "windows",
    },
    {
      name: "Academia-Helm-1.0.0.dmg",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0.dmg",
      size: "~15 MB",
      platform: "macos",
    },
    {
      name: "Academia-Helm-1.0.0.apk",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0.apk",
      size: "~25 MB",
      platform: "android",
    },
    {
      name: "Academia-Helm-1.0.0.aab",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0.aab",
      size: "~22 MB",
      platform: "android",
    },
  ],
};

const PREVIOUS_RELEASES: Release[] = [
  // TODO: récupérer depuis GitHub API
];

// ── Mapping plateforme → config (utilise les icônes officielles) ──
// Plus besoin de PLATFORM_CONFIG — on utilise PlatformIcon + PLATFORM_COLORS/LABELS/REQUIREMENTS

// ── Composant principal ──

export default function DownloadsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AH</span>
            </div>
            <span className="font-bold text-slate-900">Academia Helm</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            ← Retour au site
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold mb-6">
              <Download className="w-3.5 h-3.5" />
              Téléchargements
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              Academia Helm
              <span className="block text-blue-200 text-lg sm:text-2xl font-medium mt-2">
                Application Desktop & Mobile
              </span>
            </h1>

            <p className="text-blue-100 text-base sm:text-lg max-w-2xl mx-auto mb-8">
              Téléchargez l'application Academia Helm pour Windows, macOS, Android et iOS.
              Accès plus rapide, mode hors connexion, synchronisation automatique.
            </p>

            {/* Version actuelle */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm">
              <Tag className="w-4 h-4" />
              <span className="font-semibold">Version {LATEST_RELEASE.version}</span>
              <span className="opacity-60">•</span>
              <Calendar className="w-4 h-4" />
              <span>{new Date(LATEST_RELEASE.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Sélecteur Desktop / Mobile ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedPlatform("desktop")}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all ${
              selectedPlatform === "desktop"
                ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <PlatformIcon platform="windows" size={20} />
            Desktop
          </button>
          <button
            onClick={() => setSelectedPlatform("mobile")}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all ${
              selectedPlatform === "mobile"
                ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <PlatformIcon platform="android" size={20} />
            Mobile
          </button>
        </div>
      </section>

      {/* ── Section téléchargements ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {selectedPlatform === "desktop" ? (
          <DesktopDownloads release={LATEST_RELEASE} />
        ) : (
          <MobileDownloads release={LATEST_RELEASE} />
        )}
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
            Pourquoi utiliser l'application desktop/mobile ?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Zap}
              title="Accès plus rapide"
              description="Lancez Academia Helm en un clic depuis votre bureau. Pas besoin d'ouvrir un navigateur."
              color={GOLD}
            />
            <FeatureCard
              icon={WifiOff}
              title="Mode hors connexion"
              description="Travaillez sans internet. Les données sont stockées localement et synchronisées au retour de la connexion."
              color={EMERALD}
            />
            <FeatureCard
              icon={RefreshCw}
              title="Sync automatique"
              description="Synchronisation toutes les 60 secondes avec la base centrale Neon. Vos données sont toujours à jour."
              color={BLUE}
            />
            <FeatureCard
              icon={Shield}
              title="Sécurisé"
              description="Authentification JWT, chiffrement, ownership checks. Même sécurité que la version web."
              color={NAVY}
            />
          </div>
        </div>
      </section>

      {/* ── Changelog ── */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-2">
            Dernières mises à jour
          </h2>
          <p className="text-slate-500 text-center mb-12">
            Version {LATEST_RELEASE.version} — {new Date(LATEST_RELEASE.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Version {LATEST_RELEASE.version}</h3>
                  <p className="text-sm text-blue-100 mt-1">
                    {new Date(LATEST_RELEASE.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold">
                  DERNIÈRE
                </span>
              </div>
            </div>

            <div className="p-6">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-600" />
                Nouveautés
              </h4>
              <ul className="space-y-3">
                {LATEST_RELEASE.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 text-sm">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Lien vers GitHub pour les versions précédentes */}
          <div className="text-center mt-8">
            <a
              href="https://github.com/SenaDev007/Academia-Helm/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100 transition-all"
            >
              <Github className="w-4 h-4" />
              Voir toutes les versions sur GitHub
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
            Questions fréquentes
          </h2>

          <div className="space-y-6">
            <FaqItem
              question="Dois-je avoir un compte pour utiliser l'app desktop ?"
              answer="Oui. L'école doit déjà avoir un compte créé sur la version web. Au premier lancement de l'app desktop, vous recherchez votre école puis vous connectez avec vos identifiants existants."
            />
            <FaqItem
              question="L'app desktop met-elle à jour automatiquement ?"
              answer="Oui. L'app vérifie les mises à jour au démarrage et affiche une notification si une nouvelle version est disponible. L'installation se fait en un clic."
            />
            <FaqItem
              question="Puis-je travailler sans connexion internet ?"
              answer="Oui. L'app desktop embarque une base SQLite locale qui se synchronise avec Neon PostgreSQL toutes les 60 secondes quand vous êtes en ligne. Hors ligne, vos écritures sont mises en file d'attente et synchronisées au retour de la connexion."
            />
            <FaqItem
              question="Mes données sont-elles les mêmes sur web, desktop et mobile ?"
              answer="Oui, exactement. Neon PostgreSQL est la source de vérité unique. L'app desktop et l'app mobile sont des miroirs qui se synchronisent automatiquement."
            />
            <FaqItem
              question="Quelles sont les configurations requises ?"
              answer="Desktop : Windows 10/11 64-bit, macOS 11+, ou Linux. Mobile : Android 8.0+ ou iOS 14+. WebView2 est requis sur Windows (préinstallé sur Windows 11)."
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AH</span>
            </div>
            <span className="font-bold text-white">Academia Helm</span>
          </div>
          <p className="text-sm">
            © 2026 Academia Helm. Tous droits réservés.
          </p>
          <p className="text-xs mt-2 text-slate-500">
            Plateforme de gestion scolaire pour établissements africains
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── Composant: Downloads Desktop ──

function DesktopDownloads({ release }: { release: Release }) {
  const desktopAssets = release.assets.filter(
    (a) => a.platform === "windows" || a.platform === "macos" || a.platform === "linux",
  );

  // Grouper par plateforme
  const byPlatform = desktopAssets.reduce((acc, asset) => {
    if (!acc[asset.platform]) acc[asset.platform] = [];
    acc[asset.platform].push(asset);
    return acc;
  }, {} as Record<string, ReleaseAsset[]>);

  return (
    <div>
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          Télécharger pour Desktop
        </h2>
        <p className="text-slate-500">
          Version {release.version} — {new Date(release.date).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["windows", "macos", "linux"] as const).map((platform) => {
          const color = PLATFORM_COLORS[platform];
          const label = PLATFORM_LABELS[platform];
          const requirements = PLATFORM_REQUIREMENTS[platform];
          const assets = byPlatform[platform] || [];

          return (
            <div
              key={platform}
              className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* En-tête plateforme avec icône officielle */}
              <div
                className="p-6 text-white"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}DD)` }}
              >
                <PlatformIcon platform={platform} size={40} className="mb-3" />
                <h3 className="text-lg font-bold">{label}</h3>
                <p className="text-xs opacity-80 mt-1">{requirements}</p>
              </div>

              {/* Boutons de téléchargement */}
              <div className="p-6 space-y-3">
                {assets.length === 0 ? (
                  <div className="text-center py-6">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">
                      Bientôt disponible
                    </p>
                  </div>
                ) : (
                  assets.map((asset) => (
                    <a
                      key={asset.name}
                      href={asset.downloadUrl}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {asset.name}
                        </p>
                        <p className="text-xs text-slate-500">{asset.size}</p>
                      </div>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-y-0.5 transition-all flex-shrink-0" />
                    </a>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Composant: Downloads Mobile ──

function MobileDownloads({ release }: { release: Release }) {
  return (
    <div>
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          Télécharger pour Mobile
        </h2>
        <p className="text-slate-500">
          Version {release.version} — {new Date(release.date).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Android */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow">
          <div
            className="p-6 text-white"
            style={{ background: `linear-gradient(135deg, ${PLATFORM_COLORS.android}, ${PLATFORM_COLORS.android}DD)` }}
          >
            <PlatformIcon platform="android" size={40} className="mb-3" />
            <h3 className="text-lg font-bold">{PLATFORM_LABELS.android}</h3>
            <p className="text-xs opacity-80 mt-1">{PLATFORM_REQUIREMENTS.android}</p>
          </div>

          <div className="p-6 space-y-3">
            {/* Play Store */}
            <a
              href="https://play.google.com/store/apps/details?id=com.academiahelm.mobile"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <PlatformIcon platform="google-play" size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{PLATFORM_LABELS["google-play"]}</p>
                  <p className="text-xs text-slate-500">Recommandé</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-all flex-shrink-0" />
            </a>

            {/* APK direct */}
            <a
              href={release.assets.find((a) => a.platform === "android")?.downloadUrl || "#"}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">Télécharger l'APK</p>
                <p className="text-xs text-slate-500">~25 MB — Installation manuelle</p>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-all flex-shrink-0" />
            </a>
          </div>
        </div>

        {/* iOS */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow">
          <div
            className="p-6 text-white"
            style={{ background: `linear-gradient(135deg, #1a1a1a, #333)` }}
          >
            <PlatformIcon platform="ios" size={40} className="mb-3" />
            <h3 className="text-lg font-bold">{PLATFORM_LABELS.ios}</h3>
            <p className="text-xs opacity-80 mt-1">{PLATFORM_REQUIREMENTS.ios}</p>
          </div>

          <div className="p-6 space-y-3">
            {/* App Store */}
            <a
              href="https://apps.apple.com/app/academia-helm/idXXXXXXXX"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <PlatformIcon platform="app-store" size={18} className="text-slate-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{PLATFORM_LABELS["app-store"]}</p>
                  <p className="text-xs text-slate-500">Recommandé</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-all flex-shrink-0" />
            </a>

            {/* TestFlight */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 opacity-60">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">TestFlight</p>
                <p className="text-xs text-slate-500">Bientôt disponible</p>
              </div>
              <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Note d'info */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Avant de commencer</p>
          <p className="text-xs text-blue-700 mt-1">
            L'application mobile vous guidera pour rechercher votre école au premier lancement.
            Votre école doit déjà avoir un compte Academia Helm. Si ce n'est pas le cas,
            contactez l'administration de votre école.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Composants réutilisables ──

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: any;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 hover:shadow-lg transition-shadow">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900 text-sm">{question}</span>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
