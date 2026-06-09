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
 * Layout inspiré du screenshot EducMaster :
 * 1. Hero navy foncé : Bienvenue + filtres cycle + stats
 * 2. Axes SIE : cartes navy foncé
 * 3. Partenaires
 * 4. Carte Bénin : section claire avec filtres + carte interactive
 * 5. Sélection portail : cartes compactes
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
  Handshake,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
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
type CycleFilterType = 'all' | 'maternelle' | 'ci-cp' | 'ce' | 'cm';

interface SchoolData {
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
const NAVY_DEEP = '#0a1628';
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#e4c978';

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export default function PortalPage() {
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(null);
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentData | null>(null);
  const [mapFilter, setMapFilter] = useState<FilterType>('all');
  const [cycleFilter, setCycleFilter] = useState<CycleFilterType>('all');
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devTenants, setDevTenants] = useState<DevTenant[]>([]);
  const [devTenantsLoading, setDevTenantsLoading] = useState(false);
  const [selectedDevTenant, setSelectedDevTenant] = useState<DevTenant | null>(null);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);
  const { redirectToTenant } = useTenantRedirect();
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
          title: 'Plateforme',
          subtitle: 'Administration SaaS',
          Icon: Shield,
          iconBg: 'from-slate-700/30 to-slate-800/20',
          iconColor: 'text-white',
          accentBg: NAVY_DARK,
        },
        {
          type: 'SCHOOL' as const,
          title: 'École',
          subtitle: 'Direction & Finances',
          Icon: Building2,
          iconBg: 'from-blue-500/30 to-blue-600/20',
          iconColor: 'text-blue-200',
          accentBg: '#1a4a8a',
        },
        {
          type: 'TEACHER' as const,
          title: 'Enseignant',
          subtitle: 'Pédagogie & Notes',
          Icon: GraduationCap,
          iconBg: 'from-emerald-500/30 to-emerald-600/20',
          iconColor: 'text-emerald-200',
          accentBg: '#1a5a4a',
        },
        {
          type: 'PARENT' as const,
          title: 'Parent / Élève',
          subtitle: 'Suivi & Paiements',
          Icon: Users,
          iconBg: 'from-violet-500/30 to-violet-600/20',
          iconColor: 'text-violet-200',
          accentBg: '#4a1a6a',
        },
        {
          type: 'PUBLIC' as const,
          title: 'Public',
          subtitle: 'Admissions & Infos',
          Icon: Globe,
          iconBg: 'from-amber-500/30 to-amber-600/20',
          iconColor: 'text-amber-200',
          accentBg: '#6a4a1a',
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
        gradient: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`,
      },
      {
        icon: Compass,
        title: 'Piloter',
        description: 'Écoles, ressources humaines, planning',
        gradient: `linear-gradient(135deg, ${NAVY_DARK}, #0a2550)`,
      },
      {
        icon: Lightbulb,
        title: 'Décider',
        description: 'Indicateurs clés, tableaux de bord, rapports',
        gradient: `linear-gradient(135deg, #0D3B85, ${NAVY_DARK})`,
      },
    ],
    [],
  );

  /* ── Partenaires ── */
  const partners = useMemo(
    () => [
      {
        name: 'Budget National',
        subtitle: 'Bénin',
        icon: '🇧🇯',
      },
      {
        name: 'PME',
        subtitle: 'Partenaire Financier',
        icon: '🏦',
      },
      {
        name: 'UNICEF',
        subtitle: 'Partenaire Technique',
        icon: '🤝',
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

  const handleSchoolSelect = (school: SchoolData | null) => {
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
    <div className="relative min-h-screen overflow-hidden text-slate-900">

      <PremiumHeader />

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1 : HERO NAVY FONCÉ — Bienvenue + Cycle + Stats
          ════════════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden pb-12 pt-28 md:pb-16 md:pt-32"
        style={{ background: `linear-gradient(160deg, ${NAVY_DEEP} 0%, ${NAVY_DARK} 40%, ${NAVY} 100%)` }}
      >
        {/* Blobs décoratifs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {!shouldReduceMotion ? (
            <>
              <motion.div
                className="absolute -left-20 top-20 h-64 w-64 rounded-full opacity-20"
                style={{ backgroundColor: GOLD }}
                animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -right-16 bottom-16 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl"
                animate={{ x: [0, -15, 0], y: [0, 12, 0] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
              />
            </>
          ) : null}
        </div>

        <div className="relative z-[1] mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            {/* Bienvenue */}
            <div className="mb-8 text-center">
              <motion.h1
                variants={heroItem}
                className="mb-2 text-3xl font-extrabold tracking-tight text-white md:text-5xl"
              >
                Bienvenue sur {BRAND.name}
              </motion.h1>
              <motion.p
                variants={heroItem}
                className="mx-auto max-w-xl text-base text-slate-300 md:text-lg"
              >
                {BRAND.subtitle}. Pilotage, suivi et aide à la décision pour l&apos;enseignement maternel et primaire du Bénin.
              </motion.p>

              {/* Bande tricolore Bénin */}
              <motion.div variants={heroItem} className="mt-4 flex justify-center">
                <div className="flex h-1 w-32 overflow-hidden rounded-full">
                  <div className="flex-1 bg-green-500" />
                  <div className="flex-1" style={{ backgroundColor: GOLD }} />
                  <div className="flex-1 bg-red-500" />
                </div>
              </motion.div>
            </div>

            {/* Cycle d'enseignement + Filtres */}
            <motion.div variants={heroItem} className="mb-6 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Cycle d&apos;enseignement
              </p>
              <div className="inline-flex flex-wrap justify-center gap-2">
                {[
                  { key: 'all' as CycleFilterType, label: 'Tous' },
                  { key: 'maternelle' as CycleFilterType, label: 'Maternelle' },
                  { key: 'ci-cp' as CycleFilterType, label: 'CI-CP' },
                  { key: 'ce' as CycleFilterType, label: 'CE' },
                  { key: 'cm' as CycleFilterType, label: 'CM' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setCycleFilter(tab.key)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      cycleFilter === tab.key
                        ? 'bg-white text-slate-900 shadow-md'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Stats globales */}
            <motion.div
              variants={heroItem}
              className="mb-4 flex flex-wrap items-end justify-center gap-6 md:gap-10"
            >
              {[
                { label: 'Apprenants', value: formatNumber(BENIN_TOTALS.students) },
                { label: 'Enseignants', value: formatNumber(BENIN_TOTALS.teachers) },
                { label: 'Écoles', value: formatNumber(BENIN_TOTALS.schools) },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.3 + i * 0.08, duration: dur }}
                  className="text-center"
                >
                  <p className="text-3xl font-extrabold text-white md:text-4xl">{stat.value}</p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Explorer les données */}
            <motion.div variants={heroItem} className="text-center">
              <button
                onClick={() => {
                  const mapSection = document.getElementById('benin-map-section');
                  mapSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-transform hover:scale-105"
              >
                Explorer les données
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 2 : TROIS AXES DU SIE — Cartes navy foncé
          ════════════════════════════════════════════════════════════════════════ */}
      <section
        className="py-10 md:py-14"
        style={{ background: `linear-gradient(180deg, ${NAVY_DARK}, ${NAVY_DEEP})` }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.2, duration: dur }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
          >
            {axes.map((axe, index) => {
              const Icon = axe.icon;
              return (
                <motion.div
                  key={axe.title}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: shouldReduceMotion ? 0 : 0.3 + index * 0.1,
                    duration: dur,
                  }}
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : { y: -4, transition: cardSpring }
                  }
                  className="group rounded-2xl p-6 text-center shadow-lg transition-shadow hover:shadow-xl"
                  style={{ background: axe.gradient }}
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{axe.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{axe.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3 : PARTENAIRES
          ════════════════════════════════════════════════════════════════════════ */}
      <section
        className="py-8 md:py-10"
        style={{ background: NAVY_DEEP }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.4, duration: dur }}
          >
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
              Avec le soutien de
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
              {partners.map((partner, index) => (
                <motion.div
                  key={partner.name}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: shouldReduceMotion ? 0 : 0.45 + index * 0.08,
                    duration: dur,
                  }}
                  className="flex items-center gap-3 rounded-xl bg-white/5 px-5 py-4"
                >
                  <span className="text-2xl">{partner.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{partner.name}</p>
                    <p className="text-xs text-slate-400">{partner.subtitle}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 4 : CARTE INTERACTIVE DU BÉNIN
          ════════════════════════════════════════════════════════════════════════ */}
      <section
        id="benin-map-section"
        className="bg-gradient-to-br from-slate-50 via-white to-blue-50/80 py-12 md:py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.5, duration: dur }}
          >
            {/* Titre + filtres */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold md:text-2xl" style={{ color: NAVY }}>
                  L&apos;éducation du Bénin en un coup d&apos;œil
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cliquez sur un département pour voir les statistiques détaillées
                </p>
              </div>
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
            </div>

            {/* Carte */}
            <div
              className="rounded-3xl border border-slate-200/60 bg-white/95 p-4 shadow-xl backdrop-blur-sm md:p-6"
              style={{ boxShadow: `0 0 0 1px ${GOLD}10, 0 8px 32px rgba(30,58,95,0.08)` }}
            >
              <BeninMap
                onDepartmentSelect={setSelectedDepartment}
                selectedDepartment={selectedDepartment}
                filter={mapFilter}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 5 : SÉLECTION DU PORTAIL — Cartes compactes
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-slate-50 via-white to-blue-50/80 pb-16 pt-8 md:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.6, duration: dur }}
          >
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
                Accéder à votre portail
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Sélectionnez votre espace sécurisé {BRAND.name}
              </p>
              <motion.div className="mt-3 flex justify-center">
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
                  className="group relative inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-lg"
                  title="Ouvrir la fenêtre : choisir une école puis saisir vos identifiants"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Mode Dev</span>
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 py-0.5 text-[8px] font-bold text-white shadow-md">
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
                  className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5 lg:gap-5"
                >
                  {portalCards.map((card, index) => {
                    const Icon = card.Icon;
                    return (
                      <motion.div
                        key={card.type}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: shouldReduceMotion ? 0 : 0.08 + index * 0.06,
                          duration: dur,
                          ease: 'easeOut',
                        }}
                        whileHover={shouldReduceMotion ? undefined : { y: -4, transition: cardSpring }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                        onClick={() => handlePortalSelect(card.type)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePortalSelect(card.type);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="group relative cursor-pointer overflow-hidden rounded-xl p-4 text-center outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 hover:shadow-lg"
                        style={{ background: card.accentBg }}
                      >
                        <div
                          className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.iconBg}`}
                        >
                          <Icon className={`h-5 w-5 ${card.iconColor}`} />
                        </div>
                        <h3 className="text-sm font-bold text-white leading-tight">{card.title}</h3>
                        <p className="mt-0.5 text-[11px] text-slate-300 leading-snug">{card.subtitle}</p>
                        <div className="mt-2 inline-flex items-center text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
                          <span>Accéder</span>
                          <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
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
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 6 : MISSION + SÉCURITÉ
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="pb-10 pt-4 md:pb-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.7, duration: dur }}
          >
            <div className="rounded-3xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
              <div className="px-8 py-10 md:px-16 md:py-12 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Notre Mission
                </h2>
                <p className="text-slate-300 max-w-2xl mx-auto mb-5">
                  L&apos;éducation est la clé d&apos;un avenir meilleur pour une jeunesse épanouie. {BRAND.name} accompagne les établissements du Bénin vers l&apos;excellence éducative grâce au numérique.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  {[
                    { title: 'Développement des compétences pour l\'avenir', icon: '🎓' },
                    { title: 'Accès équitable à l\'éducation', icon: '⚖️' },
                    { title: 'Promotion de l\'épanouissement personnel', icon: '🌟' },
                  ].map((item) => (
                    <div key={item.title} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <p className="text-xs font-medium text-white/90">{item.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Badge sécurité */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.8, duration: dur }}
            className="mt-6 flex justify-center"
          >
            <div
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-5 py-2 text-sm text-slate-600 shadow-sm"
              style={{ boxShadow: `0 0 0 1px ${GOLD}22` }}
            >
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>Vous êtes sur un portail officiel sécurisé {BRAND.name}</span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
