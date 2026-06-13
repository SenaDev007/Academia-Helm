/**
 * ============================================================================
 * SCHOOL PORTAL SELECTOR — ACCÈS DIRECT PAR SOUS-DOMAINE
 * ============================================================================
 *
 * Composant affiché lorsqu'un utilisateur accède directement à
 * un sous-domaine d'école (ex: cspeb-eveildafriqueeducation.academiahelm.com).
 *
 * Présente les 4 portails disponibles dans le contexte d'une école :
 *   - ÉCOLE (45 rôles) : Gestion de l'établissement
 *   - ENSEIGNANT (11 rôles) : Pédagogie & suivi
 *   - PARENT / ÉLÈVE (9 rôles) : Suivi & communication
 *   - PUBLIC (5 rôles) : Pré-inscription & acquisition
 *
 * Design V3 : Fond navy, cartes glassmorphism, palette Academia Helm
 *   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  GraduationCap,
  Users,
  Globe,
  ArrowRight,
  Loader2,
  MapPin,
  Phone,
  ChevronRight,
  Shield,
  BookOpen,
  UserCheck,
  Compass,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getMotionDuration } from '@/lib/motion/presets';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { getAvailablePortals, detectAccessContext, type PortalType } from '@/lib/auth/role-portal-map';
import { getApiBaseUrl } from '@/lib/utils/urls';

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
 * Définition des 4 portails
 */
const SCHOOL_PORTAL_DEFS = [
  {
    type: 'SCHOOL' as PortalType,
    title: 'École',
    subtitle: 'Direction & administration',
    authMethod: 'Email & mot de passe',
    authIcon: Shield,
    description: 'Scolarité, finances, RH, paramètres',
    Icon: Building2,
    accentFrom: '#f5b335',
    accentTo: '#e09e1f',
  },
  {
    type: 'TEACHER' as PortalType,
    title: 'Enseignant',
    subtitle: 'Pédagogie & suivi',
    authMethod: 'Matricule & mot de passe',
    authIcon: BookOpen,
    description: 'Cours, notes, présences, ressources',
    Icon: GraduationCap,
    accentFrom: '#34d399',
    accentTo: '#059669',
  },
  {
    type: 'PARENT' as PortalType,
    title: 'Parent / Élève',
    subtitle: 'Suivi & communication',
    authMethod: 'Téléphone & OTP',
    authIcon: UserCheck,
    description: 'Bulletins, paiements, absences',
    Icon: Users,
    accentFrom: '#60a5fa',
    accentTo: '#2563eb',
  },
  {
    type: 'PUBLIC' as PortalType,
    title: 'Public',
    subtitle: 'Pré-inscription & infos',
    authMethod: 'Aucune authentification',
    authIcon: Globe,
    description: 'Pré-inscription, informations, contact',
    Icon: Globe,
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
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/tenants/by-subdomain/${slug}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        const identity = data.identityProfiles?.[0];
        const settings = data.schoolSettings;
        const school = data.schools;
        setSchoolData({
          name: identity?.schoolName || settings?.schoolName || school?.name || data.name || slug,
          slug: data.slug || slug,
          logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
          city: identity?.city || settings?.city || school?.city || null,
          phone: identity?.phonePrimary || settings?.phone || school?.primaryPhone || null,
          address: identity?.address || settings?.address || school?.address || null,
          primaryColor: settings?.primaryColor || school?.primaryColor || null,
          secondaryColor: settings?.secondaryColor || school?.secondaryColor || null,
          slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
          motto: school?.motto || null,
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
    <div
      className="relative flex min-h-screen w-full flex-col items-center"
      style={{
        background: `linear-gradient(160deg, ${NAVY_DARK} 0%, ${NAVY} 40%, ${NAVY_LIGHT} 100%)`,
      }}
    >
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
                className="flex h-[80px] w-[80px] items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}25, ${GOLD}08)`,
                  border: `1.5px solid ${GOLD}30`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
                }}
              >
                <span className="text-3xl font-bold" style={{ color: GOLD }}>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Nom de l'école */}
          <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#f5b335]" />
                <span className="text-white/70">Chargement...</span>
              </span>
            ) : (
              displayName
            )}
          </h1>

          {/* Slogan */}
          {displaySlogan && (
            <p className="mt-1 text-xs italic text-white/40 sm:text-sm">
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
          <p className="mt-4 text-sm font-medium text-white/50">
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
            const Icon = portal.Icon;
            const AuthIcon = portal.authIcon;

            return (
              <motion.button
                key={portal.type}
                onClick={() => handlePortalClick(portal.type)}
                onMouseEnter={() => setHoveredPortal(portal.type)}
                onMouseLeave={() => setHoveredPortal(null)}
                className="group relative flex flex-col overflow-hidden rounded-2xl text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
                style={{
                  background: isHovered
                    ? 'rgba(255,255,255,0.10)'
                    : 'rgba(255,255,255,0.05)',
                  border: isHovered
                    ? `1.5px solid rgba(255,255,255,0.18)`
                    : `1.5px solid rgba(255,255,255,0.08)`,
                  boxShadow: isHovered
                    ? `0 8px 32px rgba(0,0,0,0.3), 0 0 24px ${portal.accentFrom}15`
                    : `0 4px 16px rgba(0,0,0,0.2)`,
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
                    opacity: isHovered ? 1 : 0.5,
                  }}
                />

                <div className="p-4 sm:p-5">
                  {/* Ligne supérieure : icône + titre */}
                  <div className="flex items-start gap-3">
                    {/* Icône du portail */}
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-300"
                      style={{
                        background: isHovered
                          ? `${portal.accentFrom}25`
                          : `${portal.accentFrom}10`,
                        border: isHovered
                          ? `1px solid ${portal.accentFrom}40`
                          : `1px solid ${portal.accentFrom}15`,
                      }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: isHovered ? portal.accentFrom : `${portal.accentFrom}cc` }}
                      />
                    </div>

                    {/* Titre + sous-titre */}
                    <div className="min-w-0 flex-1">
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
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-[11px] leading-relaxed text-white/40 sm:text-xs">
                    {portal.description}
                  </p>

                  {/* Séparateur */}
                  <div
                    className="my-3 h-px"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  />

                  {/* Pied de carte — méthode d'auth + bouton Accéder */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AuthIcon
                        className="h-3 w-3 flex-shrink-0"
                        style={{ color: `${portal.accentFrom}80` }}
                      />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/35 truncate">
                        {portal.authMethod}
                      </span>
                    </div>
                    <div
                      className="flex flex-shrink-0 items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200"
                      style={{ color: isHovered ? portal.accentFrom : 'rgba(255,255,255,0.35)' }}
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
