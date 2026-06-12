/**
 * ============================================================================
 * PORTAL ACCESS PAGE — ACCÉDER À UN PORTAIL
 * ============================================================================
 *
 * Page centrale pour accéder aux différents portails Academia Helm.
<<<<<<< HEAD
 * Design professionnel et compact avec :
 * - Hero section immersive avec gradient Navy→Blue
 * - Tuiles portail compactes en grille horizontale (5 portails)
 * - Modal de sélection d'établissement (SchoolSearch)
 * - Carte interactive du Bénin intégrée avec données gouvernementales
 * - Statistiques nationales en bandeau
 *
 * Palette Academia Helm : Navy (#0b2f73) / Blue (#1d4fa5) / Gold (#f5b335)
 *
=======
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
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
  School,
  TrendingUp,
  Sparkles,
  Globe,
  Lock,
=======
  Search,
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumHeader from '@/components/layout/PremiumHeader';
import SchoolSearch from '@/components/portal/SchoolSearch';
import BeninMap from '@/components/portal/BeninMap';
<<<<<<< HEAD
import {
  BENIN_DEPARTMENTS,
  BENIN_TOTALS,
  BENIN_SECONDAIRE_TOTALS,
  type DepartmentData,
} from '@/data/benin-departments';
=======
import { type DepartmentData } from '@/data/benin-departments';
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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

<<<<<<< HEAD
/** Palette Academia Helm */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';
const NAVY_DARK = '#071d4a';
=======
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
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)

