'use client';

/**
 * ============================================================================
 * SYNC MODAL — Modal de chargement détaillé (style GitHub)
 * ============================================================================
 *
 * Affiche un modal avec :
 *   - Barre de progression animée (0-100%)
 *   - Liste des opérations qui défile (push + pull)
 *   - Détail de chaque opération (type, table, action, statut)
 *   - Pourcentage en temps réel
 *
 * Comme GitHub : liste les commits/modifications qui vont être poussés
 * ou tirés, avec un défilement du bas vers le haut.
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Check, AlertCircle, CloudDownload, CloudUpload, ArrowUp, ArrowDown, FileText, Trash2, Edit, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SyncOperation {
  id: string;
  type: 'push' | 'pull';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  recordId?: string;
  status: 'pending' | 'success' | 'error' | 'conflict';
  message?: string;
}

interface SyncModalState {
  isVisible: boolean;
  phase: 'push' | 'pull' | 'done' | 'error' | null;
  message: string;
  pushed: number;
  pulled: number;
  total: number;
  current: number;
  operations: SyncOperation[];
}

let modalListeners: ((state: SyncModalState) => void)[] = [];
let currentState: SyncModalState = {
  isVisible: false,
  phase: null,
  message: '',
  pushed: 0,
  pulled: 0,
  total: 0,
  current: 0,
  operations: [],
};

export function setSyncModalState(state: Partial<SyncModalState>) {
  currentState = { ...currentState, ...state };
  for (const cb of modalListeners) {
    try { cb(currentState); } catch {}
  }
}

export function addSyncOperation(op: SyncOperation) {
  currentState = {
    ...currentState,
    operations: [...currentState.operations, op].slice(-50), // Garder les 50 dernières
    current: currentState.current + 1,
  };
  for (const cb of modalListeners) {
    try { cb(currentState); } catch {}
  }
}

export function useSyncModal() {
  const [state, setState] = useState<SyncModalState>(currentState);

  useEffect(() => {
    const cb = (newState: SyncModalState) => setState(newState);
    modalListeners.push(cb);
    return () => {
      modalListeners = modalListeners.filter(l => l !== cb);
    };
  }, []);

  return state;
}

export function SyncModal() {
  const state = useSyncModal();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand de nouvelles opérations arrivent
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.operations]);

  const progress = state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;

  return (
    <AnimatePresence>
      {state.isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
          >
            {/* Header avec icône */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                {state.phase === 'done' ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="h-5 w-5 text-emerald-600" />
                  </div>
                ) : state.phase === 'error' ? (
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  {state.phase === 'done'
                    ? 'Synchronisation terminée'
                    : state.phase === 'error'
                      ? 'Erreur de synchronisation'
                      : 'Synchronisation en cours'}
                </h3>
                <p className="text-xs text-slate-500">
                  {state.message || (state.phase === 'push'
                    ? 'Envoi des modifications locales...'
                    : state.phase === 'pull'
                      ? 'Récupération des données distantes...'
                      : '')}
                </p>
              </div>
              {/* Pourcentage */}
              {state.phase !== 'done' && state.phase !== 'error' && state.total > 0 && (
                <span className="text-lg font-bold text-blue-600 tabular-nums">{progress}%</span>
              )}
            </div>

            {/* Barre de progression */}
            {state.phase !== 'done' && state.phase !== 'error' && (
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {/* Liste des opérations (style GitHub) */}
            {state.operations.length > 0 && (
              <div
                ref={scrollRef}
                className="bg-slate-50 rounded-lg border border-slate-200 p-2 mb-4 max-h-48 overflow-y-auto"
              >
                <div className="space-y-1">
                  {state.operations.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-2 text-[10px] font-mono py-0.5 px-1 rounded"
                    >
                      {/* Direction */}
                      <span className={cn(
                        'flex items-center justify-center w-4 h-4 rounded shrink-0',
                        op.type === 'push' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                      )}>
                        {op.type === 'push' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                      </span>

                      {/* Action icon */}
                      <span className="shrink-0 text-slate-400">
                        {op.action === 'INSERT' ? <Plus className="h-3 w-3 text-emerald-500" />
                          : op.action === 'UPDATE' ? <Edit className="h-3 w-3 text-blue-500" />
                          : op.action === 'DELETE' ? <Trash2 className="h-3 w-3 text-red-500" />
                          : <FileText className="h-3 w-3 text-slate-400" />}
                      </span>

                      {/* Table + recordId */}
                      <span className="text-slate-700 truncate flex-1">
                        {op.table}
                        {op.recordId && <span className="text-slate-400 ml-1">#{op.recordId.substring(0, 8)}</span>}
                      </span>

                      {/* Statut */}
                      <span className="shrink-0">
                        {op.status === 'success' && <Check className="h-3 w-3 text-emerald-500" />}
                        {op.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
                        {op.status === 'pending' && <RefreshCw className="h-3 w-3 text-slate-300 animate-spin" />}
                        {op.status === 'conflict' && <AlertCircle className="h-3 w-3 text-amber-500" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            {(state.phase === 'done' || state.pushed > 0 || state.pulled > 0) && (
              <div className="flex items-center justify-center gap-4 mb-4 text-xs">
                <span className="flex items-center gap-1 text-blue-600 font-bold">
                  <CloudUpload className="h-3.5 w-3.5" />
                  {state.pushed} envoyé(s)
                </span>
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <CloudDownload className="h-3.5 w-3.5" />
                  {state.pulled} reçu(s)
                </span>
              </div>
            )}

            {/* Bouton fermer */}
            {(state.phase === 'done' || state.phase === 'error') && (
              <button
                onClick={() => setSyncModalState({ isVisible: false })}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                Fermer
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
