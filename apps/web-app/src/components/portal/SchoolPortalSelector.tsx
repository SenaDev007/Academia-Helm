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
 * Le portail PLATEFORME n'est PAS affiché ici — il est accessible
 * uniquement via le domaine principal (academiahelm.com).
 *
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
  CheckCircle2,
  MapPin,
  Phone,
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
    description: 'Direction, administration, scolarité, finances, RH, paramètres',
    Icon: Building2,
    color: NAVY,
  },
  {
    type: 'TEACHER' as PortalType,
    title: 'Portail Enseignant',
    subtitle: 'Pédagogie & suivi',
    authMethod: 'Matricule & mot de passe',
    description: 'Cours, notes, présences, cahier de texte, ressources',
    Icon: GraduationCap,
    color: BLUE,
  },
  {
    type: 'PARENT' as PortalType,
    title: 'Portail Parent / Élève',
    subtitle: 'Suivi & communication',
    authMethod: 'Téléphone & OTP',
    description: 'Bulletins, paiements, absences, messages, documents',
    Icon: Users,
    color: BLUE,
  },
  {
    type: 'PUBLIC' as PortalType,
    title: 'Portail Public',
    subtitle: 'Pré-inscription & acquisition',
    authMethod: 'Aucune authentification',
    description: 'Pré-inscription, informations, contact',
    Icon: Globe,
    color: NAVY,
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
      // Essayer de détecter le sous-domaine depuis l'URL
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
        // Résolution des données scolaires (identité > settings > école)
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
    // Rediriger vers la page de login avec le portail pré-sélectionné
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
          staggerChildren: shouldReduceMotion ? 0 : 0.1,
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
        y: shouldReduceMotion ? 0 : 20,
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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: `linear-gradient(135deg, ${bgColor1} 0%, ${bgColor2} 50%, ${bgColor1}cc 100%)` }}
    >
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-40 -left-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${accentColor}, transparent)` }} />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: `radial-gradient(circle, ${bgColor1}, transparent)` }} />
      </div>

      {/* Main content */}
      <motion.div
        className="relative z-10 w-full max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header — School info */}
        <motion.div variants={itemVariants} className="mb-8 text-center sm:mb-10">
          {/* Logo */}
          <div className="mb-4 flex justify-center">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20">
              {schoolData?.logoUrl ? (
                <Image
                  src={schoolData.logoUrl}
                  alt={schoolData.name}
                  fill
                  className="rounded-full border-2 border-white/30 object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm">
                  <span className="text-2xl font-bold text-white sm:text-3xl">
                    {(schoolData?.name || BRAND.name).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* School name */}
          <h1 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
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
            <p className="mt-1 text-sm text-white/60 italic sm:text-base">
              {schoolData.slogan || schoolData.motto}
            </p>
          )}

          {/* School details */}
          {schoolData && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-blue-200/80">
              {schoolData.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {schoolData.city}
                </span>
              )}
              {schoolData.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {schoolData.phone}
                </span>
              )}
            </div>
          )}

          <p className="mt-3 text-sm text-blue-100/70 sm:text-base">
            Choisissez votre portail pour vous connecter
          </p>
        </motion.div>

        {/* Portal grid */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-5"
        >
          {SCHOOL_PORTAL_DEFS.map((portal) => {
            const isHovered = hoveredPortal === portal.type;
            const Icon = portal.Icon;

            return (
              <motion.button
                key={portal.type}
                onClick={() => handlePortalClick(portal.type)}
                onMouseEnter={() => setHoveredPortal(portal.type)}
                onMouseLeave={() => setHoveredPortal(null)}
                className="group relative flex flex-col items-start rounded-xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:border-white/20 sm:p-5 lg:p-6 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                {/* Icon */}
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg sm:h-12 sm:w-12"
                  style={{ background: `${GOLD}18` }}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: GOLD }} />
                </div>

                {/* Title + subtitle */}
                <h3 className="text-base font-bold text-white sm:text-lg">
                  {portal.title}
                </h3>
                <p className="mt-0.5 text-xs text-blue-200/60 sm:text-sm">
                  {portal.subtitle}
                </p>

                {/* Description */}
                <p className="mt-2 text-xs text-blue-100/50 leading-relaxed sm:text-sm">
                  {portal.description}
                </p>

                {/* Footer — auth method */}
                <div className="mt-3 flex w-full items-center justify-end sm:mt-4">
                  <span className="text-[10px] text-blue-200/40 uppercase tracking-wide">
                    {portal.authMethod}
                  </span>
                </div>

                {/* Arrow indicator on hover */}
                <motion.div
                  className="absolute right-3 top-3 sm:right-4 sm:top-4"
                  animate={{
                    opacity: isHovered ? 1 : 0,
                    x: isHovered ? 0 : -8,
                  }}
                  transition={{ duration: 0.15 }}
                >
                  <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
                </motion.div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Footer links */}
        <motion.div variants={itemVariants} className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:justify-center sm:gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white sm:text-sm"
          >
            ← Accueil Academia Helm
          </Link>
          <Link
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white sm:text-sm"
          >
            Tous les portails
          </Link>
        </motion.div>

        {/* Powered by */}
        <motion.div variants={itemVariants} className="mt-6 text-center sm:mt-8">
          <p className="text-[10px] text-blue-200/30 tracking-wide">
            Propulsé par <span className="font-semibold" style={{ color: GOLD }}>{BRAND.name}</span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
