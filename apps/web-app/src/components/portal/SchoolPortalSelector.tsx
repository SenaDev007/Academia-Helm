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
 * Design : Professionnel, moderne, captivant
 * Palette Academia Helm exclusive :
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
  Sparkles,
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
 * Définition des 4 portails disponibles dans le contexte école
 */
const SCHOOL_PORTAL_DEFS = [
  {
    type: 'SCHOOL' as PortalType,
    title: 'Portail École',
    subtitle: 'Gestion de l\'établissement',
    authMethod: 'Email & mot de passe',
    authIcon: Shield,
    description: 'Direction, administration, scolarité, finances, RH, paramètres',
    Icon: Building2,
    gradient: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
  },
  {
    type: 'TEACHER' as PortalType,
    title: 'Portail Enseignant',
    subtitle: 'Pédagogie & suivi',
    authMethod: 'Matricule & mot de passe',
    authIcon: BookOpen,
    description: 'Cours, notes, présences, cahier de texte, ressources',
    Icon: GraduationCap,
    gradient: `linear-gradient(135deg, #1a3f8f, #2a5fcf)`,
  },
  {
    type: 'PARENT' as PortalType,
    title: 'Portail Parent / Élève',
    subtitle: 'Suivi & communication',
    authMethod: 'Téléphone & OTP',
    authIcon: UserCheck,
    description: 'Bulletins, paiements, absences, messages, documents',
    Icon: Users,
    gradient: `linear-gradient(135deg, #0d3570, #1d55a8)`,
  },
  {
    type: 'PUBLIC' as PortalType,
    title: 'Portail Public',
    subtitle: 'Pré-inscription & acquisition',
    authMethod: 'Aucune authentification',
    authIcon: Globe,
    description: 'Pré-inscription, informations, contact',
    Icon: Globe,
    gradient: `linear-gradient(135deg, #092a5e, #1549a0)`,
  },
];

