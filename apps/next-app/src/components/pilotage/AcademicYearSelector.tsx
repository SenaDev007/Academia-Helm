/**
 * ============================================================================
 * ACADEMIC YEAR SELECTOR
 * ============================================================================
 * 
 * Sélecteur d'année scolaire dans la Top Bar
 * OBLIGATOIRE - Aucun écran sans année scolaire sélectionnée
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';

export default function AcademicYearSelector() {
  const { currentYear, setCurrentYear, availableYears, isLoading } = useAcademicYear();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading || !currentYear) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Chargement...</span>
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
              {availableYears.map((year) => (
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
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