export default function PortalPage() {
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentData | null>(null);
  const [mapFilter, setMapFilter] = useState<'all' | 'public' | 'private'>('all');
<<<<<<< HEAD
  const [showSchoolModal, setShowSchoolModal] = useState(false);
=======
  const [showSchoolSearch, setShowSchoolSearch] = useState(false);
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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

<<<<<<< HEAD
  // ── Motion variants ──────────────────────────────────────────────────
  const heroVariants = useMemo(
    () => ({
      hidden: { opacity: shouldReduceMotion ? 1 : 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: shouldReduceMotion ? 0 : 0.07,
          delayChildren: shouldReduceMotion ? 0 : 0.08,
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

  const tileSpring = useMemo(
=======
  const cardSpring = useMemo(
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
    () => ({
      type: 'spring' as const,
      stiffness: shouldReduceMotion ? 500 : 300,
      damping: shouldReduceMotion ? 50 : 22,
    }),
    [shouldReduceMotion],
  );

  const modalMotion = getModalMotion(shouldReduceMotion);
<<<<<<< HEAD

  // ── Portal tiles data (compact) ──────────────────────────────────────
  const portalTiles: { type: PortalType; title: string; subtitle: string; Icon: typeof Building2; accent: string; iconBg: string; badge?: string }[] = useMemo(
    () =>
      [
        {
          type: 'SCHOOL' as PortalType,
          title: 'École',
          subtitle: 'Direction · Administration · Finances',
          Icon: Building2,
          accent: BLUE,
          iconBg: `${BLUE}12`,
        },
        {
          type: 'TEACHER' as PortalType,
          title: 'Enseignant',
          subtitle: 'Pédagogie · Notes · Suivi',
          Icon: GraduationCap,
          accent: GOLD,
          iconBg: `${GOLD}12`,
        },
        {
          type: 'PARENT' as PortalType,
          title: 'Parent / Élève',
          subtitle: 'Suivi · Paiements · Communication',
          Icon: Users,
          accent: NAVY,
          iconBg: `${NAVY}12`,
        },
        {
          type: 'PLATFORM' as PortalType,
          title: 'Plateforme',
          subtitle: 'SaaS · Supervision globale',
          Icon: Shield,
          accent: NAVY_DARK,
          iconBg: `${NAVY}12`,
          badge: 'SaaS',
        },
        {
          type: 'PUBLIC' as PortalType,
          title: 'Public',
          subtitle: 'Pré-inscription · Informations',
          Icon: Globe,
          accent: GOLD,
          iconBg: `${GOLD}12`,
        },
      ],
    [],
  );

  // ── Portal metadata for modal header ─────────────────────────────────
  const portalMeta = useMemo(() => {
    switch (selectedPortal) {
      case 'SCHOOL':
        return {
          title: 'Portail École',
          description: 'Gérez votre établissement scolaire avec une suite complète d\'outils.',
          Icon: Building2,
          accent: BLUE,
        };
      case 'TEACHER':
        return {
          title: 'Portail Enseignant',
          description: 'Planifiez vos cours, suivez les progrès et gérez vos notes.',
          Icon: GraduationCap,
          accent: GOLD,
        };
      case 'PARENT':
        return {
          title: 'Portail Parent / Élève',
          description: 'Suivez la scolarité de vos enfants et communiquez avec l\'école.',
          Icon: Users,
          accent: NAVY,
        };
      case 'PLATFORM':
        return {
          title: 'Portail Plateforme',
          description: 'Pilotez Academia Helm et supervisez tous les établissements.',
          Icon: Shield,
          accent: NAVY_DARK,
        };
      case 'PUBLIC':
        return {
          title: 'Portail Public',
          description: 'Consultez les informations ou pré-inscrivez un enfant.',
          Icon: Globe,
          accent: GOLD,
        };
      default:
        return null;
    }
  }, [selectedPortal]);

  // ── Dev mode: load tenants ───────────────────────────────────────────
=======

  // ── Dev tenants loading ──
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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

<<<<<<< HEAD
  // ── Handlers ─────────────────────────────────────────────────────────
=======
  // ── Portal selection handler ──
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
  const handlePortalSelect = (portal: PortalType) => {
    setSelectedPortal(portal);
    setSelectedSchool(null);

<<<<<<< HEAD
    if (portal === 'PUBLIC') {
      // Public portal : nécessite aussi la sélection d'un établissement
      setShowSchoolModal(true);
      return;
    }

    setShowSchoolModal(true);
=======
    // Public portal : aucune authentification requise — pré-inscription directe
    if (portal === 'PUBLIC') {
      setShowSchoolSearch(true);
      return;
    }

    // Tous les autres portails nécessitent un tenant (multi-tenant strict)
    setShowSchoolSearch(true);
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
  };

  const handleSchoolSelect = (school: School | null) => {
    setSelectedSchool(school);
  };

  const handleContinue = async () => {
    if (selectedPortal === 'PLATFORM') {
<<<<<<< HEAD
      // Store school info for login page display
      if (typeof window !== 'undefined' && selectedSchool) {
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

=======
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
      window.location.href = `/jobs?school=${selectedSchool.slug}`;
=======
      // Conforme au document : pré-inscription & acquisition, aucune auth requise
      // Redirige vers la page publique de l'école pour pré-inscription
      window.location.href = `/public/pre-enrollment?school=${selectedSchool.slug}`;
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
    setSelectedPortal(null);
=======
    setShowSchoolSearch(false);
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
      const errMsg = error instanceof Error ? error.message : 'Impossible de se connecter';
      let userMessage = errMsg;
      if (errMsg.includes('timeout') || errMsg.includes('ne répond pas') || errMsg.includes('30 secondes')) {
        userMessage = 'Le serveur est en cours de démarrage. Veuillez réessayer dans quelques secondes.';
      } else if (errMsg.includes('Internal server error') || errMsg.includes('500')) {
        userMessage = 'Erreur serveur temporaire. Veuillez réessayer dans quelques instants.';
      } else if (errMsg.includes('Unauthorized') || errMsg.includes('401')) {
=======
      const msg = error instanceof Error ? error.message : 'Impossible de se connecter';
      let userMessage = msg;
      if (msg.includes('timeout') || msg.includes('ne répond pas') || msg.includes('30 secondes')) {
        userMessage = 'Le serveur est en cours de démarrage. Veuillez réessayer dans quelques secondes.';
      } else if (msg.includes('Internal server error') || msg.includes('500')) {
        userMessage = 'Erreur serveur temporaire. Veuillez réessayer dans quelques instants.';
      } else if (msg.includes('Unauthorized') || msg.includes('401')) {
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
        userMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
      }
      alert(`Erreur: ${userMessage}`);
    } finally {
      setIsDevLoggingIn(false);
    }
  };

<<<<<<< HEAD
  // ── Computed values ──────────────────────────────────────────────────
  const totalSchools = BENIN_TOTALS.schools + BENIN_SECONDAIRE_TOTALS.schools;
  const totalStudents = BENIN_TOTALS.students + BENIN_SECONDAIRE_TOTALS.students;
  const totalTeachers = BENIN_TOTALS.teachers + BENIN_SECONDAIRE_TOTALS.teachers;
=======
  // ── Selected portal info for modal ──
  const activePortalDef = PORTAL_DEFINITIONS.find((p) => p.type === selectedPortal);
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
<<<<<<< HEAD
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/60 text-slate-900">
      {/* ── Animated background ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {!shouldReduceMotion ? (
          <>
            <motion.div
              className="absolute -left-32 top-0 h-[600px] w-[600px] rounded-full blur-3xl opacity-20"
              style={{ backgroundColor: NAVY }}
              animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full blur-3xl opacity-15"
              style={{ backgroundColor: BLUE }}
              animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/4 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-3xl opacity-10"
              style={{ backgroundColor: GOLD }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.18, 0.1] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
=======
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
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* ── Hero Section ── */}
          <motion.div
            className="mb-10 text-center"
            variants={heroVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={heroItem}>
              <span
                className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  color: NAVY,
                  borderColor: `${GOLD}55`,
                  background: `linear-gradient(90deg, ${GOLD}18, ${GOLD}30)`,
                }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: GOLD }} />
                Portails sécurisés
              </span>
            </motion.div>
            <motion.h1
              variants={heroItem}
              className="mb-3 text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"
              style={{ color: NAVY }}
            >
              Accédez à votre{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${BLUE}, ${GOLD})`,
                }}
              >
                espace
              </span>
            </motion.h1>
            <motion.p
              variants={heroItem}
              className="mx-auto max-w-xl text-base text-slate-600"
            >
              Sélectionnez votre portail sécurisé {BRAND.name} pour gérer votre activité éducative.
            </motion.p>
          </motion.div>

          {/* ── Portal Tiles Grid ── */}
          <motion.div
            variants={heroVariants}
            initial="hidden"
            animate="show"
            className="mb-10"
          >
            <motion.div
              variants={heroItem}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
            >
              {portalTiles.map((tile, index) => {
                const Icon = tile.Icon;
                return (
                  <motion.button
                    key={tile.type}
                    type="button"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : 0.15 + index * 0.05,
                      duration: dur,
                      ease: 'easeOut',
                    }}
                    whileHover={shouldReduceMotion ? undefined : { y: -4, transition: tileSpring }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                    onClick={() => handlePortalSelect(tile.type)}
                    className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-5 text-center shadow-sm outline-none transition-all hover:shadow-lg hover:border-slate-300/80 focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                  >
                    {/* Top accent bar */}
                    <div
                      className="absolute left-0 top-0 h-[3px] w-full rounded-t-2xl"
                      style={{ background: `linear-gradient(90deg, ${tile.accent}, ${tile.accent}88)` }}
                      aria-hidden
                    />
                    {/* Hover glow */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{ background: `radial-gradient(ellipse at 50% 30%, ${tile.accent}08, transparent 70%)` }}
                    />
                    {/* Icon */}
                    <div
                      className="relative flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-white/60"
                      style={{ background: tile.iconBg }}
                    >
                      <Icon className="h-6 w-6" style={{ color: tile.accent }} />
                      {tile.badge && (
                        <span
                          className="absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                        >
                          {tile.badge}
                        </span>
                      )}
                    </div>
                    {/* Title */}
                    <h3
                      className="text-sm font-bold leading-tight"
                      style={{ color: NAVY }}
                    >
                      {tile.title}
                    </h3>
                    {/* Subtitle */}
                    <p className="text-[10px] leading-relaxed text-slate-500 max-w-[140px]">
                      {tile.subtitle}
                    </p>
                    {/* Arrow indicator */}
                    <div
                      className="absolute bottom-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ background: `${tile.accent}15` }}
                    >
                      <ArrowRight className="h-3 w-3" style={{ color: tile.accent }} />
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>

          {/* ── National Stats Banner ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.3, duration: dur, ease: 'easeOut' }}
            className="mb-10 mx-auto max-w-3xl"
          >
            <div
              className="rounded-2xl border border-white/30 p-4 backdrop-blur-sm"
              style={{
                background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200 mb-3 flex items-center justify-center gap-2">
                <School className="h-4 w-4" style={{ color: GOLD }} />
                Éducation au Bénin — Année 2025-2026
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-extrabold text-white">
                    {new Intl.NumberFormat('fr-FR').format(totalSchools)}
                  </p>
                  <p className="text-[11px] font-medium text-blue-200 uppercase tracking-wide">Écoles</p>
                  <div className="mt-1 flex justify-center gap-1.5 text-[9px] text-blue-300">
                    <span>Primaire: {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.schools)}</span>
                    <span>·</span>
                    <span>Sec.: {new Intl.NumberFormat('fr-FR').format(BENIN_SECONDAIRE_TOTALS.schools)}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-extrabold text-white">
                    {new Intl.NumberFormat('fr-FR').format(totalStudents)}
                  </p>
                  <p className="text-[11px] font-medium text-blue-200 uppercase tracking-wide">Apprenants</p>
                  <div className="mt-1 flex justify-center gap-1.5 text-[9px] text-blue-300">
                    <span>Primaire: {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.students)}</span>
                    <span>·</span>
                    <span>Sec.: {new Intl.NumberFormat('fr-FR').format(BENIN_SECONDAIRE_TOTALS.students)}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-extrabold" style={{ color: GOLD }}>
                    {new Intl.NumberFormat('fr-FR').format(totalTeachers)}
                  </p>
                  <p className="text-[11px] font-medium text-blue-200 uppercase tracking-wide">Enseignants</p>
                  <div className="mt-1 flex justify-center gap-1.5 text-[9px] text-blue-300">
                    <span>Primaire: {new Intl.NumberFormat('fr-FR').format(BENIN_TOTALS.teachers)}</span>
                    <span>·</span>
                    <span>Sec.: {new Intl.NumberFormat('fr-FR').format(BENIN_SECONDAIRE_TOTALS.teachers)}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Benin Map Section ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.35, duration: dur, ease: 'easeOut' }}
            className="mb-10"
          >
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg overflow-hidden">
              {/* Section header */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold tracking-tight" style={{ color: NAVY }}>
                    L&apos;éducation au Bénin
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cliquez sur un département pour voir les statistiques
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" style={{ color: GOLD }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    12 départements
                  </span>
                </div>
              </div>

              {/* Status filter tabs */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Statut</span>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]">
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

              {/* Data source */}
              <p className="mt-3 text-center text-[9px] text-slate-400">
                Données : MEMP (emp.educmaster.bj) · MESTFP (secondaire.educmaster.bj) · 2025-2026
              </p>
            </div>
          </motion.div>

          {/* ── Security Badge + Dev Button ── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.5, duration: dur }}
            className="flex flex-col items-center gap-3"
          >
            <div
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-5 py-2.5 text-sm text-slate-600 shadow-sm backdrop-blur-sm"
              style={{ boxShadow: `0 0 0 1px ${GOLD}22` }}
            >
              <Lock className="h-4 w-4" style={{ color: NAVY }} />
=======
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
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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

<<<<<<< HEAD
      {/* ── School Selection Modal ── */}
      <AnimatePresence>
        {showSchoolModal && selectedPortal && portalMeta ? (
          <motion.div
            key="school-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`Sélection d'établissement — ${portalMeta.title}`}
=======
      {/* ── MODAL : Recherche d'établissement ── */}
      <AnimatePresence>
        {showSchoolSearch && selectedPortal ? (
          <motion.div
            key="school-search-overlay"
            role="presentation"
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
<<<<<<< HEAD
            transition={{ duration: dur * 0.7 }}
            onClick={handleCloseModal}
          >
            <motion.div
              key="school-modal-card"
              className="relative w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-2xl"
              {...modalMotion}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal header */}
              <div className="mb-6 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: `${portalMeta.accent}12` }}
                >
                  <portalMeta.Icon className="h-6 w-6" style={{ color: portalMeta.accent }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: NAVY }}>
                    {portalMeta.title}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Recherchez votre établissement pour continuer
                  </p>
                </div>
=======
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
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
=======
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                    transition={{ duration: dur, ease: 'easeOut' }}
                    className="mt-5"
                  >
                    <motion.button
                      type="button"
                      onClick={() => void handleContinue()}
<<<<<<< HEAD
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.01, boxShadow: `0 12px 28px ${NAVY}35` }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-md transition-colors"
                      style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                    >
                      <span>Continuer vers la connexion</span>
=======
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
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                      <ArrowRight className="h-5 w-5" />
                    </motion.button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

<<<<<<< HEAD
              {/* Security note */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                <Lock className="h-3 w-3" />
                <span>Connexion chiffrée et sécurisée</span>
              </div>
=======
              {/* Back link */}
              <button
                type="button"
                onClick={handleBack}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                <span>Retour à la sélection du portail</span>
              </button>
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

<<<<<<< HEAD
      {/* ── Dev Panel Modal ── */}
=======
      {/* ── MODAL : Mode développement ── */}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
              className="relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl"
=======
              className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"
              style={{
                borderColor: `${NAVY}18`,
                boxShadow: `0 24px 48px -12px ${NAVY}20, 0 0 0 1px ${GOLD}14`,
              }}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
              {...modalMotion}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
<<<<<<< HEAD
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Code2 className="h-5 w-5" style={{ color: GOLD }} />
                  Connexion développement
                </h3>
                <button
                  type="button"
=======
                <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: NAVY }}>
                  <Code2 className="h-5 w-5" style={{ color: GOLD }} />
                  Connexion en mode développement
                </h3>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                  onClick={handleDevPanelClose}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
<<<<<<< HEAD
                </button>
              </div>
              <p className="mb-4 text-sm text-slate-600">
                Choisissez d&apos;abord l&apos;école (tenant), puis saisissez vos identifiants.
              </p>
              <form onSubmit={handleDevLogin} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">École</label>
=======
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
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                  <select
                    value={selectedDevTenant?.id ?? ''}
                    onChange={(e) => {
                      const t = devTenants.find((x) => x.id === e.target.value);
                      setSelectedDevTenant(t ?? null);
                    }}
<<<<<<< HEAD
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-offset-1"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
=======
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2"
                    style={{
                      borderColor: `${NAVY}25`,
                      '--tw-ring-color': `${NAVY}30`,
                    } as React.CSSProperties}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
<<<<<<< HEAD
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
=======
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Email
                  </label>
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                  <input
                    type="email"
                    name={selectedDevTenant ? `email_${selectedDevTenant.id}` : 'email'}
                    autoComplete="email"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    placeholder="votre@email.com"
<<<<<<< HEAD
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-offset-1"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
=======
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2"
                    style={{
                      borderColor: `${NAVY}25`,
                      '--tw-ring-color': `${NAVY}30`,
                    } as React.CSSProperties}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                    required
                  />
                  {selectedDevTenant &&
                    getSavedEmailForTenant(selectedDevTenant.tenantId || selectedDevTenant.id) && (
                      <p className="mt-1 text-xs text-slate-500">
<<<<<<< HEAD
                        Dernière connexion pour cet établissement.
=======
                        Dernière connexion pour cet établissement (ce poste uniquement).
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                      </p>
                    )}
                </div>
                <div>
<<<<<<< HEAD
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
=======
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Mot de passe
                  </label>
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                  <input
                    type="password"
                    value={devPassword}
                    onChange={(e) => setDevPassword(e.target.value)}
                    placeholder="••••••••"
<<<<<<< HEAD
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-offset-1"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
=======
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2"
                    style={{
                      borderColor: `${NAVY}25`,
                      '--tw-ring-color': `${NAVY}30`,
                    } as React.CSSProperties}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDevPanelClose}
<<<<<<< HEAD
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
=======
                    className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    style={{ borderColor: `${NAVY}20` }}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isDevLoggingIn}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
<<<<<<< HEAD
                    style={{ background: `linear-gradient(135deg, ${GOLD}, #e09e2a)` }}
=======
                    style={{
                      background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                    }}
>>>>>>> a633e1f0 (52218ec6-f87f-425f-a6d6-8e4710cb1fbb)
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
