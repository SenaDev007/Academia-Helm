/**
 * ============================================================================
 * ARCHITECT MODE - MODE ARCHITECTE (DEV ONLY)
 * ============================================================================
 * 
 * Composant React pour le mode architecte (PLATFORM_OWNER uniquement)
 * 
 * ⚠️ Ce composant n'existe qu'en développement
 * ⚠️ Il disparaît automatiquement en production
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PlatformOwnerStatus {
  isPlatformOwner: boolean;
  isEnabled: boolean;
  platformOwnerEmail: string | null;
  environment: string;
  message: string;
}

interface ForcedContext {
  tenantId?: string;
  academicYearId?: string;
  schoolLevelId?: string;
  classId?: string;
}

export function ArchitectMode() {
  const [forcedContext, setForcedContext] = useState<ForcedContext>({});
  const [isOpen, setIsOpen] = useState(false);

  // Vérifier si on est en développement
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Vérifier le statut PLATFORM_OWNER
  const { data: status, isLoading } = useQuery<PlatformOwnerStatus>({
    queryKey: ['platform-owner-status'],
    queryFn: async () => {
      const response = await fetch('/api/dev/platform-owner/status', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch platform owner status');
      }
      return response.json();
    },
    enabled: isDevelopment,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Si ce n'est pas le développement, ne rien afficher
  if (!isDevelopment) {
    return null;
  }

  // Si ce n'est pas le PLATFORM_OWNER, ne rien afficher
  if (!status?.isPlatformOwner) {
    return null;
  }

  // Appliquer le contexte forcé aux headers
  useEffect(() => {
    if (Object.keys(forcedContext).length > 0) {
      // Les headers seront envoyés automatiquement par le client HTTP
      // (axios/fetch interceptors)
    }
  }, [forcedContext]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Bouton toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors"
        title="Mode Architecte (DEV ONLY)"
      >
        🔐 Architect
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-96 bg-white border border-gray-300 rounded-lg shadow-xl p-4">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              🔐 Mode Architecte
            </h3>
            <p className="text-sm text-gray-600">
              {status.message}
            </p>
          </div>

          <div className="space-y-3">
            {/* Forcer Tenant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant ID
              </label>
              <input
                type="text"
                value={forcedContext.tenantId || ''}
                onChange={(e) =>
                  setForcedContext({ ...forcedContext, tenantId: e.target.value })
                }
                placeholder="tenant-id"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Forcer Academic Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year ID
              </label>
              <input
                type="text"
                value={forcedContext.academicYearId || ''}
                onChange={(e) =>
                  setForcedContext({
                    ...forcedContext,
                    academicYearId: e.target.value,
                  })
                }
                placeholder="academic-year-id"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Forcer School Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Level ID
              </label>
              <input
                type="text"
                value={forcedContext.schoolLevelId || ''}
                onChange={(e) =>
                  setForcedContext({
                    ...forcedContext,
                    schoolLevelId: e.target.value,
                  })
                }
                placeholder="school-level-id"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Forcer Class */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class ID
              </label>
              <input
                type="text"
                value={forcedContext.classId || ''}
                onChange={(e) =>
                  setForcedContext({ ...forcedContext, classId: e.target.value })
                }
                placeholder="class-id"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setForcedContext({})}
                className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
              >
                Reset
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Warning */}
          <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ DEV ONLY - Ce mode n'existe pas en production
          </div>
        </div>
      )}
    </div>
  );
}
