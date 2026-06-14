/**
 * ============================================================================
 * PILOTAGE SIDEBAR - NAVIGATION PAR DOMAINES MÉTIER
 * ============================================================================
 * 
 * Navigation orientée "domaines métier", pas par écrans techniques.
 * S'adapte au niveau scolaire, aux modules activés, au rôle utilisateur.
 * 
 * Design V2 : Palette officielle Academia Helm
 *   - Base : blue-900 (#0A2A5E) / blue-800 (#0D3B85)
 *   - Accent : gold-500 (#F2C94C) / gold-600 (#CFA63A)
 *   - Texte : white / blue-200 / blue-300
 * 
 * Philosophie : Résumer avant de détailler
 * ============================================================================
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calculator,
  BookOpen,
  UserCheck,
  Building,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Network,
  Library,
  Bus,
  UtensilsCrossed,
  HeartPulse,
  ShieldCheck,
  Radio,
  ShoppingBag,
  Brain,
  Calendar,
  Settings,
  Globe,
  Briefcase,
  CreditCard,
  Zap,
  ShieldAlert,
  HelpCircle,
  History,
  Lock,
  PieChart,
  BarChart3,
  Compass,
} from 'lucide-react';
import type { User } from '@/types';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useEnabledFeatureCodes } from '@/hooks/useEnabledFeatureCodes';
import { getPortalForRole, getVisibleModulesForRole } from '@/lib/auth/role-portal-map';

/**
 * Construit l'URL de la landing page (domaine principal sans sous-domaine).
 * En local : même origine. En prod : retire le sous-domaine du host.
 */
function getLandingPageUrl(): string {
  if (typeof window === 'undefined') return '/';
  try {
    const { hostname, protocol, port } = window.location;
    // Local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    }
    // Production / Preview : extraire le domaine principal
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (baseDomain) {
      const clean = baseDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `https://${clean}`;
    }
    // Fallback : retirer la première partie si >= 3 segments
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const main = parts.slice(1).join('.');
      return port ? `${protocol}//${main}:${port}` : `${protocol}//${main}`;
    }
    return `${protocol}//${hostname}${port ? ':' + port : ''}`;
  } catch {
    return '/';
  }
}

/**
 * URL de la landing page avec marqueur ?from_app=true
 * pour que le header public affiche "Retourner à l'application".
 * Inclut aussi l'URL de retour pour que le bouton puisse renvoyer vers l'app.
 */
function getLandingPageUrlFromApp(): string {
  const base = getLandingPageUrl();
  const sep = base.includes('?') ? '&' : '?';
  // Construire l'URL de retour vers l'application courante
  let returnUrl = '';
  if (typeof window !== 'undefined') {
    returnUrl = `${window.location.origin}/app`;
  }
  const returnParam = returnUrl ? `&return_url=${encodeURIComponent(returnUrl)}` : '';
  return `${base}${sep}from_app=true${returnParam}`;
}

/**
 * Filtre un module en fonction de sa visibilité par accréditation.
 * Mapping chemin → catégorie de visibilité.
 */
function filterModuleByVisibility(
  path: string,
  visibility: ReturnType<typeof getVisibleModulesForRole>,
): boolean {
  if (path.startsWith('/app/platform')) return visibility.showPlatformModules;
  if (path.startsWith('/app/orion') || path.startsWith('/app/meetings') || path.startsWith('/app/general'))
    return visibility.showDirectionModules;
  if (path.startsWith('/app/finance')) return visibility.showFinanceModules;
  if (path.startsWith('/app/pedagogy') || path.startsWith('/app/aggregation'))
    return visibility.showPedagogyModules;
  if (path.startsWith('/app/hr')) return visibility.showHrModules;
  if (path.startsWith('/app/communication')) return visibility.showCommunicationModules;
  if (path.startsWith('/app/students')) return visibility.showStudentModules;
  if (path.startsWith('/app/exams')) return visibility.showExamModules;
  if (path.startsWith('/app/settings')) return visibility.showSettingsModules;
  // Supplementary modules
  if (path.startsWith('/app/library') || path.startsWith('/app/transport') ||
      path.startsWith('/app/canteen') || path.startsWith('/app/infirmary') ||
      path.startsWith('/app/qhse') || path.startsWith('/app/educast') ||
      path.startsWith('/app/shop'))
    return visibility.showSupplementaryModules;
  // Dashboard always visible
  if (path === '/app') return true;
  return true;
}

