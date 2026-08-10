'use client';

/**
 * ============================================================================
 * SYNC MODAL — Animation visuelle du flux de données
 * ============================================================================
 *
 * Affiche un modal avec :
 *   - Animation visuelle cloud ↔ stockage local
 *     • PULL : cloud en haut, stockage local en bas, flèche qui descend,
 *       données qui défilent du haut vers le bas
 *     • PUSH : stockage local en bas, cloud en haut, flèche qui monte,
 *       données qui défilent du bas vers le haut
 *   - Barre de progression animée (0-100%)
 *   - Estimation du temps restant basée sur la vitesse
 *   - Message respectueux demandant à l'utilisateur de patienter
 *   - Liste des opérations qui défile (style console)
 *
 * AUCUNE mention d'infrastructure interne (pas de "Neon", pas de "base
 * de données distante PostgreSQL", etc.). On parle uniquement de
 * "serveur" et de "stockage local".
 * ============================================================================
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  RefreshCw, Check, AlertCircle, CloudUpload, CloudDownload,
  ArrowUp, ArrowDown, FileText, Trash2, Edit, Plus,
  HardDrive, Cloud, Database, Clock, Minimize2, Maximize2, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  subscribeToSyncModalState,
  setSyncModalState as setModalState,
  addSyncOperation as addOp,
  getSyncModalState,
  type SyncModalState,
} from '@/lib/offline/sync-modal-state';

// Re-export pour rétro-compat (SyncButton importe depuis ici)
export const setSyncModalState = setModalState;
export const addSyncOperation = addOp;

export function useSyncModal() {
  const [state, setState] = useState<SyncModalState>(getSyncModalState());

  useEffect(() => {
    return subscribeToSyncModalState(setState);
  }, []);

  return state;
}

/**
 * Estime le temps restant en secondes basé sur la vitesse observée.
 * Si on a fait X opérations en Y secondes, on estime le reste à
 * (total - current) * (Y / X).
 */
