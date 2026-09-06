'use client';

/**
 * ============================================================================
 * ADMIN PORTAL SHELL — Factory de shells pour les portails administratifs
 * ============================================================================
 *
 * Un seul composant, six shells : directeur, secrétaire, secrétaire-comptable,
 * comptable, surveillant, censeur. Chaque portail fournit sa navigation ÉCRITE
 * EN DUR (admin-portal-map.ts), son thème et son libellé métier — exactement
 * le modèle des portails Enseignant (TeacherLayout) et Parent (ParentLayout).
 *
 * Ce que le shell garantit :
 *   - SA sidebar (w-64, responsive, drawer mobile) avec les modules du métier
 *   - SON thème (accent par portail) et SON badge de profil métier
 *   - SON tableau de bord d'accueil (la home du portail)
 *   - AUCUN filtrage par rôle : la navigation est déclarée, pas filtrée.
 *     Seuls restent appliqués les feature flags du TENANT (module activé ?)
 *     et la garde requiresSecondary (module lié au niveau Secondaire).
 *
 * Garde défensive (défense en profondeur) : si le rôle de session n'a pas
 * vocation sur ce portail (ex: session incohérente), écran d'accès réservé
 * puis redirection vers /app. En conditions normales, le layout racine ne
 * rend ce shell QUE pour les rôles du portail (getAdminShellForRole).
 *
 * Le contenu (children) est rendu tel quel : les pages métier partagées
 * (/app/pedagogy, /app/exams, /app/finance…) s'affichent dans le shell du
 * métier avec leurs propres sous-navigations — zéro duplication.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Brain, School, Users, GraduationCap, Shield,
  Wallet, UserCog, MessageSquare, CalendarDays, ClipboardCheck, Receipt,
  Building2, LogOut, Menu, X, Loader2, Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolIdentity } from '@/hooks/useSchoolIdentity';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useEnabledFeatureCodes } from '@/hooks/useEnabledFeatureCodes';
import { LogoutModal } from '@/components/auth/LogoutModal';
// ⭐ Double casquette : bascule instantanée vers l'UI Enseignant sans déconnexion
import PortalSwitchButton from '@/components/auth/PortalSwitchButton';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { LanguageSwitcher } from '@/contexts/I18nContext';
// ⭐ P4-final : coquille bilingue — un directeur anglophone voit son portail 100% EN
import { useL } from '@/lib/i18n/bilingual';
import AcademicYearSelector from '@/components/pilotage/AcademicYearSelector';
import SchoolLevelSelector from '@/components/pilotage/SchoolLevelSelector';
import AcademicTrackSelector from '@/components/pilotage/AcademicTrackSelector';
import {
  ADMIN_PORTALS,
  canRoleAccessAdminPortal,
  type AdminPortalAccent,
  type AdminPortalIcon,
} from '@/lib/auth/admin-portal-map';

// ─── Registre d'icônes (clés string sérialisables → composants lucide) ──────
// (exporté : réutilisé par AdminPortalHome pour les cartes d'accès rapide)

export const ICON_REGISTRY: Record<AdminPortalIcon, LucideIcon> = {
  LayoutDashboard,
  Brain,
  School,
  Users,
  GraduationCap,
  Shield,
  Wallet,
  UserCog,
  MessageSquare,
  CalendarDays,
  ClipboardCheck,
  Receipt,
};

// ─── Thèmes par accent (un métier = une couleur) ────────────────────────────

interface AccentTheme {
  active: string;
  avatar: string;
  avatarText: string;
  iconBg: string;
  iconText: string;
  logoBg: string;
  spinner: string;
}

const ACCENT_THEMES: Record<AdminPortalAccent, AccentTheme> = {
  indigo: {
    active: 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600',
    avatar: 'bg-indigo-600', avatarText: 'text-white',
    iconBg: 'bg-indigo-100', iconText: 'text-indigo-600',
    logoBg: 'bg-indigo-100', spinner: 'text-indigo-600',
  },
  sky: {
    active: 'bg-sky-50 text-sky-700 border-l-4 border-sky-600',
    avatar: 'bg-sky-600', avatarText: 'text-white',
    iconBg: 'bg-sky-100', iconText: 'text-sky-600',
    logoBg: 'bg-sky-100', spinner: 'text-sky-600',
  },
  emerald: {
    active: 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600',
    avatar: 'bg-emerald-600', avatarText: 'text-white',
    iconBg: 'bg-emerald-100', iconText: 'text-emerald-600',
    logoBg: 'bg-emerald-100', spinner: 'text-emerald-600',
  },
  teal: {
    active: 'bg-teal-50 text-teal-700 border-l-4 border-teal-600',
    avatar: 'bg-teal-600', avatarText: 'text-white',
    iconBg: 'bg-teal-100', iconText: 'text-teal-600',
    logoBg: 'bg-teal-100', spinner: 'text-teal-600',
  },
  amber: {
    active: 'bg-amber-50 text-amber-700 border-l-4 border-amber-600',
    avatar: 'bg-amber-600', avatarText: 'text-white',
    iconBg: 'bg-amber-100', iconText: 'text-amber-600',
    logoBg: 'bg-amber-100', spinner: 'text-amber-600',
  },
  violet: {
    active: 'bg-violet-50 text-violet-700 border-l-4 border-violet-600',
    avatar: 'bg-violet-600', avatarText: 'text-white',
    iconBg: 'bg-violet-100', iconText: 'text-violet-600',
    logoBg: 'bg-violet-100', spinner: 'text-violet-600',
  },
};

// ─── Composant ──────────────────────────────────────────────────────────────

export interface AdminPortalShellProps {
  /** Clé du portail ('director', 'secretaire', …) — sérialisable server→client */
  portalKey: keyof typeof ADMIN_PORTALS;
  children: React.ReactNode;
}

