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
 * Design V2 : Fond blanc, palette Academia Helm
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
 * Définition des 4 portails — compactes
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
  },
  {
    type: 'TEACHER' as PortalType,
    title: 'Enseignant',
    subtitle: 'Pédagogie & suivi',
    authMethod: 'Matricule & mot de passe',
    authIcon: BookOpen,
    description: 'Cours, notes, présences, ressources',
    Icon: GraduationCap,
  },
  {
    type: 'PARENT' as PortalType,
    title: 'Parent / Élève',
    subtitle: 'Suivi & communication',
    authMethod: 'Téléphone & OTP',
    authIcon: UserCheck,
    description: 'Bulletins, paiements, absences',
    Icon: Users,
  },
  {
    type: 'PUBLIC' as PortalType,
    title: 'Public',
    subtitle: 'Pré-inscription & infos',
    authMethod: 'Aucune authentification',
    authIcon: Globe,
    description: 'Pré-inscription, informations, contact',
    Icon: Globe,
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
  const { shouldReduceMotion } = useMotionBudget();

  const dur = useMemo(
    () => getMotionDuration(shouldReduceMotion, 'normal'),
    [shouldReduceMotion],
  );

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

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center bg-white">
      {/* ── Subtle top accent line ── */}
      <div className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD}, ${NAVY})` }}
      />

      {/* ── Subtle background decoration ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${NAVY}04, transparent 70%)` }} />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${GOLD}04, transparent 70%)` }} />
      </div>

      {/* ── Main content ── */}
      <motion.div
        className="relative z-10 flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* ── Header — School branding ── */}
        <motion.div variants={itemVariants} className="mb-8 flex flex-col items-center text-center sm:mb-10">
          {/* Logo */}
          <div className="relative mb-4">
            {schoolData?.logoUrl ? (
              <Image
                src={schoolData.logoUrl}
                alt={displayName}
                width={72}
                height={72}
                className="rounded-xl object-cover shadow-md"
                style={{ boxShadow: `0 4px 16px ${NAVY}15` }}
                priority
              />
            ) : (
              <div
                className="flex h-[72px] w-[72px] items-center justify-center rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                  boxShadow: `0 4px 16px ${NAVY}20`,
                }}
              >
                <span className="text-2xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* School name */}
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl" style={{ color: NAVY }}>
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement...
              </span>
            ) : (
              displayName
            )}
          </h1>

          {/* Slogan */}
          {displaySlogan && (
            <p className="mt-1 text-xs italic text-slate-400 sm:text-sm">
              {displaySlogan}
            </p>
          )}

          {/* School info badges */}
          {schoolData && (schoolData.city || schoolData.phone) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              {schoolData.city && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5"
                  style={{ borderColor: `${NAVY}15`, background: `${NAVY}04` }}>
                  <MapPin className="h-3 w-3" style={{ color: NAVY }} />
                  {schoolData.city}
                </span>
              )}
              {schoolData.phone && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5"
                  style={{ borderColor: `${NAVY}15`, background: `${NAVY}04` }}>
                  <Phone className="h-3 w-3" style={{ color: NAVY }} />
                  {schoolData.phone}
                </span>
              )}
            </div>
          )}

          {/* Prompt */}
          <p className="mt-4 text-sm font-medium text-slate-500">
            Choisissez votre portail pour vous connecter
          </p>
        </motion.div>

        {/* ── Portal cards grid — compact 2×2 ── */}
        <motion.div
          variants={itemVariants}
          className="grid w-full max-w-lg grid-cols-2 gap-3 sm:gap-4"
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
                className="group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{
                  background: isHovered ? `${NAVY}08` : 'white',
                  borderColor: isHovered ? `${NAVY}30` : `${NAVY}12`,
                  boxShadow: isHovered
                    ? `0 4px 16px ${NAVY}12`
                    : `0 1px 3px ${NAVY}08`,
                  focusRingColor: GOLD,
                }}
                whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                {/* Top accent line */}
                <div className="h-0.5 w-full transition-opacity duration-200"
                  style={{
                    background: `linear-gradient(90deg, ${GOLD}, ${NAVY})`,
                    opacity: isHovered ? 1 : 0.3,
                  }}
                />

                <div className="p-3 sm:p-4">
                  {/* Icon */}
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 sm:h-10 sm:w-10"
                    style={{
                      background: isHovered ? `${NAVY}12` : `${NAVY}08`,
                    }}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: isHovered ? NAVY : `${NAVY}99` }} />
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold sm:text-base" style={{ color: NAVY }}>
                    {portal.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="mt-0.5 text-[11px] font-medium sm:text-xs" style={{ color: `${GOLD}cc` }}>
                    {portal.subtitle}
                  </p>

                  {/* Description */}
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400 sm:text-[11px]">
                    {portal.description}
                  </p>

                  {/* Footer */}
                  <div className="mt-2 flex items-center justify-between border-t pt-2"
                    style={{ borderColor: `${NAVY}08` }}
                  >
                    <div className="flex items-center gap-1">
                      <AuthIcon className="h-2.5 w-2.5 text-slate-300" />
                      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                        {portal.authMethod}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-200"
                      style={{ color: isHovered ? NAVY : `${NAVY}50` }}>
                      Accéder
                      <ChevronRight className="h-2.5 w-2.5 transition-transform duration-200"
                        style={{ transform: isHovered ? 'translateX(1px)' : 'translateX(0)' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Footer navigation ── */}
        <motion.div variants={itemVariants} className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium text-slate-500 transition-all duration-200 hover:text-slate-700"
            style={{ borderColor: `${NAVY}12`, background: `${NAVY}03` }}
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">&larr;</span>
            Accueil
          </Link>
          <Link
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium text-slate-500 transition-all duration-200 hover:text-slate-700"
            style={{ borderColor: `${NAVY}12`, background: `${NAVY}03` }}
          >
            Tous les portails
            <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        {/* ── Powered by ── */}
        <motion.div variants={itemVariants} className="mt-6 text-center sm:mt-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1"
            style={{ borderColor: `${NAVY}08`, background: `${NAVY}02` }}
          >
            <Compass className="h-3 w-3" style={{ color: GOLD }} />
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Propulsé par
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: NAVY }}>
              {BRAND.name}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
