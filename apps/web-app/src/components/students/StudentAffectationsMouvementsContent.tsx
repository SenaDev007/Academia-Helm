'use client';

/**
 * ============================================================================
 * AFFECTATIONS & MOUVEMENTS — Module Élèves
 * ============================================================================
 *
 * Workflow métier (depuis la réforme "classe officielle vs classe physique") :
 *
 *   1. Admission/Inscription → parent choisit la classe OFFICIELLE (CP, CE1, 6ème…)
 *   2. Affectation vers classe PHYSIQUE → école répartit les élèves dans les sections (CE1-A, CE1-B…)
 *   3. Changement de classe → déplacer un élève d'une section à une autre (même niveau)
 *   4. Changement de série → changer la série officielle (A → D, etc.)
 *   5. Historique → consulter tous les mouvements (ClassTransfer)
 *
 * 4 sous-onglets :
 *   1. Affectation vers classe physique (PREMIER sous-onglet)
 *   2. Changement de classe
 *   3. Changement de série
 *   4. Historique
 * ============================================================================
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  UserCheck, ArrowRightLeft, RefreshCw, History,
} from 'lucide-react';
import AffectationVersClassePhysique from './AffectationVersClassePhysique';
import StudentAssignmentsContent from './StudentAssignmentsContent';
import ChangementDeSerie from './ChangementDeSerie';
import HistoriqueAffectations from './HistoriqueAffectations';

type SubTab = 'assign-physical' | 'change-class' | 'change-series' | 'history';

const SUB_TABS: { id: SubTab; label: string; icon: any; description: string }[] = [
  {
    id: 'assign-physical',
    label: 'Affectation vers classe physique',
    icon: UserCheck,
    description: 'Répartir les élèves admis/inscrits (classe officielle) vers les sections physiques (CE1-A, CE1-B…)',
  },
  {
    id: 'change-class',
    label: 'Changement de classe',
    icon: ArrowRightLeft,
    description: 'Déplacer des élèves d\'une section physique à une autre (même niveau)',
  },
  {
    id: 'change-series',
    label: 'Changement de série',
    icon: RefreshCw,
    description: 'Changer la série officielle d\'un élève (série A → série D, etc.)',
  },
  {
    id: 'history',
    label: 'Historique',
    icon: History,
    description: 'Consulter tous les mouvements (affectations, changements de classe/série)',
  },
];

export default function StudentAffectationsMouvementsContent() {
  const [activeTab, setActiveTab] = useState<SubTab>('assign-physical');
  const currentTab = SUB_TABS.find(t => t.id === activeTab) || SUB_TABS[0];

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* ─── Sous-onglets ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap border-b border-slate-100">
          {SUB_TABS.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap',
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Description du sous-onglet courant */}
        <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100">
          <p className="text-xs text-slate-600 italic">{currentTab.description}</p>
        </div>
      </div>

      {/* ─── Contenu du sous-onglet ─── */}
      <div className="flex-1 min-h-0">
        {activeTab === 'assign-physical' && <AffectationVersClassePhysique />}
        {activeTab === 'change-class' && <StudentAssignmentsContent />}
        {activeTab === 'change-series' && <ChangementDeSerie />}
        {activeTab === 'history' && <HistoriqueAffectations />}
      </div>
    </div>
  );
}
