/**
 * ============================================================================
 * HIERARCHICAL EVALUATION LIST — Groupement par trimestre puis évaluation
 * ============================================================================
 *
 * Affiche les évaluations groupées de façon hiérarchique :
 *   Trimestre 1 (dépliable)
 *     └─ Évaluation mensuelle 1 — Classe CI A (carte)
 *     └─ Évaluation mensuelle 1 — Classe CE1 (carte)
 *   Trimestre 2 (dépliable)
 *     └─ ...
 *
 * Utilisé dans : Évaluations, Saisie des notes, Validation
 * ============================================================================
 */

'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { translatePeriodName } from '@/lib/exam-anglophone-config';
import type { GroupedEvaluation } from '@/components/exams/GradingSheet';

interface HierarchicalListProps {
  groups: GroupedEvaluation[];
  onGroupClick: (group: GroupedEvaluation) => void;
  /** Masquer les groupes non cliquables (ex: pas OPEN_FOR_GRADING pour la saisie) */
  filterFn?: (group: GroupedEvaluation) => boolean;
  /** Badge de statut personnalisé */
  renderStatusBadge?: (group: GroupedEvaluation) => React.ReactNode;
  /** Mode de saisie affiché (TS/S/PS ou /20) */
  isMaternelle?: boolean;
  /** ⭐ V10 — piste linguistique DÉDUITE du niveau (Nursery/Primary → EN) :
   *  libellés de la liste dans la langue du niveau sélectionné. */
  language?: 'FR' | 'EN';
  /**
   * ⭐ RETOUR PAR ÉTAPE — Clé de mémoire des trimestres dépliés.
   * Si fournie, l'état déplié survit au démontage (retour depuis une fiche
   * de saisie) : l'utilisateur retrouve le trimestre ouvert tel qu'il
   * l'avait laissé, au lieu de retomber sur la première page de l'onglet.
   */
  scopeKey?: string;
}

interface TrimestreGroup {
  periodName: string;
  periodId: string;
  evaluations: GroupedEvaluation[];
}

/**
 * ⭐ RETOUR PAR ÉTAPE — Mémoire des trimestres dépliés par page (module-level).
 * Quand l'utilisateur quitte la liste (fiche de saisie, validation…) puis
 * revient via « Retour à la liste », le composant est démonté puis remonté :
 * sans cette mémoire, tous les trimestres se refermaient et l'utilisateur
 * retombait sur la « première page » de l'onglet au lieu de l'étape
 * intermédiaire (le trimestre qu'il avait ouvert, avec ses classes).
 * La Map vit autant que la session SPA (navigation client-side).
 */
const openTrimestresByScope = new Map<string, Set<string>>();

