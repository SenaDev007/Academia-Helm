/**
 * FederisLoadingShell — Squelette de chargement du portail Academia Federis
 * ═══════════════════════════════════════════════════════════════════════════
 * CORRECTION « PAGE BLANCHE » LORS DES CHANGEMENTS DE MODULE (2026-09-29) :
 *
 * Avant : chaque loading.tsx rendait <AcademiaLoader inline /> SEUL — un mini
 * spinner au milieu d'une page BLANCHE, sans header ni sidebar. À chaque
 * bascule entre modules, l'application semblait « disparaître » (page blanche)
 * avant d'afficher le module demandé.
 *
 * Maintenant : les loading.tsx rendent CE SHELL qui reproduit EXACTEMENT le
 * chrome du FederisLayout (header applicatif blanc + sidebar navy + zone de
 * contenu) SANS AUCUN appel API ni lecture de session — il est donc affiché
 * instantanément pendant que le composant serveur de la page (session +
 * profil) se résout. La transition entre modules est visuellement continue :
 * seul le contenu central passe en squelette animé.
 *
 * Pattern Helm (PilotageLayout) : le squelette utilise les mêmes classes et
 * les mêmes dimensions que l'application réelle pour éviter tout saut de
 * mise en page (layout shift) à l'hydratation.
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { useFederisPath } from '@/lib/federis/useFederisPath';

// ── Navigation (miroir statique de FederisLayout.federisNavItems) ───────────
// Aucune donnée de session n'étant disponible pendant le chargement, toutes
// les entrées sont rendues : c'est un état transitoire d'une fraction de
// seconde, remplacé dès que la page (et le layout réel) est prête.

const NAV_ITEMS = [
  { category: 'PILOTAGE', items: [{ name: 'Tableau de bord', subPath: '/dashboard', icon: 'dashboard' as const }] },
  {
    category: 'GOUVERNANCE',
    items: [
      { name: 'Patronats territoriaux', subPath: '/patronats', icon: 'network' as const },
      { name: 'Bureau & Membres', subPath: '/bureau', icon: 'building' as const },
      { name: 'Équipe & Comptes', subPath: '/team', icon: 'students' as const },
    ],
  },
  { category: 'RÉSEAU', items: [{ name: 'Écoles rattachées', subPath: '/schools', icon: 'classes' as const }] },
  {
    category: 'EXAMENS',
    items: [
      { name: 'Examens nationaux', subPath: '/exams', icon: 'exams' as const },
      { name: 'Centres et salles', subPath: '/centers', icon: 'classes' as const },
      { name: 'Candidats', subPath: '/candidates', icon: 'scolarite' as const },
      { name: 'Délibérations', subPath: '/deliberations', icon: 'document' as const },
    ],
  },
  {
    category: 'RESSOURCES',
    items: [
      { name: 'Épreuves et documents', subPath: '/documents', icon: 'document' as const },
      { name: 'Banque d\u2019épreuves', subPath: '/question-bank', icon: 'library' as const },
    ],
  },
  {
    category: 'ANALYSE',
    items: [
      { name: 'Rapports et statistiques', subPath: '/reports', icon: 'grades' as const },
      { name: 'ORION (lecture seule)', subPath: '/orion', icon: 'orion' as const },
    ],
  },
  {
    category: 'SYSTÈME',
    items: [
      { name: 'Gestion des conflits', subPath: '/conflicts', icon: 'warning' as const },
      { name: 'Paramètres', subPath: '/settings', icon: 'settings' as const },
    ],
  },
];

/** Libellé lisible du module en cours de chargement (d'après l'URL). */
const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/patronats': 'Patronats territoriaux',
  '/bureau': 'Bureau & Membres',
  '/team': 'Équipe & Comptes',
  '/schools': 'Écoles rattachées',
  '/exams': 'Examens nationaux',
  '/centers': 'Centres et salles',
  '/candidates': 'Candidats',
  '/deliberations': 'Délibérations',
  '/documents': 'Épreuves et documents',
  '/question-bank': 'Banque d\u2019épreuves',
  '/reports': 'Rapports et statistiques',
  '/orion': 'ORION',
  '/conflicts': 'Gestion des conflits',
  '/settings': 'Paramètres',
  '/checkout': 'Abonnement',
};

/** Bloc de squelette animé (pulse) — mêmes teintes que fed-card. */
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-slate-200/70 animate-pulse',
        className,
      )}
    />
  );
}

