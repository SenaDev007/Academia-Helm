/**
 * LogoutLoadingScreen Component
 * 
 * Écran de chargement pendant le flow de logout
 * Affiche les messages de progression
 */

'use client';

import { LogOut } from 'lucide-react';
import type { LogoutFlowProgress } from '@/lib/logout/secure-logout-flow.service';

export interface LogoutLoadingScreenProps {
  progress: LogoutFlowProgress | null;
}

/**
 * Écran de chargement pour le logout
 */
export function LogoutLoadingScreen({ progress }: LogoutLoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-6 text-center">
        {/* Icône */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-orange-200"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <LogOut className="h-10 w-10 text-orange-600 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {progress?.message || 'Déconnexion en cours…'}
        </h2>

        {/* Barre de progression */}
        {progress && (
          <div className="mt-6">
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
