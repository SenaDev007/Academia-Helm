/**
 * ============================================================================
 * PORTAL ACCESS PAGE - ACCÉDER À UN PORTAIL
 * ============================================================================
 * 
 * Page centrale pour accéder aux différents portails Academia Helm.
 * Refonte motion (Framer Motion) : entrées échelonnées, cartes interactives,
 * transitions entre choix du portail et recherche d'établissement.
 * 
 * Palette Academia Helm : Navy (#0b2f73) / Blue (#1d4fa5) / Gold (#f5b335)
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  GraduationCap,
  Users,
  ArrowRight,
  Shield,
  Code2,
  X,
  School,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumHeader from '@/components/layout/PremiumHeader';
import SchoolSearch from '@/components/portal/SchoolSearch';
import BeninMap from '@/components/portal/BeninMap';
import { BENIN_DEPARTMENTS, BENIN_TOTALS, BENIN_SECONDAIRE_TOTALS, type DepartmentData } from '@/data/benin-departments';
import { useTenantRedirect } from '@/lib/hooks/useTenantRedirect';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { persistClientSession } from '@/lib/auth/client-access-token';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getModalMotion, getMotionDuration } from '@/lib/motion/presets';

type PortalType = 'PLATFORM' | 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC' | null;

interface School {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  schoolType?: string;
}

interface DevTenant {
  id: string;
  tenantId: string;
  name: string;
  schoolName: string;
  tenantName: string;
  slug: string;
}

/** Aligné charte Academia Helm (landing / portail) */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

