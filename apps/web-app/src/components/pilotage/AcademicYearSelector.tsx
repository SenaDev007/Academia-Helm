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
// ⭐ P4-final : sélecteur bilingue (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';

export default function AcademicYearSelector() {
  const { currentYear, setCurrentYear, availableYears, isLoading, isEmpty } = useAcademicYear();
  const [isOpen, setIsOpen] = useState(false);
  // ⭐ Libellés dans la langue du profil
  const L = useL();

  // État de chargement
  // ⭐ V19 : inclut les RETRIES réseau (une liste vide NON confirmée n'est pas
  //    « aucune année » — cf. AcademicYearContext.isEmpty) : pendant un échec
  //    transitoire (401 Railway, cold start Neon, 2G), on affiche « Chargement... »
  //    au lieu du warning rouge — les années arrivent dès que le réseau répond.
  if (isLoading || (!currentYear && !isEmpty)) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <Calendar className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">{L("Chargement...", "Loading...")}</span>
      </div>
    );
  }

  // ⚠️ Mode "année stricte" : warning si aucune année n'est disponible
  if (!currentYear) {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md"
        title={L(
          "Aucune année scolaire n'est configurée pour ce tenant. Contactez un administrateur pour en créer une.",
          "No school year is configured for this tenant. Contact an administrator to create one.",
        )}
      >
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-700 font-medium">
          {L("Aucune année scolaire", "No school year")}
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
                  {L("Aucune année scolaire disponible.", "No school year available.")}
                  <br />
                  {L("Contactez un administrateur.", "Contact an administrator.")}
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
                        <span className="text-xs text-green-600 font-medium">{L("Active", "Current")}</span>
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