interface PilotageSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user?: User;
  mobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
}

/** Mapping path → featureCode (optionnel). Sans featureCode = toujours affiché. */
const MAIN_MODULES = [
  { path: '/app', label: 'Tableau de pilotage', icon: LayoutDashboard },
  { path: '/app/orion', label: 'ORION — Pilotage Direction', icon: Zap, featureCode: 'ORION', roles: ['SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'CENSEUR', 'director', 'admin'] },
  { path: '/app/meetings', label: 'Réunions', icon: Calendar },
  { path: '/app/students', label: 'Élèves & Scolarité', icon: Users, featureCode: 'STUDENTS', roles: ['SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SCOLARITE', 'admin'] },
  { path: '/app/finance', label: 'Finances & Économat', icon: Calculator, featureCode: 'FINANCE', roles: ['SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_BILLING', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'CAISSIER', 'COMPTABLE', 'ECONOME', 'DIRECTEUR_GENERAL', 'accountant', 'admin'] },
  { path: '/app/exams', label: 'Examens, Notes & Bulletins', icon: BookOpen, featureCode: 'EXAMS', roles: ['SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'CENSEUR', 'TEACHER', 'TEACHER_RESP', 'admin'] },
  { path: '/app/aggregation', label: 'Agrégation & Décision', icon: BarChart3, featureCode: 'AGGREGATION', roles: ['SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'director', 'admin'] },
  { path: '/app/pedagogy', label: 'Organisation Pédagogique', icon: Building, featureCode: 'PEDAGOGY' },
  { path: '/app/hr', label: 'Personnel, RH & Paie', icon: UserCheck, featureCode: 'HR_PAYROLL', roles: ['SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SCOLARITE', 'admin'] },
  { path: '/app/communication', label: 'Communication', icon: MessageSquare, featureCode: 'COMMUNICATION' },
];

const PLATFORM_MODULES = [
  { path: '/app/platform', label: 'Tableau de bord global', icon: LayoutDashboard },
  { path: '/app/platform/tenants', label: 'Écoles / Tenants', icon: Building },
  { path: '/app/platform/initial-subscriptions', label: 'Souscriptions initiales', icon: Briefcase },
  { path: '/app/platform/subscriptions', label: 'Abonnements & Plans', icon: CreditCard },
  { path: '/app/platform/modules', label: 'Modules & Fonctions', icon: Zap },
  { path: '/app/platform/aggregation', label: 'Agrégation Globale', icon: BarChart3 },
  { path: '/app/platform/orion-pilotage', label: 'ORION-Pilotage Direction', icon: Zap },
  { path: '/app/platform/users', label: 'Utilisateurs plateforme', icon: Users },
  { path: '/app/platform/rbac', label: 'Rôles & Permissions', icon: Lock },
  { path: '/app/platform/billing', label: 'Facturation SaaS', icon: PieChart },
  { path: '/app/platform/payments', label: 'Paiements & Transactions', icon: CreditCard },
  { path: '/app/platform/support', label: 'Support & Tickets', icon: HelpCircle },
  { path: '/app/platform/monitoring', label: 'Incidents & Monitoring', icon: ShieldAlert },
  { path: '/app/platform/orion', label: 'ORION Global', icon: Brain },
  { path: '/app/platform/audit', label: 'Audit & Logs', icon: History },
  { path: '/app/platform/settings', label: 'Paramètres plateforme', icon: Settings },
];

const SUPPLEMENTARY_MODULES = [
  { path: '/app/library', label: 'Bibliothèque', icon: Library, featureCode: 'LIBRARY' },
  { path: '/app/transport', label: 'Transport', icon: Bus, featureCode: 'TRANSPORT' },
  { path: '/app/canteen', label: 'Cantine', icon: UtensilsCrossed, featureCode: 'CANTEEN' },
  { path: '/app/infirmary', label: 'Infirmerie', icon: HeartPulse, featureCode: 'INFIRMARY' },
  { path: '/app/qhse', label: 'QHSE', icon: ShieldCheck, featureCode: 'QHSE' },
  { path: '/app/educast', label: 'EduCast', icon: Radio, featureCode: 'EDUCAST' },
  { path: '/app/shop', label: 'Boutique', icon: ShoppingBag, featureCode: 'SHOP' },
];

export default function PilotageSidebar({
  isOpen,
  onToggle,
  user,
  mobileDrawerOpen = false,
  onCloseMobileDrawer,
}: PilotageSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantParam = searchParams.get('tenant');
  const { currentLevel } = useSchoolLevel();
  const { enabledSet, loading } = useEnabledFeatureCodes();
  const isSuperDirector =
    user?.role === 'SUPER_DIRECTOR' || 
    user?.role === 'PLATFORM_OWNER' || 
    user?.role === 'PLATFORM_SUPER_ADMIN' || 
    user?.role === 'SCHOOL_OWNER' || 
    user?.role === 'SCHOOL_ADMIN' ||
    user?.role === 'DIRECTEUR_GENERAL' ||
    user?.role === 'DIRECTEUR_ETABLISSEMENT' ||
    user?.role === 'director';
  const [mainModulesOpen, setMainModulesOpen] = useState(true);
  const [supplementaryModulesOpen, setSupplementaryModulesOpen] = useState(true);

  // ── Accreditation-based module visibility ──
  const moduleVisibility = useMemo(
    () => getVisibleModulesForRole(user?.role || ''),
    [user?.role],
  );

  const userPortal = useMemo(
    () => getPortalForRole(user?.role || ''),
    [user?.role],
  );

  const showModule = (featureCode?: string, roles?: string[]) => {
    const isFeatureEnabled = !featureCode || loading || enabledSet.has(featureCode);
    const isRoleAuthorized = !roles || !user?.role || roles.includes(user.role);
    return isFeatureEnabled && isRoleAuthorized;
  };

  const mainModules = useMemo(
    () => MAIN_MODULES.filter((m) => {
      const featureOk = !m.featureCode || loading || enabledSet.has(m.featureCode);
      const roleOk = !m.roles || !user?.role || (m.roles as string[]).includes(user.role);
      const accredOk = filterModuleByVisibility(m.path, moduleVisibility);
      return featureOk && roleOk && accredOk;
    }),
    [enabledSet, loading, user?.role, moduleVisibility],
  );

  const supplementaryModules = useMemo(
    () => SUPPLEMENTARY_MODULES.filter((m) => {
      const featureOk = !m.featureCode || loading || enabledSet.has(m.featureCode);
      const accredOk = filterModuleByVisibility(m.path, moduleVisibility);
      return featureOk && accredOk;
    }),
    [enabledSet, loading, moduleVisibility],
  );

  const platformModules = useMemo(
    () => PLATFORM_MODULES,
    [],
  );

  const isPlatformOwner =
    user?.role === 'PLATFORM_OWNER' ||
    user?.role === 'PLATFORM_SUPER_ADMIN';
  const isPlatformPortal = user?.portal === 'PLATFORM' || isPlatformOwner;

  // Module Général (Direction uniquement)
  const generalModule = isSuperDirector
    ? { path: '/app/general', label: 'Module Général', icon: Network }
    : null;

  const isActive = (path: string) => {
    if (path === '/app') {
      return pathname === '/app';
    }
    return pathname.startsWith(path);
  };

  // Fermer le drawer mobile à la navigation
  useEffect(() => {
    onCloseMobileDrawer?.();
  }, [pathname, onCloseMobileDrawer]);

  // Sur mobile drawer ou PC étendu : afficher les libellés
  const effectiveOpen = mobileDrawerOpen || isOpen;

  // ── Level display helpers ──
  const getLevelLabel = (code?: string) => {
    if (!code) return 'Tous les niveaux';
    if (code === 'ALL' || code === 'TOUS_LES_NIVEAUX') return 'Tous les niveaux';
    if (code === 'MATERNELLE') return 'Maternelle';
    if (code === 'PRIMAIRE') return 'Primaire';
    if (code === 'SECONDAIRE') return 'Secondaire';
    return code;
  };

  const getLevelColor = (code?: string) => {
    if (code === 'MATERNELLE') return 'from-pink-400 to-rose-400';
    if (code === 'PRIMAIRE') return 'from-emerald-400 to-green-400';
    if (code === 'SECONDAIRE') return 'from-violet-400 to-purple-400';
    return 'from-gold-400 to-gold-500';
  };

  // ── Render navigation item ──
  const renderNavItem = (item: { path: string; label: string; icon: any }, isGeneral = false) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    const href = tenantParam ? `${item.path}?tenant=${tenantParam}` : item.path;

    return (
      <Link
        key={item.path}
        href={href}
        onClick={onCloseMobileDrawer}
        className={`group relative flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
          active
            ? 'bg-white/[0.12] text-white shadow-lg shadow-black/10'
            : 'text-blue-200/80 hover:bg-white/[0.06] hover:text-white'
        }`}
        title={!effectiveOpen ? item.label : undefined}
      >
        {/* Active indicator — gold left bar */}
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-gold-400 to-gold-600 shadow-sm shadow-gold-500/40" />
        )}
        <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-all duration-200 ${
          active ? 'text-gold-400 scale-110' : 'text-blue-300/70 group-hover:text-blue-100 group-hover:scale-105'
        }`} />
        {effectiveOpen && (
          <span className={`text-[13px] transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
            active ? 'font-semibold text-white' : 'font-medium'
          }`} title={item.label}>{item.label}</span>
        )}
        {active && effectiveOpen && (
          <div className="ml-auto w-1.5 h-1.5 bg-gold-400 rounded-full flex-shrink-0 shadow-sm shadow-gold-400/60" />
        )}
        {/* Hover glow effect */}
        {!active && (
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
        )}
      </Link>
    );
  };

  // ── Render icon-only item (collapsed sidebar) ──
  const renderIconItem = (item: { path: string; label: string; icon: any }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    const href = tenantParam ? `${item.path}?tenant=${tenantParam}` : item.path;

    return (
      <Link
        key={item.path}
        href={href}
        onClick={onCloseMobileDrawer}
        className={`group relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] ${
          active
            ? 'bg-white/[0.12] text-white shadow-lg shadow-black/10'
            : 'text-blue-200/70 hover:bg-white/[0.06] hover:text-white'
        }`}
        title={item.label}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-gold-400 to-gold-600" />
        )}
        <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 ${
          active ? 'text-gold-400 scale-110' : 'group-hover:scale-110'
        }`} />
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* ── Branding Header ── */}
      <div className="px-4 py-4 border-b border-white/[0.08]">
        {effectiveOpen ? (
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20 flex-shrink-0">
              <Compass className="w-5 h-5 text-blue-900" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold text-white tracking-tight leading-none">
                Academia <span className="text-gold-400">Helm</span>
              </h1>
              <p className="text-[10px] text-blue-300/50 font-medium tracking-wider uppercase mt-0.5">Pilotage</p>
            </div>
            {/* Toggle button on desktop */}
            <button
              onClick={onToggle}
              className="hidden lg:flex ml-auto p-1.5 rounded-lg hover:bg-white/[0.08] transition-all duration-200 text-blue-300/60 hover:text-white min-h-[36px] min-w-[36px] items-center justify-center"
              aria-label="Réduire la barre latérale"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
              <Compass className="w-5 h-5 text-blue-900" />
            </div>
            <button
              onClick={onToggle}
              className="hidden lg:flex mt-3 p-1.5 rounded-lg hover:bg-white/[0.08] transition-all duration-200 text-blue-300/60 hover:text-white min-h-[36px] min-w-[36px] items-center justify-center"
              aria-label="Étendre la barre latérale"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile: bouton fermer en haut du drawer */}
      {onCloseMobileDrawer && (
        <div className="flex lg:hidden items-center justify-between px-4 py-2.5 border-b border-white/[0.08]">
          <span className="text-sm font-semibold text-white/80">Menu</span>
          <button
            onClick={onCloseMobileDrawer}
            className="p-2 rounded-lg hover:bg-white/[0.08] min-h-[44px] min-w-[44px] flex items-center justify-center text-blue-200"
            aria-label="Fermer le menu"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Modules Principaux */}
        <div className="mb-5">
          {effectiveOpen ? (
            <>
              <button
                type="button"
                onClick={() => setMainModulesOpen(!mainModulesOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group/section"
              >
                <span className="text-[10px] font-semibold text-blue-300/40 uppercase tracking-[0.15em]">
                  Modules principaux
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-blue-300/40 transition-transform duration-200 group-hover/section:text-blue-300/60 ${
                    mainModulesOpen ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
              {mainModulesOpen && (
                <div className="mt-1.5 space-y-0.5">
                  {mainModules.map((item) => renderNavItem(item))}
                </div>
              )}
            </>
          ) : (
            mainModules.map((item) => renderIconItem(item))
          )}
        </div>

        {/* Modules Plateforme (Administration Globale) */}
        {isPlatformPortal && (
          <div className="mb-5">
            {effectiveOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setMainModulesOpen(!mainModulesOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group/section"
                >
                  <span className="text-[10px] font-semibold text-blue-300/40 uppercase tracking-[0.15em]">
                    Administration Globale
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-blue-300/40 transition-transform duration-200 ${
                      mainModulesOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
                {mainModulesOpen && (
                  <div className="mt-1.5 space-y-0.5">
                    {platformModules.map((item) => renderNavItem(item))}
                  </div>
                )}
              </>
            ) : (
              platformModules.map((item) => renderIconItem(item))
            )}
          </div>
        )}

        {/* Module Général (Direction) */}
        {generalModule && (
          <div className="mb-5">
            {renderNavItem(generalModule, true)}
          </div>
        )}

        {/* Modules Supplémentaires */}
        <div className="mb-5">
          {effectiveOpen ? (
            <>
              <button
                type="button"
                onClick={() => setSupplementaryModulesOpen(!supplementaryModulesOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group/section"
              >
                <span className="text-[10px] font-semibold text-blue-300/40 uppercase tracking-[0.15em]">
                  Modules supplémentaires
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-blue-300/40 transition-transform duration-200 group-hover/section:text-blue-300/60 ${
                    supplementaryModulesOpen ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
              {supplementaryModulesOpen && (
                <div className="mt-1.5 space-y-0.5">
                  {supplementaryModules.map((item) => renderNavItem(item))}
                </div>
              )}
            </>
          ) : (
            supplementaryModules.map((item) => renderIconItem(item))
          )}
        </div>

        {/* ── Bottom Links ── */}
        <div className="mt-auto pt-3 border-t border-white/[0.06]">
          {/* Visiter le site public */}
          <Link
            href={typeof window !== 'undefined' ? getLandingPageUrlFromApp() : '/'}
            onClick={onCloseMobileDrawer}
            className="group flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-blue-200/60 hover:bg-white/[0.04] hover:text-white"
            title={!effectiveOpen ? 'Visiter le site' : undefined}
            {...(typeof window !== 'undefined' && getLandingPageUrl() !== '/' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <Globe className="w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {effectiveOpen && (
              <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1">Visiter le site</span>
            )}
          </Link>
          {/* Paramètres */}
          <Link
            href={tenantParam ? `/app/settings?tenant=${tenantParam}` : '/app/settings'}
            onClick={onCloseMobileDrawer}
            className={`group flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              isActive('/app/settings')
                ? 'bg-white/[0.12] text-white relative'
                : 'text-blue-200/60 hover:bg-white/[0.04] hover:text-white'
            }`}
            title={!effectiveOpen ? 'Paramètres' : undefined}
          >
            {isActive('/app/settings') && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-gold-400 to-gold-600" />
            )}
            <Settings className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 ${
              isActive('/app/settings') ? 'text-gold-400 scale-110' : 'group-hover:scale-105'
            }`} />
            {effectiveOpen && (
              <span className={`text-[13px] whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
                isActive('/app/settings') ? 'font-semibold' : 'font-medium'
              }`}>Paramètres</span>
            )}
            {isActive('/app/settings') && effectiveOpen && (
              <div className="ml-auto w-1.5 h-1.5 bg-gold-400 rounded-full flex-shrink-0" />
            )}
          </Link>
        </div>
      </nav>

      {/* ── Footer - Niveau actif ── */}
      <div className="border-t border-white/[0.06]">
        {effectiveOpen ? (
          <div className="p-4">
            <p className="text-[10px] font-semibold text-blue-300/40 uppercase tracking-[0.15em] mb-2.5">Niveau actif</p>
            {currentLevel ? (
              <div className="flex items-center space-x-3 bg-white/[0.05] rounded-xl px-3 py-2.5">
                <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${getLevelColor(currentLevel.code)} shadow-sm animate-pulse`} />
                <p className="text-sm font-semibold text-white">{getLevelLabel(currentLevel.code)}</p>
              </div>
            ) : (
              <div className="flex items-center space-x-3 bg-white/[0.05] rounded-xl px-3 py-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400/40" />
                <p className="text-sm font-medium text-blue-200/60">Non défini</p>
              </div>
            )}
          </div>
        ) : (
          currentLevel && (
            <div className="flex justify-center py-3">
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${getLevelColor(currentLevel.code)} shadow-sm animate-pulse`} title={getLevelLabel(currentLevel.code)} />
            </div>
          )
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Mobile : drawer overlay — z-[60] au-dessus de la TopBar (z-50) et du backdrop (z-[55]) */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 z-[60] lg:hidden flex flex-col bg-[#0A2A5E] text-white shadow-2xl transition-transform duration-300 ease-in-out ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-label="Menu de navigation"
        aria-hidden={!mobileDrawerOpen}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gold-500/[0.04] to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full">
          {sidebarContent}
        </div>
      </aside>

      {/* 2. Tablette : icônes seules (md → lg) */}
      <aside
        className="hidden md:flex lg:hidden fixed left-0 top-[56px] h-[calc(100vh-56px)] w-16 flex-col bg-[#0A2A5E] text-white z-40 shadow-xl"
        aria-label="Navigation raccourcie"
      >
        {/* Subtle side glow */}
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-gold-500/20 via-transparent to-transparent pointer-events-none" />
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 relative z-10">
          {mainModules.map((item) => renderIconItem(item))}
          {generalModule && (
            <Link
              href={tenantParam ? `${generalModule.path}?tenant=${tenantParam}` : generalModule.path}
              className={`group relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] ${
                isActive(generalModule.path)
                  ? 'bg-white/[0.12] text-white shadow-lg shadow-black/10'
                  : 'text-blue-200/70 hover:bg-white/[0.06] hover:text-white'
              }`}
              title={generalModule.label}
            >
              {isActive(generalModule.path) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-gold-400 to-gold-600" />
              )}
              <Network className={`w-[18px] h-[18px] flex-shrink-0 ${isActive(generalModule.path) ? 'text-gold-400' : ''}`} />
            </Link>
          )}
          {supplementaryModules.map((item) => renderIconItem(item))}
        </nav>
        <div className="relative z-10 border-t border-white/[0.06] py-2 space-y-0.5">
          <Link
            href={typeof window !== 'undefined' ? getLandingPageUrlFromApp() : '/'}
            className="flex items-center justify-center p-2.5 rounded-xl text-blue-200/60 hover:bg-white/[0.04] hover:text-white min-h-[44px] min-w-[44px]"
            title="Visiter le site"
            {...(typeof window !== 'undefined' && getLandingPageUrl() !== '/' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <Globe className="w-[18px] h-[18px] flex-shrink-0" />
          </Link>
          <Link
            href="/app/settings"
            className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] ${
              isActive('/app/settings')
                ? 'bg-white/[0.12] text-white'
                : 'text-blue-200/60 hover:bg-white/[0.04] hover:text-white'
            }`}
            title="Paramètres"
          >
            <Settings className={`w-[18px] h-[18px] flex-shrink-0 ${isActive('/app/settings') ? 'text-gold-400' : ''}`} />
          </Link>
        </div>
      </aside>

      {/* 3. PC : sidebar complète ou icônes (lg+) */}
      <aside
        className={`hidden lg:flex fixed left-0 top-[56px] h-[calc(100vh-56px)] bg-[#0A2A5E] text-white transition-all duration-300 ease-in-out z-40 shadow-xl flex-col ${
          isOpen ? 'w-64' : 'w-16'
        }`}
        aria-label="Navigation principale"
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-gold-500/[0.03] to-transparent pointer-events-none" />
        {/* Subtle left accent line */}
        <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-gold-500/10 via-transparent to-gold-500/5 pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
