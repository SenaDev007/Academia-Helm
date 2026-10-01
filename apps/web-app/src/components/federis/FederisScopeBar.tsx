/**
 * FederisScopeBar — Barre de périmètre du patronat national (Academia Frederis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ AGRÉGATION NATIONALE (2026-10-01) — visible UNIQUEMENT pour le patronat
 *    national, sous l'en-tête applicatif :
 *
 *   [ 👁 Tous les départements (agrégation) ▾ ]  [ Lecture seule ]
 *
 * ⭐ VUE PAR DÉPARTEMENT (2026-10-02) — retours promoteur : dans les modules
 *    de la section EXAMENS (examens, centres, candidats, épreuves, notes,
 *    délibération, rapports), le national ne consulte PLUS l'agrégat de tous
 *    les départements : la page du module affiche d'abord la GRILLE DES
 *    DÉPARTEMENTS (FederisDepartmentGate) et l'utilisateur choisit un
 *    département. La barre de périmètre reflète ce mode :
 *
 *   [ 🏛 Département : Borgou ]  [ Lecture seule ]  [ ← Changer de département ]
 *
 *    - Aucun département sélectionné → la barre se retire (la grille du module
 *      occupe l'écran et propose les cartes de chaque département) ;
 *    - Département sélectionné → bandeau + bouton « Changer » qui ROUVRE la
 *      grille du module courant.
 *
 *    Les autres modules de données (Tableau de bord, Matières, Écoles
 *    rattachées, Banque d'épreuves, Saisie des notes) gardent le sélecteur
 *    classique avec l'option « Tous les départements ».
 */

'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { useFederisScope } from '@/lib/federis/scope-context';
import { useFederisPath } from '@/lib/federis/useFederisPath';

/** Modules de données dont les listes sont rechargées au changement de
 *  département (le hook useFederisExams et les fetchs internes écoutent le
 *  contexte) — la navigation force aussi un remontage propre du module. */
const DATA_MODULES = [
  '/dashboard',
  '/subjects',
  '/exams',
  '/centers',
  '/candidates',
  '/documents',
  '/grades',
  '/saisie',
  '/deliberations',
  '/question-bank',
  '/reports',
  '/schools',
];

/** ⭐ 2026-10-02 — Modules à VUE PAR DÉPARTEMENT (section EXAMENS + Rapports) :
 *  le national choisit un département sur la grille d'entrée du module ; la
 *  barre affiche alors le département consulté + « Changer de département ». */
const DEPARTMENT_GATE_MODULES = [
  '/exams',
  '/centers',
  '/candidates',
  '/documents',
  '/grades',
  '/deliberations',
  '/reports',
];

export default function FederisScopeBar() {
  const {
    isNational,
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    canWrite,
    readOnlyLabel,
    restored,
  } = useFederisScope();
  const pathname = usePathname();
  const router = useRouter();
  const { path: federisPath } = useFederisPath();

  // Le sélecteur n'a de sens que sur les modules de données (pas sur
  // Patronats territoriaux, Paramètres, Équipe…)
  const isDataModule = useMemo(
    () => DATA_MODULES.some((m) => pathname === federisPath(m) || pathname?.startsWith(`${federisPath(m)}/`)),
    [pathname, federisPath],
  );

  // ⭐ Vue par département : module EXAMENS dont l'entrée passe par la grille
  //    des départements (FederisDepartmentGate).
  const isGateModule = useMemo(
    () => DEPARTMENT_GATE_MODULES.some((m) => pathname === federisPath(m) || pathname?.startsWith(`${federisPath(m)}/`)),
    [pathname, federisPath],
  );

  if (!isNational || !isDataModule || departments.length === 0) return null;

  // ⭐ Contexte de périmètre en cours d'initialisation (restauration de la
  //    dernière sélection) : on attend plutôt que d'afficher un état faux.
  if (!restored) return null;

  const selected = departments.find((d) => d.patronatId === selectedDepartmentId) ?? null;

  // Badge de statut (lecture seule / délégation) — partagé par les deux modes.
  const statusBadge = (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0',
        canWrite
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          : 'bg-amber-50 text-amber-800 border border-amber-200',
      )}
      title={readOnlyLabel ?? undefined}
    >
      <AppIcon name={canWrite ? 'check' : 'view'} size="menu" className={canWrite ? 'text-emerald-600' : 'text-amber-600'} />
      <span>{canWrite ? 'Modification autorisée (déléguée)' : 'Lecture seule'}</span>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // ⭐ MODE « VUE PAR DÉPARTEMENT » (section EXAMENS + Rapports)
  // ════════════════════════════════════════════════════════════════════════
  if (isGateModule) {
    // Grille des départements affichée par le module → la barre se retire.
    if (!selectedDepartmentId) return null;

    return (
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-blue-100 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-900 flex-shrink-0">
            <AppIcon name="network" size="menu" className="text-gold-400" />
          </div>
          <div className="min-w-0">
            <p className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Département consulté
            </p>
            <p className="text-sm font-semibold text-blue-900 truncate">
              {selected?.territoryName ?? selected?.name ?? '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {statusBadge}
          <button
            type="button"
            onClick={() => {
              setSelectedDepartmentId(null);
              // Rouvre la grille des départements du module courant.
              router.refresh();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-900 text-white hover:bg-blue-800 transition-colors flex-shrink-0"
          >
            <AppIcon name="chevronLeft" size="submenu" />
            Changer de département
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // MODE CLASSIQUE — sélecteur « Tous les départements » (agrégation)
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-blue-100 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-900 flex-shrink-0">
          <AppIcon name="network" size="menu" className="text-gold-400" />
        </div>
        <div className="min-w-0">
          <label htmlFor="federis-department" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Périmètre de consultation
          </label>
          <select
            id="federis-department"
            value={selectedDepartmentId ?? ''}
            onChange={(e) => {
              const value = e.target.value || null;
              setSelectedDepartmentId(value);
              // Remonte le module courant pour recharger les listes filtrées
              router.refresh();
            }}
            className="mt-0.5 bg-white border border-gray-300 text-sm font-semibold text-blue-900 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-600 transition-colors max-w-full"
          >
            <option value="">Tous les départements (agrégation nationale)</option>
            {departments.map((d) => (
              <option key={d.patronatId} value={d.patronatId}>
                {d.territoryName ?? d.name}
                {d.canWrite ? ' — modification déléguée' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusBadge}
    </div>
  );
}
