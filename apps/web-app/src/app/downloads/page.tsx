"use client";

/**
 * ============================================================================
 * PAGE DE TÉLÉCHARGEMENT — Academia Helm Desktop + Mobile
 * ============================================================================
 *
 * Page publique qui partage EXACTEMENT le même style que le landing page :
 *   - Header <Header /> depuis @/components/ui/header-1
 *   - Footer <Footer2 /> depuis @/components/ui/footer-2
 *   - Logo <LogoCircle /> (default export) depuis @/components/ui/LogoCircle
 *   - Palette : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335
 *   - Font : Inter (chargée globalement via layout.tsx)
 *   - Keywords : "Plateforme de pilotage éducatif", "Cockpit digital"
 *
 * Version dynamique :
 *   - Récupère la dernière release depuis l'API GitHub
 *   - Si l'API échoue, fallback sur les valeurs par défaut
 *   - Version + date + notes mises à jour automatiquement
 *
 * Image de fond :
 *   - Background-Page-download.png dans le hero (si disponible)
 *   - Fallback : gradient navy + pattern dots
 *
 * Responsive :
 *   - Mobile-first, breakpoints sm/md/lg/xl
 *   - Grilles adaptatives (1 col mobile → 2-3 cols desktop)
 *   - Tailles de texte fluides (clamp via Tailwind)
 * ============================================================================
 */

import { useState, useEffect } from "react";
import {
  Download, CheckCircle2, AlertCircle, ChevronRight,
  Calendar, Tag, Shield, Zap, WifiOff, RefreshCw, FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ── Composants partagés du landing page ──
import { Header } from "@/components/ui/header-1";
import { Footer2 } from "@/components/ui/footer-2";
import LogoCircle from "@/components/ui/LogoCircle";
import {
  PlatformIcon,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  PLATFORM_REQUIREMENTS,
  FileFormatIcon,
  detectFileFormat,
} from "@/components/icons/PlatformIcon";

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

// ── Release par défaut (fallback si GitHub API indisponible) ──

const DEFAULT_RELEASE: Release = {
  version: "1.0.0",
  date: new Date().toISOString(),
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

// ── Hook: récupère la dernière release depuis GitHub API ──

function useLatestRelease(): { release: Release; loading: boolean } {
  const [release, setRelease] = useState<Release>(DEFAULT_RELEASE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        const response = await fetch(
          "https://api.github.com/repos/SenaDev007/Academia-Helm/releases/latest",
        );

        if (!response.ok) throw new Error("GitHub API error");

        const data = await response.json();

        // Construire les assets depuis la réponse GitHub
        const assets: ReleaseAsset[] = (data.assets || []).map((asset: any) => {
          const name = asset.name as string;
          let platform: ReleaseAsset["platform"] = "windows";

          if (name.includes(".exe") || name.includes(".msi")) platform = "windows";
          else if (name.includes(".dmg") || name.includes(".app")) platform = "macos";
          else if (name.includes(".deb") || name.includes(".AppImage") || name.includes(".rpm")) platform = "linux";
          else if (name.includes(".apk") || name.includes(".aab")) platform = "android";
          else if (name.includes(".ipa")) platform = "ios";

          return {
            name,
            downloadUrl: asset.browser_download_url,
            size: asset.size ? `${Math.round(asset.size / 1024 / 1024)} MB` : "—",
            platform,
          };
        });

        // Parser les notes de version (body markdown → lignes)
        const notesRaw = data.body || "";
        const notes = notesRaw
          .split("\n")
          .map((line: string) => line.replace(/^[-•*\s]+/, "").trim())
          .filter((line: string) => line.length > 0 && !line.startsWith("#"));

        setRelease({
          version: data.tag_name?.replace(/^v/, "") || DEFAULT_RELEASE.version,
          date: data.published_at || data.created_at || new Date().toISOString(),
          notes: notes.length > 0 ? notes : DEFAULT_RELEASE.notes,
          assets: assets.length > 0 ? assets : DEFAULT_RELEASE.assets,
        });
      } catch (error) {
        // Fallback silencieux sur les valeurs par défaut
        console.warn("[downloads] Could not fetch GitHub release, using defaults");
      } finally {
        setLoading(false);
      }
    }

    fetchLatestRelease();
  }, []);

  return { release, loading };
}

