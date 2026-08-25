/**
 * ============================================================================
 * CHAT OFFLINE STORE — IndexedDB local cache + send queue (V3-1)
 * ============================================================================
 *
 * Permet au chat Yeshua Connect de fonctionner hors-ligne :
 *   1. Cache les messages par conversation dans IndexedDB (lecture instantanée
 *      au chargement, avant le fetch backend).
 *   2. Stocke une file d'attente des messages en attente d'envoi (pending)
 *      quand le réseau est down.
 *   3. Au reconnect (socket.on('connect')), on flush la queue.
 *
 * Pattern :
 *   - Utilise l'API native indexedDB (pas de lib tierce — comme crypto.ts).
 *   - 2 object stores : "messages" (cache) + "pending" (send queue) +
 *    "meta" (lastSyncedAt per conversation).
 *   - Toutes les méthodes sont async et never-throw (log + fallback).
 *
 * Clés :
 *   - messages: conversationId -> array of messages (triés par createdAt)
 *   - pending: localId -> pending message (contenu + conversationId + ts)
 *   - meta: conversationId -> { lastSyncedAt: ISOString }
 * ============================================================================
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface OfflineChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'TEXT' | 'ATTACHMENT' | 'AUDIO' | 'VIDEO' | 'POLL' | 'SYSTEM';
  content: string;
  replyToId?: string | null;
  createdAt: string; // ISO string
  // Local-only fields:
  status?: 'pending' | 'sent' | 'failed';
  localId?: string; // for pending messages, before server assigns an id
}

export interface PendingMessage {
  localId: string; // UUID local
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string | null;
  queuedAt: string; // ISO string
  attempts: number; // number of send attempts
  lastError?: string;
}

interface ChatMeta {
  conversationId: string;
  lastSyncedAt: string; // ISO string of last successful fetch
}

// ─── DB setup ──────────────────────────────────────────────────────────

const DB_NAME = 'academia-helm-chat';
const DB_VERSION = 2;

const STORE_MESSAGES = 'messages';
const STORE_PENDING = 'pending';
const STORE_META = 'meta';

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      // messages store : keyPath = 'id' (the message id, server or local)
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        // Index by conversationId for fast retrieval
        const store = req.transaction.objectStore(STORE_MESSAGES);
        store.createIndex('conversationId', 'conversationId', { unique: false });
      }
      // pending store : keyPath = 'localId'
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'localId' });
      }
      // meta store : keyPath = 'conversationId'
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'conversationId' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  });

  return _dbPromise;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

// ─── Messages cache (per conversation) ─────────────────────────────────

/**
 * Récupère tous les messages cachés pour une conversation, triés par createdAt.
 * Retourne [] si IndexedDB indisponible ou conversation vide.
 */
export async function getMessages(conversationId: string): Promise<OfflineChatMessage[]> {
  try {
    const db = await openDB();
    return await new Promise<OfflineChatMessage[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const index = tx.objectStore(STORE_MESSAGES).index('conversationId');
      const req = index.getAll(conversationId);
      req.onsuccess = () => {
        const items = (req.result as OfflineChatMessage[]) || [];
        // Tri ascendant par createdAt
        items.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Stocke un message dans le cache (insert or replace, par id).
 */
export async function saveMessage(message: OfflineChatMessage): Promise<void> {
  try {
    await tx(STORE_MESSAGES, 'readwrite', (store) => store.put(message));
  } catch {
    // silent — IndexedDB may be unavailable in private browsing mode
  }
}

/**
 * Stocke plusieurs messages en une seule transaction (bulk).
 * Utilisé après un fetch backend pour mettre à jour le cache.
 */
export async function saveMessagesBulk(messages: OfflineChatMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_MESSAGES, 'readwrite');
      const store = transaction.objectStore(STORE_MESSAGES);
      for (const msg of messages) {
        store.put(msg);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // silent
  }
}

/**
 * Supprime tous les messages d'une conversation (quand on quitte/reset).
 */
export async function clearConversation(conversationId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      const index = tx.objectStore(STORE_MESSAGES).index('conversationId');
      const req = index.openCursor(IDBKeyRange.only(conversationId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silent
  }
}

/**
 * Met à jour le statut d'un message (pending → sent).
 * Si le message était pending (avec localId), on le supprime et on insère
 * le vrai message (avec l'id serveur) à la place.
 */
export async function markMessageSent(
  localId: string,
  serverId: string,
  serverCreatedAt: string,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      // Trouver par localId (on doit scanner car localId n'est pas indexé)
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const msg = cursor.value as OfflineChatMessage;
        if (msg.localId === localId) {
          // Mettre à jour l'id et le statut
          const updated: OfflineChatMessage = {
            ...msg,
            id: serverId,
            status: 'sent',
            createdAt: serverCreatedAt,
            localId: undefined,
          };
          cursor.delete(); // supprimer l'ancien (clé localId)
          store.put(updated); // insérer le nouveau (clé serverId)
          return;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silent
  }
}

/**
 * Marque un message comme failed (envoi échoué définitivement, par ex. si
 * l'utilisateur annule).
 */
export async function markMessageFailed(localId: string, error?: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const msg = cursor.value as OfflineChatMessage;
        if (msg.localId === localId) {
          const updated: OfflineChatMessage = { ...msg, status: 'failed' };
          cursor.update(updated);
          return;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silent
  }
}

// ─── Pending queue (send retry) ─────────────────────────────────────────

/**
 * Ajoute un message à la queue d'envoi en attente.
 */
export async function addPendingMessage(pending: PendingMessage): Promise<void> {
  try {
    await tx(STORE_PENDING, 'readwrite', (store) => store.put(pending));
  } catch {
    // silent
  }
}

/**
 * Récupère tous les messages en attente d'envoi, triés par queuedAt.
 */
export async function getPendingMessages(): Promise<PendingMessage[]> {
  try {
    const db = await openDB();
    return await new Promise<PendingMessage[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as PendingMessage[]) || [];
        items.sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : 1));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Supprime un message de la queue après envoi réussi.
 */
export async function removePendingMessage(localId: string): Promise<void> {
  try {
    await tx(STORE_PENDING, 'readwrite', (store) => store.delete(localId));
  } catch {
    // silent
  }
}

/**
 * Incrémente le compteur de tentatives d'un message en attente.
 */
export async function incrementPendingAttempts(
  localId: string,
  error?: string,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.get(localId);
      req.onsuccess = () => {
        const pending = req.result as PendingMessage | undefined;
        if (pending) {
          pending.attempts += 1;
          pending.lastError = error;
          store.put(pending);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silent
  }
}

// ─── Meta (lastSyncedAt per conversation) ───────────────────────────────

export async function getLastSyncedAt(conversationId: string): Promise<string | null> {
  try {
    const result = await tx<ChatMeta | undefined>(
      STORE_META,
      'readonly',
      (store) => store.get(conversationId),
    );
    return result?.lastSyncedAt ?? null;
  } catch {
    return null;
  }
}

export async function setLastSyncedAt(conversationId: string, ts: string): Promise<void> {
  try {
    await tx(STORE_META, 'readwrite', (store) =>
      store.put({ conversationId, lastSyncedAt: ts }),
    );
  } catch {
    // silent
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────

/**
 * Génère un UUID local (utilise crypto.randomUUID si dispo, fallback sur Math.random).
 */
export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Vérifie si l'offline store est disponible (IndexedDB + browser support).
 */
export function isOfflineStoreAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
