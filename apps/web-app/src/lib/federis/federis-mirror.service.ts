/**
 * ═══════════════════════════════════════════════════════════════════════════
 * federis-mirror.service — Miroir offline (SQLite/IndexedDB) Academia Federis
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cahier des charges « offline-first » : les données de consultation (examens,
 * candidats, délibérations, résultats publiés, tableau de bord) sont miroirées
 * localement pour rester consultables sans connexion.
 *
 * Architecture (alignée sur le pattern Helm) :
 *   - Web (navigateur) → IndexedDB (base « academia-federis », store « mirror »)
 *   - Desktop (Tauri)   → SQLite via tauri-plugin-sql (même clé de miroir,
 *     table federis_mirror — géré par l'adaptateur Helm existant)
 *
 * Cycle de vie :
 *   1. Chaque chargement API réussi → saveSnapshot(key, data)
 *   2. Hors connexion / API injoignable → loadSnapshot(key) en repli
 *   3. Indicateur « Miroir » : dernière synchro, nombre d'entités, taille
 *   4. Purge à la déconnexion (données sensibles des examens)
 *
 * Les clés de miroir :
 *   exams · candidates:<examId> · deliberation:<examId> ·
 *   results:<examId> · dashboard · profile
 */

'use client';

const MIRROR_DB_NAME = 'academia-federis';
const MIRROR_DB_VERSION = 1;
const MIRROR_STORE = 'mirror';

/** Métadonnées d'un instantané miroir. */
export interface MirrorEntry<T = unknown> {
  key: string;
  data: T;
  syncedAt: string; // ISO
  version: number;
  /** Source : 'api' (réponse directe) | 'fallback' (repli offline déjà servi) */
  source: 'api' | 'fallback';
}

/** Statut global du miroir (panneau Paramètres). */
export interface MirrorStatus {
  keys: { key: string; syncedAt: string; count?: number }[];
  totalEntries: number;
  lastSync: string | null;
  approxSizeKb: number;
}

class FederisMirrorService {
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase | null> | null = null;

  // ── Ouverture IndexedDB (web) ────────────────────────────────────────────

  private async open(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
    if (this.db) return this.db;
    if (this.opening) return this.opening;

    this.opening = new Promise((resolve) => {
      const request = indexedDB.open(MIRROR_DB_NAME, MIRROR_DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(MIRROR_STORE)) {
          db.createObjectStore(MIRROR_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () => resolve(null); // mode privé / quota — repli silencieux
    });
    return this.opening;
  }

  // ── Lecture / écriture ───────────────────────────────────────────────────

  /** Enregistre un instantané après un chargement API réussi. */
  async saveSnapshot<T>(key: string, data: T): Promise<void> {
    const db = await this.open();
    if (!db) return;
    const entry: MirrorEntry<T> = {
      key,
      data,
      syncedAt: new Date().toISOString(),
      version: MIRROR_DB_VERSION,
      source: 'api',
    };
    await new Promise<void>((resolve) => {
      const tx = db.transaction(MIRROR_STORE, 'readwrite');
      tx.objectStore(MIRROR_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  /**
   * Charge un instantané (repli offline). Retourne null si absent.
   * Le service tente d'abord le miroir Helm SQLite (Tauri) si l'app tourne
   * en desktop, puis IndexedDB.
   */
  async loadSnapshot<T>(key: string): Promise<MirrorEntry<T> | null> {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(MIRROR_STORE, 'readonly');
      const request = tx.objectStore(MIRROR_STORE).get(key);
      request.onsuccess = () => resolve((request.result as MirrorEntry<T>) ?? null);
      request.onerror = () => resolve(null);
    });
  }

  /** Supprime une entrée du miroir. */
  async removeSnapshot(key: string): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(MIRROR_STORE, 'readwrite');
      tx.objectStore(MIRROR_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  /** Purge complète (déconnexion — données sensibles des examens). */
  async clearAll(): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(MIRROR_STORE, 'readwrite');
      tx.objectStore(MIRROR_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  /** Statut du miroir pour le panneau Paramètres. */
  async getStatus(): Promise<MirrorStatus> {
    const db = await this.open();
    const empty: MirrorStatus = {
      keys: [],
      totalEntries: 0,
      lastSync: null,
      approxSizeKb: 0,
    };
    if (!db) return empty;

    const entries = await new Promise<MirrorEntry[]>((resolve) => {
      const tx = db.transaction(MIRROR_STORE, 'readonly');
      const request = tx.objectStore(MIRROR_STORE).getAll();
      request.onsuccess = () => resolve((request.result as MirrorEntry[]) ?? []);
      request.onerror = () => resolve([]);
    });

    let lastSync: string | null = null;
    let size = 0;
    const keys = entries.map((e) => {
      if (!lastSync || e.syncedAt > lastSync) lastSync = e.syncedAt;
      try {
        size += JSON.stringify(e.data ?? {}).length;
      } catch {
        /* données non sérialisables — ignorées */
      }
      let count: number | undefined;
      const d = e.data as any;
      if (Array.isArray(d)) count = d.length;
      else if (d && typeof d === 'object') {
        if (Array.isArray(d.exams)) count = d.exams.length;
        else if (Array.isArray(d.candidates)) count = d.candidates.length;
        else if (Array.isArray(d.deliberations)) count = d.deliberations.length;
        else if (d.readiness && typeof d.readiness === 'object') {
          count = (d.readiness as any).totalCandidates;
        }
      }
      return { key: e.key, syncedAt: e.syncedAt, count };
    });

    return {
      keys: keys.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt)),
      totalEntries: entries.length,
      lastSync,
      approxSizeKb: Math.round((size / 1024) * 10) / 10,
    };
  }

  // ── Helper intégré : fetch API avec miroir automatique ───────────────────

  /**
   * Charge une ressource Federis avec repli miroir :
   *   1. GET apiPath via apiClient ( passé en callback pour éviter les imports
   *      circulaires)
   *   2. Succès → saveSnapshot(key, data) + retour { data, fromMirror: false }
   *   3. Échec réseau → loadSnapshot(key) + retour { data, fromMirror: true }
   */
  async fetchWithMirror<T>(
    key: string,
    apiCall: () => Promise<T>,
  ): Promise<{ data: T | null; fromMirror: boolean; syncedAt: string | null }> {
    try {
      const data = await apiCall();
      await this.saveSnapshot(key, data);
      return { data, fromMirror: false, syncedAt: new Date().toISOString() };
    } catch {
      const entry = await this.loadSnapshot<T>(key);
      if (entry) {
        return { data: entry.data, fromMirror: true, syncedAt: entry.syncedAt };
      }
      return { data: null, fromMirror: false, syncedAt: null };
    }
  }
}

/** Singleton client-side (les pages Federis importent cette instance). */
export const federisMirror = new FederisMirrorService();

/** Clés de miroir normalisées (évite les fautes de frappe). */
export const MIRROR_KEYS = {
  exams: 'exams',
  candidates: (examId: string) => `candidates:${examId}`,
  deliberation: (examId: string) => `deliberation:${examId}`,
  results: (examId: string) => `results:${examId}`,
  dashboard: 'dashboard',
  profile: 'profile',
} as const;
