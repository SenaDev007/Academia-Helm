/**
 * ============================================================================
 * SCHOOL LEVEL SELECTOR
 * ============================================================================
 *
 * Sélecteur de niveau scolaire dans la Top Bar
 * OBLIGATOIRE - Aucun écran métier sans niveau scolaire
 *
 * Affiche un warning rouge si aucun niveau n'est activé pour ce tenant.
 * N'affiche QUE les niveaux activés dans Paramètres → Structure.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ChevronDown, GraduationCap, AlertCircle } from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';

export default function SchoolLevelSelector() {
  const { currentLevel, setCurrentLevel, availableLevels, isLoading } = useSchoolLevel();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <GraduationCap className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Chargement...</span>
      </div>
    );
  }

  // ⚠️ Mode "niveau strict" : warning si aucun niveau n'est activé
  if (!availableLevels.length || !currentLevel) {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md"
        title="Aucun niveau scolaire n'est activé pour ce tenant. Activez au moins un niveau dans Paramètres → Structure."
      >
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-700 font-medium">
          Aucun niveau scolaire
        </span>
      </div>
    );
  }

  const getLevelLabel = (code: string) => {
    const labels: Record<string, string> = {
      MATERNELLE: 'Maternelle',
      PRIMAIRE: 'Primaire',
      SECONDAIRE: 'Secondaire',
      ALL: 'Tous les niveaux',
    };
    return labels[code] || code;
  };

  const getLevelColor = (code: string) => {
    const colors: Record<string, string> = {
      MATERNELLE: 'text-pink-600',
      PRIMAIRE: 'text-emerald-600',
      SECONDAIRE: 'text-violet-600',
      ALL: 'text-amber-600',
    };
    return colors[code] || 'text-gray-600';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        <GraduationCap className={`w-4 h-4 ${getLevelColor(currentLevel.code)}`} />
        <span className="text-sm font-medium text-gray-900">
          {getLevelLabel(currentLevel.code)}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
            <div className="p-2">
              {availableLevels.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  Aucun niveau disponible.
                  <br />
                  Activez un niveau dans Paramètres → Structure.
                </div>
              ) : (
                availableLevels.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => {
                      setCurrentLevel(level.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      level.id === currentLevel.id
                        ? 'bg-blue-50 text-blue-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <GraduationCap className={`w-3.5 h-3.5 ${getLevelColor(level.code)}`} />
                      {getLevelLabel(level.code)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
