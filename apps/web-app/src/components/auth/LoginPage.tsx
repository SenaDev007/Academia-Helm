/**
 * ============================================================================
 * LOGIN PAGE — Multi-Portal Support
 * ============================================================================
 *
 * Page de connexion unifiée pour tous les portails Academia Helm.
 * Palette unifiée : Navy (#0b2f73) / Blue (#1d4fa5) / Gold (#f5b335)
 *
 * Portails :
 * - École : email + mot de passe
 * - Enseignant : matricule + mot de passe
 * - Parent / Élève : téléphone + OTP (2 étapes)
 * - Plateforme : email + mot de passe + sélection tenant
 * - Public : accès invité ou pré-inscription
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
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
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

interface SchoolInfo {
  name: string;
  logoUrl: string | null;
  city: string | null;
  schoolType: string | null;
}

/** Palette Academia Helm — unifiée pour tous les portails */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

function normalizePortal(raw: string | null | undefined): PortalType {
  const x = raw?.toLowerCase();
  if (x === 'platform' || x === 'school' || x === 'teacher' || x === 'parent' || x === 'public') return x as PortalType;
  return null;
}

/** Validation helpers */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidBeninPhone(phone: string): boolean {
  // Accepte +229XXXXXXXX ou 9XXXXXXXX ou 0XXXXXXXXX
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(\+229|0)?\d{8,9}$/.test(cleaned);
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Faible', color: '#ef4444' };
  if (score <= 2) return { score: 2, label: 'Moyen', color: '#f59e0b' };
  if (score <= 3) return { score: 3, label: 'Bon', color: BLUE };
  return { score: 4, label: 'Fort', color: '#16a34a' };
}

