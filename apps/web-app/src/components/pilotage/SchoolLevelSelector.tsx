/**
 * ============================================================================
 * SCHOOL LEVEL SELECTOR
 * ============================================================================
 * 
 * Sélecteur de niveau scolaire dans la Top Bar
 * OBLIGATOIRE - Aucun écran métier sans niveau scolaire
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ChevronDown, GraduationCap } from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';

export default function SchoolLevelSelector() {
  const { currentLevel, setCurrentLevel, availableLevels, isLoading } = useSchoolLevel();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <GraduationCap className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Chargement...</span>
      </div>
    );
  }
  if (!availableLevels.length) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-amber-50 rounded-md border border-amber-200">
        <GraduationCap className="w-4 h-4 text-amber-600" />
        <span className="text-sm text-amber-800">Aucun niveau activé</span>
      </div>
    );
  }
  if (!currentLevel) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <GraduationCap className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Chargement...</span>
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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        <GraduationCap className="w-4 h-4 text-gray-600" />
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
              {availableLevels.map((level) => (
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
                  {getLevelLabel(level.code)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

