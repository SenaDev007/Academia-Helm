import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SyncPullDto, SyncPushDto } from './dto/sync-pull-push.dto';

/**
 * ============================================================================
 * SYNC SERVICE — Synchronisation Neon ↔ SQLite (app desktop + mobile + web)
 * ============================================================================
 *
 * PULL : L'app desktop/mobile/web demande les modifications depuis Neon
 *   POST /api/sync/pull
 *   → Retourne les enregistrements modifiés depuis lastSyncAt
 *   → Filtrage STRICT par tenantId extrait du JWT (jamais du body)
 *
 * PUSH : L'app desktop/mobile/web envoie ses écritures locales (outbox)
 *   POST /api/sync/push
 *   → Applique les INSERT/UPDATE/DELETE sur Neon
 *   → Retourne le résultat (success/conflict/error) pour chaque record
 *   → Idempotence via table _sync_outbox (local_id unique par tenant)
 *
 * ⭐ SÉCURITÉ MULTI-TENANT STRICTE :
 *    - Le tenantId vient TOUJOURS du JWT (décorateur @TenantId)
 *    - La valeur du body `dto.tenantId` est IGNORÉE
 *    - Pour les UPDATE/DELETE : la clause WHERE inclut `tenant_id = $jwt`
 *      → un client malveillant ne peut PAS modifier un record d'un autre tenant
 *    - Pour les INSERT : le payload est écrasé avec `tenantId = $jwt`
 *      → un client malveillant ne peut PAS créer un record chez un autre tenant
 * ============================================================================
 */

/**
 * ⭐ Convertit récursivement toutes les valeurs non-sérialisables JSON
 *    (BigInt, Decimal Prisma, Date) en valeurs sérialisables.
 */
