/**
 * FederisDepartmentGate — Vue PAR DÉPARTEMENT des modules EXAMENS (Academia Frederis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-10-02 — Retour promoteur « agrégation par département » :
 *
 * Au niveau du PATRONAT NATIONAL, les modules de la section EXAMENS (Examens
 * nationaux, Centres, Candidats, Épreuves et documents, Notes et moyennes,
 * Délibération & relevés, Rapports et statistiques) ne mélangent PLUS les
 * données de tous les départements : l'entrée dans le module affiche d'abord
 * la GRILLE DES DÉPARTEMENTS du pays (les patronats territoriaux du réseau).
 * L'utilisateur clique sur un département (ex. Borgou) pour consulter les
 * données de CE département uniquement — chaque patronat départemental
 * organise ses examens en son sein.
 *
 * Comportement :
 *   - TERRITORIAL            → contenu du module directement (inchangé) ;
 *   - NATIONAL sans réseau   → contenu du module (aucun département rattaché) ;
 *   - NATIONAL · aucun département sélectionné → GRILLE DE CARTES ;
 *   - NATIONAL · département sélectionné        → contenu du module (la barre
 *     de périmètre affiche le département + le bouton « Changer »).
 *
 * La sélection est PERSISTANTE (sessionStorage via le contexte de périmètre) :
 * en naviguant d'un module à l'autre, le département reste sélectionné —
 * inutile de re-cliquer à chaque module. Le flag `restored` du contexte évite
 * le flash « grille → contenu » au rechargement de la page.
 *
 * Ce composant est monté au niveau de la ROUTE (server component) : tant que
 * la grille s'affiche, la page du module n'est PAS MONTÉE — aucun fetch
 * inutile, aucun hook de module ne tourne.
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { FedPage } from '@/components/federis/federis-motion';
import { useFederisScope } from '@/lib/federis/scope-context';

/** Compteurs affichés sur les cartes (endpoint léger patronat/children). */
interface DepartmentCounters {
  examsCount?: number;
  schoolsCount?: number;
}

export default function FederisDepartmentGate({
  moduleName,
  children,
}: {
  /** Nom exact du module (libellé de la sidebar) — titre de la grille. */
  moduleName: string;
  children: ReactNode;
}) {
  const {
    isNational,
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    restored,
  } = useFederisScope();
  const router = useRouter();
  const [counters, setCounters] = useState<Record<string, DepartmentCounters>>({});

  // Grille visible = national + réseau non vide + aucun département choisi.
  const showGrid = isNational && departments.length > 0 && !selectedDepartmentId;

  // Compteurs par département (examens, écoles) — enrichissement best effort :
  // en cas d'échec les cartes restent utilisables, simplement sans compteurs.
  useEffect(() => {
    if (!showGrid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/federis/patronat/children', { timeout: 15000 });
        if (cancelled || !Array.isArray(res.data)) return;
        const map: Record<string, DepartmentCounters> = {};
        for (const c of res.data) {
          if (c?.id) map[c.id] = { examsCount: c.examsCount, schoolsCount: c.schoolsCount };
        }
        setCounters(map);
      } catch {
        /* silencieux — cartes sans compteurs */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showGrid]);

  // Territorial : module direct, sans intermédiaire.
  if (!isNational) return <>{children}</>;

  // ⭐ National — initialisation du contexte en cours (restauration du
  // dernier département + chargement du réseau) : squelette neutre. Sans ce
  // garde, la page du module s'afficherait un instant (SSR) avant d'être
  // remplacée par la grille — et inversement au rechargement avec un
  // département déjà sélectionné.
  if (!restored) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-80 bg-blue-100 rounded-full" />
        <div className="h-4 w-56 bg-blue-50 rounded-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="fed-card h-48" />
          ))}
        </div>
      </div>
    );
  }

  // National sans réseau départemental, ou département déjà sélectionné
  // (persistance entre modules) : contenu du module.
  if (departments.length === 0 || !showGrid) return <>{children}</>;

  const select = (patronatId: string) => {
    setSelectedDepartmentId(patronatId);
    // Remonte la route courante : les server components se re-rendent et le
    // module démarre proprement sur les données du département choisi.
    router.refresh();
  };

  return (
    <FedPage className="space-y-8">
      {/* En-tête — même style que les en-têtes de modules */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-2">Périmètre national</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {moduleName} — sélection du département
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Chaque patronat départemental organise ses examens en son sein : les campagnes, les
            centres, les candidats et les résultats d&apos;un département ne sont pas ceux d&apos;un
            autre. Sélectionnez un département pour consulter ses données.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-900 flex-shrink-0">
          <AppIcon name="network" size="menu" className="text-blue-800" />
          <span>{departments.length} département(s)</span>
        </div>
      </div>

      {/* Bandeau lecture seule — même règle que la barre de périmètre */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 text-sm text-amber-800 flex items-start gap-3">
        <AppIcon name="view" size="menu" className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="leading-relaxed">
          La consultation nationale est en <strong>lecture seule</strong>. Un coordonnateur
          départemental peut vous déléguer un accès en modification pour son département
          (module Équipe &amp; Comptes → Délégation au patronat national).
        </p>
      </div>

      {/* Grille des départements du pays */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {departments.map((d) => {
          const c = counters[d.patronatId];
          return (
            <button
              key={d.patronatId}
              type="button"
              onClick={() => select(d.patronatId)}
              className="group text-left bg-white border border-blue-100 rounded-2xl p-6 shadow-sm hover:border-blue-800/40 hover:shadow-lg hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-900 flex-shrink-0">
                  <AppIcon name="network" size="menu" className="text-gold-400" />
                </div>
                {d.canWrite ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Délégation
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                    Lecture seule
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-base font-bold text-blue-900 group-hover:text-blue-800 leading-tight">
                {d.territoryName ?? d.name}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1 truncate">
                {d.name}
              </p>

              <div className="mt-4 flex items-center gap-3 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <AppIcon name="exams" size="submenu" className="text-slate-400" />
                  {c?.examsCount ?? '—'} examen(s)
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-1.5">
                  <AppIcon name="classes" size="submenu" className="text-slate-400" />
                  {c?.schoolsCount ?? '—'} école(s)
                </span>
              </div>

              <div className="mt-5 flex items-center gap-1.5 text-[11px] font-bold text-blue-800">
                <span>Consulter ce département</span>
                <AppIcon
                  name="arrowRight"
                  size="submenu"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Le département sélectionné reste actif lorsque vous naviguez entre les modules — changez
        de département à tout moment depuis la barre de périmètre au-dessus du module.
      </p>
    </FedPage>
  );
}
