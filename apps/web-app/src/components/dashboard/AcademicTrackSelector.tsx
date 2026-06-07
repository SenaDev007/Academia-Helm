/**
 * Academic Track Selector Component
 * 
 * Sélecteur conditionnel pour choisir entre FR et EN
 * N'est affiché QUE si la feature BILINGUAL_TRACK est activée
 */

'use client';

import { useState, useEffect } from 'react';
import { useFeature, FeatureCode } from '@/hooks/useFeature';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

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

  // Ne pas afficher si la feature n'est pas activée
  if (loading) {
    return null; // Ou un loader
  }

  if (!isBilingualEnabled) {
    return null; // Feature désactivée, sélecteur masqué
  }

  const handleTrackChange = (track: 'FR' | 'EN') => {
    setSelectedTrack(track);
    onTrackChange?.(track);
    
    // Sauvegarder dans localStorage pour persistance
    if (typeof window !== 'undefined') {
      localStorage.setItem('academic-track', track);
    }
  };

  // Restaurer depuis localStorage au chargement
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('academic-track') as 'FR' | 'EN' | null;
      if (saved && (saved === 'FR' || saved === 'EN')) {
        setSelectedTrack(saved);
        onTrackChange?.(saved);
      }
    }
  }, []);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm font-medium text-gray-700">Academic Track:</span>
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
            Francophone
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
            Anglophone
          </span>
        </button>
      </div>
    </div>
  );
}

