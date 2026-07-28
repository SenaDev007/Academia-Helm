"use client";

/**
 * ============================================================================
 * PAGE DE TÉLÉCHARGEMENT — Academia Helm Desktop + Mobile
 * ============================================================================
 *
 * Page publique qui partage EXACTEMENT le même style que le landing page :
 *   - Header <Header /> depuis @/components/ui/header-1
 *   - Footer <Footer2 /> depuis @/components/ui/footer-2
 *   - Logo <LogoCircle /> depuis @/components/ui/LogoCircle
 *   - Palette : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335
 *   - Font : Inter (chargée globalement via layout.tsx)
 *   - Keywords : "Plateforme de pilotage éducatif", "Cockpit digital"
 *
 * Sections :
 *   1. Hero — gradient navy + badge or + titre + sous-titre
 *   2. Sélecteur Desktop / Mobile (onglets)
 *   3. Cartes de téléchargement (Windows/macOS/Linux ou Android/iOS)
 *   4. Fonctionnalités (4 feature cards)
 *   5. Changelog (dernière version)
 *   6. FAQ
 * ============================================================================
 */

import { useState } from "react";
import {
  Download, CheckCircle2, AlertCircle, ChevronRight,
  Calendar, Tag, Shield, Zap, WifiOff, RefreshCw, FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ── Composants partagés du landing page ──
import { Header } from "@/components/ui/header-1";
import { Footer2 } from "@/components/ui/footer-2";
import { LogoCircle } from "@/components/ui/LogoCircle";
import {
  PlatformIcon,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  PLATFORM_REQUIREMENTS,
} from "@/components/icons/PlatformIcon";

// ── Palette Academia Helm (identique au landing page) ──
const NAVY = "#0b2f73";
const NAVY_DARK = "#0a1d3f";
const NAVY_MID = "#103e91";
const BLUE = "#1d4fa5";
const GOLD = "#f5b335";
const GOLD_HOVER = "#f7c359";
const GOLD_LIGHT = "#ffd166";

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

// ── Release actuelle ──

const LATEST_RELEASE: Release = {
  version: "1.0.0",
  date: "2026-07-28",
  notes: [
    "Application desktop Windows, macOS et Linux (Tauri 2)",
    "Application mobile Android et iOS (Flutter)",
    "Base de données locale SQLite pour le mode hors connexion",
    "Synchronisation automatique avec Neon PostgreSQL toutes les 60 secondes",
    "Bouton « Synchroniser » manuel dans le cockpit digital",
    "Auto-update : notification native au démarrage si mise à jour disponible",
    "Même interface que la version web — pas de recodage",
    "Sécurité renforcée : JWT + vérification d'appartenance sur tous les endpoints",
  ],
  assets: [
    {
      name: "Academia-Helm-1.0.0-windows-setup.exe",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0-windows-setup.exe",
      size: "~10 MB",
      platform: "windows",
    },
    {
      name: "Academia-Helm-1.0.0-windows.msi",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0-windows.msi",
      size: "~12 MB",
      platform: "windows",
    },
    {
      name: "Academia-Helm-1.0.0-macos.dmg",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0-macos.dmg",
      size: "~15 MB",
      platform: "macos",
    },
    {
      name: "Academia-Helm-1.0.0-android.apk",
      downloadUrl: "https://github.com/SenaDev007/Academia-Helm/releases/latest/download/Academia-Helm-1.0.0-android.apk",
      size: "~25 MB",
      platform: "android",
    },
  ],
};

// ── Composant principal ──

export default function DownloadsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      {/* ── Header (identique au landing page) ── */}
      <Header />

      {/* Espace pour le header fixe */}
      <div className="h-16 md:h-18" />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Fond gradient Navy (identique au hero du landing page) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2f73] via-[#103e91] to-[#1d4fa5]" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge or */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f5b335]/20 border border-[#f5b335]/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#f5b335] mb-6">
              <Download className="w-3.5 h-3.5" />
              Téléchargements
            </div>

            {/* Logo Academia Helm */}
            <div className="flex justify-center mb-6">
              <LogoCircle size={72} animated={true} />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.15] tracking-tight mb-4">
              Academia<span className="text-amber-300 ml-2">Helm</span>
            </h1>

            <p className="text-base md:text-lg text-blue-100 max-w-2xl mx-auto mb-6">
              Téléchargez le cockpit digital de votre établissement.
              Application desktop et mobile, mode hors connexion, synchronisation automatique.
            </p>

            {/* Version actuelle */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm">
              <Tag className="w-4 h-4 text-[#f5b335]" />
              <span className="font-semibold">Version {LATEST_RELEASE.version}</span>
              <span className="opacity-40">•</span>
              <Calendar className="w-4 h-4 text-[#f5b335]" />
              <span>{new Date(LATEST_RELEASE.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Sélecteur Desktop / Mobile ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] border border-slate-200/80 p-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedPlatform("desktop")}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all duration-300 ${
              selectedPlatform === "desktop"
                ? "bg-[#0b2f73] text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <PlatformIcon platform="windows" size={20} />
            Desktop
          </button>
          <button
            onClick={() => setSelectedPlatform("mobile")}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all duration-300 ${
              selectedPlatform === "mobile"
                ? "bg-[#0b2f73] text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <PlatformIcon platform="android" size={20} />
            Mobile
          </button>
        </div>
      </section>

      {/* ── Section téléchargements ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <AnimatePresence mode="wait">
          {selectedPlatform === "desktop" ? (
            <motion.div
              key="desktop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DesktopDownloads release={LATEST_RELEASE} />
            </motion.div>
          ) : (
            <motion.div
              key="mobile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <MobileDownloads release={LATEST_RELEASE} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="bg-[#0a1d3f] py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 30% 20%, #f5b335 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f5b335]/20 border border-[#f5b335]/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#f5b335] mb-4">
              Avantages
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
              Pourquoi utiliser l'application desktop et mobile ?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Zap}
              title="Accès plus rapide"
              description="Lancez le cockpit digital en un clic depuis votre bureau. Pas besoin d'ouvrir un navigateur."
            />
            <FeatureCard
              icon={WifiOff}
              title="Mode hors connexion"
              description="Travaillez sans internet. Les données sont stockées localement et synchronisées au retour de la connexion."
            />
            <FeatureCard
              icon={RefreshCw}
              title="Sync automatique"
              description="Synchronisation toutes les 60 secondes avec la base centrale Neon. Vos données sont toujours à jour."
            />
            <FeatureCard
              icon={Shield}
              title="Sécurisé"
              description="Authentification JWT, chiffrement, vérification d'appartenance. Même sécurité que la version web."
            />
          </div>
        </div>
      </section>

      {/* ── Changelog ── */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-4">
              <FileCode className="w-3.5 h-3.5" />
              Mises à jour
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight mb-2">
              Dernières nouveautés
            </h2>
            <p className="text-slate-500">
              Version {LATEST_RELEASE.version} — {new Date(LATEST_RELEASE.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] overflow-hidden">
            {/* En-tête navy */}
            <div className="bg-gradient-to-r from-[#0b2f73] to-[#1d4fa5] p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Version {LATEST_RELEASE.version}</h3>
                  <p className="text-sm text-blue-100 mt-1">
                    {new Date(LATEST_RELEASE.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#f5b335] text-[#0b2f73] text-xs font-bold">
                  DERNIÈRE
                </span>
              </div>
            </div>

            {/* Notes de version */}
            <div className="p-6 md:p-8">
              <h4 className="font-semibold text-[#0b2f73] mb-4 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#f5b335]" />
                Nouveautés
              </h4>
              <ul className="space-y-3">
                {LATEST_RELEASE.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 text-sm md:text-base">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-[#F7F9FC] py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-4">
              FAQ
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight">
              Questions fréquentes
            </h2>
          </div>

          <div className="space-y-4">
            <FaqItem
              question="Dois-je avoir un compte pour utiliser l'application desktop ?"
              answer="Oui. L'établissement doit déjà avoir un compte créé sur la version web. Au premier lancement de l'application desktop, vous recherchez votre établissement puis vous connectez avec vos identifiants existants."
            />
            <FaqItem
              question="L'application desktop met-elle à jour automatiquement ?"
              answer="Oui. L'application vérifie les mises à jour au démarrage et affiche une notification si une nouvelle version est disponible. L'installation se fait en un clic."
            />
            <FaqItem
              question="Puis-je travailler sans connexion internet ?"
              answer="Oui. L'application desktop embarque une base SQLite locale qui se synchronise avec Neon PostgreSQL toutes les 60 secondes quand vous êtes en ligne. Hors ligne, vos écritures sont mises en file d'attente et synchronisées au retour de la connexion."
            />
            <FaqItem
              question="Mes données sont-elles les mêmes sur web, desktop et mobile ?"
              answer="Oui, exactement. Neon PostgreSQL est la source de vérité unique. L'application desktop et l'application mobile sont des miroirs qui se synchronisent automatiquement."
            />
            <FaqItem
              question="Quelles sont les configurations requises ?"
              answer="Desktop : Windows 10/11 64-bit, macOS 11+, ou Linux. Mobile : Android 8.0+ ou iOS 14+. WebView2 est requis sur Windows (préinstallé sur Windows 11)."
            />
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="bg-gradient-to-br from-[#0b2f73] via-[#103e91] to-[#1d4fa5] py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-[1.15] tracking-tight mb-4">
            Passez au pilotage scolaire nouvelle génération
          </h2>
          <p className="text-blue-100 text-base md:text-lg mb-8 max-w-2xl mx-auto">
            Équipez votre établissement d'un système fiable, élégant et prêt pour la croissance.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 bg-[#f5b335] text-[#0b2f73] hover:bg-[#f7c359] px-6 py-3 rounded-xl font-bold min-h-[48px] shadow-lg shadow-[#f5b335]/20 transition-all duration-200 hover:-translate-y-0.5"
          >
            Accéder au portail
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer (identique au landing page) ── */}
      <Footer2 />
    </div>
  );
}

// ── Composant: Downloads Desktop ──

function DesktopDownloads({ release }: { release: Release }) {
  const desktopAssets = release.assets.filter(
    (a) => a.platform === "windows" || a.platform === "macos" || a.platform === "linux",
  );

  const byPlatform = desktopAssets.reduce((acc, asset) => {
    if (!acc[asset.platform]) acc[asset.platform] = [];
    acc[asset.platform].push(asset);
    return acc;
  }, {} as Record<string, ReleaseAsset[]>);

  return (
    <div>
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-4">
          <PlatformIcon platform="windows" size={14} />
          Desktop
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight mb-2">
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
              className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] hover:shadow-[0_24px_60px_-20px_rgba(11,47,115,0.30)] hover:border-[#0b2f73]/30 transition-all duration-300"
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
                    <p className="text-sm text-slate-400">Bientôt disponible</p>
                  </div>
                ) : (
                  assets.map((asset) => (
                    <a
                      key={asset.name}
                      href={asset.downloadUrl}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0b2f73] truncate">
                          {asset.name}
                        </p>
                        <p className="text-xs text-slate-500">{asset.size}</p>
                      </div>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-[#f5b335] group-hover:translate-y-0.5 transition-all flex-shrink-0" />
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
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-4">
          <PlatformIcon platform="android" size={14} />
          Mobile
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight mb-2">
          Télécharger pour Mobile
        </h2>
        <p className="text-slate-500">
          Version {release.version} — {new Date(release.date).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Android */}
        <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] hover:shadow-[0_24px_60px_-20px_rgba(11,47,115,0.30)] hover:border-[#0b2f73]/30 transition-all duration-300">
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
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <PlatformIcon platform="google-play" size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0b2f73]">{PLATFORM_LABELS["google-play"]}</p>
                  <p className="text-xs text-slate-500">Recommandé</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-[#f5b335] transition-all flex-shrink-0" />
            </a>

            {/* APK direct */}
            <a
              href={release.assets.find((a) => a.platform === "android")?.downloadUrl || "#"}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0b2f73]">Télécharger l'APK</p>
                <p className="text-xs text-slate-500">~25 MB — Installation manuelle</p>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-[#f5b335] transition-all flex-shrink-0" />
            </a>
          </div>
        </div>

        {/* iOS */}
        <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] hover:shadow-[0_24px_60px_-20px_rgba(11,47,115,0.30)] hover:border-[#0b2f73]/30 transition-all duration-300">
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
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <PlatformIcon platform="app-store" size={18} className="text-slate-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0b2f73]">{PLATFORM_LABELS["app-store"]}</p>
                  <p className="text-xs text-slate-500">Recommandé</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-[#f5b335] transition-all flex-shrink-0" />
            </a>

            {/* TestFlight */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 opacity-60">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0b2f73]">TestFlight</p>
                <p className="text-xs text-slate-500">Bientôt disponible</p>
              </div>
              <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Note d'info */}
      <div className="mt-8 max-w-3xl mx-auto bg-[#0b2f73]/5 border border-[#0b2f73]/15 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#0b2f73] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#0b2f73]">Avant de commencer</p>
          <p className="text-xs text-slate-600 mt-1">
            L'application mobile vous guidera pour rechercher votre établissement au premier lancement.
            Votre établissement doit déjà avoir un compte Academia Helm. Si ce n'est pas le cas,
            contactez l'administration de votre établissement.
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
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm p-6 hover:bg-white/[0.08] transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-[#f5b335]/20 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#f5b335]" />
      </div>
      <h3 className="font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-blue-100/70 leading-relaxed">{description}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors duration-200"
      >
        <span className="font-semibold text-[#0b2f73] text-sm md:text-base">{question}</span>
        <ChevronRight
          className={`w-4 h-4 text-[#f5b335] flex-shrink-0 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
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
