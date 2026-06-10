/**
 * Local Database Service
 * 
 * Service pour gérer la base de données locale SQLite (ou IndexedDB pour Web)
 * 
 * PRINCIPE : Base locale complète avec toutes les tables métier
 */

import type { SyncEntityType } from '@/types';

// Pour Web : utiliser IndexedDB via idb
// Pour Desktop : utiliser better-sqlite3
// Cette implémentation est une abstraction

interface LocalDbConfig {
  dbName: string;
  version: number;
}

class LocalDbService {
  private db: any; // IDBDatabase pour Web, Database pour Desktop
  private isInitialized: boolean = false;

  constructor(private config: LocalDbConfig) {}

  /**
   * Initialise la base de données locale
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Détection de l'environnement
    // Dans Next.js, on utilise toujours IndexedDB (côté client uniquement)
    // SQLite est uniquement pour l'app Desktop Electron
    if (typeof window !== 'undefined') {
      // Web/Next.js Client : IndexedDB
      await this.initializeIndexedDB();
    } else {
      // Next.js Server : ne pas initialiser (les services offline ne fonctionnent que côté client)
      // Desktop Electron : SQLite (mais cette partie ne sera jamais exécutée dans Next.js)
      throw new Error('Local database can only be initialized in browser/client environment');
    }

    this.isInitialized = true;
  }

  /**
   * Initialise IndexedDB (Web)
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        this.createObjectStores(db);
      };
    });
  }

  /**
   * Crée les object stores (IndexedDB)
   */
  private createObjectStores(db: IDBDatabase): void {
    // Object store pour chaque entité métier
    const entities: string[] = [
      'students', 'teachers', 'classes', 'subjects', 'exams', 'grades', 
      'payments', 'attendance', 'absences', 'invoices', 'academic_years', 
      'school_levels', 'homeworks', 'incidents', 'loans', 'sessions', 
      'messages', 'notifications', 'alerts', 'reports', 'orion_alerts',
      'exam_candidates', 'exam_results', 'exam_pvs', 'pedagogical_files',
      'disciplinary_incidents',
      'class_diaries', 'lesson_plans', 'lesson_journals', 'lesson_journal_entries',
      'weekly_semainier_daily_entries', 'teacher_class_assignments', 'homework_entries',
      'teacher_profiles', 'academic_series', 'series_subjects',
      'pedagogical_materials', 'material_stocks', 'material_movements', 'teacher_material_assignments',
      'school_academic_settings',
      // Stores ajoutés pour support offline complet
      'fee_structures', 'expenses', 'finance_settings',
      'modules', 'academic_terms',
    ];

    entities.forEach(storeName => {
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: 'id' });
        store.createIndex('tenant_id', 'tenantId', { unique: false });
        store.createIndex('sync_status', 'syncStatus', { unique: false });
        store.createIndex('_is_dirty', '_isDirty', { unique: false });
        store.createIndex('local_id', 'local_id', { unique: false });
      }
    });

    // Tables techniques offline (Section 9 du Cahier Technique)
    const technicalStores = [
      'user_profile_cache', 
      'roles_cache', 
      'permissions_cache', 
      'local_tenant_context', 
      'local_academic_year', 
      'local_academic_term',
      'local_audit_log',
      'search_indexes',
      'schema_version',
      'sync_operations',
      'sync_conflicts',
      'device_registry_local',
      'outbox_events',
      'sync_state'
    ];

    technicalStores.forEach(storeName => {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: storeName === 'sync_state' ? 'tenantId' : 'id' });
      }
    });

  }

  /**
   * Initialise SQLite (Desktop)
   * 
   * ⚠️ DÉSACTIVÉ POUR NEXT.JS (WEB UNIQUEMENT)
   * 
   * Cette fonction est uniquement pour l'app Desktop Electron.
   * Dans Next.js (Web), cette fonction ne sera jamais appelée.
   * 
   * Pour Next.js, on utilise uniquement IndexedDB côté client.
   */
  private async initializeSQLite(): Promise<void> {
    // Next.js = Web uniquement, pas de SQLite
    if (typeof window !== 'undefined') {
      throw new Error('SQLite is not available in Next.js Web app. Use IndexedDB instead.');
    }
    throw new Error('SQLite initialization is only available in Electron desktop app');
  }

  /**
   * Exécute le schéma SQLite
   */
  private async executeSQLiteSchema(): Promise<void> {
    // Le schéma sera chargé depuis un fichier SQL
    // Pour l'instant, placeholder
  }

  /**
   * Exécute une requête (lecture)
   */
  async query<T>(storeName: string, query?: (store: IDBObjectStore) => IDBRequest<T[]>): Promise<T[]> {
    await this.ensureInitialized();

    if (typeof window !== 'undefined') {
      // IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        if (query) {
          const request = query(store);
          request.onsuccess = () => resolve(Array.from(request.result || []));
          request.onerror = () => reject(request.error);
        } else {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        }
      });
    } else {
      // SQLite (Desktop)
      // Implémentation à faire
      throw new Error('SQLite query not implemented yet');
    }
  }

  /**
   * Exécute une commande (écriture)
   */
  async execute(storeName: string, operation: 'add' | 'put' | 'delete', data: any): Promise<void> {
    await this.ensureInitialized();

    if (typeof window !== 'undefined') {
      // IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        let request: IDBRequest;
        switch (operation) {
          case 'add':
            request = store.add(data);
            break;
          case 'put':
            request = store.put(data);
            break;
          case 'delete':
            request = store.delete(data.id || data);
            break;
          default:
            reject(new Error('Invalid operation'));
            return;
          }

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else {
      // SQLite (Desktop)
      throw new Error('SQLite execute not implemented yet');
    }
  }

  /**
   * Exécute plusieurs commandes en une seule transaction (bulk)
   */
  async executeBulk(storeName: string, operation: 'add' | 'put' | 'delete', dataArray: any[]): Promise<void> {
    if (dataArray.length === 0) return;
    await this.ensureInitialized();

    if (typeof window !== 'undefined') {
      // IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        dataArray.forEach(data => {
          switch (operation) {
            case 'add':
              store.add(data);
              break;
            case 'put':
              store.put(data);
              break;
            case 'delete':
              store.delete(data.id || data);
              break;
          }
        });
      });
    } else {
      throw new Error('SQLite executeBulk not implemented yet');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  /**
   * Vide un store complet (Section 20.2)
   */
  async clearStore(storeName: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db.objectStoreNames.contains(storeName)) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Instance singleton
export const localDb = new LocalDbService({
  dbName: 'academia-helm-local',
  version: 9, // + fee_structures, expenses, finance_settings, modules, academic_terms
});

