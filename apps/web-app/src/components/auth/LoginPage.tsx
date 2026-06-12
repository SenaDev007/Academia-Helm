/**
 * ============================================================================
 * LOGIN PAGE — MULTI-PORTAL CONFORME AU DOCUMENT ACADEMIA-HELM-PORTAILS.MD
 * ============================================================================
 *
 * Conforme au modèle RBAC 7 dimensions :
 *   portal → role → function → accreditations → levelScopes → classScopes → permissions
 *
 * Portails et méthodes d'authentification :
 *   - PLATFORM : email + mot de passe (7 rôles, tenant obligatoire)
 *   - SCHOOL   : email + mot de passe (45 rôles, accreditations par niveau)
 *   - TEACHER  : matricule + mot de passe (11 rôles, levelScopes)
 *   - PARENT   : téléphone + OTP (9 rôles, childScope)
 *   - PUBLIC   : PRÉ-INSCRIPTION uniquement (5 rôles, aucune auth requise)
 *
 * Palette Academia Helm exclusive :
 *   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
 *   Aucune autre couleur par portail — palette unifiée professionnelle.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Loader,
  AlertCircle,
  Mail,
  Lock,
  User,
  Phone,
  KeyRound,
  Building2,
  GraduationCap,
  Users,
  ArrowLeft,
  Home,
  Shield,
  Globe,
  BookOpen,
  Baby,
  GraduationCap as GradCap,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { persistClientSession } from '@/lib/auth/client-access-token';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getMotionDuration } from '@/lib/motion/presets';
import { getTenantRedirectUrl } from '@/lib/utils/tenant-redirect';
import { getAppBaseUrl } from '@/lib/utils/urls';

type PortalType = 'platform' | 'school' | 'teacher' | 'parent' | 'public' | null;

/** ── Palette Academia Helm — Conforme charte ── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/** Types de candidats pour le portail Public — conforme au document */
type PublicCandidateType = 'MATERNELLE' | 'PRIMARY' | 'SECONDARY' | 'PROSPECT_PARENT';

interface SchoolCredentials {
  email: string;
  password: string;
}

interface TeacherCredentials {
  teacherIdentifier: string;
  password: string;
}

interface ParentCredentials {
  phone: string;
  otp?: string;
}

interface PreEnrollmentData {
  candidateType: PublicCandidateType;
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
  parentEmail: string;
  childFirstName: string;
  childLastName: string;
  targetLevel: string;
  message?: string;
}

function normalizePortal(raw: string | null | undefined): PortalType {
  const x = raw?.toLowerCase();
  if (x === 'platform' || x === 'school' || x === 'teacher' || x === 'parent' || x === 'public') return x as PortalType;
  return null;
}

/**
 * Définition des portails pour la page login — conforme au document
 */
