'use client';

/**
 * ============================================================================
 * useAutoSave — Hook de sauvegarde automatique avec debounce
 * ============================================================================
 *
 * Sauvegarde automatiquement après `delay` ms d'inactivité.
 *
 * États : 'idle' | 'saving' | 'saved' | 'dirty'
 *   - idle : rien à sauvegarder
 *   - dirty : modifications en attente (avant le debounce)
 *   - saving : sauvegarde en cours
 *   - saved : sauvegardé avec succès (retour à idle après 2s)
 *
 * Usage :
 *   const { status, save } = useAutoSave(async (data) => { ... }, 1500);
 *   // save(data) est appelé automatiquement après 1.5s d'inactivité
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type AutoSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved';

export function useAutoSave(
  saveFn: (data: any) => Promise<any>,
  delay: number = 1500,
) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef<any>(null);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const save = useCallback((data: any) => {
    dataRef.current = data;
    setStatus('dirty');

    // Annuler le timer précédent
    if (timerRef.current) clearTimeout(timerRef.current);

    // Nouveau timer
    timerRef.current = setTimeout(async () => {
      if (dataRef.current === null) return;
      setStatus('saving');
      try {
        await saveFnRef.current(dataRef.current);
        setStatus('saved');
        // Retour à idle après 2s
        setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        console.error('[useAutoSave] Save failed:', err);
        setStatus('idle'); // Retour à dirty pour permettre retry manuel
      }
    }, delay);
  }, [delay]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { status, save };
}

/**
 * Badge visuel pour l'état de sauvegarde
 */
export function AutoSaveBadge({ status }: { status: AutoSaveStatus }) {
  if (status === 'idle') return null;

  const config = {
    dirty: { text: 'Modifications non enregistrées', color: 'text-amber-600 bg-amber-50', dot: 'bg-amber-400' },
    saving: { text: 'Enregistrement…', color: 'text-blue-600 bg-blue-50', dot: 'bg-blue-400 animate-pulse' },
    saved: { text: 'Enregistré ✓', color: 'text-emerald-600 bg-emerald-50', dot: 'bg-emerald-400' },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.text}
    </span>
  );
}
