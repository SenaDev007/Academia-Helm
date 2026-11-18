'use client';

/**
 * ============================================================================
 * GENERAL + EXAM FEES CONTENT — Onglet « Frais généraux » FUSIONNÉ
 * ============================================================================
 *
 * ⭐ Demande promoteur (nov. 2026) :
 *    « Je voudrais qu'on fusionne les onglets frais généraux et frais
 *    examen. Ce sera un onglet frais généraux, mais lorsqu'on rentre dedans,
 *    on a les sous-onglets frais généraux et frais des examens. »
 *
 * Structure :
 *   - UN SEUL onglet « Frais généraux » dans la navigation du module Finance ;
 *   - À l'intérieur, DEUX sous-onglets :
 *       • « Frais généraux »  → GeneralFeesContent (listing par élève) ;
 *       • « Frais des examens » → ExamFeesContent (lui-même organisé en
 *         sous-onglets par examen national : CEP / BEPC / BAC / CAP) ;
 *   - Le sous-onglet « Frais des examens » n'apparaît que si l'école a un
 *     examen national éligible (niveaux activés + classes à examen) ou des
 *     frais d'examen paramétrés (cf. useExamFeesTab — une école purement
 *     maternelle ne le voit pas).
 *
 * L'ancienne route /app/finance/exam-fees reste fonctionnelle : elle rend ce
 * même composant avec le sous-onglet examens pré-sélectionné (liens et
 * favoris existants préservés).
 */

import { useState } from 'react';
import { Layers, GraduationCap } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useExamFeesTab } from '@/hooks/useExamFeesTab';
import { useL } from '@/lib/i18n/bilingual';
import { cn } from '@/lib/utils';
import GeneralFeesContent from './GeneralFeesContent';
import ExamFeesContent from './ExamFeesContent';

export default function GeneralExamFeesContent({
  initialSubTab = 'general',
}: {
  initialSubTab?: 'general' | 'exam';
}) {
  const { academicYear } = useModuleContext();
  const L = useL();

  // ⭐ Sous-onglet « Frais des examens » visible seulement si l'école a un
  //    examen national éligible (niveau activé + classe à examen) ou des
  //    frais d'examen paramétrés.
  const showExamSubTab = useExamFeesTab(academicYear?.id);

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'exam'>(
    initialSubTab === 'exam' ? 'exam' : 'general',
  );

  // ⭐ Sous-onglet effectif : si l'école n'a AUCUN examen national éligible
  //    (ex. école purement maternelle, ou année sans frais d'examen), le
  //    sous-onglet « Frais des examens » n'existe pas → repli sur « Frais
  //    généraux ». Valeur DÉRIVÉE (pas de setState dans un effet) : elle se
  //    recalcule automatiquement quand showExamSubTab change (switch d'année
  //    ou de structure pédagogique).
  const effectiveSubTab: 'general' | 'exam' = showExamSubTab ? activeSubTab : 'general';

  const subTabs = [
    {
      id: 'general' as const,
      label: L('Frais généraux', 'General fees'),
      icon: Layers,
    },
    ...(showExamSubTab
      ? [{
          id: 'exam' as const,
          label: L("Frais des examens", 'Exam fees'),
          icon: GraduationCap,
        }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* ⭐ SOUS-ONGLETS FUSIONNÉS — Frais généraux | Frais des examens */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {subTabs.map((tab) => {
          const isActive = tab.id === effectiveSubTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                isActive
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300',
              )}
            >
              <tab.icon className={cn('w-4 h-4', isActive ? 'text-indigo-600' : 'text-slate-400')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu du sous-onglet actif (chacun rend sa propre ModuleContentArea) */}
      {effectiveSubTab === 'general' ? (
        <GeneralFeesContent />
      ) : (
        <ExamFeesContent />
      )}
    </div>
  );
}
