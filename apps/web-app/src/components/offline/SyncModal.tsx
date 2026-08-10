'use client';

/**
 * ============================================================================
 * SYNC MODAL — Modal de chargement pendant la synchronisation
 * ============================================================================
 *
 * Affiche un modal avec spinner quand une sync (pull + push) est en cours.
 * L'utilisateur voit : "Synchronisation en cours..." + animation.
 *
 * Le modal est non-bloquant (l'utilisateur peut cliquer ailleurs) mais visible.
 *
 * Monté dans layout-client.tsx via useSyncModal().
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, AlertCircle, CloudDownload, CloudUpload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncModalState {
  isVisible: boolean;
  phase: 'push' | 'pull' | 'done' | 'error' | null;
  message: string;
  pushed: number;
  pulled: number;
}

let modalListeners: ((state: SyncModalState) => void)[] = [];

export function setSyncModalState(state: Partial<SyncModalState>) {
  const fullState: SyncModalState = {
    isVisible: state.isVisible ?? false,
    phase: state.phase ?? null,
    message: state.message ?? '',
    pushed: state.pushed ?? 0,
    pulled: state.pulled ?? 0,
  };
  for (const cb of modalListeners) {
    try { cb(fullState); } catch {}
  }
}

export function useSyncModal() {
  const [state, setState] = useState<SyncModalState>({
    isVisible: false,
    phase: null,
    message: '',
    pushed: 0,
    pulled: 0,
  });

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

  return (
    <AnimatePresence>
      {state.isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
          >
            {/* Icône animée */}
            <div className="flex justify-center mb-4">
              {state.phase === 'done' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
              ) : state.phase === 'error' ? (
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
              )}
            </div>

            {/* Titre */}
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {state.phase === 'done'
                ? 'Synchronisation terminée'
                : state.phase === 'error'
                  ? 'Erreur de synchronisation'
                  : 'Synchronisation en cours'}
            </h3>

            {/* Message */}
            <p className="text-sm text-slate-500 mb-4">
              {state.message || (state.phase === 'push'
                ? 'Envoi de vos modifications vers le serveur...'
                : state.phase === 'pull'
                  ? 'Récupération des dernières données...'
                  : state.phase === 'done'
                    ? `${state.pushed} envoi(s) • ${state.pulled} mise(s) à jour reçue(s)`
                    : 'Veuillez patienter...')}
            </p>

            {/* Phases */}
            {state.phase !== 'done' && state.phase !== 'error' && (
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className={`flex items-center gap-1.5 ${state.phase === 'push' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>Envoi</span>
                </div>
                <div className="w-8 h-px bg-slate-200" />
                <div className={`flex items-center gap-1.5 ${state.phase === 'pull' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                  <CloudDownload className="h-3.5 w-3.5" />
                  <span>Réception</span>
                </div>
              </div>
            )}

            {/* Fermer si done/error */}
            {(state.phase === 'done' || state.phase === 'error') && (
              <button
                onClick={() => setSyncModalState({ isVisible: false })}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700"
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
