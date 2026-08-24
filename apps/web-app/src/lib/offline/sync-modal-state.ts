/**
 * ============================================================================
 * SYNC MODAL STATE — État partagé (sans React)
 * ============================================================================
 *
 * Store d'état pour le SyncModal. Séparé du composant React pour éviter
 * les imports circulaires (services ↔ composants React).
 *
 * Les services offline peuvent appeler setSyncModalState() sans importer
 * de composants React.
 * ============================================================================
 */

export interface SyncOperation {
  id: string;
  type: 'push' | 'pull';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  recordId?: string;
  status: 'pending' | 'success' | 'error' | 'conflict';
  message?: string;
}

export interface SyncModalState {
  isVisible: boolean;
  /** Si true, le modal est réduit en une petite pastille en bas à droite.
   *  L'opération de sync CONTINUE en arrière-plan — seul l'overlay est masqué.
   *  L'utilisateur peut continuer à travailler pendant la sync. */
  isMinimized: boolean;
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
  isMinimized: false,
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
    operations: [...currentState.operations, op].slice(-50),
    current: currentState.current + 1,
  };
  for (const cb of modalListeners) {
    try { cb(currentState); } catch {}
  }
}

export function getSyncModalState(): SyncModalState {
  return currentState;
}

export function subscribeToSyncModalState(cb: (state: SyncModalState) => void): () => void {
  modalListeners.push(cb);
  cb(currentState);
  return () => {
    modalListeners = modalListeners.filter(l => l !== cb);
  };
}
