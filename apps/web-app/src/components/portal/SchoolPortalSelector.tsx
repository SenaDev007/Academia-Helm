/**
 * ============================================================================
 * SCHOOL PORTAL SELECTOR — ACCÈS DIRECT PAR SOUS-DOMAINE
 * ============================================================================
 *
 * Composant affiché lorsqu'un utilisateur accède directement à
 * un sous-domaine d'école (ex: cspeb-eveildafriqueeducation.academiahelm.com).
 *
 * Présente les 4 portails disponibles dans le contexte d'une école :
 *   - ÉCOLE : Gestion de l'établissement
 *   - ENSEIGNANT : Pédagogie & suivi
 *   - PARENT / ÉLÈVE : Suivi & communication
 *   - PUBLIC : Pré-inscription & acquisition
 *
 * Design V4 : Fond navy, cartes épurées sans icônes, palette Academia Helm
 *   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  MapPin,
  Phone,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getMotionDuration } from '@/lib/motion/presets';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { type PortalType } from '@/lib/auth/role-portal-map';

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';
const NAVY_DARK = '#091f4a';
const NAVY_LIGHT = '#144798';

interface SchoolPortalInfo {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  motto: string | null;
}

/**
 * Définition des 4 portails — sans icônes, design épuré
 */
const SCHOOL_PORTAL_DEFS = [
  {
    type: 'SCHOOL' as PortalType,
    title: 'Portail École',
    subtitle: 'Direction & administration',
    accentFrom: '#f5b335',
    accentTo: '#e09e1f',
  },
  {
    type: 'TEACHER' as PortalType,
    title: 'Portail Enseignant',
    subtitle: 'Pédagogie & suivi',
    accentFrom: '#34d399',
    accentTo: '#059669',
  },
  {
    type: 'PARENT' as PortalType,
    title: 'Portail Parent / Élève',
    subtitle: 'Suivi & communication',
    accentFrom: '#60a5fa',
    accentTo: '#2563eb',
  },
  {
    type: 'PUBLIC' as PortalType,
    title: 'Portail Public',
    subtitle: 'Pré-inscription & infos',
    accentFrom: '#c084fc',
    accentTo: '#7c3aed',
  },
];

interface SchoolPortalSelectorProps {
  schoolInfo?: SchoolPortalInfo | null;
  subdomain?: string | null;
}

