/**
 * ============================================================================
 * SCHOOL LEVEL SELECTOR
 * ============================================================================
 *
 * Sélecteur de niveau scolaire dans la Top Bar.
 * OBLIGATOIRE - Aucun écran métier sans niveau scolaire.
 *
 * En mode FUSED_MATERNELLE_PRIMAIRE :
 *   - Affiche "Maternelle + Primaire" comme une seule unité administrative
 *   - Sélectionner cette unité propage automatiquement le niveau MATERNELLE
 *     ou PRIMARY (le backend résoudra les 2 niveaux conjointement)
 *   - Le secondaire reste une entrée séparée
 *
 * En mode SEPARATE :
 *   - Affiche chaque niveau individuellement (Maternelle, Primaire, Secondaire)
 * ============================================================================
 */

'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, GraduationCap, AlertCircle, GitMerge } from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useAdminStructureMode } from '@/hooks/useAdminStructureMode';

export default function SchoolLevelSelector() {
  const { currentLevel, setCurrentLevel, availableLevels, isLoading } = useSchoolLevel();
  const { mode, groups } = useAdminStructureMode();
  const [isOpen, setIsOpen] = useState(false);

  // En mode FUSED, on groupe les niveaux par unité administrative
  const isFused = mode === 'FUSED_MATERNELLE_PRIMAIRE';

  // Construire la liste d'options selon le mode
  const options = useMemo(() => {
    if (!isFused || groups.length === 0) {
      // Mode SEPARATE : chaque niveau individuellement
      return availableLevels.map((level) => ({
        id: level.id,
        label: getLevelLabel(level.code),
        code: level.code,
        color: getLevelColor(level.code),
        isGroup: false,
      }));
    }

    // Mode FUSED : grouper par unité administrative
    const opts: Array<{ id: string; label: string; code: string; color: string; isGroup: boolean }> = [];
    for (const group of groups) {
      if (group.unit === 'MAT_PRI') {
        // Unité fusionnée Maternelle + Primaire
        // On prend le premier niveau (maternelle) comme ID de référence
        const matLevel = availableLevels.find((l) => l.code === 'MATERNELLE');
        const priLevel = availableLevels.find((l) => l.code === 'PRIMARY');
        if (matLevel && priLevel) {
          opts.push({
            id: matLevel.id, // On sélectionne maternelle, le backend résoudra les 2
            label: 'Maternelle + Primaire',
            code: 'MAT_PRI',
            color: 'text-amber-600',
            isGroup: true,
          });
        }
      } else if (group.unit === 'SEC') {
        const secLevel = availableLevels.find((l) => l.code === 'SECONDAIRE');
        if (secLevel) {
          opts.push({
            id: secLevel.id,
            label: getLevelLabel(secLevel.code),
            code: secLevel.code,
            color: getLevelColor(secLevel.code),
            isGroup: false,
          });
        }
      }
    }
    return opts;
  }, [isFused, groups, availableLevels]);

  // Déterminer le label actuel
  const currentLabel = useMemo(() => {
    if (!currentLevel) return '';
    if (isFused && (currentLevel.code === 'MATERNELLE' || currentLevel.code === 'PRIMARY')) {
      return 'Maternelle + Primaire';
    }
    return getLevelLabel(currentLevel.code);
  }, [currentLevel, isFused]);

  const currentColor = useMemo(() => {
    if (!currentLevel) return 'text-gray-600';
    if (isFused && (currentLevel.code === 'MATERNELLE' || currentLevel.code === 'PRIMARY')) {
      return 'text-amber-600';
    }
    return getLevelColor(currentLevel.code);
  }, [currentLevel, isFused]);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <GraduationCap className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Chargement...</span>
      </div>
    );
  }

  if (!availableLevels.length || !currentLevel) {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md"
        title="Aucun niveau scolaire n'est activé pour ce tenant. Activez au moins un niveau dans Paramètres → Structure."
      >
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-700 font-medium">Aucun niveau scolaire</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        title={isFused ? 'Mode fusionné : Maternelle + Primaire partagent la même administration' : undefined}
      >
        {isFused && (currentLevel.code === 'MATERNELLE' || currentLevel.code === 'PRIMARY') ? (
          <GitMerge className={`w-4 h-4 ${currentColor}`} />
        ) : (
          <GraduationCap className={`w-4 h-4 ${currentColor}`} />
        )}
        <span className="text-sm font-medium text-gray-900">{currentLabel}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20">
            <div className="p-2">
              {isFused && (
                <div className="px-3 py-1.5 mb-1 bg-amber-50 rounded text-[10px] font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                  <GitMerge className="w-3 h-3" />
                  Mode fusionné
                </div>
              )}
              {options.map((opt) => {
                const isActive = isFused && opt.isGroup
                  ? (currentLevel.code === 'MATERNELLE' || currentLevel.code === 'PRIMARY')
                  : currentLevel.code === opt.code;
                return (
                  <button
                    key={opt.id + opt.code}
                    onClick={() => {
                      setCurrentLevel(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {opt.isGroup ? (
                        <GitMerge className={`w-3.5 h-3.5 ${opt.color}`} />
                      ) : (
                        <GraduationCap className={`w-3.5 h-3.5 ${opt.color}`} />
                      )}
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getLevelLabel(code: string): string {
  const labels: Record<string, string> = {
    MATERNELLE: 'Maternelle',
    PRIMARY: 'Primaire',
    SECONDAIRE: 'Secondaire',
    ALL: 'Tous les niveaux',
  };
  return labels[code] || code;
}

function getLevelColor(code: string): string {
  const colors: Record<string, string> = {
    MATERNELLE: 'text-pink-600',
    PRIMARY: 'text-emerald-600',
    SECONDAIRE: 'text-violet-600',
    ALL: 'text-amber-600',
  };
  return colors[code] || 'text-gray-600';
}