interface SchoolPortalSelectorProps {
  /** School info résolue depuis le sous-domaine */
  schoolInfo?: SchoolPortalInfo | null;
  /** Sous-domaine détecté */
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
          staggerChildren: shouldReduceMotion ? 0 : 0.12,
          delayChildren: shouldReduceMotion ? 0 : 0.15,
        },
      },
    }),
    [shouldReduceMotion],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: {
        opacity: shouldReduceMotion ? 1 : 0,
        y: shouldReduceMotion ? 0 : 24,
      },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: dur, ease: 'easeOut' as const },
      },
    }),
    [shouldReduceMotion, dur],
  );

  // Couleurs dynamiques : utiliser les couleurs de l'école si disponibles
  const bgColor1 = schoolData?.primaryColor || NAVY;
  const bgColor2 = schoolData?.secondaryColor || BLUE;
  const accentColor = GOLD;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${bgColor1} 0%, ${bgColor2} 40%, ${bgColor1}dd 70%, ${bgColor2}99 100%)` }}
    >
      {/* ── Animated background decorative elements ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* Large top-left glow */}
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${accentColor}15, transparent 70%)` }} />
        {/* Bottom-right glow */}
        <div className="absolute -bottom-48 -right-48 h-[600px] w-[600px] rounded-full"
          style={{ background: `radial-gradient(circle, ${bgColor2}20, transparent 70%)` }} />
        {/* Center subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full"
          style={{ background: `radial-gradient(circle, ${accentColor}08, transparent 60%)` }} />
        {/* Geometric decorative lines */}
        <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        {/* Floating orbs */}
        <motion.div
          className="absolute top-[15%] right-[8%] h-2 w-2 rounded-full"
          style={{ background: accentColor, opacity: 0.4 }}
          animate={shouldReduceMotion ? {} : { y: [0, -20, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[60%] left-[5%] h-1.5 w-1.5 rounded-full"
          style={{ background: accentColor, opacity: 0.3 }}
          animate={shouldReduceMotion ? {} : { y: [0, 15, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute top-[80%] right-[15%] h-2.5 w-2.5 rounded-full"
          style={{ background: '#ffffff', opacity: 0.15 }}
          animate={shouldReduceMotion ? {} : { y: [0, -12, 0], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
      </div>

      {/* ── Main content ── */}
      <motion.div
        className="relative z-10 flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* ── Header — School branding ── */}
        <motion.div variants={itemVariants} className="mb-10 flex flex-col items-center text-center sm:mb-14">
          {/* Logo container with animated ring */}
          <div className="relative mb-5">
            {/* Animated ring behind logo */}
            <motion.div
              className="absolute -inset-3 rounded-full"
              style={{ border: `2px solid ${accentColor}30` }}
              animate={shouldReduceMotion ? {} : {
                scale: [1, 1.05, 1],
                borderColor: [`${accentColor}30`, `${accentColor}60`, `${accentColor}30`],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative h-20 w-20 sm:h-24 sm:w-24">
              {schoolData?.logoUrl ? (
                <Image
                  src={schoolData.logoUrl}
                  alt={schoolData.name}
                  fill
                  className="rounded-2xl border-2 border-white/20 object-cover shadow-lg"
                  style={{ boxShadow: `0 8px 32px ${bgColor1}40` }}
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-md"
                  style={{ boxShadow: `0 8px 32px ${bgColor1}40` }}>
                  <span className="text-3xl font-bold text-white sm:text-4xl"
                    style={{ textShadow: `0 2px 8px ${accentColor}40` }}>
                    {(schoolData?.name || BRAND.name).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* School name */}
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl"
            style={{ textShadow: `0 2px 16px ${bgColor1}60` }}>
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement...
              </span>
            ) : (
              schoolData?.name || BRAND.name
            )}
          </h1>

          {/* School slogan/motto */}
          {(schoolData?.slogan || schoolData?.motto) && (
            <p className="mt-1.5 text-sm font-medium text-white/50 italic sm:text-base">
              {schoolData.slogan || schoolData.motto}
            </p>
          )}

          {/* School location info */}
          {schoolData && (schoolData.city || schoolData.phone) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-white/40">
              {schoolData.city && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm">
                  <MapPin className="h-3.5 w-3.5" style={{ color: accentColor }} />
                  {schoolData.city}
                </span>
              )}
              {schoolData.phone && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm">
                  <Phone className="h-3.5 w-3.5" style={{ color: accentColor }} />
                  {schoolData.phone}
                </span>
              )}
            </div>
          )}

          {/* Subtitle — portal selection prompt */}
          <div className="mt-5 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: accentColor }} />
            <p className="text-sm font-medium text-white/60 sm:text-base">
              Choisissez votre portail pour vous connecter
            </p>
            <Sparkles className="h-4 w-4" style={{ color: accentColor }} />
          </div>
        </motion.div>

        {/* ── Portal cards grid ── */}
        <motion.div
          variants={itemVariants}
          className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6"
        >
          {SCHOOL_PORTAL_DEFS.map((portal, index) => {
            const isHovered = hoveredPortal === portal.type;
            const Icon = portal.Icon;
            const AuthIcon = portal.authIcon;

            return (
              <motion.button
                key={portal.type}
                onClick={() => handlePortalClick(portal.type)}
                onMouseEnter={() => setHoveredPortal(portal.type)}
                onMouseLeave={() => setHoveredPortal(null)}
                className="group relative flex overflow-hidden rounded-2xl border border-white/10 text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  background: isHovered ? `${bgColor1}cc` : `${bgColor1}55`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: isHovered
                    ? `0 12px 40px ${bgColor1}50, inset 0 1px 0 ${accentColor}20`
                    : `0 4px 16px ${bgColor1}20, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  borderColor: isHovered ? `${accentColor}40` : 'rgba(255,255,255,0.08)',
                  focusRingColor: accentColor,
                  focusRingOffsetColor: bgColor1,
                }}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -4 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {/* Card top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(90deg, ${accentColor}, ${accentColor}00)`,
                    opacity: isHovered ? 1 : 0.3,
                  }}
                />

                {/* Card content */}
                <div className="flex w-full flex-col p-5 sm:p-6">
                  {/* Top row: icon + arrow */}
                  <div className="flex items-start justify-between">
                    {/* Icon with background */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 sm:h-14 sm:w-14"
                      style={{
                        background: isHovered ? `${accentColor}25` : `${accentColor}12`,
                        boxShadow: isHovered ? `0 4px 16px ${accentColor}20` : 'none',
                      }}
                    >
                      <Icon className="h-6 w-6 transition-transform duration-300 sm:h-7 sm:w-7"
                        style={{
                          color: accentColor,
                          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                        }}
                      />
                    </div>

                    {/* Arrow indicator */}
                    <motion.div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: isHovered ? `${accentColor}20` : 'transparent' }}
                      animate={{
                        opacity: isHovered ? 1 : 0.3,
                        x: isHovered ? 2 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <ArrowRight className="h-4 w-4" style={{ color: accentColor }} />
                    </motion.div>
                  </div>

                  {/* Title */}
                  <h3 className="mt-4 text-lg font-bold text-white sm:text-xl"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                    {portal.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="mt-0.5 text-sm font-medium" style={{ color: `${accentColor}cc` }}>
                    {portal.subtitle}
                  </p>

                  {/* Description */}
                  <p className="mt-2 text-xs leading-relaxed text-white/40 sm:text-sm">
                    {portal.description}
                  </p>

                  {/* Separator line */}
                  <div className="my-3 h-px w-full" style={{ background: `linear-gradient(90deg, ${accentColor}15, ${accentColor}05, transparent)` }} />

                  {/* Footer — auth method */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AuthIcon className="h-3 w-3 text-white/25" />
                      <span className="text-[11px] font-medium uppercase tracking-wider text-white/30">
                        {portal.authMethod}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-300"
                      style={{ color: isHovered ? accentColor : 'rgba(255,255,255,0.25)' }}>
                      Accéder
                      <ChevronRight className="h-3 w-3 transition-transform duration-300"
                        style={{ transform: isHovered ? 'translateX(2px)' : 'translateX(0)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Hover glow effect overlay */}
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${accentColor}08, transparent 40%)`,
                  }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Footer navigation ── */}
        <motion.div variants={itemVariants} className="mt-10 flex flex-col items-center gap-4 sm:mt-14 sm:flex-row sm:justify-center sm:gap-5">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white/50 backdrop-blur-sm transition-all duration-200 hover:border-white/25 hover:bg-white/10 hover:text-white/80 sm:text-sm"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">&larr;</span>
            Accueil Academia Helm
          </Link>
          <Link
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white/50 backdrop-blur-sm transition-all duration-200 hover:border-white/25 hover:bg-white/10 hover:text-white/80 sm:text-sm"
          >
            Tous les portails
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        {/* ── Powered by ── */}
        <motion.div variants={itemVariants} className="mt-8 text-center sm:mt-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-4 py-1.5 backdrop-blur-sm">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20">
              Propulsé par
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: accentColor }}>
              {BRAND.name}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