export default function PortalPage() {
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentData | null>(null);
  const [mapFilter, setMapFilter] = useState<'all' | 'public' | 'private'>('all');
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devTenants, setDevTenants] = useState<DevTenant[]>([]);
  const [devTenantsLoading, setDevTenantsLoading] = useState(false);
  const [selectedDevTenant, setSelectedDevTenant] = useState<DevTenant | null>(
    null,
  );
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);
  const { redirectToTenant, getTenantRedirectUrl } = useTenantRedirect();
  const { shouldReduceMotion } = useMotionBudget();

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
          staggerChildren: shouldReduceMotion ? 0 : 0.1,
          delayChildren: shouldReduceMotion ? 0 : 0.06,
        },
      },
    }),
    [shouldReduceMotion],
  );

  const heroItem = useMemo(
    () => ({
      hidden: {
        opacity: shouldReduceMotion ? 1 : 0,
        y: shouldReduceMotion ? 0 : 18,
        filter: shouldReduceMotion ? 'blur(0px)' : 'blur(6px)',
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

  const cardSpring = useMemo(
    () => ({
      type: 'spring' as const,
      stiffness: shouldReduceMotion ? 500 : 280,
      damping: shouldReduceMotion ? 50 : 22,
    }),
    [shouldReduceMotion],
  );

  const portalCards = useMemo(
    () =>
      [
        {
          type: 'PLATFORM' as const,
          title: 'Portail Plateforme',
          subtitle: 'Administration SaaS • Supervision globale • Business',
          Icon: Shield,
          iconBg: `linear-gradient(135deg, ${NAVY}22, ${NAVY}11)`,
          iconColor: NAVY,
          accentBar: `linear-gradient(90deg, ${NAVY}, ${BLUE})`,
          hoverBg: `linear-gradient(135deg, ${NAVY}08, ${BLUE}06)`,
        },
        {
          type: 'SCHOOL' as const,
          title: 'Portail École',
          subtitle: 'Direction • Administration • Finances • Scolarité',
          Icon: Building2,
          iconBg: `linear-gradient(135deg, ${BLUE}22, ${BLUE}11)`,
          iconColor: BLUE,
          accentBar: `linear-gradient(90deg, ${BLUE}, #2d6bc4)`,
          hoverBg: `linear-gradient(135deg, ${BLUE}08, ${BLUE}04)`,
        },
        {
          type: 'TEACHER' as const,
          title: 'Portail Enseignant',
          subtitle: 'Pédagogie • Suivi • Notes • Cahier de texte',
          Icon: GraduationCap,
          iconBg: `linear-gradient(135deg, ${GOLD}22, ${GOLD}11)`,
          iconColor: GOLD,
          accentBar: `linear-gradient(90deg, ${GOLD}, #f7c76e)`,
          hoverBg: `linear-gradient(135deg, ${GOLD}0a, ${GOLD}04)`,
        },
        {
          type: 'PARENT' as const,
          title: 'Portail Parent / Élève',
          subtitle: 'Suivi scolaire • Paiements • Communication',
          Icon: Users,
          iconBg: `linear-gradient(135deg, #0b2f7322, #0b2f7311)`,
          iconColor: NAVY,
          accentBar: `linear-gradient(90deg, ${NAVY}, ${GOLD})`,
          hoverBg: `linear-gradient(135deg, ${NAVY}08, ${GOLD}04)`,
        },
        {
          type: 'PUBLIC' as const,
          title: 'Portail Public',
          subtitle: 'Pré-inscription • Admissions • Informations',
          Icon: ArrowRight,
          iconBg: `linear-gradient(135deg, ${GOLD}22, ${BLUE}11)`,
          iconColor: GOLD,
          accentBar: `linear-gradient(90deg, ${GOLD}, ${BLUE})`,
          hoverBg: `linear-gradient(135deg, ${GOLD}08, ${BLUE}04)`,
        },
      ] as const,
    [],
  );

  useEffect(() => {
    if (devPanelOpen && devTenants.length === 0) {
      setDevTenantsLoading(true);
      fetch('/api/auth/dev-available-tenants')
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            console.error(
              '[Portal mode dev] Impossible de charger les tenants:',
              res.status,
              data,
            );
            return;
          }
          if (Array.isArray(data)) setDevTenants(data);
        })
        .catch((err) =>
          console.error('[Portal mode dev] Erreur réseau tenants:', err),
        )
        .finally(() => setDevTenantsLoading(false));
    }
  }, [devPanelOpen]);

  useEffect(() => {
    if (!selectedDevTenant) {
      setDevEmail('');
      return;
    }
    const tenantKey = selectedDevTenant.tenantId || selectedDevTenant.id;
    const lastEmail = getSavedEmailForTenant(tenantKey);
    if (lastEmail) setDevEmail(lastEmail);
    else setDevEmail('');
  }, [selectedDevTenant?.id]);

  const handlePortalSelect = (portal: PortalType) => {
    setSelectedPortal(portal);
    setSelectedSchool(null);
  };

  const handleSchoolSelect = (school: School | null) => {
    setSelectedSchool(school);
  };

  const handleContinue = async () => {
    if (selectedPortal === 'PLATFORM') {
      await redirectToTenant({
        tenantSlug: selectedSchool?.slug || 'platform',
        tenantId: selectedSchool?.id || 'platform',
        path: '/login',
        portalType: 'PLATFORM',
        queryParams: { portal: 'platform' },
      });
      return;
    }

    if (!selectedPortal || !selectedSchool) return;

    if (selectedPortal === 'PUBLIC') {
      window.location.href = `/jobs?school=${selectedSchool.slug}`;
      return;
    }

    await redirectToTenant({
      tenantSlug: selectedSchool.slug,
      tenantId: selectedSchool.id,
      path: '/login',
      portalType: selectedPortal,
      queryParams: { portal: selectedPortal.toLowerCase() },
    });
  };

  const handleBack = () => {
    setSelectedPortal(null);
    setSelectedSchool(null);
  };

  const handleDevPanelOpen = () => {
    setDevPanelOpen(true);
    setSelectedDevTenant(null);
    setDevEmail('');
    setDevPassword('');
  };

  const handleDevPanelClose = () => {
    setDevPanelOpen(false);
    setSelectedDevTenant(null);
    setDevEmail('');
    setDevPassword('');
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevTenant) {
      alert('Veuillez d\'abord sélectionner une école.');
      return;
    }
    if (!devEmail.trim() || !devPassword) {
      alert('Veuillez saisir l\'email et le mot de passe.');
      return;
    }
    setIsDevLoggingIn(true);
    try {
      const tenantId = selectedDevTenant.tenantId || selectedDevTenant.id;

      const attemptLogin = async (portalType: 'SCHOOL' | 'PLATFORM') => {
        return fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: devEmail.trim(),
            password: devPassword,
            tenant_id: tenantId,
            portal_type: portalType,
          }),
        });
      };

      let response = await attemptLogin('SCHOOL');
      let data = await response.json();

      const message = typeof data?.message === 'string' ? data.message : '';
      if (
        response.status === 403 &&
        message.toLowerCase().includes('platform_owner') &&
        message.toLowerCase().includes('platform')
      ) {
        response = await attemptLogin('PLATFORM');
        data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Connexion impossible');
        }
        const selectResp = await fetch('/api/auth/select-tenant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.accessToken}`,
          },
          body: JSON.stringify({ tenant_id: tenantId }),
        });
        const selectData = await selectResp.json();
        if (!selectResp.ok || !selectData.success) {
          throw new Error(selectData.message || selectData.error || 'Sélection tenant impossible');
        }
        persistClientSession({
          accessToken: selectData.accessToken,
          refreshToken: selectData.refreshToken,
          serverSessionId: selectData.serverSessionId,
          user: selectData.user,
          tenant: selectData.tenant,
          expiresAt: selectData.expiresAt,
        });
        saveEmailForTenant(devEmail.trim(), tenantId);
        await redirectToTenant({
          tenantSlug: selectedDevTenant.slug || tenantId,
          tenantId: tenantId,
          path: '/app',
        });
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Connexion impossible');
      }
      persistClientSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        serverSessionId: data.serverSessionId,
        user: data.user,
        tenant: data.tenant,
        expiresAt: data.expiresAt,
      });
      saveEmailForTenant(devEmail.trim(), tenantId);
      await redirectToTenant({
        tenantSlug: selectedDevTenant.slug || tenantId,
        tenantId: tenantId,
        path: '/app',
      });
      return;
    } catch (error: unknown) {
      console.error('[Dev Login] Error:', error);
      const message =
        error instanceof Error ? error.message : 'Impossible de se connecter';
      let userMessage = message;
      if (message.includes('timeout') || message.includes('ne répond pas') || message.includes('30 secondes')) {
        userMessage = 'Le serveur est en cours de démarrage. Veuillez réessayer dans quelques secondes.';
      } else if (message.includes('Internal server error') || message.includes('500')) {
        userMessage = 'Erreur serveur temporaire. Veuillez réessayer dans quelques instants.';
      } else if (message.includes('Unauthorized') || message.includes('401')) {
        userMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
      }
      alert(`Erreur: ${userMessage}`);
      setIsDevLoggingIn(false);
    }
  };

  const modalMotion = getModalMotion(shouldReduceMotion);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/80 text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
      >
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-24 top-24 h-72 w-72 rounded-full blur-3xl"
              style={{ backgroundColor: `${NAVY}40` }}
              animate={{ x: [0, 24, 0], y: [0, -12, 0] }}
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute -right-20 bottom-32 h-80 w-80 rounded-full blur-3xl"
              style={{ backgroundColor: `${GOLD}33` }}
              animate={{ x: [0, -18, 0], y: [0, 16, 0] }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
              style={{ backgroundColor: `${BLUE}1a` }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : null}
      </div>

      <PremiumHeader />
      
      <main className="relative z-[1] pb-20 pt-24 md:pt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12 text-center"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={heroItem}>
            <span
              className="mb-4 inline-flex rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{
                color: NAVY,
                borderColor: `${GOLD}66`,
                background: `linear-gradient(90deg, ${GOLD}22, ${GOLD}3d)`,
              }}
            >
              Portails sécurisés
            </span>
            </motion.div>
            <motion.h1
              variants={heroItem}
              className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl"
              style={{ color: NAVY }}
            >
              Accéder à votre portail
            </motion.h1>
            <motion.p
              variants={heroItem}
              className="mx-auto max-w-2xl text-lg text-slate-600"
            >
              Sélectionnez votre espace sécurisé {BRAND.name}. {BRAND.subtitle}.
            </motion.p>
            <motion.p
              variants={heroItem}
              className="mt-2 text-base font-medium text-slate-500"
            >
              {BRAND.slogan}
            </motion.p>
            <motion.div variants={heroItem} className="mt-8 flex justify-center">
              <motion.button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDevPanelOpen();
              }}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { scale: 1.03, boxShadow: `0 20px 40px ${GOLD}55` }
                }
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={cardSpring}
                className="group relative inline-flex items-center justify-center gap-2 rounded-xl border-2 px-6 py-3 font-semibold text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, #e09e2a)`,
                  borderColor: `${GOLD}cc`,
                }}
              title="Ouvrir la fenêtre : choisir une école puis saisir vos identifiants"
            >
                <motion.span
                  animate={
                    shouldReduceMotion ? undefined : { rotate: [0, -8, 8, 0] }
                  }
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Code2 className="h-5 w-5" />
                </motion.span>
              <span>Mode Développement</span>
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-md">
                DEV
              </span>
              </motion.button>
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {devPanelOpen ? (
              <motion.div
                key="dev-overlay"
                role="presentation"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur }}
                onClick={handleDevPanelClose}
              >
                <motion.div
                  key="dev-modal"
                  className="relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl"
                  {...modalMotion}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                      <Code2 className="h-5 w-5" style={{ color: GOLD }} />
                    Connexion en mode développement
                  </h3>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={handleDevPanelClose}
                      className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Fermer"
                    >
                      <X className="h-5 w-5" />
                    </motion.button>
                </div>
                  <p className="mb-4 text-sm text-slate-600">
                    Choisissez d'abord l'école (tenant), puis saisissez vos
                    identifiants pour vous connecter à l'app avec ce contexte.
                </p>
                <form onSubmit={handleDevLogin} className="space-y-4">
                  <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        École
                      </label>
                    <select
                      value={selectedDevTenant?.id ?? ''}
                      onChange={(e) => {
                          const t = devTenants.find(
                            (x) => x.id === e.target.value,
                          );
                        setSelectedDevTenant(t ?? null);
                      }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-offset-1"
                        style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                      required
                    >
                      <option value="">— Choisir une école —</option>
                        {devTenantsLoading && (
                          <option disabled>Chargement…</option>
                        )}
                        {!devTenantsLoading &&
                          devTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.schoolName || t.tenantName || t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Email
                      </label>
                    <input
                      type="email"
                        name={
                          selectedDevTenant
                            ? `email_${selectedDevTenant.id}`
                            : 'email'
                        }
                      autoComplete="email"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      placeholder="votre@email.com"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-offset-1"
                        style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                      required
                    />
                      {selectedDevTenant &&
                        getSavedEmailForTenant(
                          selectedDevTenant.tenantId ||
                            selectedDevTenant.id,
                        ) && (
                          <p className="mt-1 text-xs text-slate-500">
                            Dernière connexion pour cet établissement (ce poste
                            uniquement).
                          </p>
                    )}
                  </div>
                  <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Mot de passe
                      </label>
                    <input
                      type="password"
                      value={devPassword}
                      onChange={(e) => setDevPassword(e.target.value)}
                      placeholder="••••••••"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-offset-1"
                        style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDevPanelClose}
                        className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isDevLoggingIn}
                        className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: `linear-gradient(135deg, ${GOLD}, #e09e2a)` }}
                    >
                      {isDevLoggingIn ? 'Connexion…' : 'Se connecter'}
                    </button>
                  </div>
                </form>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait">
          {!selectedPortal ? (
              <motion.div
                key="portal-layout"
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, y: 12 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? undefined
                    : { opacity: 0, y: -10, transition: { duration: dur * 0.85 } }
                }
                transition={{ duration: dur, ease: 'easeOut' }}
                className="mx-auto mb-12 flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-10"
              >
                {/* ── Colonne gauche : Cartes portail ── */}
                <div className="flex flex-col gap-4 lg:w-[55%]">
                  {portalCards.map((card, index) => {
                    const Icon = card.Icon;
                    return (
                      <motion.div
                        key={card.type}
                        initial={
                          shouldReduceMotion
                            ? false
                            : { opacity: 0, y: 22 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: shouldReduceMotion ? 0 : 0.08 + index * 0.07,
                          duration: dur,
                          ease: 'easeOut',
                        }}
                        whileHover={
                          shouldReduceMotion
                            ? undefined
                            : {
                                y: -4,
                                transition: cardSpring,
                              }
                        }
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                        onClick={() => handlePortalSelect(card.type)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePortalSelect(card.type);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-2 hover:shadow-xl"
                        style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                      >
                        {/* Gold accent top bar */}
                        <div
                          className="absolute left-0 top-0 h-1 w-full opacity-90"
                          style={{ background: card.accentBar }}
                          aria-hidden
                        />
                        {/* Hover background overlay */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{ background: card.hoverBg }}
                        />
                        <div className="relative flex items-center gap-4 p-4 sm:p-5">
                          {/* Circular icon container */}
                          <motion.div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-white/80 sm:h-14 sm:w-14"
                            style={{ background: card.iconBg }}
                            whileHover={
                              shouldReduceMotion
                                ? undefined
                                : { scale: 1.06, rotate: -2 }
                            }
                            transition={cardSpring}
                          >
                            <Icon className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: card.iconColor }} />
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <h3
                              className="text-base font-bold leading-snug sm:text-lg"
                              style={{ color: NAVY }}
                            >
                              {card.title}
                            </h3>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
                              {card.subtitle}
                            </p>
                          </div>
                          <div
                            className="shrink-0 inline-flex items-center text-sm font-semibold transition-colors"
                            style={{ color: card.iconColor }}
                          >
                            <span className="group-hover:text-white group-hover:drop-shadow-sm transition-colors duration-200">Accéder</span>
                            <motion.span
                              className="ml-1.5 inline-flex"
                              initial={false}
                              whileHover={{ x: shouldReduceMotion ? 0 : 4 }}
                            >
                              <ArrowRight className="h-4 w-4" aria-hidden />
                            </motion.span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* ── Stats Banner ── */}
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: shouldReduceMotion ? 0 : 0.55, duration: dur, ease: 'easeOut' }}
                    className="rounded-2xl border border-slate-200/80 bg-white shadow-md overflow-hidden"
                  >
                    <div
                      className="px-5 py-3"
                      style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                    >
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <School className="h-4 w-4" style={{ color: GOLD }} />
                        Statistiques nationales — Éducation au Bénin
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${NAVY}12` }}>
                              <School className="h-4 w-4" style={{ color: NAVY }} />
                            </div>
                          </div>
                          <p className="text-lg font-bold" style={{ color: NAVY }}>
                            {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.schools + BENIN_SECONDAIRE_TOTALS.schools)}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Écoles</p>
                          <div className="mt-1 flex justify-center gap-2 text-[9px] text-slate-400">
                            <span>Primaire: {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.schools)}</span>
                            <span>•</span>
                            <span>Secondaire: {new Intl.NumberFormat('fr-FR').format(BENIN_SECONDAIRE_TOTALS.schools)}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${BLUE}12` }}>
                              <Users className="h-4 w-4" style={{ color: BLUE }} />
                            </div>
                          </div>
                          <p className="text-lg font-bold" style={{ color: BLUE }}>
                            {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.students + BENIN_SECONDAIRE_TOTALS.students)}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Apprenants</p>
                          <div className="mt-1 flex justify-center gap-2 text-[9px] text-slate-400">
                            <span>Primaire: {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.students)}</span>
                            <span>•</span>
                            <span>Secondaire: {new Intl.NumberFormat('fr-FR').format(BENIN_SECONDAIRE_TOTALS.students)}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}12` }}>
                              <GraduationCap className="h-4 w-4" style={{ color: GOLD }} />
                            </div>
                          </div>
                          <p className="text-lg font-bold" style={{ color: GOLD }}>
                            {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.teachers + BENIN_SECONDAIRE_TOTALS.teachers)}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Enseignants</p>
                          <div className="mt-1 flex justify-center gap-2 text-[9px] text-slate-400">
                            <span>Primaire: {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.teachers)}</span>
                            <span>•</span>
                            <span>Secondaire: {new Intl.NumberFormat('fr-FR').format(BENIN_SECONDAIRE_TOTALS.teachers)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* ── Colonne droite : Carte du Bénin ── */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.35, duration: dur, ease: 'easeOut' }}
                  className="lg:w-[45%]"
                >
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg overflow-hidden">
                    {/* Section header */}
                    <div className="mb-4">
                      <h3
                        className="text-base font-bold tracking-tight"
                        style={{ color: NAVY }}
                      >
                        L'éducation au Bénin en un coup d'œil
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Cliquez sur un département pour voir les statistiques détaillées
                      </p>
                    </div>
                    {/* Filter tabs */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filtre</span>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                        {(['all', 'public', 'private'] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setMapFilter(f)}
                            className={`px-3 py-1.5 font-medium transition-colors ${
                              mapFilter === f
                                ? 'text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                            style={
                              mapFilter === f
                                ? { background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }
                                : undefined
                            }
                          >
                            {f === 'all' ? 'Tous' : f === 'public' ? 'Public' : 'Privé'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <BeninMap
                      onDepartmentSelect={setSelectedDepartment}
                      selectedDepartment={selectedDepartment}
                      filter={mapFilter}
                    />
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="school-flow"
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, x: 28 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  shouldReduceMotion
                    ? undefined
                    : { opacity: 0, x: -20, transition: { duration: dur * 0.85 } }
                }
                transition={{ duration: dur, ease: 'easeOut' }}
                className="relative z-30 mx-auto max-w-2xl"
              >
                <div className="overflow-visible rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-xl ring-1 ring-slate-200/40 backdrop-blur-sm">
                  <motion.button
                    type="button"
                  onClick={handleBack}
                  whileHover={
                    shouldReduceMotion ? undefined : { x: -3 }
                  }
                    className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                    <ArrowRight className="h-4 w-4 rotate-180" />
                  <span>Retour</span>
                  </motion.button>

                <div className="mb-6">
                    <div className="mb-2 flex items-center gap-3">
                    {selectedPortal === 'PLATFORM' && (
                      <>
                          <Shield className="h-7 w-7" style={{ color: NAVY }} />
                          <h2
                            className="text-2xl font-bold"
                            style={{ color: NAVY }}
                          >
                            Portail Plateforme
                          </h2>
                      </>
                    )}
                    {selectedPortal === 'PUBLIC' && (
                      <>
                          <ArrowRight className="h-7 w-7" style={{ color: GOLD }} />
                          <h2
                            className="text-2xl font-bold"
                            style={{ color: NAVY }}
                          >
                            Portail Public
                          </h2>
                      </>
                    )}
                    {selectedPortal === 'SCHOOL' && (
                      <>
                          <Building2 className="h-7 w-7" style={{ color: BLUE }} />
                          <h2
                            className="text-2xl font-bold"
                            style={{ color: NAVY }}
                          >
                            Portail École
                          </h2>
                      </>
                    )}
                    {selectedPortal === 'TEACHER' && (
                      <>
                          <GraduationCap className="h-7 w-7" style={{ color: GOLD }} />
                          <h2
                            className="text-2xl font-bold"
                            style={{ color: NAVY }}
                          >
                            Portail Enseignant
                          </h2>
                      </>
                    )}
                    {selectedPortal === 'PARENT' && (
                      <>
                          <Users className="h-7 w-7" style={{ color: NAVY }} />
                          <h2
                            className="text-2xl font-bold"
                            style={{ color: NAVY }}
                          >
                            Portail Parents & Élèves
                          </h2>
                      </>
                    )}
                  </div>
                    <p className="text-sm text-slate-600">
                    Recherchez votre établissement pour continuer
                  </p>
                </div>

                <SchoolSearch
                  onSchoolSelect={handleSchoolSelect}
                  selectedSchool={selectedSchool}
                  portalType={selectedPortal}
                />

                  <AnimatePresence>
                    {selectedSchool ? (
                      <motion.div
                        key="continue"
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, y: 12 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={
                          shouldReduceMotion
                            ? undefined
                            : { opacity: 0, y: 8 }
                        }
                        transition={{ duration: dur, ease: 'easeOut' }}
                        className="mt-6"
                      >
                        <motion.button
                          type="button"
                          onClick={() => void handleContinue()}
                          whileHover={
                            shouldReduceMotion
                              ? undefined
                              : { scale: 1.01, boxShadow: `0 12px 28px ${NAVY}40` }
                          }
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-md transition-colors"
                          style={{
                            background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                          }}
                    >
                      <span>Continuer vers la connexion</span>
                          <ArrowRight className="h-5 w-5" />
                        </motion.button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={
              shouldReduceMotion ? false : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.25,
              duration: dur,
            }}
            className="relative z-0 mt-14 flex justify-center"
          >
            <div
              className="relative z-0 inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-5 py-2.5 text-sm text-slate-600 shadow-sm backdrop-blur-sm"
              style={{ boxShadow: `0 0 0 1px ${GOLD}22` }}
            >
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>
                Vous êtes sur un portail officiel sécurisé {BRAND.name}
              </span>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
