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
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumHeader from '@/components/layout/PremiumHeader';
import SchoolSearch from '@/components/portal/SchoolSearch';
import BeninMap from '@/components/portal/BeninMap';
import { type DepartmentData } from '@/data/benin-departments';
import { useTenantRedirect } from '@/lib/hooks/useTenantRedirect';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { persistClientSession, markFreshLogin } from '@/lib/auth/client-access-token';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { getModalMotion, getMotionDuration } from '@/lib/motion/presets';
import { useFetchWithTimeout } from '@/lib/hooks/use-fetch-with-timeout';

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
    description: 'Administration SaaS globale',
    Icon: Shield,
  },
  {
    type: 'SCHOOL' as const,
    title: 'École',
    description: 'Gestion de l\'établissement',
    Icon: Building2,
  },
  {
    type: 'TEACHER' as const,
    title: 'Enseignant',
    description: 'Pédagogie & suivi',
    Icon: GraduationCap,
  },
  {
    type: 'PARENT' as const,
    title: 'Parent / Élève',
    description: 'Suivi & communication',
    Icon: Users,
  },
  {
    type: 'PUBLIC' as const,
    title: 'Public',
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
  const [isContinuing, setIsContinuing] = useState(false);
  const { redirectToTenant } = useTenantRedirect();
  const { shouldReduceMotion } = useMotionBudget();
  const { fetchWithTimeout } = useFetchWithTimeout();

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
      fetchWithTimeout('/api/auth/dev-available-tenants')
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
    if (!selectedPortal || !selectedSchool) return;

    setIsContinuing(true);

    try {
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
    } catch (error) {
      console.error('[Portal] Erreur lors de la redirection:', error);
      setIsContinuing(false);
    }
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
        return fetchWithTimeout('/api/auth/login', {
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
        const selectResp = await fetchWithTimeout('/api/auth/select-tenant', {
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
        markFreshLogin();
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
      markFreshLogin();
      await redirectToTenant({
        tenantSlug: selectedDevTenant.slug || tenantId,
        tenantId,
        path: '/app',
      });
    } catch (error: unknown) {
      console.error('[Dev Login] Error:', error);
      const msg = error instanceof Error ? error.message : 'Impossible de se connecter';
      let userMessage = msg;
      if (msg.includes('PORTAL_MISMATCH')) {
        const match = msg.match(/PORTAL_MISMATCH:\s*(.*)/);
        userMessage = match?.[1] || 'Ce compte n\'est pas autorisé sur ce portail. Veuillez utiliser le portail correspondant à votre profil.';
      } else if (msg.includes('timeout') || msg.includes('ne répond pas') || msg.includes('30 secondes')) {
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

      <main className="relative z-[1] pb-6 pt-16 sm:pt-20 md:pt-22">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">

          {/* ── Layout : BeninMap (majeur) + Portails (compact latéral) ── */}
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">

            {/* ── Colonne gauche : Carte du Bénin — espace majeur (INTACTE) ── */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: dur, ease: 'easeOut' }}
              className="w-full lg:w-[68%]"
            >
              <div
                className="rounded-xl border bg-white p-3 shadow-lg sm:p-4"
                style={{ borderColor: `${NAVY}18` }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: NAVY }}
                  >
                    Carte du Bénin — Données éducatives
                  </h3>
                  <div
                    className="flex overflow-hidden rounded-lg border text-xs sm:text-[10px]"
                    style={{ borderColor: `${NAVY}20` }}
                  >
                    {(['all', 'public', 'private'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setMapFilter(f)}
                        className="min-h-[44px] px-3 py-2 sm:px-2.5 sm:py-1 font-medium transition-colors"
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

            {/* ── Colonne droite : Panneau portails compact ── */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: shouldReduceMotion ? 0 : 0.1, duration: dur, ease: 'easeOut' }}
              className="w-full lg:w-[32%] flex flex-col gap-3"
            >
              {/* Titre compact */}
              <div className="text-center lg:text-left">
                <h1
                  className="text-xl font-extrabold tracking-tight sm:text-2xl"
                  style={{ color: NAVY }}
                >
                  Accéder à votre portail
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {BRAND.name} — {BRAND.subtitle}
                </p>
              </div>

              {/* Grille portails ultra-compacte — 1 colonne */}
              <div className="flex flex-col gap-2">
                {PORTAL_DEFINITIONS.map((portal, index) => {
                  const Icon = portal.Icon;
                  const isActive = selectedPortal === portal.type;
                  return (
                    <motion.button
                      key={portal.type}
                      type="button"
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: shouldReduceMotion ? 0 : 0.05 + index * 0.04,
                        duration: dur,
                        ease: 'easeOut',
                      }}
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : {
                              x: 3,
                              boxShadow: `0 6px 16px ${NAVY}18`,
                              transition: cardSpring,
                            }
                      }
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                      onClick={() => handlePortalSelect(portal.type)}
                      className="group relative flex items-center gap-3 rounded-xl border px-3 py-3 text-left outline-none transition-all min-h-[44px] sm:px-4 sm:py-3"
                      style={{
                        borderColor: isActive ? GOLD : `${NAVY}15`,
                        background: isActive
                          ? `linear-gradient(135deg, ${NAVY}0a, ${BLUE}06, ${GOLD}08)`
                          : `linear-gradient(135deg, ${NAVY}04, ${BLUE}02)`,
                        boxShadow: isActive
                          ? `0 0 0 2px ${GOLD}40, 0 4px 12px ${NAVY}10`
                          : `0 1px 2px ${NAVY}06`,
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: `linear-gradient(135deg, ${NAVY}14, ${BLUE}0c)`,
                        }}
                      >
                        <Icon className="h-4.5 w-4.5" style={{ color: NAVY }} />
                      </div>

                      {/* Texte */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className="text-sm font-bold leading-tight"
                            style={{ color: NAVY }}
                          >
                            {portal.title}
                          </h3>
                        </div>
                        <p className="mt-0.5 text-xs sm:text-[11px] leading-snug text-slate-500">
                          {portal.description}
                        </p>
                      </div>

                      {/* Flèche */}
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
                        style={isActive ? { color: GOLD } : undefined}
                      />

                      {/* Active indicator bar */}
                      {isActive && (
                        <motion.div
                          layoutId="portal-active-bar"
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl"
                          style={{ backgroundColor: GOLD }}
                          transition={cardSpring}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Lien recherche si portail sélectionné */}
              <AnimatePresence>
                {selectedPortal && !showSchoolSearch && (
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: dur, ease: 'easeOut' }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowSchoolSearch(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg min-h-[44px]"
                      style={{
                        background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                      }}
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>
                        {selectedPortal === 'PUBLIC'
                          ? 'Pré-inscription'
                          : 'Rechercher votre établissement'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer sécurité compact */}
              <div
                className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border bg-white/80 px-3 py-2 text-xs sm:text-[11px] text-slate-500 backdrop-blur-sm lg:justify-start"
                style={{ borderColor: `${NAVY}10` }}
              >
                <Shield className="h-3 w-3" style={{ color: NAVY }} />
                <span>Portail officiel sécurisé {BRAND.name}</span>
              </div>

              {/* Dev mode button — compact */}
              <div className="flex justify-center lg:justify-start">
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
                      : { scale: 1.02, boxShadow: `0 8px 20px ${GOLD}30` }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  transition={cardSpring}
                  className="group relative inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold shadow min-h-[44px]"
                  style={{
                    borderColor: GOLD,
                    background: `linear-gradient(135deg, ${GOLD}, #e6a020)`,
                    color: NAVY,
                  }}
                  title="Mode développement"
                >
                  <Code2 className="h-3 w-3" />
                  <span>DEV</span>
                  <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1 py-px text-[8px] font-bold text-white shadow-sm">
                    ⚡
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* ── MODAL : Recherche d'établissement ── */}
      <AnimatePresence>
        {showSchoolSearch && selectedPortal ? (
          <motion.div
            key="school-search-overlay"
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur * 0.6 }}
            onClick={handleCloseSchoolSearch}
          >
            <motion.div
              key="school-search-modal"
              className="relative w-full max-w-xl sm:max-w-2xl rounded-2xl border bg-white/95 p-4 shadow-2xl backdrop-blur-md sm:p-6 md:p-8 max-h-[92vh] sm:max-h-[85vh] overflow-y-auto"
              style={{
                borderColor: `${NAVY}18`,
                boxShadow: `0 24px 48px -12px ${NAVY}20, 0 0 0 1px ${GOLD}14`,
              }}
              {...modalMotion}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-4 sm:mb-5 flex items-start justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div
                    className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${NAVY}18, ${BLUE}12)`,
                    }}
                  >
                    {activePortalDef && (
                      <activePortalDef.Icon className="h-5 w-5" style={{ color: NAVY }} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold" style={{ color: NAVY }}>
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
                  className="rounded-lg p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
                      disabled={isContinuing}
                      whileHover={
                        isContinuing || shouldReduceMotion
                          ? undefined
                          : { scale: 1.01, boxShadow: `0 12px 28px ${NAVY}25` }
                      }
                      whileTap={isContinuing || shouldReduceMotion ? undefined : { scale: 0.99 }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-4 sm:px-6 py-3.5 font-semibold text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-80 min-h-[44px]"
                      style={{
                        background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                      }}
                    >
                      {isContinuing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Redirection en cours…</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {selectedPortal === 'PUBLIC'
                              ? 'Accéder à la pré-inscription'
                              : 'Continuer vers la connexion'}
                          </span>
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Back link */}
              <button
                type="button"
                onClick={handleCloseSchoolSearch}
                className="mt-3 sm:mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 min-h-[44px]"
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
              className="relative w-full max-w-md rounded-2xl border bg-white p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{
                borderColor: `${NAVY}18`,
                boxShadow: `0 24px 48px -12px ${NAVY}20, 0 0 0 1px ${GOLD}14`,
              }}
              {...modalMotion}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 sm:mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base sm:text-lg font-bold" style={{ color: NAVY }}>
                  <Code2 className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: GOLD }} />
                  <span className="hidden sm:inline">Connexion en mode développement</span>
                  <span className="sm:hidden">Mode DEV</span>
                </h3>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={handleDevPanelClose}
                  className="rounded-lg p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
              <p className="mb-3 sm:mb-4 text-sm text-slate-600">
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
                    className="w-full rounded-lg border px-3 py-2.5 min-h-[44px] text-sm focus:ring-2"
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
                    className="w-full rounded-lg border px-3 py-2.5 min-h-[44px] text-sm focus:ring-2"
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
                    className="w-full rounded-lg border px-3 py-2.5 min-h-[44px] text-sm focus:ring-2"
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
                    className="flex-1 rounded-lg border px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-700 hover:bg-slate-50"
                    style={{ borderColor: `${NAVY}20` }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isDevLoggingIn}
                    className="flex-1 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
