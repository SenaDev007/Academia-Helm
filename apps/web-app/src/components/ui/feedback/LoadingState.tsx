/**
 * ============================================================================
 * LOADING STATE - ÉTAT DE CHARGEMENT
 * ============================================================================
 * 
 * Composant standard pour afficher un état de chargement
 * 
 * ============================================================================
 */

'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingState({
  message = 'Chargement...',
  fullScreen = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        fullScreen ? 'min-h-screen' : 'py-12',
        className,
      )}
    >
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