// ── Composant principal ──

export default function DownloadsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<"desktop" | "mobile">("desktop");
  const { release, loading } = useLatestRelease();

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      {/* ── Header (identique au landing page) ── */}
      <Header />

      {/* Espace pour le header fixe */}
      <div className="h-14 md:h-16" />

      {/* ── Hero avec image de fond ── */}
      <section className="relative overflow-hidden min-h-[60vh] flex items-center justify-center">
        {/* Image de fond — Background-Page-download.png */}
        {/* Si le fichier n'existe pas, fallback sur gradient navy */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/Background-Page-download.png')",
          }}
        />
        {/* Overlay gradient navy léger — garde l'image visible tout en assurant la lisibilité */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2f73]/70 via-[#103e91]/60 to-[#1d4fa5]/50" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge or */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#f5b335]/20 border border-[#f5b335]/30 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#f5b335] mb-4 sm:mb-6">
              <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Téléchargements
            </div>

            {/* Logo Academia Helm */}
            <div className="flex justify-center mb-4 sm:mb-6">
              <LogoCircle size={56} animated={true} />
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.15] tracking-tight mb-3 sm:mb-4">
              Academia<span className="text-amber-300 ml-1 sm:ml-2">Helm</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-blue-100 max-w-xl sm:max-w-2xl mx-auto mb-4 sm:mb-6 px-2">
              Téléchargez le cockpit digital de votre établissement.
              Application desktop et mobile, mode hors connexion, synchronisation automatique.
            </p>

            {/* Version dynamique */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm">
              <Tag className="w-3.5 h-3.5 text-[#f5b335]" />
              <span className="font-semibold">
                {loading ? "Chargement…" : `Version ${release.version}`}
              </span>
              {!loading && (
                <>
                  <span className="opacity-40">•</span>
                  <Calendar className="w-3.5 h-3.5 text-[#f5b335]" />
                  <span>
                    {new Date(release.date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Sélecteur Desktop / Mobile ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-10">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] border border-slate-200/80 p-1.5 sm:p-2 grid grid-cols-2 gap-1.5 sm:gap-2">
          <button
            onClick={() => setSelectedPlatform("desktop")}
            className={`flex items-center justify-center gap-2 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
              selectedPlatform === "desktop"
                ? "bg-[#0b2f73] text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <PlatformIcon platform="windows" size={18} />
            <span className="hidden xs:inline sm:inline">Desktop</span>
          </button>
          <button
            onClick={() => setSelectedPlatform("mobile")}
            className={`flex items-center justify-center gap-2 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
              selectedPlatform === "mobile"
                ? "bg-[#0b2f73] text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <PlatformIcon platform="android" size={18} />
            <span className="hidden xs:inline sm:inline">Mobile</span>
          </button>
        </div>
      </section>

      {/* ── Section téléchargements ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <AnimatePresence mode="wait">
          {selectedPlatform === "desktop" ? (
            <motion.div
              key="desktop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DesktopDownloads release={release} loading={loading} />
            </motion.div>
          ) : (
            <motion.div
              key="mobile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <MobileDownloads release={release} loading={loading} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="bg-[#0a1d3f] py-16 sm:py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 30% 20%, #f5b335 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f5b335]/20 border border-[#f5b335]/30 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#f5b335] mb-3 sm:mb-4">
              Avantages
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.15] tracking-tight px-2">
              Pourquoi utiliser l'application desktop et mobile ?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
      <section className="bg-white py-16 sm:py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-3 sm:mb-4">
              <FileCode className="w-3.5 h-3.5" />
              Mises à jour
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight mb-2">
              Dernières nouveautés
            </h2>
            {!loading && (
              <p className="text-slate-500 text-sm sm:text-base">
                Version {release.version} —{" "}
                {new Date(release.date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] overflow-hidden">
            {/* En-tête navy */}
            <div className="bg-gradient-to-r from-[#0b2f73] to-[#1d4fa5] p-4 sm:p-6 text-white">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold truncate">
                    {loading ? "Chargement…" : `Version ${release.version}`}
                  </h3>
                  {!loading && (
                    <p className="text-xs sm:text-sm text-blue-100 mt-1">
                      {new Date(release.date).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <span className="px-2 sm:px-3 py-1 rounded-full bg-[#f5b335] text-[#0b2f73] text-[10px] sm:text-xs font-bold whitespace-nowrap flex-shrink-0">
                  DERNIÈRE
                </span>
              </div>
            </div>

            {/* Notes de version */}
            <div className="p-4 sm:p-6 md:p-8">
              <h4 className="font-semibold text-[#0b2f73] mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                <FileCode className="w-4 h-4 text-[#f5b335]" />
                Nouveautés
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                {(loading ? DEFAULT_RELEASE.notes : release.notes).map((note, i) => (
                  <li key={i} className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 text-xs sm:text-sm md:text-base">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-[#F7F9FC] py-16 sm:py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-3 sm:mb-4">
              FAQ
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight">
              Questions fréquentes
            </h2>
          </div>

          <div className="space-y-3 sm:space-y-4">
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
      <section className="bg-gradient-to-br from-[#0b2f73] via-[#103e91] to-[#1d4fa5] py-12 sm:py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-[1.15] tracking-tight mb-3 sm:mb-4 px-2">
            Passez au pilotage scolaire nouvelle génération
          </h2>
          <p className="text-blue-100 text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Équipez votre établissement d'un système fiable, élégant et prêt pour la croissance.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 bg-[#f5b335] text-[#0b2f73] hover:bg-[#f7c359] px-5 sm:px-6 py-3 rounded-xl font-bold min-h-[48px] text-sm sm:text-base shadow-lg shadow-[#f5b335]/20 transition-all duration-200 hover:-translate-y-0.5"
          >
            Accéder au portail
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer (identique au landing page) ── */}
      <Footer2 />
    </div>
  );
}

// ── Composant: Downloads Desktop ──

function DesktopDownloads({
  release,
  loading,
}: {
  release: Release;
  loading: boolean;
}) {
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
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-3 sm:mb-4">
          <PlatformIcon platform="windows" size={14} />
          Desktop
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight mb-2">
          Télécharger pour Desktop
        </h2>
        {!loading && (
          <p className="text-slate-500 text-sm sm:text-base">
            Version {release.version} —{" "}
            {new Date(release.date).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {(["windows", "macos", "linux"] as const).map((platform) => {
          const color = PLATFORM_COLORS[platform];
          const label = PLATFORM_LABELS[platform];
          const requirements = PLATFORM_REQUIREMENTS[platform];
          const assets = byPlatform[platform] || [];

          return (
            <div
              key={platform}
              className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] hover:shadow-[0_24px_60px_-20px_rgba(11,47,115,0.30)] hover:border-[#0b2f73]/30 transition-all duration-300"
            >
              {/* En-tête plateforme */}
              <div
                className="p-4 sm:p-6 text-white"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}DD)` }}
              >
                <PlatformIcon platform={platform} size={32} className="mb-2 sm:mb-3" />
                <h3 className="text-base sm:text-lg font-bold">{label}</h3>
                <p className="text-[10px] sm:text-xs opacity-80 mt-1">{requirements}</p>
              </div>

              {/* Boutons de téléchargement */}
              <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
                {assets.length === 0 ? (
                  <div className="text-center py-4 sm:py-6">
                    <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-slate-400">Bientôt disponible</p>
                  </div>
                ) : (
                  assets.map((asset) => {
                    const fileFormat = detectFileFormat(asset.name);
                    return (
                    <a
                      key={asset.name}
                      href={asset.downloadUrl}
                      className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* Icône du format de fichier (.msi, .exe, .dmg, .apk) */}
                        {fileFormat && (
                          <FileFormatIcon format={fileFormat} size={32} className="hidden sm:flex" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-[#0b2f73] truncate">
                            {asset.name}
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-500">{asset.size}</p>
                        </div>
                      </div>
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-[#f5b335] group-hover:translate-y-0.5 transition-all flex-shrink-0" />
                    </a>
                    );
                  })
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

function MobileDownloads({
  release,
  loading,
}: {
  release: Release;
  loading: boolean;
}) {
  return (
    <div>
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/15 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-3 sm:mb-4">
          <PlatformIcon platform="android" size={14} />
          Mobile
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight mb-2">
          Télécharger pour Mobile
        </h2>
        {!loading && (
          <p className="text-slate-500 text-sm sm:text-base">
            Version {release.version} —{" "}
            {new Date(release.date).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
        {/* Android */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] hover:shadow-[0_24px_60px_-20px_rgba(11,47,115,0.30)] hover:border-[#0b2f73]/30 transition-all duration-300">
          <div
            className="p-4 sm:p-6 text-white"
            style={{ background: `linear-gradient(135deg, ${PLATFORM_COLORS.android}, ${PLATFORM_COLORS.android}DD)` }}
          >
            <PlatformIcon platform="android" size={32} className="mb-2 sm:mb-3" />
            <h3 className="text-base sm:text-lg font-bold">{PLATFORM_LABELS.android}</h3>
            <p className="text-[10px] sm:text-xs opacity-80 mt-1">{PLATFORM_REQUIREMENTS.android}</p>
          </div>

          <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
            {/* Play Store */}
            <a
              href="https://play.google.com/store/apps/details?id=com.academiahelm.mobile"
              className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <PlatformIcon platform="google-play" size={16} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-[#0b2f73] truncate">
                    {PLATFORM_LABELS["google-play"]}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500">Recommandé</p>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-[#f5b335] transition-all flex-shrink-0" />
            </a>

            {/* APK direct */}
            <a
              href={release.assets.find((a) => a.platform === "android")?.downloadUrl || "#"}
              className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <FileFormatIcon format="apk" size={32} className="hidden sm:flex" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-[#0b2f73]">Télécharger l'APK</p>
                  <p className="text-[10px] sm:text-xs text-slate-500">~25 MB — Installation manuelle</p>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-[#f5b335] transition-all flex-shrink-0" />
            </a>
          </div>
        </div>

        {/* iOS */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] hover:shadow-[0_24px_60px_-20px_rgba(11,47,115,0.30)] hover:border-[#0b2f73]/30 transition-all duration-300">
          <div
            className="p-4 sm:p-6 text-white"
            style={{ background: `linear-gradient(135deg, #1a1a1a, #333)` }}
          >
            <PlatformIcon platform="ios" size={32} className="mb-2 sm:mb-3" />
            <h3 className="text-base sm:text-lg font-bold">{PLATFORM_LABELS.ios}</h3>
            <p className="text-[10px] sm:text-xs opacity-80 mt-1">{PLATFORM_REQUIREMENTS.ios}</p>
          </div>

          <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
            {/* App Store */}
            <a
              href="https://apps.apple.com/app/academia-helm/idXXXXXXXX"
              className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 hover:border-[#0b2f73]/30 hover:bg-[#0b2f73]/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <PlatformIcon platform="app-store" size={16} className="text-slate-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-[#0b2f73] truncate">
                    {PLATFORM_LABELS["app-store"]}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500">Recommandé</p>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-[#f5b335] transition-all flex-shrink-0" />
            </a>

            {/* TestFlight */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 opacity-60">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-[#0b2f73]">TestFlight</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Bientôt disponible</p>
              </div>
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Note d'info */}
      <div className="mt-6 sm:mt-8 max-w-3xl mx-auto bg-[#0b2f73]/5 border border-[#0b2f73]/15 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#0b2f73] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs sm:text-sm font-semibold text-[#0b2f73]">Avant de commencer</p>
          <p className="text-[10px] sm:text-xs text-slate-600 mt-1">
            L'application mobile vous guidera pour rechercher votre établissement au premier lancement.
            Votre établissement doit déjà avoir un compte Academia Helm.
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
    <div className="rounded-xl sm:rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm p-4 sm:p-6 hover:bg-white/[0.08] transition-all duration-300">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#f5b335]/20 flex items-center justify-center mb-3 sm:mb-4">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#f5b335]" />
      </div>
      <h3 className="font-bold text-white mb-1.5 sm:mb-2 text-sm sm:text-base">{title}</h3>
      <p className="text-xs sm:text-sm text-blue-100/70 leading-relaxed">{description}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200/80 rounded-lg sm:rounded-xl overflow-hidden bg-white shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 text-left hover:bg-slate-50 transition-colors duration-200"
      >
        <span className="font-semibold text-[#0b2f73] text-xs sm:text-sm md:text-base">{question}</span>
        <ChevronRight
          className={`w-4 h-4 text-[#f5b335] flex-shrink-0 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-3 sm:pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