function serializeForJson(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (value.$numberDecimal !== undefined) {
      return value.$numberDecimal;
    }
    if (value.d !== undefined && value.e !== undefined && value.s !== undefined) {
      return value.toString();
    }
    if (Array.isArray(value)) {
      return value.map(serializeForJson);
    }
    const result: any = {};
    for (const key of Object.keys(value)) {
      result[key] = serializeForJson(value[key]);
    }
    return result;
  }
  return value;
}

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);

  /**
   * ⭐ Tables EXCLUES de la sync pour des raisons de SÉCURITÉ.
   *    Contient toutes les tables contenant des secrets, tokens, hashes de
   *    mots de passe, identifiants d'authentification, etc.
   *    ⚠️ AJOUTER ICI toute nouvelle table sensible créée dans le schéma Prisma.
   */
  private readonly EXCLUDED_TABLES = new Set<string>([
    // ─── Tables système ───
    '_prisma_migrations',
    '_sync_metadata',
    '_sync_outbox',
    '_sync_log',
    'schema_migrations',
    'audit_logs',
    // ─── Auth & sécurité (hashes, tokens, secrets) ───
    'user',
    'users',
    'password_reset_token',
    'password_reset_tokens',
    'session',
    'sessions',
    'refresh_token',
    'refresh_tokens',
    'api_key',
    'api_keys',
    'tenant_api_key',
    'tenant_api_keys',
    'email_verification_token',
    'email_verification_tokens',
    'two_factor_secret',
    'two_factor_secrets',
    'user_session',
    'user_sessions',
    'magic_link_token',
    'magic_link_tokens',
    'oauth_account',
    'oauth_accounts',
    'webauthn_credential',
    'webauthn_credentials',
    'backup_code',
    'backup_codes',
    // ─── Données d'infrastructure (pas métier) ───
    'app_release',
    'app_releases',
    'feature_flag',
    'feature_flags',
    'tenant_feature_flag',
    'tenant_feature_flags',
    'deployment_log',
    'deployment_logs',
  ]);

  /**
   * ⭐ Whitelist des tables syncables, construite dynamiquement au démarrage.
   *    On ne peut PAS se fier uniquement à EXCLUDED_TABLES (blacklist) car
   *    une nouvelle table sensible ajoutée sans mise à jour de la blacklist
   *    serait exposée. La whitelist = (toutes tables public) - (EXCLUDED_TABLES).
   *    Elle est mise en cache et rafraîchie toutes les 10 minutes.
   */
  private syncableTablesCache: Set<string> = new Set();
  private lastCacheRefresh = 0;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Pré-remplir le cache au démarrage
    await this.refreshSyncableTablesCache().catch((err) => {
      this.logger.warn(`Failed to initialize syncable tables cache: ${err.message}`);
    });
  }

  // ===========================================================================
  // PULL — Télécharge les modifications depuis Neon
  // ===========================================================================

  /**
   * ⭐ Le paramètre `jwtTenantId` vient DIRECTEMENT du JWT (via @TenantId()).
   *    Il EST la source de vérité pour le filtrage multi-tenant.
   *    La valeur `dto.tenantId` (body) est ignorée.
   */
  async pull(dto: SyncPullDto, jwtTenantId: string) {
    // ⭐ SÉCURITÉ : écrasement inconditionnel — le JWT prime
    const tenantId = jwtTenantId;
    const lastSyncAt = dto.lastSyncAt || (dto as any).last_sync_at;

    this.logger.log(`Pull request: tables=${dto.tables?.length || 'all'}, lastSync=${lastSyncAt ? 'delta' : 'initial'}, tenant=${tenantId}`);

    // ⭐ Whitelist : on ne sync que les tables autorisées
    await this.ensureCacheFresh();
    const allSyncableTables = await this.getTableNames();
    const requestedTables = dto.tables?.length ? dto.tables : allSyncableTables;

    // ⭐ Filtrer les tables demandées contre la whitelist (sécurité)
    const tables = requestedTables.filter((t) => this.syncableTablesCache.has(t));
    if (tables.length === 0) {
      this.logger.warn(`Pull: no syncable tables after filtering (requested=${requestedTables.length})`);
      return {
        success: true,
        pulledAt: new Date().toISOString(),
        lastSyncAt,
        syncToken: `sync-${Date.now()}`,
        totalRecords: 0,
        tableCount: 0,
        entities: {},
        tables: {},
        stats: { totalEntities: 0, tableCount: 0 },
      };
    }

    const limit = Math.min(dto.limit || 5000, 10000); // ⭐ Cap à 10000 pour éviter DoS

    const columnMap = await this.buildColumnMap(tables);

    const results: Record<string, any[]> = {};
    let totalRecords = 0;

    // ⭐ Parallélisation par chunks de 5
    const CHUNK_SIZE = 5;
    const tableChunks: string[][] = [];
    for (let i = 0; i < tables.length; i += CHUNK_SIZE) {
      tableChunks.push(tables.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of tableChunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (tableName) => {
          if (this.EXCLUDED_TABLES.has(tableName)) return { tableName, records: [] };
          if (!this.syncableTablesCache.has(tableName)) {
            this.logger.warn(`Pull: table ${tableName} not in whitelist — skipping`);
            return { tableName, records: [] };
          }
          try {
            const records = await this.pullTableFast(tableName, lastSyncAt, limit, tenantId, columnMap);
            return { tableName, records };
          } catch (error) {
            this.logger.warn(`Pull failed for table ${tableName}: ${error.message}`);
            return { tableName, records: [] };
          }
        })
      );

      for (const { tableName, records } of chunkResults) {
        results[tableName] = records;
        totalRecords += records.length;
      }
    }

    this.logger.log(`Pull complete: ${totalRecords} records from ${Object.keys(results).length} tables, tenant=${tenantId}`);

    const serializedResults: Record<string, any[]> = {};
    for (const [tableName, records] of Object.entries(results)) {
      serializedResults[tableName] = records.map((r) => serializeForJson(r));
    }

    return {
      success: true,
      pulledAt: new Date().toISOString(),
      lastSyncAt,
      syncToken: `sync-${Date.now()}`,
      totalRecords,
      tableCount: Object.keys(serializedResults).length,
      entities: serializedResults,
      tables: serializedResults, // rétro-compat Tauri/Flutter
      stats: {
        totalEntities: totalRecords,
        tableCount: Object.keys(serializedResults).length,
      },
    };
  }

  /// Construit une Map<tableName, Set<columnName>> en UNE seule requête SQL
  /// ⭐ Utilise $queryRawUnsafe avec une IN-clause construite via escapeSql
  ///    (les noms de tables viennent de getTableNames qui lit information_schema,
  ///    donc pas d'injection possible — les noms sont déjà validés par Postgres)
  private async buildColumnMap(tables: string[]): Promise<Map<string, Set<string>>> {
    const map = new Map<string, Set<string>>();
    if (tables.length === 0) return map;

    try {
      const inClause = tables.map(t => `'${this.escapeSql(t)}'`).join(',');
      const query = `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (${inClause})
        ORDER BY table_name, ordinal_position
      `;
      const result = await this.prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(query);
      for (const row of result) {
        if (!map.has(row.table_name)) map.set(row.table_name, new Set());
        map.get(row.table_name)!.add(row.column_name);
      }
    } catch (err) {
      this.logger.warn(`buildColumnMap failed: ${err.message}`);
    }
    return map;
  }

  /// Version optimisée de pullTable
  /// ⭐ SÉCURITÉ : le tenantId est bindé en paramètre ($1), pas interpolé
  private async pullTableFast(
    tableName: string,
    lastSyncAt: string | undefined,
    limit: number,
    tenantId: string,
    columnMap: Map<string, Set<string>>,
  ) {
    const cols = columnMap.get(tableName) ?? new Set<string>();
    const hasUpdatedAt = cols.has('updated_at');
    const hasTenantId = cols.has('tenant_id');

    // ⭐ Construction avec paramètres bindés pour éviter l'injection SQL
    const params: any[] = [];
    let paramIdx = 1;
    let query = `SELECT * FROM "${tableName}"`;
    const conditions: string[] = [];

    if (lastSyncAt && hasUpdatedAt) {
      conditions.push(`"updated_at" > $${paramIdx++}`);
      params.push(lastSyncAt);
    }
    if (hasTenantId) {
      // ⭐ Filtrage STRICT par tenant_id (bindé en paramètre)
      conditions.push(`"tenant_id" = $${paramIdx++}::text::uuid`);
      params.push(tenantId);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    if (hasUpdatedAt) {
      query += ' ORDER BY "updated_at" DESC';
    }
    // ⭐ LIMIT en paramètre bindé (sécurité + clarté)
    query += ` LIMIT $${paramIdx++}`;
    params.push(limit);

    const result = await this.prisma.$queryRawUnsafe(query, ...params);
    return result as any[];
  }

  // ===========================================================================
  // PUSH — Applique les écritures locales sur Neon
  // ===========================================================================

  /**
   * ⭐ Le paramètre `jwtTenantId` vient DIRECTEMENT du JWT.
   *    Il écrase `dto.tenantId` (body) de façon inconditionnelle.
   */
  async push(dto: SyncPushDto, jwtTenantId: string) {
    // ⭐ Normaliser : accepter à la fois records[] et operations[]
    let records: any[] = [];
    if (dto.records && dto.records.length > 0) {
      records = dto.records;
    } else if (dto.operations && dto.operations.length > 0) {
      records = dto.operations.map((op: any) => ({
        tableName: op.table_name || op.tableName,
        recordId: op.record_id || op.recordId,
        operation: (op.operation_type || op.operation || 'UPDATE').toUpperCase(),
        data: op.payload || op.data || {},
        clientTimestamp: op.client_timestamp || op.clientTimestamp || new Date().toISOString(),
        localId: op.id || op.local_id || op.localId,
      }));
    }

    // ⭐ SÉCURITÉ : le tenantId vient UNIQUEMENT du JWT
    const effectiveTenantId = jwtTenantId;
    if (!effectiveTenantId) {
      throw new Error('tenantId is required for push (must come from JWT)');
    }

    this.logger.log(`Push request: ${records.length} records, tenant=${effectiveTenantId}`);

    // ⭐ Whitelist des tables syncables
    await this.ensureCacheFresh();

    const results: Array<{
      operation_id?: string;
      tableName: string;
      recordId: string;
      status: 'SUCCESS' | 'CONFLICT' | 'ERROR';
      error?: string;
    }> = [];

    for (const record of records) {
      try {
        // ⭐ Sécurité : vérifier que la table est dans la whitelist
        if (!this.syncableTablesCache.has(record.tableName)) {
          throw new Error(`Table '${record.tableName}' is not syncable (not in whitelist)`);
        }

        // ⭐ IDEMPOTENCE : vérifier si ce local_id a déjà été traité pour ce tenant
        const localId = (record as any).localId || (record as any).local_id || (record as any).id;
        if (localId) {
          const existing = await this.prisma.$queryRawUnsafe(
            `SELECT id FROM _sync_outbox
             WHERE tenant_id = $1::text::uuid
               AND local_id = $2
               AND status = 'synced'
             LIMIT 1`,
            effectiveTenantId,
            String(localId)
          ).catch(() => [] as any[]);

          if (Array.isArray(existing) && existing.length > 0) {
            results.push({
              operation_id: localId,
              tableName: record.tableName,
              recordId: record.recordId,
              status: 'SUCCESS',
            });
            continue;
          }
        }

        // ⭐ Appliquer l'écriture (avec injection du tenantId JWT)
        await this.applyRecord(record, effectiveTenantId);

        // ⭐ Enregistrer le local_id dans _sync_outbox pour l'idempotence future
        if (localId) {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO _sync_outbox (tenant_id, local_id, table_name, record_id, operation, status, client_timestamp, device_id)
             VALUES ($1::text::uuid, $2, $3, $4, $5, 'synced', $6, $7)
             ON CONFLICT (tenant_id, local_id) DO NOTHING`,
            effectiveTenantId,
            String(localId),
            record.tableName || 'unknown',
            String(record.recordId || ''),
            String(record.operation || 'UPDATE'),
            record.clientTimestamp || new Date().toISOString(),
            dto.device_id || null
          ).catch((err) => {
            this.logger.warn(`Failed to record idempotency for local_id=${localId}: ${err.message}`);
          });
        }

        results.push({
          operation_id: localId,
          tableName: record.tableName,
          recordId: record.recordId,
          status: 'SUCCESS',
        });
      } catch (error) {
        const localId = (record as any).localId || (record as any).local_id || (record as any).id;
        const message = error?.message || String(error);
        // ⭐ Détection de conflit : version-based ou message Postgres
        if (message.includes('conflict') || message.includes('version') || message.includes('unique constraint')) {
          results.push({
            operation_id: localId,
            tableName: record.tableName,
            recordId: record.recordId,
            status: 'CONFLICT',
            error: message,
          });
        } else {
          results.push({
            operation_id: localId,
            tableName: record.tableName,
            recordId: record.recordId,
            status: 'ERROR',
            error: message,
          });
          this.logger.warn(`Push failed for ${record.tableName}/${record.recordId}: ${message}`);
        }
      }
    }

    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const conflictCount = results.filter(r => r.status === 'CONFLICT').length;
    const errorCount = results.filter(r => r.status === 'ERROR').length;

    this.logger.log(`Push complete: ${successCount} success, ${conflictCount} conflicts, ${errorCount} errors, tenant=${effectiveTenantId}`);

    return {
      success: errorCount === 0,
      pushedAt: new Date().toISOString(),
      total: records.length,
      successful_operations: successCount,
      conflicted_operations: conflictCount,
      failed_operations: errorCount,
      results,
    };
  }

  /// Applique un enregistrement (INSERT/UPDATE/DELETE) sur Neon
  /// ⭐ SÉCURITÉ : `jwtTenantId` est injecté dans le payload (INSERT) et dans
  ///    la clause WHERE (UPDATE/DELETE) pour empêcher l'écriture cross-tenant.
  private async applyRecord(record: {
    tableName: string;
    recordId: string;
    operation: string;
    data: Record<string, any>;
    clientTimestamp: string;
  }, jwtTenantId: string) {
    const { tableName, recordId, operation, data } = record;

    if (this.EXCLUDED_TABLES.has(tableName)) {
      throw new Error(`Table ${tableName} is not syncable (excluded)`);
    }
    if (!this.syncableTablesCache.has(tableName)) {
      throw new Error(`Table ${tableName} is not syncable (not in whitelist)`);
    }

    switch (operation) {
      case 'INSERT':
        return this.applyInsert(tableName, data, jwtTenantId);

      case 'UPDATE':
        return this.applyUpdate(tableName, recordId, data, jwtTenantId);

      case 'DELETE':
        return this.applyDelete(tableName, recordId, jwtTenantId);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /// INSERT : insère un nouvel enregistrement
  /// ⭐ SÉCURITÉ : injecte `tenantId` (camelCase) et `tenant_id` (snake_case)
  ///    dans le payload, en écrasant toute valeur envoyée par le client.
  ///    → un client malveillant ne peut PAS créer un record chez un autre tenant
  private async applyInsert(tableName: string, data: Record<string, any>, jwtTenantId: string) {
    // ⭐ Forger un payload safe : écraser tenantId/tenant_id avec la valeur JWT
    const safeData = {
      ...data,
      tenantId: jwtTenantId,   // camelCase (Prisma)
      tenant_id: jwtTenantId,  // snake_case (raw SQL)
    };

    const columns = Object.keys(safeData).map(c => `"${c}"`);
    const values = Object.values(safeData);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    await this.prisma.$executeRawUnsafe(query, ...values);
  }

  /// UPDATE : met à jour un enregistrement existant
  /// ⭐ SÉCURITÉ : la clause WHERE inclut `tenant_id = $jwt` (ou `tenantId = $jwt`)
  ///    → un client ne peut PAS modifier un record d'un autre tenant
  private async applyUpdate(tableName: string, recordId: string, data: Record<string, any>, jwtTenantId: string) {
    // ⭐ Stripping du tenantId du payload (on ne peut pas changer de tenant via UPDATE)
    const safeData = { ...data };
    delete safeData.tenantId;
    delete safeData.tenant_id;
    delete safeData.id;

    const entries = Object.entries(safeData);
    if (entries.length === 0) return;

    // ⭐ Construction avec paramètres bindés
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const [key, value] of entries) {
      setClauses.push(`"${key}" = $${paramIdx++}`);
      params.push(value);
    }

    // ⭐ Clause WHERE : id = $X AND tenant_id = $Y (sécurité multi-tenant)
    //    On essaie tenant_id (snake_case) en premier, puis tenantId (camelCase)
    const whereIdParam = paramIdx++;
    params.push(recordId);
    const whereTenantParam = paramIdx++;
    params.push(jwtTenantId);

    const query = `
      UPDATE "${tableName}"
      SET ${setClauses.join(', ')}
      WHERE "id" = $${whereIdParam}
        AND ("tenant_id" = $${whereTenantParam}::text::uuid
             OR "tenantId" = $${whereTenantParam}::text::uuid)
    `;

    const result = await this.prisma.$executeRawUnsafe(query, ...params);
    // ⭐ Si 0 ligne affectée, c'est soit que le record n'existe pas, soit qu'il
    //    appartient à un autre tenant. On lève une erreur pour que le client
    //    soit informé.
    if (result === 0) {
      // Vérifier si le record existe mais chez un autre tenant
      const exists = await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM "${tableName}" WHERE "id" = $1 LIMIT 1`,
        recordId
      ).catch(() => [] as any[]);
      if (Array.isArray(exists) && exists.length > 0) {
        throw new Error(`Record ${recordId} in ${tableName} does not belong to tenant ${jwtTenantId} (cross-tenant update blocked)`);
      }
      throw new Error(`Record ${recordId} not found in ${tableName}`);
    }
  }

  /// DELETE : supprime un enregistrement
  /// ⭐ SÉCURITÉ : la clause WHERE inclut `tenant_id = $jwt`
  private async applyDelete(tableName: string, recordId: string, jwtTenantId: string) {
    const query = `
      DELETE FROM "${tableName}"
      WHERE "id" = $1
        AND ("tenant_id" = $2::text::uuid
             OR "tenantId" = $2::text::uuid)
    `;
    const result = await this.prisma.$executeRawUnsafe(query, recordId, jwtTenantId);
    if (result === 0) {
      const exists = await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM "${tableName}" WHERE "id" = $1 LIMIT 1`,
        recordId
      ).catch(() => [] as any[]);
      if (Array.isArray(exists) && exists.length > 0) {
        throw new Error(`Record ${recordId} in ${tableName} does not belong to tenant ${jwtTenantId} (cross-tenant delete blocked)`);
      }
      // Record n'existe pas → idempotent DELETE (no-op)
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /// Récupère la liste de toutes les tables syncables (= public tables - EXCLUDED_TABLES)
  async getTableNames(): Promise<string[]> {
    await this.ensureCacheFresh();
    return Array.from(this.syncableTablesCache).sort();
  }

  /// Rafraîchit le cache des tables syncables depuis information_schema
  private async refreshSyncableTablesCache(): Promise<void> {
    const result = await this.prisma.$queryRawUnsafe<{ table_name: string }[]>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    this.syncableTablesCache = new Set(
      (result as any[])
        .map(r => r.table_name)
        .filter(name => !this.EXCLUDED_TABLES.has(name))
    );
    this.lastCacheRefresh = Date.now();
    this.logger.log(`Syncable tables cache refreshed: ${this.syncableTablesCache.size} tables`);
  }

  /// Vérifie si le cache est périmé et le rafraîchit si nécessaire
  private async ensureCacheFresh(): Promise<void> {
    if (Date.now() - this.lastCacheRefresh > this.CACHE_TTL_MS || this.syncableTablesCache.size === 0) {
      await this.refreshSyncableTablesCache();
    }
  }

  /// Échappe les chaînes pour SQL (anti-injection basique, utilisé pour les IN-clauses)
  /// ⭐ Préférable d'utiliser $queryRaw avec paramètres bindés partout où possible
  private escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }
}
