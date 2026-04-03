/**
 * Login Page Component - Multi-Portal Support
 *
 * Portails : École (email + mot de passe), Enseignant (matricule + mot de passe),
 * Parents & Élèves (téléphone + OTP). Refonte visuelle & Framer Motion alignée
 * sur la page portail (navy / or, budget mouvement, AnimatePresence).
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { persistClientSession } from '@/lib/auth/client-access-token';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getMotionDuration } from '@/lib/motion/presets';

type PortalType = 'school' | 'teacher' | 'parent' | null;

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

const NAVY = '#0b2f73';
const GOLD = '#f5b335';

function normalizePortal(raw: string | null | undefined): PortalType {
  const x = raw?.toLowerCase();
  if (x === 'school' || x === 'teacher' || x === 'parent') return x;
  return null;
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { shouldReduceMotion } = useMotionBudget();

  const portalParam = searchParams?.get('portal');
  const tenantSlug = searchParams?.get('tenant');
  const tenantIdFromUrl = searchParams?.get('tenant_id');
  const tenantIdForApi = tenantIdFromUrl || tenantSlug;
  const redirectPath = searchParams?.get('redirect') || '/app';

  const [portalType, setPortalType] = useState<PortalType>(() =>
    normalizePortal(portalParam),
  );

  useEffect(() => {
    setPortalType(normalizePortal(portalParam));
  }, [portalParam]);

  const [schoolCredentials, setSchoolCredentials] = useState<SchoolCredentials>({
    email: '',
    password: '',
  });

  const [teacherCredentials, setTeacherCredentials] = useState<TeacherCredentials>(
    {
      teacherIdentifier: '',
      password: '',
    },
  );

  const [parentCredentials, setParentCredentials] = useState<ParentCredentials>({
    phone: '',
    otp: '',
  });

  const [parentOtpSent, setParentOtpSent] = useState(false);
  const [parentOtpCode, setParentOtpCode] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    const lastEmail = getSavedEmailForTenant(tenantStorageKey);
    if (lastEmail && !schoolCredentials.email) {
      setSchoolCredentials((prev) => ({ ...prev, email: lastEmail }));
    }
  }, [tenantStorageKey]);

  const isStandardLogin = !portalType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isStandardLogin) {
        await handleStandardLogin();
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
      const params = new URLSearchParams();
      if (redirectPath !== '/app') params.set('redirect', redirectPath);
      window.location.href = params.toString()
        ? `/auth/select-tenant?${params.toString()}`
        : '/auth/select-tenant';
      return;
    }

    let redirectUrl = redirectPath;
    if (tenantSlug || tenantIdFromUrl) {
      const params = new URLSearchParams();
      if (tenantSlug) {
        params.set('tenant', tenantSlug);
      }
      if (tenantIdFromUrl) {
        params.set('tenant_id', tenantIdFromUrl);
      }
      redirectUrl = `${redirectPath}?${params.toString()}`;
    }
    window.location.href = redirectUrl;
  };

  const handleSchoolLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    const response = await fetch('/api/portal/auth/school', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const redirectUrl =
      tenantSlug || tenantIdFromUrl
        ? `${redirectPath}?tenant=${encodeURIComponent(tenantSlug || '')}${tenantIdFromUrl ? `&tenant_id=${encodeURIComponent(tenantIdFromUrl)}` : ''}`
        : redirectPath;
    window.location.href = redirectUrl;
  };

  const handleTeacherLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    const response = await fetch('/api/portal/auth/teacher', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const redirectUrl =
      tenantSlug || tenantIdFromUrl
        ? `${redirectPath}?tenant=${encodeURIComponent(tenantSlug || '')}${tenantIdFromUrl ? `&tenant_id=${encodeURIComponent(tenantIdFromUrl)}` : ''}`
        : redirectPath;
    window.location.href = redirectUrl;
  };

  const handleParentLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error("Identifiant de l'établissement manquant");
    }

    if (!parentOtpSent) {
      const response = await fetch('/api/portal/auth/parent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: tenantIdForApi,
          phone: parentCredentials.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || data.error || "Erreur lors de l'envoi du code OTP",
        );
      }

      if (data.otp) {
        setParentOtpCode(data.otp);
      }

      setParentOtpSent(true);
      return;
    }

    const response = await fetch('/api/portal/auth/parent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const redirectUrl =
      tenantSlug || tenantIdFromUrl
        ? `${redirectPath}?tenant=${encodeURIComponent(tenantSlug || '')}${tenantIdFromUrl ? `&tenant_id=${encodeURIComponent(tenantIdFromUrl)}` : ''}`
        : redirectPath;
    window.location.href = redirectUrl;
  };

  const theme = useMemo(() => {
    switch (portalType) {
      case 'school':
        return {
          title: 'Portail École',
          subtitle: 'Direction • Administration • Promoteur',
          Icon: Building2,
          accent: 'blue' as const,
          iconBg: 'from-blue-500/20 to-blue-600/10',
          iconClass: 'text-blue-600',
          ring: 'ring-blue-500/25',
          focus: 'focus:ring-blue-600 focus:border-blue-600',
          btnFrom: '#2563eb',
          btnTo: '#1d4ed8',
        };
      case 'teacher':
        return {
          title: 'Portail Enseignant',
          subtitle: 'Enseignants & Encadreurs',
          Icon: GraduationCap,
          accent: 'emerald' as const,
          iconBg: 'from-emerald-500/20 to-emerald-600/10',
          iconClass: 'text-emerald-600',
          ring: 'ring-emerald-500/25',
          focus: 'focus:ring-emerald-600 focus:border-emerald-600',
          btnFrom: '#059669',
          btnTo: '#047857',
        };
      case 'parent':
        return {
          title: 'Portail Parents & Élèves',
          subtitle: 'Suivi scolaire & paiements',
          Icon: Users,
          accent: 'violet' as const,
          iconBg: 'from-violet-500/20 to-violet-600/10',
          iconClass: 'text-violet-600',
          ring: 'ring-violet-500/25',
          focus: 'focus:ring-violet-600 focus:border-violet-600',
          btnFrom: '#7c3aed',
          btnTo: '#6d28d9',
        };
      default:
        return {
          title: BRAND.name,
          subtitle: BRAND.subtitle,
          Icon: null as null,
          accent: 'navy' as const,
          iconBg: 'from-[#0b2f73]/15 to-blue-600/10',
          iconClass: 'text-[#0b2f73]',
          ring: 'ring-[#0b2f73]/20',
          focus: 'focus:ring-[#0b2f73] focus:border-[#0b2f73]',
          btnFrom: NAVY,
          btnTo: '#144798',
        };
    }
  }, [portalType]);

  const PortalIcon = theme.Icon;

  const formBlockKey = portalType || 'standard';

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/90 px-4 py-16 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-blue-400/30 blur-3xl"
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute -right-16 bottom-24 h-80 w-80 rounded-full bg-amber-300/25 blur-3xl"
              animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
              transition={{
                duration: 17,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: `${NAVY}18` }}
              animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.38, 0.25] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : null}
      </div>

      <motion.nav
        initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur }}
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:border-amber-300/60 hover:text-slate-900"
        >
          <Home className="h-4 w-4" style={{ color: NAVY }} />
          Accueil
        </Link>
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:border-amber-300/60 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Portails
        </Link>
      </motion.nav>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={
            shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.99 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: dur, ease: 'easeOut' }}
          className={`rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-2xl ring-1 backdrop-blur-md md:p-10 ${theme.ring}`}
          style={{ boxShadow: `0 24px 48px -12px rgba(11,47,115,0.12), 0 0 0 1px ${GOLD}14` }}
        >
          <motion.div
            className="mb-8 text-center"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div
              variants={heroItem}
              className="mb-6 inline-flex items-center justify-center"
              animate={
                shouldReduceMotion
                  ? undefined
                  : { y: [0, -4, 0] }
              }
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Image
                src="/images/logo-Academia Hub.png"
                alt={BRAND.name}
                width={120}
                height={120}
                className="h-24 w-24 object-contain drop-shadow-lg md:h-28 md:w-28"
                priority
              />
            </motion.div>

            <motion.div
              variants={heroItem}
              className="mb-3 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              {PortalIcon ? (
                <motion.div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.iconBg} ring-1 ring-white/70`}
                  whileHover={
                    shouldReduceMotion ? undefined : { scale: 1.05, rotate: -2 }
                  }
                  transition={springSoft}
                >
                  <PortalIcon className={`h-7 w-7 ${theme.iconClass}`} />
                </motion.div>
              ) : null}
              <h1
                className="text-3xl font-extrabold tracking-tight md:text-4xl"
                style={{ color: NAVY }}
              >
                {theme.title}
              </h1>
            </motion.div>

            <motion.p variants={heroItem} className="text-sm text-slate-600">
              {theme.subtitle}
            </motion.p>
            {portalType === null && (
              <motion.p
                variants={heroItem}
                className="mt-1 text-xs font-medium text-slate-500"
              >
                {BRAND.slogan}
              </motion.p>
            )}
          </motion.div>

          <AnimatePresence>
            {error ? (
              <motion.div
                key="login-error"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: dur * 0.85 }}
                className="mb-6"
              >
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/95 p-4 shadow-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {parentOtpSent &&
            parentOtpCode &&
            process.env.NODE_ENV === 'development' ? (
              <motion.div
                key="dev-otp"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50/95 p-4"
              >
                <p className="mb-1 text-sm font-semibold text-amber-900">
                  Code OTP (DEV)
                </p>
                <p className="text-center text-2xl font-bold tracking-widest text-amber-950">
                  {parentOtpCode}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={formBlockKey}
                initial={
                  shouldReduceMotion ? false : { opacity: 0, x: 16 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  shouldReduceMotion
                    ? undefined
                    : { opacity: 0, x: -12 }
                }
                transition={{ duration: dur, ease: 'easeOut' }}
                className="space-y-6"
              >
                {(isStandardLogin || portalType === 'school') && (
                  <>
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
                          className={`w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 ${theme.focus}`}
                          placeholder="votre.email@etablissement.com"
                        />
                      </div>
                      {getSavedEmailForTenant(tenantStorageKey) ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Dernière connexion pour cet établissement (ce poste
                          uniquement).
                        </p>
                      ) : null}
                    </div>

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
                          type="password"
                          id={`password-${tenantStorageKey}`}
                          name={`password_${tenantStorageKey}`}
                          autoComplete="current-password"
                          required
                          value={schoolCredentials.password}
                          onChange={(e) =>
                            setSchoolCredentials({
                              ...schoolCredentials,
                              password: e.target.value,
                            })
                          }
                          className={`w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 ${theme.focus}`}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </>
                )}

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
                          className={`w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 ${theme.focus}`}
                          placeholder="EMP001"
                        />
                      </div>
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
                          type="password"
                          id="teacherPassword"
                          required
                          value={teacherCredentials.password}
                          onChange={(e) =>
                            setTeacherCredentials({
                              ...teacherCredentials,
                              password: e.target.value,
                            })
                          }
                          className={`w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 ${theme.focus}`}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </>
                )}

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
                          className={`w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 disabled:bg-slate-100 ${theme.focus}`}
                          placeholder="+22912345678"
                        />
                      </div>
                    </div>

                    <AnimatePresence>
                      {parentOtpSent ? (
                        <motion.div
                          key="otp-field"
                          initial={
                            shouldReduceMotion ? false : { opacity: 0, y: 10 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            shouldReduceMotion ? undefined : { opacity: 0, y: 6 }
                          }
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
                              className={`w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 transition-all placeholder:text-slate-400 ${theme.focus}`}
                              placeholder="123456"
                              maxLength={6}
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

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { scale: 1.01, boxShadow: '0 14px 32px rgba(11,47,115,0.22)' }
              }
              whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
              transition={springSoft}
              className="flex w-full items-center justify-center rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${theme.btnFrom}, ${theme.btnTo})`,
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

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.12, duration: dur }}
            className="mt-8 space-y-3 text-center"
          >
            {!isStandardLogin ? (
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
                    style={{ color: NAVY }}
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
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
