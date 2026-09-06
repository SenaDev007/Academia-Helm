/**
 * Academic Track Selector Component
 *
 * Sélecteur conditionnel pour choisir entre FR et EN
 * N'est affiché QUE si la feature BILINGUAL_TRACK est activée
 *
 * ⭐ DIRECTEUR LOCK :
 *    Si l'utilisateur est un directeur niveau-spécifique (DIRECTEUR_MATERNELLE,
 *    DIRECTEUR_PRIMAIRE, DIRECTEUR_SECONDAIRE, DIRECTEUR_MAT_PRI) avec une
 *    seule langue assignée, le sélecteur est masqué et la piste est lockée
 *    sur sa langue. Les DIRECTEUR_GENERAL et PROMOTER peuvent basculer
 *    librement entre FR et EN.
 */

'use client';

import { useState, useEffect } from 'react';
import { useFeature, FeatureCode } from '@/hooks/useFeature';
import { useAppSessionOptional } from '@/contexts/AppSessionContext';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { getUserScope } from '@/lib/auth/user-scope';
// ⭐ P4-final : sélecteur bilingue (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';

// ⭐ Rôles directeur niveau-spécifiques qui peuvent être language-locked
const LEVEL_SPECIFIC_DIRECTOR_ROLES = [
  'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI',
  'DIRECTEUR',
];

// ⭐ Rôles avec accès complet (peuvent basculer FR/EN librement)
const FULL_ACCESS_ROLES = [
  'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
  'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
  'SUPER_ADMIN', 'SUPER_DIRECTOR', 'admin',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
];

interface AcademicTrackSelectorProps {
  currentTrack?: 'FR' | 'EN';
  onTrackChange?: (track: 'FR' | 'EN') => void;
  className?: string;
}

export default function AcademicTrackSelector({
  currentTrack = 'FR',
  onTrackChange,
  className,
}: AcademicTrackSelectorProps) {
  const { isEnabled: isBilingualEnabled, loading } = useFeature(FeatureCode.BILINGUAL_TRACK);
  const [selectedTrack, setSelectedTrack] = useState<'FR' | 'EN'>(currentTrack);
  const session = useAppSessionOptional();
  const user = session?.user;
  // ⭐ Libellés dans la langue du profil
  const L = useL();

  // ⭐ Déterminer la langue lockée du directeur (si applicable)
  //    ⭐ P4 (2026-09-06) : SOURCE DE VÉRITÉ = le périmètre serveur résolu à la
  //    connexion (user_scope : pistes autorisées depuis StaffAdminAssignment /
  //    Teacher.assignedLanguages). L'ancienne heuristique (accréditations /
  //    user.function) reste en fallback si le scope est absent.
  //    TODO résolu : la langue authoritative vient désormais du serveur.
  const scopeLockedTrack: 'FR' | 'EN' | null = (() => {
    const scope = getUserScope();
    if (!scope) return null;
    if (scope.allTracks) return null; // bi-piste / transverse → pas de lock
    const tracks = Array.isArray(scope.trackCodes) ? scope.trackCodes : [];
    if (tracks.length === 1) return tracks[0] === 'EN' ? 'EN' : 'FR';
    return null;
  })();

  const heuristicLockedTrack: 'FR' | 'EN' | null = (() => {
    if (!user) return null;
    if (FULL_ACCESS_ROLES.includes(user.role)) return null; // Pas de lock
    if (!LEVEL_SPECIFIC_DIRECTOR_ROLES.includes(user.role)) return null;
    // Vérifier les accreditations pour une mention de langue
    const accreditations = user.accreditations || [];
    if (accreditations.some(a => typeof a === 'string' && a.toUpperCase().includes('EN'))) {
      return 'EN';
    }
    if (accreditations.some(a => typeof a === 'string' && a.toUpperCase().includes('FR'))) {
      return 'FR';
    }
    // Vérifier le champ function
    if (user.function && user.function.toUpperCase().includes('EN')) return 'EN';
    if (user.function && user.function.toUpperCase().includes('FR')) return 'FR';
    // Par défaut, on ne lock pas (le directeur peut basculer)
    return null;
  })();

  // Le lock serveur prime sur l'heuristique
  const lockedTrack = scopeLockedTrack ?? heuristicLockedTrack;

  // ⭐ Si le directeur est language-locked, force la piste sur sa langue
  useEffect(() => {
    if (lockedTrack && selectedTrack !== lockedTrack) {
      setSelectedTrack(lockedTrack);
      onTrackChange?.(lockedTrack);
      if (typeof window !== 'undefined') {
        localStorage.setItem('academic-track', lockedTrack);
      }
    }
  }, [lockedTrack, selectedTrack, onTrackChange]);

  // Restaurer depuis localStorage au chargement (seulement si pas de lock)
  useEffect(() => {
    if (lockedTrack) return; // Pas de restoration si lock
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('academic-track') as 'FR' | 'EN' | null;
      if (saved && (saved === 'FR' || saved === 'EN')) {
        setSelectedTrack(saved);
        onTrackChange?.(saved);
      }
    }
  }, [lockedTrack, onTrackChange]);

  // Ne pas afficher si la feature n'est pas activée
  if (loading) {
    return null;
  }

  if (!isBilingualEnabled) {
    return null; // Feature désactivée, sélecteur masqué
  }

  // ⭐ Si le directeur est language-locked, ne pas afficher le sélecteur
  //    (la piste est fixée automatiquement via le useEffect ci-dessus)
  if (lockedTrack) {
    return null;
  }

  const handleTrackChange = (track: 'FR' | 'EN') => {
    setSelectedTrack(track);
    onTrackChange?.(track);

    // Sauvegarder dans localStorage pour persistance
    if (typeof window !== 'undefined') {
      localStorage.setItem('academic-track', track);
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm font-medium text-gray-700">{L("Piste académique :", "Academic Track:")}</span>
      <div className="flex gap-2">
        <button
          onClick={() => handleTrackChange('FR')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
            selectedTrack === 'FR'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          <span className="flex items-center gap-2">
            <AppIcon name="globe" size="action" />
            {L("Francophone", "French Track")}
          </span>
        </button>
        <button
          onClick={() => handleTrackChange('EN')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
            selectedTrack === 'EN'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          <span className="flex items-center gap-2">
            <AppIcon name="globe" size="action" />
            {L("Anglophone", "English Track")}
          </span>
        </button>
      </div>
    </div>
  );
}