export default function SchoolPortalSelector({ schoolInfo, subdomain }: SchoolPortalSelectorProps) {
  const [hoveredPortal, setHoveredPortal] = useState<PortalType | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolPortalInfo | null>(schoolInfo || null);
  const [isLoading, setIsLoading] = useState(!schoolInfo);
  const [imgError, setImgError] = useState(false);
  const { shouldReduceMotion } = useMotionBudget();

  const dur = useMemo(
    () => getMotionDuration(shouldReduceMotion, 'normal'),
    [shouldReduceMotion],
  );

  // Réinitialiser l'erreur image quand les données changent
  useEffect(() => {
    setImgError(false);
  }, [schoolData?.logoUrl]);

  // Résoudre les informations de l'école depuis l'API si pas fournies
  useEffect(() => {
    if (schoolInfo) {
      setSchoolData(schoolInfo);
      setIsLoading(false);
      return;
    }

    if (!subdomain && typeof window !== 'undefined') {
      const host = window.location.host;
      const slug = extractTenantSlug(host);
      if (slug) {
        fetchSchoolData(slug);
      } else {
        setIsLoading(false);
      }
    } else if (subdomain) {
      fetchSchoolData(subdomain);
    } else {
      setIsLoading(false);
    }
  }, [schoolInfo, subdomain]);

  const fetchSchoolData = async (slug: string) => {
    try {
      // Appeler la route BFF qui proxy vers le backend et extrait le branding
      const response = await fetch(`/api/public/schools/by-subdomain/${slug}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        // La BFF retourne déjà les données de branding extraites (flat object)
        setSchoolData({
          name: data.name || slug,
          slug: data.slug || slug,
          logoUrl: data.logoUrl || null,
          city: data.city || null,
          phone: data.phone || null,
          address: data.address || null,
          primaryColor: data.primaryColor || null,
          secondaryColor: data.secondaryColor || null,
          slogan: data.slogan || null,
          motto: data.motto || null,
        });
      }
    } catch (error) {
      console.error('Failed to fetch school data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePortalClick = (portalType: PortalType) => {
    const params = new URLSearchParams();
    params.set('portal', portalType.toLowerCase());
    if (schoolData?.slug) params.set('tenant', schoolData.slug);
    if (schoolData?.name) params.set('school_name', schoolData.name);
    window.location.href = `/login?${params.toString()}`;
  };

  const containerVariants = useMemo(
    () => ({
      hidden: { opacity: shouldReduceMotion ? 1 : 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: shouldReduceMotion ? 0 : 0.08,
          delayChildren: shouldReduceMotion ? 0 : 0.1,
        },
      },
    }),
    [shouldReduceMotion],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: {
        opacity: shouldReduceMotion ? 1 : 0,
        y: shouldReduceMotion ? 0 : 16,
      },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: dur, ease: 'easeOut' as const },
      },
    }),
    [shouldReduceMotion, dur],
  );

  const displayName = schoolData?.name || BRAND.name;
  const displaySlogan = schoolData?.slogan || schoolData?.motto;

  // Vérifier si on a un vrai logo
  const hasValidLogo = schoolData?.logoUrl && !imgError;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden">
      {/* ── Image de fond ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/images/school-portal.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
          quality={85}
          sizes="100vw"
        />
        {/* Overlay sombre pour la lisibilité */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${NAVY_DARK}dd 0%, ${NAVY}cc 40%, ${NAVY_LIGHT}bb 100%)`,
          }}
        />
      </div>

      {/* ── Décorations de fond ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* Glow or en haut à droite */}
        <div
          className="absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full"
          style={{ background: `radial-gradient(circle, ${GOLD}15, transparent 65%)` }}
        />
        {/* Glow bleu en bas à gauche */}
        <div
          className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full"
          style={{ background: `radial-gradient(circle, ${BLUE}18, transparent 65%)` }}
        />
        {/* Motif subtil de points */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* ── Ligne d'accent en haut ── */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${GOLD}, ${NAVY_LIGHT}, ${GOLD})` }}
      />

      {/* ── Contenu principal ── */}
      <motion.div
        className="relative z-10 flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* ── En-tête — Branding de l'école ── */}
        <motion.div variants={itemVariants} className="mb-8 flex flex-col items-center text-center sm:mb-10">
          {/* Logo de l'école */}
          <div className="relative mb-4">
            {hasValidLogo ? (
              <div
                className="rounded-2xl p-1"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}40, ${GOLD}10)`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${GOLD}20`,
                }}
              >
                <Image
                  src={schoolData!.logoUrl!}
                  alt={displayName}
                  width={80}
                  height={80}
                  className="rounded-xl object-cover"
                  style={{ boxShadow: `0 2px 8px rgba(0,0,0,0.2)` }}
                  priority
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div
                className="rounded-2xl p-1"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}08)`,
                  border: `1.5px solid ${GOLD}25`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
                }}
              >
                <Image
                  src="/images/logo-Academia Hub.png"
                  alt={BRAND.name}
                  width={72}
                  height={72}
                  className="rounded-xl object-contain"
                  style={{ boxShadow: `0 2px 8px rgba(0,0,0,0.2)` }}
                  priority
                />
              </div>
            )}
          </div>

          {/* Nom de l'école */}
          <h1 className="text-sm font-semibold tracking-tight text-white sm:text-base">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f5b335]" />
                <span className="text-white/70">Chargement...</span>
              </span>
            ) : (
              displayName
            )}
          </h1>

          {/* Slogan */}
          {displaySlogan && (
            <p className="mt-1 text-[11px] italic text-white/40 sm:text-xs">
              {displaySlogan}
            </p>
          )}

          {/* Badges info école */}
          {schoolData && (schoolData.city || schoolData.phone) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {schoolData.city && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-white/70"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <MapPin className="h-3 w-3" style={{ color: GOLD }} />
                  {schoolData.city}
                </span>
              )}
              {schoolData.phone && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-white/70"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Phone className="h-3 w-3" style={{ color: GOLD }} />
                  {schoolData.phone}
                </span>
              )}
            </div>
          )}

          {/* Invite */}
          <p className="mt-3 text-xs font-medium text-white/50">
            Choisissez votre portail pour vous connecter
          </p>
        </motion.div>

        {/* ── Grille de cartes portail ── */}
        <motion.div
          variants={itemVariants}
          className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
        >
          {SCHOOL_PORTAL_DEFS.map((portal) => {
            const isHovered = hoveredPortal === portal.type;

            return (
              <motion.button
                key={portal.type}
                onClick={() => handlePortalClick(portal.type)}
                onMouseEnter={() => setHoveredPortal(portal.type)}
                onMouseLeave={() => setHoveredPortal(null)}
                className="group relative flex flex-col overflow-hidden rounded-2xl text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
                style={{
                  background: isHovered
                    ? `linear-gradient(135deg, ${portal.accentFrom}18, rgba(255,255,255,0.12))`
                    : `linear-gradient(135deg, ${portal.accentFrom}12, rgba(255,255,255,0.08))`,
                  border: isHovered
                    ? `1.5px solid ${portal.accentFrom}50`
                    : `1.5px solid ${portal.accentFrom}30`,
                  boxShadow: isHovered
                    ? `0 12px 40px rgba(0,0,0,0.4), 0 0 30px ${portal.accentFrom}20`
                    : `0 4px 20px ${portal.accentFrom}10, 0 2px 8px rgba(0,0,0,0.2)`,
                  backdropFilter: 'blur(12px)',
                }}
                whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.01 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {/* Barre d'accent colorée en haut */}
                <div
                  className="h-1 w-full transition-all duration-300"
                  style={{
                    background: `linear-gradient(90deg, ${portal.accentFrom}, ${portal.accentTo})`,
                  }}
                />

                <div className="p-4 sm:p-5">
                  {/* Titre + sous-titre */}
                  <div>
                    <h3 className="text-sm font-bold text-white sm:text-base">
                      {portal.title}
                    </h3>
                    <p
                      className="mt-0.5 text-[11px] font-medium sm:text-xs"
                      style={{ color: `${portal.accentFrom}cc` }}
                    >
                      {portal.subtitle}
                    </p>
                  </div>

                  {/* Bouton Accéder */}
                  <div className="mt-4 flex items-center justify-end">
                    <div
                      className="flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200"
                      style={{ color: portal.accentFrom }}
                    >
                      Accéder
                      <ChevronRight
                        className="h-3 w-3 transition-transform duration-200"
                        style={{ transform: isHovered ? 'translateX(2px)' : 'translateX(0)' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Navigation footer ── */}
        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:gap-4"
        >
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-white/50 transition-all duration-200 hover:text-white/80"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">&larr;</span>
            Accueil
          </Link>
          <Link
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-white/50 transition-all duration-200 hover:text-white/80"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Tous les portails
            <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        {/* ── Propulsé par ── */}
        <motion.div variants={itemVariants} className="mt-6 text-center sm:mt-8">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Compass className="h-3 w-3" style={{ color: GOLD }} />
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/30">
              Propulsé par
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD }}>
              {BRAND.name}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
