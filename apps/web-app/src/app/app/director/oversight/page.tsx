'use client';

/**
 * ============================================================================
 * PORTAIL DIRECTEUR — ESPACE DIRECTEUR (oversight)
 * ============================================================================
 *
 * Score de risque croisé + décrochage scolaire. Contenu historique de
 * /app/director, déplacé ici car /app/director est devenu la home du
 * portail dédié du directeur.
 *
 * Composants partagés (zéro duplication) : DirectorRiskDashboard,
 * DropoutDashboard — également accessibles depuis les autres portails à
 * mesure de leur migration.
 * ============================================================================
 */

import { useState } from 'react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import DirectorRiskDashboard from '@/components/director/DirectorRiskDashboard';
import DropoutDashboard from '@/components/director/DropoutDashboard';
import { Activity, TrendingDown, AlertTriangle } from 'lucide-react';

type DirectorTab = 'risk-score' | 'dropout';

const TABS = [
  {
    id: 'risk-score' as const,
    label: 'Score de Risque',
    description: 'Croisement conduite (SG) + pédagogie (censeur) + assiduité',
    icon: Activity,
    color: 'from-blue-700 to-blue-900',
  },
  {
    id: 'dropout' as const,
    label: 'Décrochage scolaire',
    description: 'Élèves en dégradation — tendances inter-trimestres',
    icon: TrendingDown,
    color: 'from-purple-700 to-purple-900',
  },
];

export default function DirectorOversightPage() {
  const { academicYear, tenant, schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const [activeTab, setActiveTab] = useState<DirectorTab>('risk-score');

  // ⭐ Garde-fou : le niveau Secondaire doit être activé pour accéder à l'Espace Directeur
  const secondaryEnabled = availableLevels.some(l => l.code === 'SECONDAIRE' && l.isActive);

  if (!secondaryEnabled) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Espace Directeur indisponible
        </h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          L'Espace Directeur (score de risque croisé + décrochage) est spécifique au niveau Secondaire.
          Activez le niveau Secondaire dans <strong>Paramètres → Structure</strong> pour y accéder.
        </p>
      </div>
    );
  }

  // Récupérer le trimestre courant depuis schoolLevel ou academicYear
  const quarterId = (academicYear as any)?.activeQuarterId || (schoolLevel as any)?.quarterId;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex gap-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              <div className="text-left">
                <div className="text-sm font-bold">{tab.label}</div>
                <div className="text-[10px] text-gray-500">{tab.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'risk-score' ? (
        <DirectorRiskDashboard
          tenant={tenant}
          academicYear={academicYear}
          quarterId={quarterId}
        />
      ) : (
        <DropoutDashboard
          tenant={tenant}
          academicYear={academicYear}
          quarterId={quarterId}
        />
      )}
    </div>
  );
}