export default function FederisLoadingShell() {
  const pathname = usePathname();
  const { path: federisPath } = useFederisPath();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Libellé du module (dernier segment connu de l'URL fédérée)
  const label =
    PAGE_LABELS[pathname] ??
    PAGE_LABELS[`/${(pathname ?? '').split('/').filter(Boolean).pop() ?? ''}`] ??
    'Chargement du module';

  return (
    <div className="min-h-screen bg-[#f7f9fc] fed-app">
      {/* ── HEADER — clone statique du FederisLayout (blanc opaque + or) ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white">
        <div className="h-[2px] bg-gradient-to-r from-blue-900 via-gold-500 to-blue-900" />
        <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8 border-b border-gray-200">
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="relative">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis"
                width={36}
                height={36}
                className="h-9 w-9 object-contain rounded-xl ring-1 ring-gray-100 bg-white"
                priority
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[13px] font-bold text-blue-900 leading-tight">Academia Federis</div>
              <div className="text-[11px] text-gray-400 font-medium leading-tight">
                Chargement…
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="hidden md:flex flex-col items-end gap-1 border-r border-gray-200 pr-4">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-4 w-28" />
            </div>
            <div className="p-2 text-gray-300">
              <AppIcon name="bell" size="menu" />
            </div>
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-right space-y-1.5">
                <SkeletonBlock className="h-3.5 w-28" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl flex items-center justify-center ring-1 ring-blue-700/20">
                <span className="text-white text-sm font-semibold">…</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-[60px]">
        {/* ── SIDEBAR — clone statique (navy + indicateur doré) ────────── */}
        <aside className="fixed left-0 top-[60px] bottom-0 w-64 bg-blue-900 border-r border-blue-950/40 z-30 lg:translate-x-0">
          <nav className="h-full overflow-y-auto py-4 relative z-10 fed-scroll">
            {NAV_ITEMS.map((group) => (
              <div key={group.category} className="mb-5">
                <h3 className="px-6 text-[10px] font-semibold text-blue-200/80 uppercase tracking-[0.15em] mb-2">
                  {group.category}
                </h3>
                <div className="px-3 space-y-0.5">
                  {group.items.map((item) => {
                    const itemHref = federisPath(item.subPath);
                    const active = isActive(itemHref);
                    return (
                      <Link
                        key={item.subPath}
                        href={itemHref}
                        className={cn(
                          'group relative flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                          active
                            ? 'bg-white/[0.12] text-white shadow-lg shadow-black/10'
                            : 'text-blue-200/80 hover:bg-white/[0.06] hover:text-white',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-gold-400 to-gold-600" />
                        )}
                        <AppIcon
                          name={item.icon}
                          size="menu"
                          className={cn(
                            'transition-colors flex-shrink-0',
                            active
                              ? 'text-gold-400'
                              : 'text-blue-300/70 group-hover:text-blue-100',
                          )}
                        />
                        <span
                          className={cn(
                            'text-[13px] whitespace-nowrap overflow-hidden text-ellipsis',
                            active ? 'font-semibold text-white' : 'font-medium',
                          )}
                        >
                          {item.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ── CONTENU — squelette + indicateur du module en cours ──────── */}
        <main className="flex-1 transition-all duration-300 lg:ml-64">
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Indicateur du module en cours de chargement */}
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="relative">
                <div className="academia-loader-ring-sm" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src="/images/logo-Academia Hub.webp"
                    alt="Academia Federis"
                    width={24}
                    height={24}
                    className="relative z-10 rounded-full"
                    priority
                  />
                </div>
              </div>
              <span className="text-sm text-slate-500 font-medium">
                Chargement de « {label} »…
              </span>
            </div>

            {/* Squelette de page : en-tête + cartes + tableau (pattern fed-card) */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-3">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-8 w-72 max-w-full" />
                  <SkeletonBlock className="h-4 w-52 max-w-full" />
                </div>
                <SkeletonBlock className="h-11 w-44" />
              </div>

              <div className="fed-card p-6 space-y-4">
                <SkeletonBlock className="h-5 w-48" />
                <div className="space-y-3">
                  <SkeletonBlock className="h-4 w-full" />
                  <SkeletonBlock className="h-4 w-11/12" />
                  <SkeletonBlock className="h-4 w-8/12" />
                </div>
              </div>

              <div className="fed-card overflow-hidden">
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((i) => (
                      <SkeletonBlock key={i} className="h-20 w-full" />
                    ))}
                  </div>
                  <div className="space-y-3 pt-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <SkeletonBlock key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
