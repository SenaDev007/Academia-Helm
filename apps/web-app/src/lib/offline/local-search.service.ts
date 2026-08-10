/**
 * Local Search Service
 * 
 * Moteur de recherche locale pour les données stockées dans IndexedDB.
 * 
 * RÈGLE : Section 13 du Cahier Technique
 */

import { localDb } from './local-db.service';

export interface SearchOptions {
  query?: string;
  fields?: string[]; // Champs sur lesquels chercher (ex: ['firstName', 'lastName'])
  tenantId?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, any>; // Filtres exacts (ex: { role: 'STUDENT' })
}

export class LocalSearchService {
  /**
   * Effectue une recherche dans un store spécifique
   *
   * ⭐ Robustesse : si le store n'existe pas en IndexedDB (par exemple si la
   *    convention de nommage a changé ou si l'entité n'a pas encore été
   *    déclarée dans local-db.service.ts), on retourne un tableau vide plutôt
   *    que de crasher l'appelant. L'appelant pourra ainsi afficher un état
   *    "pas de données" propre au lieu d'une page blanche.
   */
  static async search<T>(storeName: string, options: SearchOptions): Promise<T[]> {
    let allData: T[];
    try {
      allData = await localDb.query<T>(storeName);
    } catch (err) {
      console.warn(`[LocalSearch] Store "${storeName}" not available in IndexedDB — returning empty list:`, (err as Error).message);
      return [];
    }

    let results = allData;

    // 1. Filtre par Tenant (Isolation obligatoire) et exclusion des éléments supprimés localement (_deleted)
    results = results.filter((item: any) => !item._deleted);
    if (options.tenantId) {
      results = results.filter((item: any) => item.tenantId === options.tenantId);
    }

    // 2. Filtres exacts
    if (options.filters) {
      results = results.filter((item: any) => {
        return Object.entries(options.filters!).every(([key, value]) => item[key] === value);
      });
    }

    // 3. Recherche textuelle (Case insensitive)
    if (options.query && options.fields && options.fields.length > 0) {
      const q = options.query.toLowerCase();
      results = results.filter((item: any) => {
        return options.fields!.some(field => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(q);
        });
      });
    }

    // 4. Pagination
    const start = options.offset || 0;
    const end = options.limit ? start + options.limit : results.length;
    
    return results.slice(start, end);
  }
}