function useTimeEstimate(current: number, total: number): string {
  const startTimeRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<{ current: number; time: number } | null>(null);
  const [estimate, setEstimate] = useState<string>('—');

  useEffect(() => {
    if (total === 0 || current === 0) {
      // Réinitialiser au début d'une sync
      if (current === 0) {
        startTimeRef.current = Date.now();
        lastUpdateRef.current = null;
      }
      setEstimate('Calcul en cours…');
      return;
    }

    // Enregistrer le moment où on atteint current pour la première fois
    if (!lastUpdateRef.current || lastUpdateRef.current.current !== current) {
      lastUpdateRef.current = { current, time: Date.now() };
    }

    if (current >= total) {
      setEstimate('Terminé');
      return;
    }

    const startTime = startTimeRef.current;
    if (!startTime) return;
    const elapsedSec = (Date.now() - startTime) / 1000;
    if (elapsedSec < 1 || current === 0) {
      setEstimate('Calcul en cours…');
      return;
    }

    const ratePerSec = current / elapsedSec;
    if (ratePerSec <= 0) {
      setEstimate('Calcul en cours…');
      return;
    }

    const remainingSec = (total - current) / ratePerSec;
    if (remainingSec < 1) {
      setEstimate('Presque terminé…');
    } else if (remainingSec < 60) {
      setEstimate(`~${Math.ceil(remainingSec)} s restantes`);
    } else {
      const min = Math.floor(remainingSec / 60);
      const sec = Math.ceil(remainingSec % 60);
      setEstimate(`~${min} min ${sec}s restantes`);
    }
  }, [current, total]);

  return estimate;
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
  const isIndeterminate =
    (state.phase === 'push' || state.phase === 'pull') && state.total === 0;
  const minBarWidth = (state.phase === 'pull' || state.phase === 'push') && state.total > 0 && state.current === 0
    ? 5
    : progress;

  const timeEstimate = useTimeEstimate(state.current, state.total);

  const isPull = state.phase === 'pull';
  const isPush = state.phase === 'push';
  const isDone = state.phase === 'done';
  const isError = state.phase === 'error';
  const isActive = isPull || isPush;

  return (
    <AnimatePresence>
      {state.isVisible && (
        <>
          {/* ─── MODE PASTILLE (réduit) — opération continue en arrière-plan ─── */}
          {state.isMinimized ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="fixed bottom-4 right-4 z-[9998] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 flex items-center gap-3 cursor-pointer hover:shadow-lg transition-shadow max-w-xs"
              onClick={() => setModalState({ isMinimized: false })}
              title="Cliquez pour agrandir le modal de synchronisation"
            >
              {/* Icône spinner */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                isDone ? 'bg-emerald-100' : isError ? 'bg-red-100' : isPull ? 'bg-emerald-100' : 'bg-blue-100'
              }`}>
                {isDone ? <Check className="h-4 w-4 text-emerald-600" />
                  : isError ? <AlertCircle className="h-4 w-4 text-red-600" />
                  : <RefreshCw className={`h-4 w-4 animate-spin ${isPull ? 'text-emerald-600' : 'text-blue-600'}`} />}
              </div>
              {/* Texte */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {isDone ? 'Sync terminée' : isError ? 'Erreur sync' : isPull ? 'Téléchargement…' : 'Envoi…'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {state.total > 0 ? `${state.current}/${state.total} · ${progress}%` : state.message || 'En cours…'}
                </p>
                {/* Mini barre de progression */}
                {!isDone && !isError && (
                  <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isPull ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${minBarWidth}%` }}
                    />
                  </div>
                )}
              </div>
              {/* Bouton agrandir */}
              <button
                onClick={(e) => { e.stopPropagation(); setModalState({ isMinimized: false }); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 shrink-0"
                title="Agrandir"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            /* ─── MODE FULL OVERLAY (normal) ─── */
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
                className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full relative"
              >
                {/* ⭐ Bouton "Réduire" — visible pendant push/pull/done/error */}
                {/*    Permet à l'utilisateur de continuer à travailler pendant
                      que la sync tourne en arrière-plan. */}
                {isActive && (
                  <button
                    onClick={() => setModalState({ isMinimized: true })}
                    className="absolute top-3 right-3 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 z-10"
                    title="Réduire — l'opération continue en arrière-plan"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                )}

                {/* ─── Header ─── */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    {isDone ? (
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Check className="h-5 w-5 text-emerald-600" />
                      </div>
                    ) : isError ? (
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                ) : isPull ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CloudDownload className="h-5 w-5 text-emerald-600" />
                  </div>
                ) : isPush ? (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <CloudUpload className="h-5 w-5 text-blue-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  {isDone
                    ? 'Synchronisation terminée'
                    : isError
                      ? 'Erreur de synchronisation'
                      : isPull
                        ? 'Téléchargement des données'
                        : isPush
                          ? 'Envoi des modifications'
                          : 'Synchronisation en cours'}
                </h3>
                <p className="text-xs text-slate-500 truncate" title={state.message}>
                  {state.message || (isPush
                    ? 'Envoi de vos modifications locales…'
                    : isPull
                      ? 'Récupération des données du serveur…'
                      : '')}
                </p>
              </div>
              {/* Pourcentage */}
              {isActive && state.total > 0 && (
                <span className={`text-lg font-bold tabular-nums ${
                  isPull ? 'text-emerald-600' : 'text-blue-600'
                }`}>{progress}%</span>
              )}
            </div>

            {/* ─── Animation visuelle cloud ↔ stockage local ─── */}
            {isActive && (
              <DataFlowAnimation direction={isPull ? 'pull' : 'push'} />
            )}

            {/* ─── Barre de progression ─── */}
            {isActive && (
              isIndeterminate ? (
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3 relative">
                  <div
                    className={`absolute inset-y-0 left-0 w-1/3 rounded-full ${
                      isPull
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
                    }`}
                    style={{ animation: 'sync-indeterminate 1.4s ease-in-out infinite' }}
                  />
                  <style>{`
                    @keyframes sync-indeterminate {
                      0%   { transform: translateX(-100%); }
                      50%  { transform: translateX(150%); }
                      100% { transform: translateX(300%); }
                    }
                  `}</style>
                </div>
              ) : (
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <motion.div
                    className={`h-full rounded-full ${
                      isPull
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${minBarWidth}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )
            )}

            {/* ─── Compteur + estimation temps ─── */}
            {isActive && (
              <div className="flex items-center justify-between mb-3 text-[10px]">
                <span className="text-slate-500 tabular-nums">
                  {state.total > 0 ? `${state.current} / ${state.total}` : 'Initialisation…'}
                  {state.pulled > 0 && <> · {state.pulled} enregistrements</>}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3" />
                  {timeEstimate}
                </span>
              </div>
            )}

            {/* ─── Message de patience (respectueux) ─── */}
            {isActive && (
              <div className={`rounded-lg p-3 mb-3 text-center ${
                isPull
                  ? 'bg-emerald-50 border border-emerald-100'
                  : 'bg-blue-50 border border-blue-100'
              }`}>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {isPull ? (
                    <>⏳ Veuillez patienter pendant le téléchargement de vos données. <strong>Ne fermez pas l'application</strong> — cette opération peut prendre quelques instants selon votre connexion.</>
                  ) : (
                    <>⏳ Veuillez patienter pendant l'envoi de vos modifications. <strong>Ne fermez pas l'application</strong> — vos données sont en cours de transmission.</>
                  )}
                </p>
              </div>
            )}

            {/* ─── Liste des opérations (style console) ─── */}
            {state.operations.length > 0 && (
              <div
                ref={scrollRef}
                className="bg-slate-900 rounded-lg border border-slate-700 p-2 mb-4 max-h-36 overflow-y-auto"
              >
                <div className="space-y-0.5">
                  {state.operations.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-2 text-[10px] font-mono py-0.5 px-1 rounded"
                    >
                      <span className={cn(
                        'flex items-center justify-center w-4 h-4 rounded shrink-0',
                        op.type === 'push'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-emerald-900/50 text-emerald-300'
                      )}>
                        {op.type === 'push'
                          ? <ArrowUp className="h-2.5 w-2.5" />
                          : <ArrowDown className="h-2.5 w-2.5" />}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {op.action === 'INSERT'
                          ? <Plus className="h-3 w-3 text-emerald-400" />
                          : op.action === 'UPDATE'
                            ? <Edit className="h-3 w-3 text-blue-400" />
                            : op.action === 'DELETE'
                              ? <Trash2 className="h-3 w-3 text-red-400" />
                              : <FileText className="h-3 w-3 text-slate-400" />}
                      </span>
                      <span className="text-slate-300 truncate flex-1">
                        {op.table}
                        {op.recordId && <span className="text-slate-500 ml-1">#{op.recordId.substring(0, 8)}</span>}
                      </span>
                      <span className="shrink-0">
                        {op.status === 'success' && <Check className="h-3 w-3 text-emerald-400" />}
                        {op.status === 'error' && <AlertCircle className="h-3 w-3 text-red-400" />}
                        {op.status === 'pending' && <RefreshCw className="h-3 w-3 text-slate-500 animate-spin" />}
                        {op.status === 'conflict' && <AlertCircle className="h-3 w-3 text-amber-400" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Stats finales ─── */}
            {(isDone || state.pushed > 0 || state.pulled > 0) && (
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

            {/* ─── Bouton fermer ─── */}
            {(isDone || isError) && (
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
        </>
      )}
    </AnimatePresence>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ⭐ Animation visuelle cloud ↔ stockage local
// ──────────────────────────────────────────────────────────────────────────

function DataFlowAnimation({ direction }: { direction: 'pull' | 'push' }) {
  const isPull = direction === 'pull';
  const accentColor = isPull ? '#10b981' : '#3b82f6'; // emerald-500 : blue-500
  const accentBg = isPull ? 'bg-emerald-50' : 'bg-blue-50';
  const accentBorder = isPull ? 'border-emerald-200' : 'border-blue-200';

  // Particules de données qui défilent (5 particules)
  const particles = useMemo(() => [0, 1, 2, 3, 4], []);

  return (
    <div className={`relative rounded-xl border ${accentBorder} ${accentBg} p-4 mb-4 overflow-hidden`}>
      {/* Layout vertical : cloud en haut, flèche au milieu, stockage local en bas */}
      <div className="relative h-44 flex flex-col items-center justify-between">

        {/* ─── Cloud (en haut pour PULL, en bas pour PUSH) ─── */}
        <div className={`absolute ${isPull ? 'top-0' : 'bottom-0'} left-1/2 -translate-x-1/2 transition-all duration-500`}>
          <div className={`flex flex-col items-center gap-1`}>
            <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
              isPull ? 'bg-white' : 'bg-white'
            }`} style={{ borderColor: accentColor, borderWidth: 2 }}>
              <Cloud
                className="w-6 h-6"
                style={{ color: accentColor }}
                fill={isPull ? `${accentColor}20` : 'white'}
              />
              {/* Halo pulsant */}
              <div
                className="absolute inset-0 rounded-2xl animate-ping opacity-20"
                style={{ backgroundColor: accentColor }}
              />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
              Serveur
            </span>
          </div>
        </div>

        {/* ─── Particules de données qui défilent ─── */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 flex flex-col items-center justify-center pointer-events-none">
          {particles.map((i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{
                y: isPull ? -80 : 80,
                opacity: 0,
              }}
              animate={{
                y: isPull ? [-80, 0, 80] : [80, 0, -80],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 2,
                delay: i * 0.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Database
                className="w-3 h-3"
                style={{ color: accentColor }}
                fill={accentColor}
              />
            </motion.div>
          ))}
        </div>

        {/* ─── Flèche centrale animée ─── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            animate={{
              y: isPull ? [0, 4, 0] : [0, -4, 0],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {isPull ? (
              <ArrowDown
                className="w-7 h-7"
                style={{ color: accentColor }}
                strokeWidth={2.5}
              />
            ) : (
              <ArrowUp
                className="w-7 h-7"
                style={{ color: accentColor }}
                strokeWidth={2.5}
              />
            )}
          </motion.div>
        </div>

        {/* ─── Stockage local (en bas pour PULL, en haut pour PUSH) ─── */}
        <div className={`absolute ${isPull ? 'bottom-0' : 'top-0'} left-1/2 -translate-x-1/2 transition-all duration-500`}>
          <div className="flex flex-col items-center gap-1">
            <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm bg-white`}
              style={{ borderColor: '#64748b', borderWidth: 2 }}>
              <HardDrive className="w-6 h-6 text-slate-600" />
              {/* Petit point d'activité */}
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Stockage local
            </span>
          </div>
        </div>
      </div>

      {/* ─── Légende du flux ─── */}
      <div className="mt-2 flex items-center justify-center gap-2 text-[10px]">
        {isPull ? (
          <span className="text-emerald-700 font-medium">
            <Cloud className="inline w-3 h-3 mr-1" />
            Serveur → Stockage local
          </span>
        ) : (
          <span className="text-blue-700 font-medium">
            <Cloud className="inline w-3 h-3 mr-1" />
            Stockage local → Serveur
          </span>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
