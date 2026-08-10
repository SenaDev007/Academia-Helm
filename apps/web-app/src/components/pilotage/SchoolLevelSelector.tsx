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

import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, GraduationCap, AlertCircle, GitMerge, Lock } from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useAdminStructureMode } from '@/hooks/useAdminStructureMode';
import { useAppSessionOptional } from '@/contexts/AppSessionContext';

// ⭐ Rôles qui ont accès à TOUS les niveaux (pas de filtrage par accreditation)
const FULL_ACCESS_ROLES = [
  'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
  'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
  'SUPER_ADMIN', 'SUPER_DIRECTOR', 'admin',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
];

// ⭐ Rôles directeur niveau-spécifiques (doivent être filtrés par accreditation)
const LEVEL_SPECIFIC_DIRECTOR_ROLES = [
  'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI',
  'DIRECTEUR',
];

// ⭐ Mapping accreditation → code de niveau scolaire
//    Les accreditations du user sont stockées avec des codes comme 'MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'
//    mais on peut aussi avoir 'PRIMARY' (legacy). On normalise tout vers les codes disponibles dans availableLevels.
function accreditationToLevelCode(accreditation: string): string {
  const upper = accreditation.toUpperCase();
  if (upper.startsWith('MAT')) return 'MATERNELLE';
  if (upper.startsWith('PRI') || upper === 'PRIMARY') return 'PRIMARY';
  if (upper.startsWith('SEC')) return 'SECONDAIRE';
  return upper;
}

export default function SchoolLevelSelector() {
  const { currentLevel, setCurrentLevel, availableLevels, isLoading } = useSchoolLevel();
  const { mode, groups } = useAdminStructureMode();
  const session = useAppSessionOptional();
  const user = session?.user;
  const [isOpen, setIsOpen] = useState(false);

  // En mode FUSED, on groupe les niveaux par unité administrative
  const isFused = mode === 'FUSED_MATERNELLE_PRIMAIRE';

  // ⭐ Déterminer si l'utilisateur doit être filtré par accreditation
  //    - FULL_ACCESS_ROLES : pas de filtrage (voient tous les niveaux)
  //    - LEVEL_SPECIFIC_DIRECTOR_ROLES + autres rôles avec accreditations :
  //      filtrer pour ne montrer que les niveaux autorisés
  const isFullAccess = user ? FULL_ACCESS_ROLES.includes(user.role) : true;
  const userAccreditations = user?.accreditations || [];

  // ⭐ Filtrer les niveaux disponibles selon les accreditations du user
  const allowedLevels = useMemo(() => {
    if (!availableLevels.length) return [];
    // Si l'utilisateur a un accès complet, on garde tous les niveaux
    if (isFullAccess) return availableLevels;
    // Si l'utilisateur a des accreditations, on filtre
    if (userAccreditations.length > 0) {
      const allowedCodes = new Set(userAccreditations.map(accreditationToLevelCode));
      return availableLevels.filter(level => allowedCodes.has(level.code));
    }
    // Fallback : utiliser levelScopes (UUIDs) si présent
    if (user?.levelScopes && user.levelScopes.length > 0) {
      return availableLevels.filter(level => user.levelScopes!.includes(level.id));
    }
    // Si pas d'accreditations ni levelScopes, on laisse tout (comportement par défaut)
    return availableLevels;
  }, [availableLevels, isFullAccess, userAccreditations, user?.levelScopes]);

  // ⭐ Si un seul niveau est autorisé, auto-sélectionner ce niveau au montage
  //    (pour les directeurs mono-niveau comme DIRECTEUR_SECONDAIRE)
  useEffect(() => {
    if (isFullAccess) return; // Pas de lock pour les full access
    if (allowedLevels.length === 1 && currentLevel?.id !== allowedLevels[0].id) {
      setCurrentLevel(allowedLevels[0].id);
    }
  }, [allowedLevels, currentLevel?.id, setCurrentLevel, isFullAccess]);

  // ⭐ Détermine si le sélecteur doit être locké (un seul niveau autorisé)
  const isLocked = !isFullAccess && allowedLevels.length === 1;

  // Construire la liste d'options selon le mode
  const options = useMemo(() => {
    // ⭐ Utiliser allowedLevels (filtré par accreditation) au lieu de availableLevels
    if (!isFused || groups.length === 0) {
      // Mode SEPARATE : chaque niveau individuellement
      return allowedLevels.map((level) => ({
        id: level.id,
        label: getLevelLabel(level.code),
        code: level.code,
        color: getLevelColor(level.code),
        isGroup: false,
      }));
    }

    // Mode FUSED : grouper par unité administrative
    // ⭐ On filtre aussi selon allowedLevels — un DIRECTEUR_SECONDAIRE ne doit
    //    pas voir l'option "Maternelle + Primaire" même en mode fused.
    const opts: Array<{ id: string; label: string; code: string; color: string; isGroup: boolean }> = [];
    const allowedCodes = new Set(allowedLevels.map(l => l.code));
    for (const group of groups) {
      if (group.unit === 'MAT_PRI') {
        // Ne proposer l'option fused que si l'utilisateur a accès à au moins
        // un des deux niveaux (maternelle ou primaire)
        if (!allowedCodes.has('MATERNELLE') && !allowedCodes.has('PRIMARY')) continue;
        const matLevel = allowedLevels.find((l) => l.code === 'MATERNELLE');
        const priLevel = allowedLevels.find((l) => l.code === 'PRIMARY');
        if (matLevel || priLevel) {
          opts.push({
            id: (matLevel || priLevel)!.id,
            label: 'Maternelle + Primaire',
            code: 'MAT_PRI',
            color: 'text-amber-600',
            isGroup: true,
          });
        }
      } else if (group.unit === 'SEC') {
        if (!allowedCodes.has('SECONDAIRE')) continue;
        const secLevel = allowedLevels.find((l) => l.code === 'SECONDAIRE');
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
  }, [isFused, groups, allowedLevels]);

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

  if (!allowedLevels.length || !currentLevel) {
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

  // ⭐ Si le sélecteur est locké (directeur mono-niveau), afficher un badge fixe
  //    sans dropdown pour éviter la confusion.
  if (isLocked) {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
        title={`Niveau fixé : ${currentLabel}. Votre compte directeur n'a accès qu'à ce niveau.`}
      >
        {isFused && (currentLevel.code === 'MATERNELLE' || currentLevel.code === 'PRIMARY') ? (
          <GitMerge className={`w-4 h-4 ${currentColor}`} />
        ) : (
          <GraduationCap className={`w-4 h-4 ${currentColor}`} />
        )}
        <span className="text-sm font-medium text-gray-900">{currentLabel}</span>
        <Lock className="w-3 h-3 text-slate-400" />
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
