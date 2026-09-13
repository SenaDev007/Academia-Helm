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
import { ChevronDown, GraduationCap, AlertCircle, GitMerge, Lock, RefreshCw } from 'lucide-react';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useAdminStructureMode } from '@/hooks/useAdminStructureMode';
import { useAppSessionOptional } from '@/contexts/AppSessionContext';
// ⭐ P4-final : sélecteur bilingue (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';

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
  'DIRECTEUR_MAT', 'DIRECTEUR_PRI', 'DIRECTEUR_SEC',
  'DIRECTEUR',
];

// ⭐ Rôles admin niveau-spécifiques (produits par resolveUserRoleWithLevel)
//    Ces rôles contiennent un suffixe de niveau (_MAT, _PRI, _SEC, _MAT_PRI)
//    On les détecte pour filtrer le SchoolLevelSelector.
const LEVEL_SUFFIX_PATTERN = /_(MAT|PRI|SEC|MAT_PRI)$/;

// ⭐ Détecter si un rôle est niveau-spécifique et extraire le code de niveau
function extractLevelFromRole(role: string): string | null {
  const match = role.match(LEVEL_SUFFIX_PATTERN);
  if (!match) return null;
  const suffix = match[1];
  // Convertir le suffixe en code de niveau scolaire
  switch (suffix) {
    case 'MAT': return 'MATERNELLE';
    case 'PRI': return 'PRIMARY';
    case 'SEC': return 'SECONDAIRE';
    case 'MAT_PRI': return 'MAT_PRI'; // géré plus tard (maternelle + primaire fusionnés)
    default: return null;
  }
}

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
  const { currentLevel, setCurrentLevel, availableLevels, isLoading, isEmpty, retry } = useSchoolLevel();
  const { mode, groups } = useAdminStructureMode();
  const session = useAppSessionOptional();
  const user = session?.user;
  const [isOpen, setIsOpen] = useState(false);
  // ⭐ Libellés dans la langue du profil (piste EN → Nursery/Primary/Secondary)
  const L = useL();
  const isEN = L('fr', 'en') === 'en';

  // En mode FUSED, on groupe les niveaux par unité administrative
  const isFused = mode === 'FUSED_MATERNELLE_PRIMAIRE';

  // ⭐ Déterminer si l'utilisateur doit être filtré par accreditation
  //    - FULL_ACCESS_ROLES : pas de filtrage (voient tous les niveaux)
  //    - LEVEL_SPECIFIC_DIRECTOR_ROLES + autres rôles avec accreditations :
  //      filtrer pour ne montrer que les niveaux autorisés
  const isFullAccess = user ? FULL_ACCESS_ROLES.includes(user.role) : true;
  const userAccreditations = user?.accreditations || [];

  // ⭐ Filtrer les niveaux disponibles selon les accreditations du user
  //    ⭐⭐ On vérifie aussi si le role contient un suffixe niveau-spécifique
  //        (ex: SECRETAIRE_COMPTABLE_MAT_PRI → on autorise Maternelle + Primaire)
  const allowedLevels = useMemo(() => {
    if (!availableLevels.length) return [];
    // Si l'utilisateur a un accès complet, on garde tous les niveaux
    if (isFullAccess) return availableLevels;

    // ⭐ Vérifier si le role contient un suffixe de niveau (_MAT, _PRI, _SEC, _MAT_PRI)
    const roleLevelCode = user?.role ? extractLevelFromRole(user.role) : null;
    if (roleLevelCode) {
      if (roleLevelCode === 'MAT_PRI') {
        // Mode fusionné : autoriser Maternelle et Primaire
        return availableLevels.filter(level => level.code === 'MATERNELLE' || level.code === 'PRIMARY');
      }
      return availableLevels.filter(level => level.code === roleLevelCode);
    }

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
        label: getLevelLabel(level.code, isEN),
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
            label: isEN ? 'Nursery + Primary' : 'Maternelle + Primaire',
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
            label: getLevelLabel(secLevel.code, isEN),
            code: secLevel.code,
            color: getLevelColor(secLevel.code),
            isGroup: false,
          });
        }
      }
    }
    return opts;
  }, [isFused, groups, allowedLevels, isEN]);

  // Déterminer le label actuel
  const currentLabel = useMemo(() => {
    if (!currentLevel) return '';
    if (isFused && (currentLevel.code === 'MATERNELLE' || currentLevel.code === 'PRIMARY')) {
      return isEN ? 'Nursery + Primary' : 'Maternelle + Primaire';
    }
    return getLevelLabel(currentLevel.code, isEN);
  }, [currentLevel, isFused, isEN]);

  const currentColor = useMemo(() => {
    if (!currentLevel) return 'text-gray-600';
    if (isFused && (currentLevel.code === 'MATERNELLE' || currentLevel.code === 'PRIMARY')) {
      return 'text-amber-600';
    }
    return getLevelColor(currentLevel.code);
  }, [currentLevel, isFused]);

  // État de chargement
  // ⭐ V19 : inclut les RETRIES réseau — pendant un échec transitoire (401
  //    Railway, cold start Neon, 2G), on affiche « Chargement... » au lieu du
  //    warning rouge. Le warning n'apparaît que si la liste est CONFIRMÉE
  //    vide par le serveur (cf. SchoolLevelContext.isEmpty).
  if (isLoading || (!currentLevel && !isEmpty)) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-md">
        <GraduationCap className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">{L("Chargement...", "Loading...")}</span>
        {/* ⭐ FIX 2026-09-14 : action manuelle pendant un chargement prolongé
            (erreur en retry) — l'utilisateur n'est plus bloqué sans action. */}
        <button
          type="button"
          onClick={retry}
          title={L("Relancer le chargement", "Reload")}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!allowedLevels.length || !currentLevel) {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md"
        title={L(
          "Aucun niveau scolaire n'est activé pour ce tenant. Activez au moins un niveau dans Paramètres → Structure.",
          "No school level is enabled for this tenant. Enable at least one level in Settings → Structure.",
        )}
      >
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-700 font-medium">{L("Aucun niveau scolaire", "No school level")}</span>
        {/* ⭐ FIX 2026-09-14 : bouton « Réessayer » — le rouge n'était pas
            cliquable : l'utilisateur restait bloqué sans aucune action. */}
        <button
          type="button"
          onClick={retry}
          title={L("Réessayer le chargement", "Retry loading")}
          className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-700 bg-red-100 hover:bg-red-200 border border-red-300 rounded transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {L("Réessayer", "Retry")}
        </button>
      </div>
    );
  }

  // ⭐ Si le sélecteur est locké (directeur mono-niveau), afficher un badge fixe
  //    sans dropdown pour éviter la confusion.
  if (isLocked) {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
        title={L(
          `Niveau fixé : ${currentLabel}. Votre compte n'a accès qu'à ce niveau.`,
          `Fixed level: ${currentLabel}. Your account only has access to this level.`,
        )}
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
        title={isFused ? L("Mode fusionné : Maternelle + Primaire partagent la même administration", "Fused mode: Nursery + Primary share the same administration") : undefined}
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
                  {L("Mode fusionné", "Fused mode")}
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

function getLevelLabel(code: string, isEN = false): string {
  const labels: Record<string, string> = isEN
    ? {
        // ⭐ Piste anglophone : les niveaux s'appellent Nursery / Primary / Secondary
        //    (cohérent avec les sections EN créées côté données — Nursery 1, Primary 1…)
        MATERNELLE: 'Nursery',
        PRIMARY: 'Primary',
        SECONDAIRE: 'Secondary',
        ALL: 'All levels',
      }
    : {
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