export default function AdminPortalShell({ portalKey, children }: AdminPortalShellProps) {
  const config = ADMIN_PORTALS[portalKey];
  const theme = ACCENT_THEMES[config.accent];

  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const { identity: school } = useSchoolIdentity();
  const { availableLevels } = useSchoolLevel();
  const { enabledSet, loading: featuresLoading } = useEnabledFeatureCodes();
  const pathname = usePathname();
  const router = useRouter();
  // ⭐ P4-final : libellés dans la langue du profil (piste EN → anglais)
  const L = useL();

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ─── Garde défensive : rôle sans vocation sur CE portail → /app ──────────
  // (En conditions normales, le layout racine ne rend ce shell que pour les
  //  rôles du portail — ceci couvre les sessions incohérentes.)
  const authorized = user ? canRoleAccessAdminPortal(user.role, config.key) : false;

  useEffect(() => {
    if (user && !authorized) {
      router.replace('/app');
    }
  }, [user, authorized, router]);

  // ─── Navigation du portail : modules déclarés + feature flags tenant ──────
  //    (AUCUN filtrage par rôle — la navigation est propre au métier.)
  const secondaryEnabled = availableLevels.some((l) => l.code === 'SECONDAIRE' && l.isActive);

  const modules = config.modules.filter((m) => {
    const featureOk = !m.featureCode || featuresLoading || enabledSet.has(m.featureCode);
    const secondaryOk = !m.requiresSecondary || secondaryEnabled;
    return featureOk && secondaryOk;
  });

  // ─── Déconnexion (retour sur l'onglet de login du portail école) ──────────
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // silent — on redirige de toute façon
    }
    const tenantSlug =
      tenant?.slug ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tenant')
        : null);
    const loginUrl = new URL('/login', window.location.origin);
    if (tenantSlug) loginUrl.searchParams.set('tenant', tenantSlug);
    loginUrl.searchParams.set('portal', config.loginPortal);
    window.location.href = loginUrl.toString();
  };

  // ─── Garde d'accès (défense en profondeur) ────────────────────────────────
  if (user && !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <Lock className={cn('w-12 h-12 mx-auto mb-3', theme.iconText)} />
          <h2 className="text-lg font-bold text-slate-900 mb-2">{L("Accès réservé", "Restricted access")}</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {L(
              `${config.label} est réservé au métier « ${config.roleLabel} ». Redirection…`,
              `${L(config.label, config.labelEn)} is reserved for the "${L(config.roleLabel, config.roleLabelEn)}" role. Redirecting…`,
            )}
          </p>
        </div>
      </div>
    );
  }

  // ─── Année scolaire obligatoire (dashboards métier) ───────────────────────
  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className={cn('h-8 w-8 animate-spin', theme.spinner)} />
      </div>
    );
  }

  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : L(config.roleLabel, config.roleLabelEn);
  // Photo de profil si le payload de session la transporte (sinon initiales).
  // ⚠️ Cast étroit : le type User de session ne déclare pas photoUrl.
  const userPhoto = (user as { photoUrl?: string } | null | undefined)?.photoUrl;
  const activeModule = modules.find(
    (m) => pathname === m.path || (m.path !== config.path && pathname.startsWith(m.path))
  );
  const currentModuleLabel = activeModule
    ? L(activeModule.label, activeModule.labelEn || activeModule.label)
    : L(config.label, config.labelEn);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ⭐ Overlay mobile — sombre la page quand la sidebar est ouverte */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar du portail — responsive :
          - Desktop (lg+) : fixed left, width 64, toujours visible
          - Mobile (<lg) : fixed left, width 64, translate-x quand fermée */}
      <aside
        className={cn(
          'w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo + Nom école + bouton fermer mobile */}
        <div className="h-20 flex items-center gap-3 px-4 border-b border-slate-200">
          {school?.logoUrl ? (
            <img src={school.logoUrl} alt={school.schoolName} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', theme.logoBg)}>
              <Building2 className={cn('h-5 w-5', theme.iconText)} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate">
              {school?.schoolName || tenant?.name || L('École', 'School')}
            </p>
            <p className="text-[10px] text-slate-400">{academicYear?.label || ''}</p>
          </div>
          {/* Bouton fermer (mobile only) */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden flex h-11 w-11 items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg"
            aria-label={L("Fermer le menu", "Close menu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profil du métier — photo ou initiales + badge du portail */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt={userName}
                className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-slate-200"
              />
            ) : (
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                  theme.avatar,
                  theme.avatarText
                )}
              >
                {(user?.firstName?.[0] || '')}
                {(user?.lastName?.[0] || '')}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
              <p className={cn('text-[10px] font-semibold', theme.iconText)}>{L(config.roleLabel, config.roleLabelEn)}</p>
            </div>
          </div>
        </div>

        {/* Navigation — modules du métier, en dur */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {modules.map((mod) => {
            const Icon = ICON_REGISTRY[mod.icon];
            const isActive =
              pathname === mod.path || (mod.path !== config.path && pathname.startsWith(mod.path));
            return (
              <Link
                key={mod.path}
                href={mod.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? theme.active
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent'
                )}
                title={L(mod.desc, mod.descEn || mod.desc)}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{L(mod.label, mod.labelEn || mod.label)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 space-y-1">
          {/* ⭐ Double casquette (ex : secrétaire + enseignant) : bascule vers
              l'UI Enseignant SANS déconnexion — visible seulement si
              l'utilisateur dispose d'un profil Teacher actif. */}
          <PortalSwitchButton target="TEACHER" tenantSlugFallback={tenant?.slug} />
          <button
            onClick={() => setLogoutOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            <span>{L("Se déconnecter", "Log out")}</span>
          </button>
        </div>
      </aside>

      {/* Modal de confirmation de déconnexion */}
      <LogoutModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
        userName={user ? `${user.firstName} ${user.lastName}`.trim() : undefined}
      />

      {/* Contenu principal — responsive :
          - Desktop (lg+) : ml-64 pour laisser place à la sidebar fixed
          - Mobile (<lg) : ml-0, pas de marge (la sidebar est en drawer) */}
      <div className="lg:ml-64 min-w-0">
        {/* Top bar — responsive avec bouton hamburger mobile */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Bouton hamburger (mobile only) */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden flex h-11 w-11 items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label={L("Ouvrir le menu", "Open menu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {currentModuleLabel}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Cloche notifications (validations, alertes, messages) */}
            <NotificationDropdown />
            {/* ⭐ P4 : bascule FR/EN (masquée si mono-piste — langue du profil) */}
            <LanguageSwitcher />
            {/* Sélecteurs de contexte global (année / niveau / piste) — les mêmes
                que la topbar partagée : les dashboards métier (examens, pédagogie,
                finances…) consomment ces contextes et restent pilotables. */}
            <div className="hidden sm:flex items-center gap-2 md:gap-3">
              <AcademicYearSelector />
              <SchoolLevelSelector />
              <AcademicTrackSelector />
            </div>
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="p-3 sm:p-4 lg:p-6">
          <div className="min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
