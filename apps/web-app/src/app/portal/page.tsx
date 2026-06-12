/**
 * ============================================================================
 * PORTAL ACCESS PAGE — ACCÉDER À UN PORTAIL
 * ============================================================================
 *
 * Page centrale pour accéder aux différents portails Academia Helm.
 * Conforme au document academia-helm-portails.md :
 *   - 5 portails : PLATFORM (7 rôles), SCHOOL (45 rôles),
 *     TEACHER (11 rôles), PARENT/ÉLÈVE (9 rôles), PUBLIC (5 rôles)
 *   - Palette Helm exclusive : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335
 *   - Grille compacte 3+2 (aucune couleur par portail, palette unifiée)
 *   - Multi-tenant strict (tenant obligatoire sauf Public)
 *   - Modèle RBAC 7 dimensions (portal, role, function, accreditations,
 *     levelScopes, classScopes, permissions)
 *
 * NE PAS TOUCHER à BeninMap — carte du Bénin intacte.
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
  Globe,
  Code2,
  X,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumHeader from '@/components/layout/PremiumHeader';
import SchoolSearch from '@/components/portal/SchoolSearch';
import BeninMap from '@/components/portal/BeninMap';
import { type DepartmentData } from '@/data/benin-departments';
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

/** ── Palette Academia Helm — Conforme charte ── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/**
 * Définition des 5 portails — conforme au document academia-helm-portails.md
 * Chaque portail indique le nombre de rôles et la description exacte du document.
 */
const PORTAL_DEFINITIONS = [
  {
    type: 'PLATFORM' as const,
    title: 'Plateforme',
    roleCount: 7,
    description: 'Administration SaaS globale',
    Icon: Shield,
  },
  {
    type: 'SCHOOL' as const,
    title: 'École',
    roleCount: 45,
    description: 'Gestion de l\'établissement',
    Icon: Building2,
  },
  {
    type: 'TEACHER' as const,
    title: 'Enseignant',
    roleCount: 11,
    description: 'Pédagogie & suivi',
    Icon: GraduationCap,
  },
  {
    type: 'PARENT' as const,
    title: 'Parent / Élève',
    roleCount: 9,
    description: 'Suivi & communication',
    Icon: Users,
  },
  {
    type: 'PUBLIC' as const,
    title: 'Public',
    roleCount: 5,
    description: 'Pré-inscription & acquisition',
    Icon: Globe,
  },
] as const;

