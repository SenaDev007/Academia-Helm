/**
 * ============================================================================
 * PORTAL ACCESS PAGE - ACCÉDER À UN PORTAIL
 * ============================================================================
 * 
 * Page centrale pour accéder aux différents portails Academia Helm.
 * Refonte avec carte interactive du Bénin, stats par département,
 * et sélection de portail — inspirée de EducMaster (emp.educmaster.bj)
 * adaptée à la charte graphique Academia Helm (Navy / Gold).
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
  Eye,
  Compass,
  Lightbulb,
  School,
  MapPin,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumHeader from '@/components/layout/PremiumHeader';
import SchoolSearch from '@/components/portal/SchoolSearch';
import BeninMap from '@/components/portal/BeninMap';
import { useTenantRedirect } from '@/lib/hooks/useTenantRedirect';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { persistClientSession } from '@/lib/auth/client-access-token';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getModalMotion, getMotionDuration } from '@/lib/motion/presets';
import { BENIN_TOTALS, type DepartmentData } from '@/data/benin-departments';

type PortalType = 'PLATFORM' | 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC' | null;
type FilterType = 'all' | 'public' | 'private';

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
const NAVY = '#1E3A5F';
const NAVY_DARK = '#0D1F6E';
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#e4c978';

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export default function PortalPage() {
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentData | null>(null);
  const [mapFilter, setMapFilter] = useState<FilterType>('all');
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devTenants, setDevTenants] = useState<DevTenant[]>([]);
  const [devTenantsLoading, setDevTenantsLoading] = useState(false);
  const [selectedDevTenant, setSelectedDevTenant] = useState<DevTenant | null>(null);
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
          iconBg: 'from-slate-700/20 to-slate-800/10',
          iconColor: 'text-slate-800',
          accentBar: 'bg-slate-800',
          cta: 'text-slate-800 group-hover:text-slate-900',
        },
        {
          type: 'SCHOOL' as const,
          title: 'Portail École',
          subtitle: 'Direction • Administration • Finances • Scolarité',
          Icon: Building2,
          iconBg: 'from-blue-500/20 to-blue-600/10',
          iconColor: 'text-blue-600',
          accentBar: 'bg-blue-500',
          cta: 'text-blue-600 group-hover:text-blue-700',
        },
        {
          type: 'TEACHER' as const,
          title: 'Portail Enseignant',
          subtitle: 'Pédagogie • Suivi • Notes • Cahier de texte',
          Icon: GraduationCap,
          iconBg: 'from-emerald-500/20 to-emerald-600/10',
          iconColor: 'text-emerald-600',
          accentBar: 'bg-emerald-500',
          cta: 'text-emerald-600 group-hover:text-emerald-700',
        },
        {
          type: 'PARENT' as const,
          title: 'Portail Parent / Élève',
          subtitle: 'Suivi scolaire • Paiements • Communication',
          Icon: Users,
          iconBg: 'from-violet-500/20 to-violet-600/10',
          iconColor: 'text-violet-600',
          accentBar: 'bg-violet-500',
          cta: 'text-violet-600 group-hover:text-violet-700',
        },
        {
          type: 'PUBLIC' as const,
          title: 'Portail Public',
          subtitle: 'Pré-inscription • Admissions • Informations',
          Icon: Globe,
          iconBg: 'from-amber-500/20 to-amber-600/10',
          iconColor: 'text-amber-600',
          accentBar: 'bg-amber-500',
          cta: 'text-amber-600 group-hover:text-amber-700',
        },
      ] as const,
    [],
  );

  /* ── Trois axes du SIGE (adapté EducMaster → Academia Helm) ── */
  const axes = useMemo(
    () => [
      {
        icon: Eye,
        title: 'Suivre',
        description: 'Apprenants, classes, examens en temps réel',
        color: NAVY,
        gradient: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`,
      },
      {
        icon: Compass,
        title: 'Piloter',
        description: 'Écoles, ressources humaines, planning',
        color: GOLD,
        gradient: `linear-gradient(135deg, ${GOLD}, #b08d3a)`,
      },
      {
        icon: Lightbulb,
        title: 'Décider',
        description: 'Indicateurs clés, tableaux de bord, rapports',
        color: '#114FC4',
        gradient: 'linear-gradient(135deg, #114FC4, #0D3B85)',
      },
    ],
    [],
  );

  /* ── Dev mode ── */
  useEffect(() => {
    if (devPanelOpen && devTenants.length === 0) {
      setDevTenantsLoading(true);
      fetch('/api/auth/dev-available-tenants')
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            console.error('[Portal mode dev] Impossible de charger les tenants:', res.status, data);
            return;
          }
          if (Array.isArray(data)) setDevTenants(data);
        })
        .catch((err) => console.error('[Portal mode dev] Erreur réseau tenants:', err))
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

  /* ── Handlers ── */
  const handlePortalSelect = (portal: PortalType) => {
    setSelectedPortal(portal);
    setSelectedSchool(null);
  };

  const handleSchoolSelect = (school: School | null) => {
    setSelectedSchool(school);
  };

  const handleContinue = async () => {
    if (!selectedPortal || !selectedSchool) return;
    if (selectedPortal === 'PLATFORM') {
      await redirectToTenant({
        tenantSlug: selectedSchool.slug,
        tenantId: selectedSchool.id,
        path: '/login',
        portalType: 'PLATFORM',
        queryParams: { portal: 'platform' },
      });
      return;
    }
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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.accessToken}` },
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
        await redirectToTenant({ tenantSlug: selectedDevTenant.slug || tenantId, tenantId, path: '/app' });
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
      await redirectToTenant({ tenantSlug: selectedDevTenant.slug || tenantId, tenantId, path: '/app' });
      return;
    } catch (error: unknown) {
      console.error('[Dev Login] Error:', error);
      const msg = error instanceof Error ? error.message : 'Impossible de se connecter';
      let userMessage = msg;
      if (msg.includes('timeout') || msg.includes('ne répond pas') || msg.includes('30 secondes')) {
        userMessage = 'Le serveur est en cours de démarrage. Veuillez réessayer dans quelques secondes.';
      } else if (msg.includes('Internal server error') || msg.includes('500')) {
        userMessage = 'Erreur serveur temporaire. Veuillez réessayer dans quelques instants.';
      } else if (msg.includes('Unauthorized') || msg.includes('401')) {
        userMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
      }
      alert(`Erreur: ${userMessage}`);
      setIsDevLoggingIn(false);
    }
  };

  const modalMotion = getModalMotion(shouldReduceMotion);

  /* ════════════════════════════════════════════════════════════════════════
     RENDU
     ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/80 text-slate-900">
      {/* ── Blobs animés en arrière-plan ── */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden>
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-blue-400/25 blur-3xl"
              animate={{ x: [0, 24, 0], y: [0, -12, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -right-20 bottom-32 h-80 w-80 rounded-full bg-amber-300/20 blur-3xl"
              animate={{ x: [0, -18, 0], y: [0, 16, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
              style={{ backgroundColor: `${NAVY}1a` }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : null}
      </div>

      <PremiumHeader />

      <main className="relative z-[1] pb-20 pt-24 md:pt-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* ════════════════════════════════════════════════════════════
              SECTION 1 : BIENVENUE + STATS + CARTE DU BÉNIN
              ════════════════════════════════════════════════════════════ */}
          <motion.section
            className="mb-16"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            {/* ── Bienvenue ── */}
            <div className="text-center mb-10">
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
                className="mb-3 text-4xl font-extrabold tracking-tight md:text-5xl"
                style={{ color: NAVY }}
              >
                Bienvenue sur {BRAND.name}
              </motion.h1>
              <motion.p
                variants={heroItem}
                className="mx-auto max-w-2xl text-lg text-slate-600"
              >
                {BRAND.subtitle}. Pilotage, suivi et aide à la décision pour les établissements du Bénin.
              </motion.p>
              <motion.p
                variants={heroItem}
                className="mt-1 text-base font-medium text-slate-500"
              >
                {BRAND.slogan}
              </motion.p>
            </div>

            {/* ── Bande tricolore Bénin (Vert / Jaune / Rouge) ── */}
            <motion.div variants={heroItem} className="mb-8">
              <div className="mx-auto flex h-1.5 w-40 overflow-hidden rounded-full">
                <div className="flex-1 bg-green-600" />
                <div className="flex-1" style={{ backgroundColor: GOLD }} />
                <div className="flex-1 bg-red-600" />
              </div>
            </motion.div>

            {/* ── Filtres cycle ── */}
            <motion.div variants={heroItem} className="mb-6 flex justify-center">
              <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm">
                {[
                  { key: 'all' as FilterType, label: 'Tous' },
                  { key: 'public' as FilterType, label: 'Public' },
                  { key: 'private' as FilterType, label: 'Privé' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMapFilter(tab.key)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      mapFilter === tab.key
                        ? 'text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                    style={
                      mapFilter === tab.key
                        ? { background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }
                        : undefined
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* ── Stats globales ── */}
            <motion.div
              variants={heroItem}
              className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-2xl mx-auto"
            >
              {[
                {
                  icon: <GraduationCap className="h-6 w-6" style={{ color: GOLD }} />,
                  label: 'APPRENANTS',
                  value: formatNumber(BENIN_TOTALS.students),
                },
                {
                  icon: <Users className="h-6 w-6" style={{ color: GOLD }} />,
                  label: 'ENSEIGNANTS',
                  value: formatNumber(BENIN_TOTALS.teachers),
                },
                {
                  icon: <School className="h-6 w-6" style={{ color: GOLD }} />,
                  label: 'ÉCOLES',
                  value: formatNumber(BENIN_TOTALS.schools),
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.3 + i * 0.08, duration: dur }}
                  className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-center shadow-md"
                  style={{ boxShadow: `0 0 0 1px ${GOLD}15` }}
                >
                  <div className="mb-2 flex justify-center">{stat.icon}</div>
                  <p className="text-2xl font-extrabold" style={{ color: NAVY }}>
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* ── Carte interactive du Bénin ── */}
            <motion.div
              variants={heroItem}
              className="rounded-3xl border border-slate-200/60 bg-white/95 p-6 md:p-8 shadow-xl backdrop-blur-sm"
              style={{ boxShadow: `0 0 0 1px ${GOLD}10, 0 8px 32px rgba(30,58,95,0.08)` }}
            >
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: NAVY }}>
                    L&apos;éducation du Bénin en un coup d&apos;œil
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Cliquez sur un département pour voir les statistiques détaillées
                  </p>
                </div>
              </div>

              <BeninMap
                onDepartmentSelect={setSelectedDepartment}
                selectedDepartment={selectedDepartment}
                filter={mapFilter}
              />
            </motion.div>
          </motion.section>

          {/* ════════════════════════════════════════════════════════════
              SECTION 2 : TROIS AXES DU SIGE
              ════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.4, duration: dur }}
            className="mb-16"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
                Trois axes du pilotage éducatif
              </h2>
              <p className="mt-2 text-slate-500">
                {BRAND.name} vous accompagne à chaque étape de la gestion éducative
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {axes.map((axe, index) => {
                const Icon = axe.icon;
                return (
                  <motion.div
                    key={axe.title}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : 0.5 + index * 0.1,
                      duration: dur,
                    }}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : { y: -4, transition: cardSpring }
                    }
                    className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md hover:shadow-xl transition-shadow text-center"
                  >
                    <div
                      className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
                      style={{ background: axe.gradient }}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: axe.color }}>
                      {axe.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">{axe.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* ════════════════════════════════════════════════════════════
              SECTION 3 : SÉLECTION DU PORTAIL
              ════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.55, duration: dur }}
            className="mb-10"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
                Accéder à votre portail
              </h2>
              <p className="mt-2 text-slate-500">
                Sélectionnez votre espace sécurisé {BRAND.name}
              </p>
              <motion.div variants={heroItem} className="mt-4 flex justify-center">
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
                      : { scale: 1.03, boxShadow: '0 20px 40px rgba(245,179,53,0.35)' }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  transition={cardSpring}
                  className="group relative inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
                  title="Ouvrir la fenêtre : choisir une école puis saisir vos identifiants"
                >
                  <motion.span
                    animate={shouldReduceMotion ? undefined : { rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Code2 className="h-4 w-4" />
                  </motion.span>
                  <span>Mode Développement</span>
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                    DEV
                  </span>
                </motion.button>
              </motion.div>
            </div>

            {/* ── Dev Modal ── */}
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
                        <Code2 className="h-5 w-5 text-amber-500" />
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
                      Choisissez d&apos;abord l&apos;école (tenant), puis saisissez vos
                      identifiants pour vous connecter à l&apos;app avec ce contexte.
                    </p>
                    <form onSubmit={handleDevLogin} className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">École</label>
                        <select
                          value={selectedDevTenant?.id ?? ''}
                          onChange={(e) => {
                            const t = devTenants.find((x) => x.id === e.target.value);
                            setSelectedDevTenant(t ?? null);
                          }}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                          required
                        >
                          <option value="">— Choisir une école —</option>
                          {devTenantsLoading && <option disabled>Chargement…</option>}
                          {!devTenantsLoading &&
                            devTenants.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.schoolName || t.tenantName || t.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                        <input
                          type="email"
                          name={selectedDevTenant ? `email_${selectedDevTenant.id}` : 'email'}
                          autoComplete="email"
                          value={devEmail}
                          onChange={(e) => setDevEmail(e.target.value)}
                          placeholder="votre@email.com"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                          required
                        />
                        {selectedDevTenant &&
                          getSavedEmailForTenant(selectedDevTenant.tenantId || selectedDevTenant.id) && (
                            <p className="mt-1 text-xs text-slate-500">
                              Dernière connexion pour cet établissement (ce poste uniquement).
                            </p>
                          )}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
                        <input
                          type="password"
                          value={devPassword}
                          onChange={(e) => setDevPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
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
                          className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDevLoggingIn ? 'Connexion…' : 'Se connecter'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* ── Portal cards / School search ── */}
            <AnimatePresence mode="wait">
              {!selectedPortal ? (
                <motion.div
                  key="portal-grid"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10, transition: { duration: dur * 0.85 } }}
                  transition={{ duration: dur, ease: 'easeOut' }}
                  className="mx-auto mb-8 grid w-full max-w-lg grid-cols-1 gap-4 sm:max-w-none sm:gap-5 md:max-w-5xl md:grid-cols-2 lg:grid-cols-3 md:gap-6 xl:max-w-6xl"
                >
                  {portalCards.map((card, index) => {
                    const Icon = card.Icon;
                    return (
                      <motion.div
                        key={card.type}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: shouldReduceMotion ? 0 : 0.08 + index * 0.07,
                          duration: dur,
                          ease: 'easeOut',
                        }}
                        whileHover={shouldReduceMotion ? undefined : { y: -6, transition: cardSpring }}
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
                        className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md outline-none ring-slate-200/60 transition-shadow focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 hover:border-slate-300 hover:shadow-xl md:min-h-[220px] ${
                          index === 4 && portalCards.length % 3 !== 0
                            ? 'md:col-span-2 lg:col-span-1 md:mx-auto md:max-w-md lg:mx-0 lg:max-w-none'
                            : ''
                        }`}
                      >
                        <div className={`absolute left-0 top-0 h-1 w-full ${card.accentBar} opacity-90`} aria-hidden />
                        <div className="flex h-full flex-row items-center gap-4 p-5 sm:p-6 md:flex-col md:items-center md:justify-between md:px-8 md:py-7 md:text-center">
                          <motion.div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-inner sm:h-14 sm:w-14 ${card.iconBg} ring-1 ring-white/80 md:mb-1`}
                            whileHover={shouldReduceMotion ? undefined : { scale: 1.06, rotate: -2 }}
                            transition={cardSpring}
                          >
                            <Icon className={`h-6 w-6 sm:h-7 sm:w-7 ${card.iconColor}`} />
                          </motion.div>
                          <div className="min-w-0 flex-1 md:flex md:flex-1 md:flex-col md:items-center">
                            <h3 className="text-lg font-bold leading-snug" style={{ color: NAVY }}>
                              {card.title}
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">{card.subtitle}</p>
                            <div className={`mt-3 inline-flex min-h-[40px] items-center text-sm font-semibold md:mt-auto ${card.cta}`}>
                              <span>Accéder</span>
                              <motion.span className="ml-2 inline-flex" initial={false} whileHover={{ x: shouldReduceMotion ? 0 : 4 }}>
                                <ArrowRight className="h-4 w-4" aria-hidden />
                              </motion.span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="school-flow"
                  initial={shouldReduceMotion ? false : { opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: -20, transition: { duration: dur * 0.85 } }}
                  transition={{ duration: dur, ease: 'easeOut' }}
                  className="relative z-30 mx-auto max-w-2xl"
                >
                  <div className="overflow-visible rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-xl ring-1 ring-slate-200/40 backdrop-blur-sm">
                    <motion.button
                      type="button"
                      onClick={handleBack}
                      whileHover={shouldReduceMotion ? undefined : { x: -3 }}
                      className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                    >
                      <ArrowRight className="h-4 w-4 rotate-180" />
                      <span>Retour</span>
                    </motion.button>

                    <div className="mb-6">
                      <div className="mb-2 flex items-center gap-3">
                        {selectedPortal === 'PLATFORM' && (
                          <>
                            <Shield className="h-7 w-7 text-slate-700" />
                            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Portail Plateforme</h2>
                          </>
                        )}
                        {selectedPortal === 'PUBLIC' && (
                          <>
                            <Globe className="h-7 w-7 text-amber-600" />
                            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Portail Public</h2>
                          </>
                        )}
                        {selectedPortal === 'SCHOOL' && (
                          <>
                            <Building2 className="h-7 w-7 text-blue-600" />
                            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Portail École</h2>
                          </>
                        )}
                        {selectedPortal === 'TEACHER' && (
                          <>
                            <GraduationCap className="h-7 w-7 text-emerald-600" />
                            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Portail Enseignant</h2>
                          </>
                        )}
                        {selectedPortal === 'PARENT' && (
                          <>
                            <Users className="h-7 w-7 text-violet-600" />
                            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Portail Parents & Élèves</h2>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">Recherchez votre établissement pour continuer</p>
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
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                          transition={{ duration: dur, ease: 'easeOut' }}
                          className="mt-6"
                        >
                          <motion.button
                            type="button"
                            onClick={() => void handleContinue()}
                            whileHover={shouldReduceMotion ? undefined : { scale: 1.01, boxShadow: '0 12px 28px rgba(11,47,115,0.25)' }}
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-md transition-colors"
                            style={{ background: `linear-gradient(135deg, ${NAVY}, #144798)` }}
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
          </motion.section>

          {/* ════════════════════════════════════════════════════════════
              SECTION 4 : NOTRE MISSION + SÉCURITÉ
              ════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.7, duration: dur }}
            className="mb-10"
          >
            <div className="rounded-3xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
              <div className="px-8 py-12 md:px-16 md:py-16 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  Notre Mission
                </h2>
                <p className="text-slate-300 max-w-2xl mx-auto mb-6 text-lg">
                  L&apos;éducation est la clé d&apos;un avenir meilleur pour une jeunesse épanouie. {BRAND.name} accompagne les établissements du Bénin vers l&apos;excellence éducative grâce au numérique.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-8">
                  {[
                    { title: 'Développement des compétences pour l\'avenir', icon: '🎓' },
                    { title: 'Accès équitable à l\'éducation', icon: '⚖️' },
                    { title: 'Promotion de l\'épanouissement personnel', icon: '🌟' },
                  ].map((item) => (
                    <div key={item.title} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="text-3xl mb-2">{item.icon}</div>
                      <p className="text-sm font-medium text-white/90">{item.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── Badge sécurité ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.8, duration: dur }}
            className="mt-10 flex justify-center"
          >
            <div
              className="relative z-0 inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-5 py-2.5 text-sm text-slate-600 shadow-sm backdrop-blur-sm"
              style={{ boxShadow: `0 0 0 1px ${GOLD}22` }}
            >
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>Vous êtes sur un portail officiel sécurisé {BRAND.name}</span>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