export function HierarchicalEvaluationList({
  groups,
  onGroupClick,
  filterFn,
  renderStatusBadge,
  isMaternelle,
  language,
  scopeKey,
}: HierarchicalListProps) {
  // ⭐ Retour par étape : restaurer les trimestres dépliés mémorisés pour ce scope
  const [openTrimestres, setOpenTrimestres] = useState<Set<string>>(
    () => (scopeKey && openTrimestresByScope.get(scopeKey)) || new Set<string>(),
  );
  const isEN = language === 'EN';
  const locale = isEN ? enUS : fr;

  // Filtrer si nécessaire
  const displayGroups = filterFn ? groups.filter(filterFn) : groups;

  // Grouper par période (trimestre)
  const byTrimestre = useMemo<TrimestreGroup[]>(() => {
    const map = new Map<string, TrimestreGroup>();
    for (const g of displayGroups) {
      const key = g.periodId || '_no_period';
      if (!map.has(key)) {
        map.set(key, {
          periodName: isEN ? translatePeriodName(g.periodName || 'Sans période', 'EN') : (g.periodName || 'Sans période'),
          periodId: key,
          evaluations: [],
        });
      }
      map.get(key)!.evaluations.push(g);
    }
    // ⭐ Trier les évaluations par type: EM1 → EM2 → EC (FR) / FCA → SCA → EXAM (EN)
    const EVAL_ORDER = ['EM1', 'EM2', 'EC', 'DV', 'INT', 'COMP', 'EB', 'ORAL', 'EP', 'FCA', 'SCA', 'EXAM'];
    for (const trim of map.values()) {
      trim.evaluations.sort((a, b) => {
        const idxA = EVAL_ORDER.indexOf(a.evaluationTypeCode?.toUpperCase() || '');
        const idxB = EVAL_ORDER.indexOf(b.evaluationTypeCode?.toUpperCase() || '');
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });
    }
    // Trier par nom de période (Trimestre 1, 2, 3 / Term 1, 2, 3)
    return Array.from(map.values()).sort((a, b) =>
      a.periodName.localeCompare(b.periodName, 'fr')
    );
  }, [displayGroups, isEN]);

  const toggleTrimestre = (periodId: string) => {
    setOpenTrimestres((prev) => {
      const next: Set<string> = new Set(prev);
      if (next.has(periodId)) {
        next.delete(periodId);
      } else {
        next.add(periodId);
      }
      // ⭐ Retour par étape : persister l'état déplié pour ce scope
      if (scopeKey) openTrimestresByScope.set(scopeKey, next);
      return next;
    });
  };

  if (displayGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {byTrimestre.map((trimestre) => {
        const isOpen = openTrimestres.has(trimestre.periodId);
        const evalCount = trimestre.evaluations.length;
        return (
          <div key={trimestre.periodId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* En-tête trimestre (cliquable pour déplier) */}
            <button
              onClick={() => toggleTrimestre(trimestre.periodId)}
              className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {trimestre.periodName.match(/(\d)/)?.[1] || '?'}
                </div>
                <div className="text-left">
                  <h3 className="text-base font-bold text-navy-900">{trimestre.periodName}</h3>
                  <p className="text-xs text-gray-500">
                    {isEN
                      ? `${evalCount} assessment${evalCount > 1 ? 's' : ''} scheduled`
                      : `${evalCount} évaluation${evalCount > 1 ? 's' : ''} programmée${evalCount > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-gray-400 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Liste des évaluations du trimestre (dépliable) */}
            {isOpen && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {trimestre.evaluations.map((group, idx) => {
                  const startDate = group.startDate ? new Date(group.startDate) : null;
                  const endDate = group.endDate ? new Date(group.endDate) : null;
                  const sameDay = startDate && endDate &&
                    startDate.getFullYear() === endDate.getFullYear() &&
                    startDate.getMonth() === endDate.getMonth() &&
                    startDate.getDate() === endDate.getDate();
                  const dateRange = startDate
                    ? sameDay || !endDate
                      ? isEN
                        ? `On ${format(startDate, 'd MMM yyyy', { locale })}`
                        : `Le ${format(startDate, 'd MMM yyyy', { locale })}`
                      : isEN
                        ? `From ${format(startDate, 'd MMM yyyy', { locale })} to ${format(endDate, 'd MMM yyyy', { locale })}`
                        : `Du ${format(startDate, 'd MMM yyyy', { locale })} au ${format(endDate, 'd MMM yyyy', { locale })}`
                    : (isEN ? 'Date not set' : 'Date non définie');

                  const canClick = !filterFn || filterFn(group);
                  const subjectCount = group.subjects.length;

                  return (
                    <button
                      key={`${group.classId}-${group.evaluationTypeId}-${idx}`}
                      onClick={() => canClick && onGroupClick(group)}
                      disabled={!canClick}
                      className={cn(
                        'bg-white rounded-2xl border shadow-sm transition-all text-left flex flex-col overflow-visible',
                        canClick
                          ? 'border-gray-200 hover:shadow-md hover:border-blue-300 cursor-pointer'
                          : 'border-gray-100 opacity-60 cursor-not-allowed'
                      )}
                    >
                      {/* En-tête carte */}
                      <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {(group.className || '?').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-base font-bold text-navy-900 truncate">{group.className}</h4>
                              <p className="text-xs text-gray-500">
                                {isEN
                                  ? `${subjectCount} subject${subjectCount > 1 ? 's' : ''} to ${isMaternelle ? 'assess' : 'sit'}`
                                  : `${subjectCount} matière${subjectCount > 1 ? 's' : ''} à ${isMaternelle ? 'évaluer' : 'composer'}`}
                              </p>
                            </div>
                          </div>
                          {renderStatusBadge && renderStatusBadge(group)}
                        </div>
                      </div>

                      {/* Corps carte */}
                      <div className="p-5 flex-1 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-navy-900">
                            {group.evaluationTypeCode ? `[${group.evaluationTypeCode}] ` : ''}
                            {group.evaluationTypeName}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1.5 text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                          <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className="font-medium">{dateRange}</span>
                        </div>
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            {isEN ? 'Subjects' : 'Matières'}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.subjects.map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100"
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Pied : action */}
                      {canClick && (
                        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30">
                          <div className="flex items-center justify-end text-xs font-semibold text-blue-600">
                            {isEN ? 'Enter grades' : 'Saisir les notes'}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