const PORTAL_LOGIN_DEFS: Record<string, {
  title: string;
  subtitle: string;
  roleCount: number;
  Icon: React.ComponentType<{ className?: string }>;
  authMethod: string;
}> = {
  platform: {
    title: 'Portail Plateforme',
    subtitle: 'Administration SaaS globale',
    roleCount: 7,
    Icon: Shield,
    authMethod: 'Email & mot de passe',
  },
  school: {
    title: 'Portail École',
    subtitle: 'Gestion de l\'établissement',
    roleCount: 45,
    Icon: Building2,
    authMethod: 'Email & mot de passe',
  },
  teacher: {
    title: 'Portail Enseignant',
    subtitle: 'Pédagogie & suivi',
    roleCount: 11,
    Icon: GraduationCap,
    authMethod: 'Matricule & mot de passe',
  },
  parent: {
    title: 'Portail Parent / Élève',
    subtitle: 'Suivi & communication',
    roleCount: 9,
    Icon: Users,
    authMethod: 'Téléphone & OTP',
  },
  public: {
    title: 'Portail Public',
    subtitle: 'Pré-inscription & acquisition',
    roleCount: 5,
    Icon: Globe,
    authMethod: 'Aucune authentification requise',
  },
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { shouldReduceMotion } = useMotionBudget();

  const portalParam = searchParams?.get('portal');
  let tenantSlug = searchParams?.get('tenant');
  let tenantIdFromUrl = searchParams?.get('tenant_id');
  const schoolSlugFromUrl = searchParams?.get('school');
  const schoolNameFromUrl = searchParams?.get('school_name');

  // Détection professionnelle du tenant via le sous-domaine
  if (typeof window !== 'undefined' && !tenantSlug) {
    const host = window.location.host;
    const parts = host.split('.');
    const ignoredSubdomains = ['www', 'dev', 'test', 'staging', 'preview', 'admin', 'api', 'portal', 'localhost'];
    if (parts.length >= 3 && !ignoredSubdomains.includes(parts[0])) {
      tenantSlug = parts[0];
    } else if (parts.length === 2 && parts[1] === 'localhost' && !ignoredSubdomains.includes(parts[0])) {
      tenantSlug = parts[0];
    }
  }

  const tenantIdForApi = tenantIdFromUrl || tenantSlug;
  const redirectPath = searchParams?.get('redirect') || '/app';

  const [portalType, setPortalType] = useState<PortalType>(() => normalizePortal(portalParam));

  useEffect(() => {
    setPortalType(normalizePortal(portalParam));
  }, [portalParam]);

  // ── School info from sessionStorage ──────────────────────────────────
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('academia_portal_school');
      if (raw) {
        const info = JSON.parse(raw) as SchoolInfo;
        setSchoolInfo(info);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Credentials state ────────────────────────────────────────────────
  const [schoolCredentials, setSchoolCredentials] = useState<SchoolCredentials>({
    email: '',
    password: '',
  });

  const [teacherCredentials, setTeacherCredentials] = useState<TeacherCredentials>({
    teacherIdentifier: '',
    password: '',
  });

  const [parentCredentials, setParentCredentials] = useState<ParentCredentials>({
    phone: '',
    otp: '',
  });

  const [parentOtpSent, setParentOtpSent] = useState(false);
  const [parentOtpCode, setParentOtpCode] = useState<string>('');

  // ── Public portal: pre-enrollment state ──
  const [preEnrollment, setPreEnrollment] = useState<PreEnrollmentData>({
    candidateType: 'PROSPECT_PARENT',
    parentFirstName: '',
    parentLastName: '',
    parentPhone: '',
    parentEmail: '',
    childFirstName: '',
    childLastName: '',
    targetLevel: '',
    message: '',
  });
  const [preEnrollmentSubmitted, setPreEnrollmentSubmitted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Client-side validation state ─────────────────────────────────────
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailError = emailTouched && schoolCredentials.email && !isValidEmail(schoolCredentials.email)
    ? 'Format d\'email invalide'
    : null;

  const phoneError = phoneTouched && parentCredentials.phone && !isValidBeninPhone(parentCredentials.phone)
    ? 'Numéro de téléphone invalide (format Bénin attendu)'
    : null;

  const passwordStrength = getPasswordStrength(
    portalType === 'teacher' ? teacherCredentials.password : schoolCredentials.password,
  );

  // ── Session expiry message ───────────────────────────────────────────
  const reasonParam = searchParams?.get('reason');
  const idleLogoutMessage = reasonParam === 'session_expired'
    ? 'Votre session a expiré après une période d\'inactivité prolongée. Veuillez vous reconnecter.'
    : reasonParam === 'session_locked'
      ? 'Vous avez été déconnecté(e) depuis l\'écran de verrouillage.'
      : reasonParam === 'idle_timeout'
        ? 'Vous avez été déconnecté(e) automatiquement après une période d\'inactivité.'
        : null;

  const tenantStorageKey = tenantIdFromUrl || tenantSlug || 'platform';

  const dur = useMemo(
    () => getMotionDuration(shouldReduceMotion, 'normal'),
    [shouldReduceMotion],
  );

  const heroVariants = useMemo(
    () => ({
      hidden: { opacity: shouldReduceMotion ? 1 : 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: shouldReduceMotion ? 0 : 0.09,
          delayChildren: shouldReduceMotion ? 0 : 0.04,
        },
      },
    }),
    [shouldReduceMotion],
  );

  const heroItem = useMemo(
    () => ({
      hidden: {
        opacity: shouldReduceMotion ? 1 : 0,
        y: shouldReduceMotion ? 0 : 14,
        filter: shouldReduceMotion ? 'blur(0px)' : 'blur(5px)',
      },
      show: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: dur, ease: 'easeOut' as const },
      },
    }),
    [shouldReduceMotion, dur],
  );

  const springSoft = useMemo(
    () => ({
      type: 'spring' as const,
      stiffness: shouldReduceMotion ? 500 : 260,
      damping: shouldReduceMotion ? 50 : 24,
    }),
    [shouldReduceMotion],
  );

  // ── Pre-fill saved email ─────────────────────────────────────────────
  useEffect(() => {
    const lastEmail = getSavedEmailForTenant(tenantStorageKey);
    if (lastEmail && !schoolCredentials.email) {
      setSchoolCredentials((prev) => ({ ...prev, email: lastEmail }));
    }
  }, [tenantStorageKey]);

  const isStandardLogin = !portalType;

  // ── Portal definition for current portal ──
  const portalDef = portalType ? PORTAL_LOGIN_DEFS[portalType] : null;
  const PortalIcon = portalDef?.Icon || null;

  // ── Form submit handlers ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isStandardLogin) {
        await handleStandardLogin();
      } else if (portalType === 'platform') {
        await handlePlatformLogin();
      } else if (portalType === 'school') {
        await handleSchoolLogin();
      } else if (portalType === 'teacher') {
        await handleTeacherLogin();
      } else if (portalType === 'parent') {
        await handleParentLogin();
      } else if (portalType === 'public') {
        await handlePreEnrollmentSubmit();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la connexion';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlatformLogin = async () => {
    if (!tenantSlug && !tenantIdFromUrl) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}/portal`;
      return;
    }
    await handleStandardLogin();
  };

  const handleStandardLogin = async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: schoolCredentials.email,
        password: schoolCredentials.password,
        tenantSubdomain: tenantSlug,
        tenant_id: tenantIdFromUrl || undefined,
        portal_type: portalType?.toUpperCase() || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de la connexion');
    }

    persistClientSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      serverSessionId: data.serverSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: portalType?.toUpperCase() || null,
      expiresAt: data.expiresAt,
    });

    const tenantKey = data.tenant?.id || tenantIdFromUrl || tenantSlug || 'platform';
    saveEmailForTenant(schoolCredentials.email, tenantKey);

    const isPlatformOwner =
      data.user?.role === 'PLATFORM_OWNER' ||
      (data.user as { isPlatformOwner?: boolean })?.isPlatformOwner;
    const hasNoTenant = !data.tenant?.id;

    if (isPlatformOwner && hasNoTenant) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}/portal`;
      return;
    }

    if (portalType === 'platform' && hasNoTenant) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}/portal`;
      return;
    }

    const resolvedSlug = tenantSlug || data.tenant?.slug || data.tenant?.subdomain;
    const resolvedTenantId = tenantIdFromUrl || data.tenant?.id;

    if (!resolvedSlug && !resolvedTenantId) {
      const mainDomain = getAppBaseUrl();
      window.location.href = `${mainDomain}${redirectPath}`;
      return;
    }

    try {
      const redirectUrl = getTenantRedirectUrl({
        tenantSlug: resolvedSlug || resolvedTenantId || 'unknown',
        tenantId: resolvedTenantId,
        path: redirectPath,
        portalType: portalType?.toUpperCase() || undefined,
      });
      window.location.href = redirectUrl;
    } catch {
      const baseUrl = window.location.origin;
      const url = new URL(redirectPath, baseUrl);
      if (resolvedSlug) url.searchParams.set('tenant', resolvedSlug);
      if (resolvedTenantId) url.searchParams.set('tenant_id', resolvedTenantId);
      if (portalType) url.searchParams.set('portal', portalType);
      window.location.href = url.toString();
    }
  };

  const handleSchoolLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    const response = await fetch('/api/portal/auth/school', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        email: schoolCredentials.email,
        password: schoolCredentials.password,
        portal_type: 'SCHOOL',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Erreur lors de la connexion');
    }

    persistClientSession({
      accessToken: data.accessToken,
      portalSessionId: data.portalSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'SCHOOL',
      expiresAt: data.expiresAt,
    });

    const tenantKey = data.tenant?.id || tenantIdForApi || 'platform';
    saveEmailForTenant(schoolCredentials.email, tenantKey);

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
      portalType: 'SCHOOL',
    });
    window.location.href = redirectUrl;
  };

  const handleTeacherLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    const response = await fetch('/api/portal/auth/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        teacherIdentifier: teacherCredentials.teacherIdentifier,
        password: teacherCredentials.password,
        portal_type: 'TEACHER',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Erreur lors de la connexion');
    }

    persistClientSession({
      accessToken: data.accessToken,
      portalSessionId: data.portalSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'TEACHER',
      expiresAt: data.expiresAt,
    });

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
      portalType: 'TEACHER',
    });
    window.location.href = redirectUrl;
  };

  const handleParentLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    if (!parentOtpSent) {
      const response = await fetch('/api/portal/auth/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantIdForApi,
          phone: parentCredentials.phone,
          portal_type: 'PARENT',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Erreur lors de l'envoi du code OTP");
      }

      if (data.otp) {
        setParentOtpCode(data.otp);
      }

      setParentOtpSent(true);
      return;
    }

    const response = await fetch('/api/portal/auth/parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        phone: parentCredentials.phone,
        otp: parentCredentials.otp,
        portal_type: 'PARENT',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Code OTP invalide');
    }

    persistClientSession({
      accessToken: data.accessToken,
      portalSessionId: data.portalSessionId,
      user: data.user,
      tenant: data.tenant,
      portalType: 'PARENT',
      expiresAt: data.expiresAt,
    });

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
      portalType: 'PARENT',
    });
    window.location.href = redirectUrl;
  };

  // ── Public portal: pre-enrollment (aucune authentification requise) ──
  const handlePreEnrollmentSubmit = async () => {
    const schoolId = tenantIdForApi || schoolSlugFromUrl;
    if (!schoolId) {
      throw new Error('Veuillez sélectionner un établissement pour la pré-inscription');
    }

    const response = await fetch('/api/public/pre-enrollment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...preEnrollment,
        schoolSlug: schoolSlugFromUrl || tenantSlug,
        tenantId: tenantIdForApi,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Erreur lors de la pré-inscription');
    }

    setPreEnrollmentSubmitted(true);
  };

  const formBlockKey = portalType || 'standard';

  // ── Niveaux disponibles selon le type de candidat (conforme au document) ──
  const getLevelsForCandidateType = (type: PublicCandidateType): string[] => {
    switch (type) {
      case 'MATERNELLE':
        return ['Maternelle 1 (M1)', 'Maternelle 2 (M2)'];
      case 'PRIMARY':
        return ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
      case 'SECONDARY':
        return ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'];
      default:
        return [];
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/90 px-4 py-16 sm:px-6 lg:px-8">
      {/* ── Background blobs — palette Helm ── */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-20 top-24 h-72 w-72 rounded-full blur-3xl"
              style={{ backgroundColor: `${NAVY}25` }}
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -right-16 bottom-24 h-80 w-80 rounded-full blur-3xl"
              style={{ backgroundColor: `${GOLD}20` }}
              animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
              transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: `${BLUE}18` }}
              animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.38, 0.25] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : null}
      </div>

      {/* ── Navigation ── */}
      <motion.nav
        initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur }}
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:text-slate-900"
          style={{ borderColor: `${NAVY}18` }}
        >
          <Home className="h-4 w-4" style={{ color: NAVY }} />
          Accueil
        </Link>
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:text-slate-900"
          style={{ borderColor: `${NAVY}18` }}
        >
          <ArrowLeft className="h-4 w-4" />
          Portails
        </Link>
      </motion.nav>

      {/* ── Main login card ── */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: dur, ease: 'easeOut' }}
          className="rounded-2xl border bg-white/95 p-8 shadow-2xl backdrop-blur-md md:p-10"
          style={{
            borderColor: `${NAVY}18`,
            boxShadow: `0 24px 48px -12px ${NAVY}14, 0 0 0 1px ${GOLD}12`,
          }}
        >
          {/* ── Header ── */}
          <motion.div
            className="mb-6 text-center"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            {/* Logo */}
            <motion.div
              variants={heroItem}
              className="mb-5 inline-flex items-center justify-center"
              animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/images/logo-Academia Hub.png"
                alt={BRAND.name}
                width={120}
                height={120}
                className="h-20 w-20 object-contain drop-shadow-lg md:h-24 md:w-24"
                priority
              />
            </motion.div>

            {/* Portal icon + title */}
            <motion.div
              variants={heroItem}
              className="mb-2 flex flex-col items-center justify-center gap-2"
            >
              {PortalIcon && (
                <motion.div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-white/70"
                  style={{
                    background: `linear-gradient(135deg, ${NAVY}18, ${BLUE}12)`,
                  }}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.05, rotate: -2 }}
                  transition={springSoft}
                >
                  <PortalIcon className="h-6 w-6" style={{ color: NAVY }} />
                </motion.div>
              )}
              <h1
                className="text-2xl font-extrabold tracking-tight md:text-3xl"
                style={{ color: NAVY }}
              >
                {portalDef?.title || BRAND.name}
              </h1>
            </motion.div>

            <motion.p variants={heroItem} className="text-sm text-slate-600">
              {portalDef?.subtitle || BRAND.subtitle}
            </motion.p>

            {/* Role count badge — conforme au document */}
            {portalDef && (
              <motion.div variants={heroItem} className="mt-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    color: NAVY,
                    background: `${GOLD}20`,
                    border: `1px solid ${GOLD}35`,
                  }}
                >
                  {portalDef.roleCount} rôles — {portalDef.authMethod}
                </span>
              </motion.div>
            )}

            {/* Tenant display — multi-tenant strict */}
            {(tenantSlug || schoolNameFromUrl) && portalType !== 'public' && (
              <motion.div variants={heroItem} className="mt-3">
                <div
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium"
                  style={{
                    color: NAVY,
                    borderColor: `${NAVY}20`,
                    background: `${NAVY}06`,
                  }}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{schoolNameFromUrl || tenantSlug}</span>
                </div>
              </motion.div>
            )}

            {portalType === null && (
              <motion.p variants={heroItem} className="mt-1 text-xs font-medium text-slate-500">
                {BRAND.slogan}
              </motion.p>
            )}
          </motion.div>

          {/* ── Error display ── */}
          <AnimatePresence>
            {error ? (
              <motion.div
                key="login-error"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: dur * 0.85 }}
                className="mb-5"
              >
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/95 p-4 shadow-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm text-red-800">{error}</p>
                    {error.toLowerCase().includes('identifiant') && (
                      <p className="mt-1 text-xs text-red-600">
                        Vérifiez vos identifiants et assurez-vous d&apos;être sur le bon portail.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Idle logout message ── */}
          <AnimatePresence>
            {idleLogoutMessage && !error ? (
              <motion.div
                key="idle-logout-info"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: dur * 0.85 }}
                className="mb-5"
              >
                <div className="flex items-start gap-3 rounded-xl border bg-amber-50/95 p-4 shadow-sm" style={{ borderColor: `${GOLD}50` }}>
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: GOLD }} />
                  <p className="text-sm" style={{ color: NAVY }}>{idleLogoutMessage}</p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Dev OTP display ── */}
          <AnimatePresence>
            {parentOtpSent && parentOtpCode && process.env.NODE_ENV === 'development' ? (
              <motion.div
                key="dev-otp"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 rounded-xl border bg-amber-50/95 p-4"
                style={{ borderColor: `${GOLD}50` }}
              >
                <p className="mb-1 text-sm font-semibold" style={{ color: NAVY }}>
                  Code OTP (DEV)
                </p>
                <p className="text-center text-2xl font-bold tracking-widest" style={{ color: NAVY }}>
                  {parentOtpCode}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Pre-enrollment success message (PUBLIC portal) ── */}
          <AnimatePresence>
            {preEnrollmentSubmitted && portalType === 'public' ? (
              <motion.div
                key="pre-enrollment-success"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur }}
                className="mb-6"
              >
                <div className="flex flex-col items-center gap-4 rounded-xl border bg-green-50/95 p-6 text-center" style={{ borderColor: '#22c55e50' }}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-800">Pré-inscription envoyée</p>
                    <p className="mt-1 text-sm text-green-700">
                      Votre demande de pré-inscription a été enregistrée avec succès.
                      Vous recevrez une confirmation par SMS et email.
                    </p>
                  </div>
                  <Link
                    href="/portal"
                    className="mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour aux portails
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════════
              FORMULAIRES D'AUTHENTIFICATION PAR PORTAIL
              Conformes au document academia-helm-portails.md
              ════════════════════════════════════════════════════════════════ */}

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={formBlockKey}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
                transition={{ duration: dur, ease: 'easeOut' }}
                className="space-y-5"
              >
                {/* ── PLATFORM + SCHOOL : Email + Mot de passe ── */}
                {(isStandardLogin || portalType === 'school' || portalType === 'platform') && (
                  <>
                    {/* Email field */}
                    <div>
                      <label
                        htmlFor={`email-${tenantStorageKey}`}
                        className="mb-2 block text-sm font-semibold text-slate-900"
                      >
                        Adresse email
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="email"
                          id={`email-${tenantStorageKey}`}
                          name={`email_${tenantStorageKey}`}
                          autoComplete="email"
                          required
                          value={schoolCredentials.email}
                          onChange={(e) =>
                            setSchoolCredentials({
                              ...schoolCredentials,
                              email: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder={
                            portalType === 'platform'
                              ? 'admin@academiahelm.com'
                              : 'votre.email@etablissement.com'
                          }
                        />
                        {emailTouched && schoolCredentials.email && (
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            {emailError ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                        )}
                      </div>
                      {getSavedEmailForTenant(tenantStorageKey) && (
                        <p className="mt-1 text-xs text-slate-500">
                          Dernière connexion pour cet établissement (ce poste uniquement).
                        </p>
                      )}
                    </div>

                    {/* Password field */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label
                          htmlFor={`password-${tenantStorageKey}`}
                          className="text-sm font-semibold text-slate-900"
                        >
                          Mot de passe
                        </label>
                        <Link
                          href="/forgot-password"
                          className="text-xs font-medium transition-colors hover:underline"
                          style={{ color: BLUE }}
                        >
                          Mot de passe oublié ?
                        </Link>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id={`password-${tenantStorageKey}`}
                          name={`password_${tenantStorageKey}`}
                          autoComplete="current-password"
                          required
                          value={schoolCredentials.password}
                          onChange={(e) => {
                            setSchoolCredentials({
                              ...schoolCredentials,
                              password: e.target.value,
                            })
                          }}
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {/* Password strength indicator */}
                      {passwordTouched && schoolCredentials.password && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className="h-1 flex-1 rounded-full transition-all duration-300"
                                style={{
                                  backgroundColor: passwordStrength.score >= level
                                    ? passwordStrength.color
                                    : '#e2e8f0',
                                }}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Force : <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── TEACHER : Matricule + Mot de passe ── */}
                {portalType === 'teacher' && (
                  <>
                    <div>
                      <label
                        htmlFor="teacherIdentifier"
                        className="mb-2 block text-sm font-semibold text-slate-900"
                      >
                        Matricule / Identifiant
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          id="teacherIdentifier"
                          required
                          value={teacherCredentials.teacherIdentifier}
                          onChange={(e) =>
                            setTeacherCredentials({
                              ...teacherCredentials,
                              teacherIdentifier: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="EMP001"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Votre matricule vous a été communiqué par l&apos;établissement.
                      </p>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label
                          htmlFor="teacherPassword"
                          className="text-sm font-semibold text-slate-900"
                        >
                          Mot de passe
                        </label>
                        <Link
                          href="/forgot-password"
                          className="text-xs font-medium transition-colors hover:underline"
                          style={{ color: BLUE }}
                        >
                          Mot de passe oublié ?
                        </Link>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="teacherPassword"
                          required
                          value={teacherCredentials.password}
                          onChange={(e) => {
                            setTeacherCredentials({
                              ...teacherCredentials,
                              password: e.target.value,
                            })
                          }}
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {/* Password strength */}
                      {passwordTouched && teacherCredentials.password && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className="h-1 flex-1 rounded-full transition-all duration-300"
                                style={{
                                  backgroundColor: passwordStrength.score >= level
                                    ? passwordStrength.color
                                    : '#e2e8f0',
                                }}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Force : <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── PARENT : Téléphone + OTP ── */}
                {portalType === 'parent' && (
                  <>
                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-2 block text-sm font-semibold text-slate-900"
                      >
                        Numéro de téléphone
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Phone className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="tel"
                          id="phone"
                          required
                          disabled={parentOtpSent}
                          value={parentCredentials.phone}
                          onChange={(e) =>
                            setParentCredentials({
                              ...parentCredentials,
                              phone: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="+229 90 00 00 00"
                        />
                        {phoneTouched && parentCredentials.phone && !parentOtpSent && (
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            {phoneError ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Numéro utilisé lors de l&apos;inscription de votre enfant.
                      </p>
                    </div>

                    <AnimatePresence>
                      {parentOtpSent ? (
                        <motion.div
                          key="otp-field"
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                          transition={{ duration: dur, ease: 'easeOut' }}
                        >
                          <label
                            htmlFor="otp"
                            className="mb-2 block text-sm font-semibold text-slate-900"
                          >
                            Code OTP
                          </label>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <KeyRound className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                              type="text"
                              id="otp"
                              required
                              value={parentCredentials.otp || ''}
                              onChange={(e) =>
                                setParentCredentials({
                                  ...parentCredentials,
                                  otp: e.target.value,
                                })
                              }
                              className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="123456"
                              maxLength={6}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                            />
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            Un code OTP a été envoyé à votre numéro de téléphone.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setParentOtpSent(false);
                              setParentOtpCode('');
                              setParentCredentials((prev) => ({ ...prev, otp: '' }));
                            }}
                            className="mt-1 text-xs font-medium transition-colors hover:underline"
                            style={{ color: BLUE }}
                          >
                            Renvoyer le code
                          </button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                )}

                {/* ── PUBLIC : Pré-inscription (aucune authentification requise) ── */}
                {portalType === 'public' && !preEnrollmentSubmitted && (
                  <>
                    {/* Type de candidat */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">
                        Vous souhaitez inscrire un enfant en
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { type: 'MATERNELLE' as const, label: 'Maternelle', Icon: Baby, desc: 'M1 – M2' },
                          { type: 'PRIMARY' as const, label: 'Primaire', Icon: BookOpen, desc: 'CI – CM2' },
                          { type: 'SECONDARY' as const, label: 'Secondaire', Icon: GradCap, desc: '6ème – Tle' },
                          { type: 'PROSPECT_PARENT' as const, label: 'Juste info', Icon: Users, desc: 'Parent prospect' },
                        ]).map((opt) => (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => setPreEnrollment((prev) => ({ ...prev, candidateType: opt.type, targetLevel: '' }))}
                            className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all"
                            style={{
                              borderColor: preEnrollment.candidateType === opt.type ? GOLD : `${NAVY}18`,
                              background: preEnrollment.candidateType === opt.type ? `${GOLD}12` : `${NAVY}04`,
                            }}
                          >
                            <opt.Icon className="h-5 w-5" style={{ color: NAVY }} />
                            <span className="text-xs font-bold" style={{ color: NAVY }}>{opt.label}</span>
                            <span className="text-[10px] text-slate-500">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Parent info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Prénom (parent)
                        </label>
                        <input
                          type="text"
                          required
                          value={preEnrollment.parentFirstName}
                          onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentFirstName: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="Prénom"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Nom (parent)
                        </label>
                        <input
                          type="text"
                          required
                          value={preEnrollment.parentLastName}
                          onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentLastName: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                          style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          placeholder="Nom"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Téléphone
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Phone className="h-4 w-4 text-slate-400" />
                          </div>
                          <input
                            type="tel"
                            required
                            value={preEnrollment.parentPhone}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentPhone: e.target.value }))}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                            placeholder="+229 90 00 00 00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-900">
                          Email
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Mail className="h-4 w-4 text-slate-400" />
                          </div>
                          <input
                            type="email"
                            value={preEnrollment.parentEmail}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, parentEmail: e.target.value }))}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-9 pr-3 text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                            placeholder="email@exemple.com"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Child info (not for PROSPECT_PARENT) */}
                    {preEnrollment.candidateType !== 'PROSPECT_PARENT' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Prénom de l&apos;enfant
                            </label>
                            <input
                              type="text"
                              required
                              value={preEnrollment.childFirstName}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childFirstName: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Prénom"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-900">
                              Nom de l&apos;enfant
                            </label>
                            <input
                              type="text"
                              required
                              value={preEnrollment.childLastName}
                              onChange={(e) => setPreEnrollment((prev) => ({ ...prev, childLastName: e.target.value }))}
                              className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 text-sm transition-all placeholder:text-slate-400 focus:ring-2"
                              style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                              placeholder="Nom"
                            />
                          </div>
                        </div>

                        {/* Target level selection */}
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-900">
                            Niveau souhaité
                          </label>
                          <select
                            required
                            value={preEnrollment.targetLevel}
                            onChange={(e) => setPreEnrollment((prev) => ({ ...prev, targetLevel: e.target.value }))}
                            className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 text-sm transition-all focus:ring-2"
                            style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                          >
                            <option value="">— Sélectionner —</option>
                            {getLevelsForCandidateType(preEnrollment.candidateType).map((level) => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Message */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-900">
                        Message (optionnel)
                      </label>
                      <textarea
                        value={preEnrollment.message}
                        onChange={(e) => setPreEnrollment((prev) => ({ ...prev, message: e.target.value }))}
                        rows={2}
                        className="w-full rounded-xl border-2 border-slate-200 py-2.5 px-3 text-sm transition-all placeholder:text-slate-400 focus:ring-2 resize-none"
                        style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                        placeholder="Précisez votre demande..."
                      />
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ── Submit button — palette Helm unifiée ── */}
            {!(portalType === 'public' && preEnrollmentSubmitted) && (
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { scale: 1.01, boxShadow: `0 14px 32px ${NAVY}22` }
                }
                whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                transition={springSoft}
                className="flex w-full items-center justify-center rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                }}
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-5 w-5 animate-spin" />
                    {parentOtpSent && portalType === 'parent'
                      ? 'Vérification...'
                      : portalType === 'public'
                      ? 'Envoi en cours...'
                      : 'Connexion en cours...'}
                  </>
                ) : parentOtpSent && portalType === 'parent' ? (
                  'Vérifier le code OTP'
                ) : portalType === 'public' ? (
                  'Soumettre la pré-inscription'
                ) : (
                  'Se connecter'
                )}
              </motion.button>
            )}
          </form>

          {/* ── Footer links ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.12, duration: dur }}
            className="mt-6 space-y-3 text-center"
          >
            {!isStandardLogin && portalType !== 'public' ? (
              <Link
                href="/portal"
                className="inline-flex items-center justify-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                ← Retour à la sélection du portail
              </Link>
            ) : null}
            {isStandardLogin ? (
              <>
                <div>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium transition-colors hover:underline"
                    style={{ color: BLUE }}
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <p className="text-sm text-slate-600">
                  Pas encore de compte ?{' '}
                  <Link
                    href="/signup"
                    className="font-semibold transition-colors hover:underline"
                    style={{ color: NAVY }}
                  >
                    Activer Academia Helm
                  </Link>
                </p>
              </>
            ) : null}
            {portalType === 'public' && (
              <p className="text-xs text-slate-500">
                Conforme au document : aucune authentification requise pour le portail public.
                Vos données sont traitées conformément à notre politique de confidentialité.
              </p>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