/** Portal metadata — icône et titre uniquement (palette unifiée) */
const PORTAL_META: Record<string, { title: string; subtitle: string; Icon: typeof Building2 }> = {
  platform: {
    title: 'Portail Plateforme',
    subtitle: 'Administration SaaS · Supervision Globale',
    Icon: Shield,
  },
  school: {
    title: 'Portail École',
    subtitle: 'Direction · Administration · Finances · Scolarité',
    Icon: Building2,
  },
  teacher: {
    title: 'Portail Enseignant',
    subtitle: 'Pédagogie · Suivi · Notes · Cahier de texte',
    Icon: GraduationCap,
  },
  parent: {
    title: 'Portail Parent / Élève',
    subtitle: 'Suivi scolaire · Paiements · Communication',
    Icon: Users,
  },
  public: {
    title: 'Portail Public',
    subtitle: 'Pré-inscription · Admissions · Informations',
    Icon: Globe,
  },
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { shouldReduceMotion } = useMotionBudget();

  const portalParam = searchParams?.get('portal');
  let tenantSlug = searchParams?.get('tenant');
  let tenantIdFromUrl = searchParams?.get('tenant_id');

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

  const [portalType, setPortalType] = useState<PortalType>(() =>
    normalizePortal(portalParam),
  );

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

  // ── Unified theme ────────────────────────────────────────────────────
  const meta = portalType ? PORTAL_META[portalType] : null;
  const PortalIcon = meta?.Icon ?? null;

  // ── Form validation ──────────────────────────────────────────────────
  const canSubmit = useCallback((): boolean => {
    if (isLoading) return false;
    if (portalType === 'school' || portalType === 'platform' || isStandardLogin) {
      if (!schoolCredentials.email || !schoolCredentials.password) return false;
      if (emailError) return false;
    }
    if (portalType === 'teacher') {
      if (!teacherCredentials.teacherIdentifier || !teacherCredentials.password) return false;
    }
    if (portalType === 'parent') {
      if (!parentCredentials.phone) return false;
      if (phoneError) return false;
      if (parentOtpSent && !parentCredentials.otp) return false;
    }
    return true;
  }, [isLoading, portalType, isStandardLogin, schoolCredentials, teacherCredentials, parentCredentials, emailError, phoneError, parentOtpSent]);

  // ── Submit handler ───────────────────────────────────────────────────
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
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la connexion';
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: schoolCredentials.email,
        password: schoolCredentials.password,
        tenantSubdomain: tenantSlug,
        tenant_id: tenantIdFromUrl || undefined,
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
      });
      window.location.href = redirectUrl;
    } catch {
      const baseUrl = window.location.origin;
      const url = new URL(redirectPath, baseUrl);
      if (resolvedSlug) url.searchParams.set('tenant', resolvedSlug);
      if (resolvedTenantId) url.searchParams.set('tenant_id', resolvedTenantId);
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
      expiresAt: data.expiresAt,
    });

    const tenantKey = data.tenant?.id || tenantIdForApi || 'platform';
    saveEmailForTenant(schoolCredentials.email, tenantKey);

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
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
      expiresAt: data.expiresAt,
    });

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
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
      expiresAt: data.expiresAt,
    });

    const redirectUrl = getTenantRedirectUrl({
      tenantSlug: tenantSlug || data.tenant?.slug || data.tenant?.id,
      tenantId: tenantIdForApi,
      path: redirectPath,
    });
    window.location.href = redirectUrl;
  };

  const formBlockKey = portalType || 'standard';

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/90 px-4 py-16 sm:px-6 lg:px-8">
      {/* ── Animated background (Navy/Blue/Gold only) ── */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-20 top-24 h-72 w-72 rounded-full blur-3xl"
              style={{ background: `${NAVY}25` }}
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -right-16 bottom-24 h-80 w-80 rounded-full blur-3xl"
              style={{ background: `${BLUE}20` }}
              animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
              transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: `${GOLD}12` }}
              animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.32, 0.2] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : null}
      </div>

      {/* ── Top navigation ── */}
      <motion.nav
        initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur }}
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          <Home className="h-4 w-4" style={{ color: NAVY }} />
          Accueil
        </Link>
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Portails
        </Link>
      </motion.nav>

      {/* ── Login card ── */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: dur, ease: 'easeOut' }}
          className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-2xl backdrop-blur-md md:p-10"
          style={{
            boxShadow: `0 24px 48px -12px rgba(11,47,115,0.12), 0 0 0 1px ${GOLD}14, inset 0 0 0 1px ${NAVY}10`,
          }}
        >
          {/* ── Card header ── */}
          <motion.div
            className="mb-6 text-center"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            {/* Logo */}
            <motion.div
              variants={heroItem}
              className="mb-4 inline-flex items-center justify-center"
              animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/images/logo-Academia Hub.png"
                alt={BRAND.name}
                width={100}
                height={100}
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
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-white/70"
                  style={{ background: `${NAVY}10` }}
                >
                  <PortalIcon className="h-6 w-6" style={{ color: NAVY }} />
                </div>
              )}
              <h1
                className="text-2xl font-extrabold tracking-tight md:text-3xl"
                style={{ color: NAVY }}
              >
                {meta?.title ?? BRAND.name}
              </h1>
            </motion.div>

            <motion.p variants={heroItem} className="text-sm text-slate-600">
              {meta?.subtitle ?? BRAND.subtitle}
            </motion.p>

            {/* School info badge */}
            {schoolInfo && (
              <motion.div
                variants={heroItem}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
                style={{
                  borderColor: `${NAVY}20`,
                  background: `linear-gradient(135deg, ${NAVY}06, ${BLUE}08)`,
                }}
              >
                {schoolInfo.logoUrl ? (
                  <Image
                    src={schoolInfo.logoUrl}
                    alt={schoolInfo.name}
                    width={20}
                    height={20}
                    className="h-5 w-5 rounded object-cover"
                  />
                ) : (
                  <Building2 className="h-4 w-4" style={{ color: NAVY }} />
                )}
                <span className="font-medium" style={{ color: NAVY }}>
                  {schoolInfo.name}
                </span>
                {schoolInfo.city && (
                  <span className="text-slate-500">· {schoolInfo.city}</span>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* ── Error message ── */}
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
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/95 p-4 shadow-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">{idleLogoutMessage}</p>
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
                className="mb-5 rounded-xl border border-amber-300/80 bg-amber-50/95 p-4"
              >
                <p className="mb-1 text-sm font-semibold text-amber-900">Code OTP (DEV)</p>
                <p className="text-center text-2xl font-bold tracking-widest text-amber-950">
                  {parentOtpCode}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <AnimatePresence mode="wait">
              <motion.div
                key={formBlockKey}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
                transition={{ duration: dur, ease: 'easeOut' }}
                className="space-y-5"
              >
                {/* ── Email + Password (School / Platform / Standard) ── */}
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
                          onBlur={() => setEmailTouched(true)}
                          className={`w-full rounded-xl border-2 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-offset-1 focus:ring-[#0b2f73] focus:border-[#0b2f73] ${
                            emailError ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                          }`}
                          placeholder="votre.email@etablissement.com"
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
                      {emailError && (
                        <p className="mt-1 text-xs text-red-600">{emailError}</p>
                      )}
                      {getSavedEmailForTenant(tenantStorageKey) && !emailError && (
                        <p className="mt-1 text-xs text-slate-500">
                          Dernière connexion pour cet établissement (ce poste uniquement).
                        </p>
                      )}
                    </div>

                    {/* Password field */}
                    <div>
                      <label
                        htmlFor={`password-${tenantStorageKey}`}
                        className="mb-2 block text-sm font-semibold text-slate-900"
                      >
                        Mot de passe
                      </label>
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
                            });
                            setPasswordTouched(true);
                          }}
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-10 transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-offset-1 focus:ring-[#0b2f73] focus:border-[#0b2f73]"
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

                {/* ── Teacher login fields ── */}
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
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-offset-1 focus:ring-[#0b2f73] focus:border-[#0b2f73]"
                          placeholder="EMP001"
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Votre identifiant unique fourni par l&apos;établissement
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="teacherPassword"
                        className="mb-2 block text-sm font-semibold text-slate-900"
                      >
                        Mot de passe
                      </label>
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
                            });
                            setPasswordTouched(true);
                          }}
                          className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-10 transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-offset-1 focus:ring-[#0b2f73] focus:border-[#0b2f73]"
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

                {/* ── Parent login fields ── */}
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
                          onBlur={() => setPhoneTouched(true)}
                          className={`w-full rounded-xl border-2 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 disabled:bg-slate-100 focus:ring-2 focus:ring-offset-1 focus:ring-[#0b2f73] focus:border-[#0b2f73] ${
                            phoneError ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                          }`}
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
                      {phoneError && (
                        <p className="mt-1 text-xs text-red-600">{phoneError}</p>
                      )}
                      {!phoneError && (
                        <p className="mt-1 text-[10px] text-slate-500">
                          Format attendu : +229 XX XX XX XX ou 9X XX XX XX
                        </p>
                      )}
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
                              className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-offset-1 focus:ring-[#0b2f73] focus:border-[#0b2f73]"
                              placeholder="123456"
                              maxLength={6}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                            />
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            Un code OTP a été envoyé à votre numéro de téléphone.
                          </p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ── Submit button ── */}
            <motion.button
              type="submit"
              disabled={!canSubmit()}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { scale: 1.01, boxShadow: '0 14px 32px rgba(11,47,115,0.22)' }
              }
              whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
              transition={springSoft}
              className="flex w-full items-center justify-center rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              style={{
                background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
              }}
            >
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-5 w-5 animate-spin" />
                  {parentOtpSent && portalType === 'parent'
                    ? 'Vérification...'
                    : 'Connexion en cours...'}
                </>
              ) : parentOtpSent && portalType === 'parent' ? (
                'Vérifier le code'
              ) : (
                'Se connecter'
              )}
            </motion.button>
          </form>

          {/* ── Security badge ── */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <Shield className="h-3 w-3" style={{ color: NAVY }} />
            <span>Connexion chiffrée TLS · Portail sécurisé {BRAND.name}</span>
          </div>

          {/* ── Links ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.12, duration: dur }}
            className="mt-6 space-y-3 text-center"
          >
            {/* "Mot de passe oublié" pour tous les portails authentifiés */}
            {(isStandardLogin || portalType === 'school' || portalType === 'platform' || portalType === 'teacher') && (
              <div>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium transition-colors hover:underline"
                  style={{ color: NAVY }}
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            )}

            {/* Retour à la sélection du portail */}
            {!isStandardLogin && (
              <div>
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Retour à la sélection du portail
                </Link>
              </div>
            )}

            {/* Signup */}
            {isStandardLogin && (
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
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
