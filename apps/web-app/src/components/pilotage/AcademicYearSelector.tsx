/**
 * ============================================================================
 * ACADEMIC YEAR SELECTOR
 * ============================================================================
 *
 * Sélecteur d'année scolaire dans la Top Bar
 * OBLIGATOIRE - Aucun écran sans année scolaire sélectionnée
 *
 * Affiche un warning rouge si aucune année n'est disponible pour ce tenant.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Calendar, AlertCircle } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';

export default function AcademicYearSelector() {
  const { currentYear, setCurrentYear, availableYears, isLoading } = useAcademicYear();
  const [isOpen, setIsOpen] = useState(false);

  // État de chargement
  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <Calendar className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Chargement...</span>
      </div>
    );
  }

  // ⚠️ Mode "année stricte" : warning si aucune année n'est disponible
  if (!currentYear) {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md"
        title="Aucune année scolaire n'est configurée pour ce tenant. Contactez un administrateur pour en créer une."
      >
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-700 font-medium">
          Aucune année scolaire
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-900">
          {currentYear.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
            <div className="p-2">
              {availableYears.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  Aucune année scolaire disponible.
                  <br />
                  Contactez un administrateur.
                </div>
              ) : (
                availableYears.map((year) => (
                  <button
                    key={year.id}
                    onClick={() => {
                      setCurrentYear(year.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      year.id === currentYear.id
                        ? 'bg-navy-50 text-navy-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{year.name}</span>
                      {year.isCurrent && (
                        <span className="text-xs text-green-600 font-medium">Active</span>
                      )}
                    </div>
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


