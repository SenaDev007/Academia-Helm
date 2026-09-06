'use client';

/**
 * ============================================================================
 * ADMIN PORTAL HOME — Home générique des portails administratifs
 * ============================================================================
 *
 * Home « métier » pilotée par la config du portail (admin-portal-map.ts) :
 * bannière d'accueil au thème du métier + cartes d'accès rapide vers les
 * modules du portail (feature flags tenant + garde requiresSecondary, les
 * mêmes filtres que la sidebar AdminPortalShell).
 *
 * Pattern calqué sur le dashboard du portail Enseignant (bannière de
 * bienvenue + grille de modules). Utilisée par les portails dont la home
 * est un tableau de bord d'accueil (ex: surveillant) — les autres portails
 * ont une home-outil dédiée (encaissements, dashboard finance, workspace
 * censeur…).
 *
 * AUCUN filtrage par rôle : les modules sont ceux du MÉTIER, déclarés en dur.
 * ============================================================================
 */

import Link from 'next/link';
import { Building2, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolIdentity } from '@/hooks/useSchoolIdentity';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useEnabledFeatureCodes } from '@/hooks/useEnabledFeatureCodes';
import { ICON_REGISTRY } from './AdminPortalShell';
import { ADMIN_PORTALS, type AdminPortalAccent } from '@/lib/auth/admin-portal-map';
// ⭐ P4-final : home bilingue — piste EN → cartes et bannière 100% EN
import { useL } from '@/lib/i18n/bilingual';

// ─── Dégradés de bannière par accent (un métier = une couleur) ───────────────

const ACCENT_GRADIENTS: Record<AdminPortalAccent, string> = {
  indigo: 'from-indigo-600 to-indigo-700',
  sky: 'from-sky-600 to-sky-700',
  emerald: 'from-emerald-600 to-emerald-700',
  teal: 'from-teal-600 to-teal-700',
  amber: 'from-amber-500 to-amber-600',
  violet: 'from-violet-600 to-violet-700',
};

// ─── Composant ──────────────────────────────────────────────────────────────

export interface AdminPortalHomeProps {
  /** Clé du portail ('surveillant', …) — sérialisable server→client */
  portalKey: keyof typeof ADMIN_PORTALS;
}

export default function AdminPortalHome({ portalKey }: AdminPortalHomeProps) {
  const config = ADMIN_PORTALS[portalKey];
  const gradient = ACCENT_GRADIENTS[config.accent];

  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const { identity: school } = useSchoolIdentity();
  const { availableLevels } = useSchoolLevel();
  const { enabledSet, loading: featuresLoading } = useEnabledFeatureCodes();
  // ⭐ P4-final : libellés dans la langue du profil (piste EN → anglais)
  const L = useL();

  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : L(config.roleLabel, config.roleLabelEn);
  // Photo de profil si le payload de session la transporte (sinon initiales).
  // ⚠️ Cast étroit : le type User de session ne déclare pas photoUrl.
  const userPhoto = (user as { photoUrl?: string } | null | undefined)?.photoUrl;

  // Modules du portail — feature flags tenant + garde requiresSecondary
  // (mêmes filtres que la sidebar : la home ne propose QUE des modules visibles)
  const secondaryEnabled = availableLevels.some((l) => l.code === 'SECONDAIRE' && l.isActive);

  const modules = config.modules.filter((m) => {
    const featureOk = !m.featureCode || featuresLoading || enabledSet.has(m.featureCode);
    const secondaryOk = !m.requiresSecondary || secondaryEnabled;
    return featureOk && secondaryOk;
  });

  return (
    <div className="space-y-6">
      {/* Bannière d'accueil — thème du métier */}
      <div className={cn('rounded-xl p-6 text-white bg-gradient-to-r', gradient)}>
        <div className="flex items-center gap-3 mb-2">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt={userName}
              className="h-12 w-12 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {(user?.firstName?.[0] || '')}
              {(user?.lastName?.[0] || '')}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white/80 text-sm">{L("Bienvenue,", "Welcome,")}</p>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{userName}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-white/90">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{school?.schoolName || tenant?.name || L("École", "School")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {academicYear?.label || L("Année scolaire", "School year")}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            {L(config.roleLabel, config.roleLabelEn)}
          </span>
        </div>
      </div>

      {/* Accès rapide — modules du métier */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3">{L("Vos modules", "Your modules")}</h2>
        {modules.length === 0 ? (
          <p className="text-sm text-slate-500">{L("Aucun module activé pour le moment.", "No module enabled yet.")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => {
              const Icon = ICON_REGISTRY[mod.icon];
              return (
                <Link
                  key={mod.path}
                  href={mod.path}
                  className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        accentChipClasses[config.accent]
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 group-hover:underline">
                        {L(mod.label, mod.labelEn || mod.label)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{L(mod.desc, mod.descEn || mod.desc)}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Chip d'icône des cartes (couleur du métier)
const accentChipClasses: Record<AdminPortalAccent, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  teal: 'bg-teal-50 text-teal-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
};