export default function PortalPage() {
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentData | null>(null);
  const [mapFilter, setMapFilter] = useState<'all' | 'public' | 'private'>('all');
  const [showSchoolSearch, setShowSchoolSearch] = useState(false);
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

  const cardSpring = useMemo(
    () => ({
      type: 'spring' as const,
      stiffness: shouldReduceMotion ? 500 : 300,
      damping: shouldReduceMotion ? 50 : 22,
    }),
    [shouldReduceMotion],
  );

  const modalMotion = getModalMotion(shouldReduceMotion);

  // ── Dev tenants loading ──
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
  }, [devPanelOpen, devTenants.length]);

  useEffect(() => {
    if (!selectedDevTenant) {
      setDevEmail('');
      return;
    }
    const tenantKey = selectedDevTenant.tenantId || selectedDevTenant.id;
    const lastEmail = getSavedEmailForTenant(tenantKey);
    setDevEmail(lastEmail || '');
  }, [selectedDevTenant?.id]);

  // ── Portal selection handler ──
  const handlePortalSelect = (portal: PortalType) => {
    setSelectedPortal(portal);
    setSelectedSchool(null);

    // Public portal : aucune authentification requise — pré-inscription directe
    if (portal === 'PUBLIC') {
      setShowSchoolSearch(true);
      return;
    }

    // Tous les autres portails nécessitent un tenant (multi-tenant strict)
    setShowSchoolSearch(true);
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

    // Store school info for login page display
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          'academia_portal_school',
          JSON.stringify({
            name: selectedSchool.name,
            logoUrl: selectedSchool.logoUrl || null,
            city: selectedSchool.city || null,
            schoolType: selectedSchool.schoolType || null,
          }),
        );
      } catch { /* ignore */ }
    }

    if (selectedPortal === 'PUBLIC') {
      // Conforme au document : pré-inscription & acquisition, aucune auth requise
      // Redirige vers la page publique de l'école pour pré-inscription
      window.location.href = `/public/pre-enrollment?school=${selectedSchool.slug}`;
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

  const handleCloseModal = () => {
    setShowSchoolModal(false);
    setSelectedSchool(null);
    setShowSchoolSearch(false);
  };

  const handleCloseSchoolSearch = () => {
    setShowSchoolSearch(false);
    setSelectedPortal(null);
    setSelectedSchool(null);
  };

  // ── Dev login handlers ──
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
          portalType: 'PLATFORM',
          expiresAt: selectData.expiresAt,
        });
        saveEmailForTenant(devEmail.trim(), tenantId);
        await redirectToTenant({
          tenantSlug: selectedDevTenant.slug || tenantId,
          tenantId,
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
        portalType: 'SCHOOL',
        expiresAt: data.expiresAt,
      });
      saveEmailForTenant(devEmail.trim(), tenantId);
      await redirectToTenant({
        tenantSlug: selectedDevTenant.slug || tenantId,
        tenantId,
        path: '/app',
      });
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
    } finally {
      setIsDevLoggingIn(false);
    }
  };

  // ── Selected portal info for modal ──
  const activePortalDef = PORTAL_DEFINITIONS.find((p) => p.type === selectedPortal);

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/80 text-slate-900">
      {/* ── Background blobs ── */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.3]" aria-hidden>
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-24 top-24 h-72 w-72 rounded-full blur-3xl"
              style={{ backgroundColor: `${NAVY}30` }}
              animate={{ x: [0, 24, 0], y: [0, -12, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -right-20 bottom-32 h-80 w-80 rounded-full blur-3xl"
              style={{ backgroundColor: `${GOLD}25` }}
              animate={{ x: [0, -18, 0], y: [0, 16, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
              style={{ backgroundColor: `${BLUE}20` }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : (
          <>
            <div className="absolute -left-32 top-0 h-[600px] w-[600px] rounded-full blur-3xl opacity-20" style={{ backgroundColor: NAVY }} />
            <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full blur-3xl opacity-15" style={{ backgroundColor: BLUE }} />
            <div className="absolute left-1/2 top-1/4 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-3xl opacity-10" style={{ backgroundColor: GOLD }} />
          </>
        )}
      </div>

      <PremiumHeader />

      <main className="relative z-[1] pb-20 pt-24 md:pt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          {/* ── Hero compact ── */}
          <motion.div
            className="mb-10 text-center"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur, ease: 'easeOut' }}
          >
            <span
              className="mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{
                color: NAVY,
                borderColor: `${GOLD}66`,
                background: `linear-gradient(90deg, ${GOLD}22, ${GOLD}3d)`,
              }}
            >
              <Shield className="h-3.5 w-3.5" />
              Portails sécurisés
            </span>
            <h1
              className="mb-2 text-3xl font-extrabold tracking-tight md:text-4xl"
              style={{ color: NAVY }}
            >
              Accéder à votre portail
            </h1>
            <p className="mx-auto max-w-xl text-base text-slate-600">
              Sélectionnez votre espace sécurisé {BRAND.name}. {BRAND.subtitle}.
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {BRAND.slogan}
            </p>

            {/* Dev mode button */}
            <div className="mt-5 flex justify-center">
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
                    : { scale: 1.03, boxShadow: `0 16px 32px ${GOLD}40` }
                }
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={cardSpring}
                className="group relative inline-flex items-center gap-2 rounded-xl border-2 px-5 py-2.5 text-sm font-semibold shadow-lg"
                style={{
                  borderColor: GOLD,
                  background: `linear-gradient(135deg, ${GOLD}, #e6a020)`,
                  color: NAVY,
                }}
                title="Ouvrir la fenêtre : choisir une école puis saisir vos identifiants"
              >
                <Code2 className="h-4 w-4" />
                <span>Mode Développement</span>
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                  DEV
                </span>
              </motion.button>
            </div>
          </motion.div>

          {/* ── Layout : Portal grid + BeninMap ── */}
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            {/* ── Colonne gauche : Grille portails compacte ── */}
            <div className="lg:w-[55%]">
              {/* Grille 3+2 compacte */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {PORTAL_DEFINITIONS.map((portal, index) => {
                  const Icon = portal.Icon;
                  const isActive = selectedPortal === portal.type;
                  return (
                    <motion.button
                      key={portal.type}
                      type="button"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: shouldReduceMotion ? 0 : 0.06 + index * 0.06,
                        duration: dur,
                        ease: 'easeOut',
                      }}
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : {
                              y: -3,
                              boxShadow: `0 12px 28px ${NAVY}20`,
                              transition: cardSpring,
                            }
                      }
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                      onClick={() => handlePortalSelect(portal.type)}
                      className="group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center outline-none transition-all sm:p-5"
                      style={{
                        borderColor: isActive ? GOLD : `${NAVY}20`,
                        background: isActive
                          ? `linear-gradient(135deg, ${NAVY}10, ${BLUE}08, ${GOLD}0a)`
                          : `linear-gradient(135deg, ${NAVY}06, ${BLUE}04)`,
                        boxShadow: isActive
                          ? `0 0 0 2px ${GOLD}50, 0 8px 20px ${NAVY}15`
                          : `0 1px 3px ${NAVY}08`,
                      }}
                    >
                      {/* Glassmorphism overlay */}
                      <div
                        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
                        style={{
                          background: `linear-gradient(135deg, ${NAVY}0a, ${BLUE}08, ${GOLD}06)`,
                        }}
                        aria-hidden
                      />

                      {/* Icon container */}
                      <motion.div
                        className="relative flex h-12 w-12 items-center justify-center rounded-xl sm:h-14 sm:w-14"
                        style={{
                          background: `linear-gradient(135deg, ${NAVY}18, ${BLUE}12)`,
                          boxShadow: `0 2px 8px ${NAVY}12`,
                        }}
                        whileHover={
                          shouldReduceMotion ? undefined : { scale: 1.08, rotate: -3 }
                        }
                        transition={cardSpring}
                      >
                        <Icon
                          className="h-6 w-6 sm:h-7 sm:w-7"
                          style={{ color: NAVY }}
                        />
                      </motion.div>

                      {/* Title */}
                      <h3
                        className="text-sm font-bold leading-tight sm:text-base"
                        style={{ color: NAVY }}
                      >
                        {portal.title}
                      </h3>

                      {/* Role count badge */}
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]"
                        style={{
                          color: NAVY,
                          background: `${GOLD}25`,
                          border: `1px solid ${GOLD}40`,
                        }}
                      >
                        {portal.roleCount} rôles
                      </span>

                      {/* Description (compact) */}
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">
                        {portal.description}
                      </p>

                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="portal-active-indicator"
                          className="absolute -bottom-0.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full"
                          style={{ backgroundColor: GOLD }}
                          transition={cardSpring}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Lien vers la recherche si portail sélectionné */}
              <AnimatePresence>
                {selectedPortal && !showSchoolSearch && (
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: dur, ease: 'easeOut' }}
                    className="mt-4"
                  >
                    <button
                      type="button"
                      onClick={() => setShowSchoolSearch(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                      }}
                    >
                      <Search className="h-4 w-4" />
                      <span>
                        {selectedPortal === 'PUBLIC'
                          ? 'Rechercher un établissement pour la pré-inscription'
                          : 'Rechercher votre établissement'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Colonne droite : Carte du Bénin (INTACTE) ── */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: shouldReduceMotion ? 0 : 0.3, duration: dur, ease: 'easeOut' }}
              className="lg:w-[45%]"
            >
              <div
                className="rounded-2xl border bg-white p-5 shadow-lg"
                style={{ borderColor: `${NAVY}18` }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: NAVY }}
                  >
                    Carte du Bénin
                  </h3>
                  <div
                    className="flex overflow-hidden rounded-lg border text-xs"
                    style={{ borderColor: `${NAVY}20` }}
                  >
                    {(['all', 'public', 'private'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setMapFilter(f)}
                        className="px-3 py-1.5 font-medium transition-colors"
                        style={
                          mapFilter === f
                            ? { background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`, color: '#fff' }
                            : { color: NAVY }
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
          </div>

          {/* ── Footer sécurité ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.25, duration: dur }}
            className="relative z-0 mt-12 flex justify-center"
          >
            <div
              className="relative z-0 inline-flex items-center gap-2 rounded-full border bg-white/90 px-5 py-2.5 text-sm text-slate-600 shadow-sm backdrop-blur-sm"
              style={{ borderColor: `${NAVY}15`, boxShadow: `0 0 0 1px ${GOLD}14` }}
            >
              <Shield className="h-4 w-4" style={{ color: NAVY }} />
              <span>
                Vous êtes sur un portail officiel sécurisé {BRAND.name}
              </span>
            </div>
            {/* Dev mode: discreet button */}
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDevPanelOpen();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white/60 px-3 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-all"
                title="Mode développement"
              >
                <Code2 className="h-3 w-3" />
                DEV
              </button>
            )}
          </motion.div>
        </div>
      </main>

      {/* ── MODAL : Recherche d'établissement ── */}
      <AnimatePresence>
        {showSchoolSearch && selectedPortal ? (
          <motion.div
            key="school-search-overlay"
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur * 0.6 }}
            onClick={handleCloseSchoolSearch}
          >
            <motion.div
              key="school-search-modal"
              className="relative w-full max-w-lg rounded-2xl border bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-8"
              style={{
                borderColor: `${NAVY}18`,
                boxShadow: `0 24px 48px -12px ${NAVY}20, 0 0 0 1px ${GOLD}14`,
              }}
              {...modalMotion}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${NAVY}18, ${BLUE}12)`,
                    }}
                  >
                    {activePortalDef && (
                      <activePortalDef.Icon className="h-5 w-5" style={{ color: NAVY }} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: NAVY }}>
                      {activePortalDef?.title || 'Portail'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {selectedPortal === 'PUBLIC'
                        ? 'Pré-inscription — aucune authentification requise'
                        : 'Recherchez votre établissement pour continuer'}
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={handleCloseSchoolSearch}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* School Search */}
              <SchoolSearch
                onSchoolSelect={handleSchoolSelect}
                selectedSchool={selectedSchool}
                portalType={selectedPortal}
              />

              {/* Continue button */}
              <AnimatePresence>
                {selectedSchool ? (
                  <motion.div
                    key="continue-btn"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
                    transition={{ duration: dur, ease: 'easeOut' }}
                    className="mt-5"
                  >
                    <motion.button
                      type="button"
                      onClick={() => void handleContinue()}
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : { scale: 1.01, boxShadow: `0 12px 28px ${NAVY}25` }
                      }
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                      }}
                    >
                      <span>
                        {selectedPortal === 'PUBLIC'
                          ? 'Accéder à la pré-inscription'
                          : 'Continuer vers la connexion'}
                      </span>
                      <ArrowRight className="h-5 w-5" />
                    </motion.button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Back link */}
              <button
                type="button"
                onClick={handleBack}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                <span>Retour à la sélection du portail</span>
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── MODAL : Mode développement ── */}
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
              className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"
              style={{
                borderColor: `${NAVY}18`,
                boxShadow: `0 24px 48px -12px ${NAVY}20, 0 0 0 1px ${GOLD}14`,
              }}
              {...modalMotion}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: NAVY }}>
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
                Choisissez d&apos;abord l&apos;école (tenant), puis saisissez vos
                identifiants pour vous connecter à l&apos;app avec ce contexte.
              </p>
              <form onSubmit={handleDevLogin} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    École
                  </label>
                  <select
                    value={selectedDevTenant?.id ?? ''}
                    onChange={(e) => {
                      const t = devTenants.find((x) => x.id === e.target.value);
                      setSelectedDevTenant(t ?? null);
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2"
                    style={{
                      borderColor: `${NAVY}25`,
                      '--tw-ring-color': `${NAVY}30`,
                    } as React.CSSProperties}
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name={selectedDevTenant ? `email_${selectedDevTenant.id}` : 'email'}
                    autoComplete="email"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2"
                    style={{
                      borderColor: `${NAVY}25`,
                      '--tw-ring-color': `${NAVY}30`,
                    } as React.CSSProperties}
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={devPassword}
                    onChange={(e) => setDevPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2"
                    style={{
                      borderColor: `${NAVY}25`,
                      '--tw-ring-color': `${NAVY}30`,
                    } as React.CSSProperties}
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDevPanelClose}
                    className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    style={{ borderColor: `${NAVY}20` }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isDevLoggingIn}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                    }}
                  >
                    {isDevLoggingIn ? 'Connexion…' : 'Se connecter'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
