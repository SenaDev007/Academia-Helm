'use client';

/**
 * ============================================================================
 * CONFLICT RESOLUTION MODAL — Modal de résolution de conflits de sync
 * ============================================================================
 *
 * Affiche les conflits détectés lors de la synchronisation et permet au
 * directeur de choisir quelle version garder (locale, serveur, ou fusion).
 *
 * Le store IndexedDB `sync_conflicts` est alimenté par sync-engine.service.ts
 * quand une opération push reçoit un statut CONFLICT du serveur.
 *
 * Utilisation :
 *   <ConflictResolutionModal />
 *   (auto-monté dans layout-client.tsx, vérifie les conflits toutes les 30s)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, GitMerge, Server, Smartphone, RefreshCw, CheckCircle } from 'lucide-react';
import { conflictResolverService } from '@/lib/offline/conflict-resolver.service';
import { cn } from '@/lib/utils';

interface ConflictItem {
  id: string;
  table_name: string;
  local_data: string;
  server_data: string;
  detected_at: string;
}

export function ConflictResolutionModal() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  // ⭐ Vérifier les conflits toutes les 30s
  const checkConflicts = useCallback(async () => {
    try {
      const pending = await conflictResolverService.getPendingConflicts();
      if (pending.length > 0) {
        setConflicts(pending as ConflictItem[]);
        setIsOpen(true);
      }
    } catch {
      // IDB pas encore initialisé
    }
  }, []);

  useEffect(() => {
    checkConflicts();
    const interval = setInterval(checkConflicts, 30000);
    return () => clearInterval(interval);
  }, [checkConflicts]);

  const handleResolve = async (conflictId: string, strategy: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE_FIELDS') => {
    setResolving(conflictId);
    try {
      await conflictResolverService.resolve(conflictId, strategy);
      // Retirer le conflit résolu de la liste
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      if (conflicts.length <= 1) {
        setIsOpen(false);
      }
    } catch (e) {
      console.error('[ConflictResolution] Failed to resolve:', e);
    } finally {
      setResolving(null);
    }
  };

  if (!isOpen || conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-300 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              Conflits de synchronisation
            </h2>
            <p className="text-xs text-slate-600">
              {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''} détecté{conflicts.length > 1 ? 's' : ''} — choisissez quelle version conserver
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — liste des conflits */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {conflicts.map((conflict) => {
            const localData = (() => { try { return JSON.parse(conflict.local_data); } catch { return {}; } })();
            const serverData = (() => { try { return JSON.parse(conflict.server_data); } catch { return {}; } })();
            const tableName = conflict.table_name || 'Inconnu';

            return (
              <div key={conflict.id} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Info du conflit */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Table</span>
                      <p className="text-sm font-semibold text-slate-900">{tableName}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Détecté le</span>
                      <p className="text-xs text-slate-600">{new Date(conflict.detected_at).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                </div>

                {/* Comparaison des versions */}
                <div className="grid grid-cols-2 gap-px bg-slate-200">
                  {/* Version locale */}
                  <div className="bg-blue-50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-bold text-blue-700 uppercase">Votre version</span>
                    </div>
                    <pre className="text-[10px] text-slate-700 overflow-x-auto max-h-24">
                      {JSON.stringify(localData, null, 2).slice(0, 500)}
                    </pre>
                  </div>
                  {/* Version serveur */}
                  <div className="bg-emerald-50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Server className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700 uppercase">Version serveur</span>
                    </div>
                    <pre className="text-[10px] text-slate-700 overflow-x-auto max-h-24">
                      {JSON.stringify(serverData, null, 2).slice(0, 500)}
                    </pre>
                  </div>
                </div>

                {/* Boutons de résolution */}
                <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleResolve(conflict.id, 'CLIENT_WINS')}
                    disabled={resolving === conflict.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition disabled:opacity-50"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Garder ma version
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'SERVER_WINS')}
                    disabled={resolving === conflict.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition disabled:opacity-50"
                  >
                    <Server className="w-3.5 h-3.5" />
                    Garder la version serveur
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'MERGE_FIELDS')}
                    disabled={resolving === conflict.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition disabled:opacity-50"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    Fusionner les deux
                  </button>
                  {resolving === conflict.id && (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
            Les conflits non résolus seront conservés jusqu'à votre décision.
          </p>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

// ⭐ FIX (2026-09-18 — React #130 en production) : export DEFAULT conservé en
// plus de l'export nommé. Le commit perf 6f21bd4dc a converti l'import dans
// layout-client.tsx en import NOMMÉ ({ ConflictResolutionModal }) alors que ce
// module n'exportait qu'en default → au bundling SWC, l'identifiant compilait
// vers undefined → Minified React error #130 sur TOUTES les pages /app/* dès
// l'hydratation (écran « Une erreur s'est produite » au login). Avec les DEUX
// exports, les deux styles d'import restent valides — défense contre un futur
// codemod qui rebasculerait le style d'import.
export default ConflictResolutionModal;
