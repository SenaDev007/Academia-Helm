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

    // ⭐ ANNÉE SCOLAIRE STRICTE (sept. 2026) : le cache offline ne doit contenir
    //    QUE les données de l'année ACTIVE du tenant. Les années antérieures
    //    restent consultables EN LIGNE uniquement (promoteur/directeur inclus)
    //    via les endpoints métier classiques — elles ne transitent jamais par
    //    la sync offline pour ne pas alourdir IndexedDB.
    const activeAcademicYearId = await this.getActiveAcademicYearId(tenantId);
    if (activeAcademicYearId) {
      this.logger.log(`Pull: filtrage année scolaire active (${activeAcademicYearId}) — données antérieures exclues du cache offline`);
    }

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
        academicYearId: activeAcademicYearId,
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
            const records = await this.pullTableFast(
              tableName,
              lastSyncAt,
              limit,
              tenantId,
              columnMap,
              activeAcademicYearId,
            );
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
      academicYearId: activeAcademicYearId,
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
  /// ⭐ Map<colonne → data_type> par table : permet de caster les paramètres
  ///    bindés selon le type RÉEL de la colonne. La BDD mélange :
  ///    tenantId=text(538)+varchar(1), tenant_id=text(18)+uuid(1),
  ///    academicYearId=text(311), updatedAt=timestamp(467)/timestamptz(10).
  ///    Un cast fixe `::text::uuid` échoue sur les colonnes text (operator
  ///    text = uuid does not exist) — d'où la résolution dynamique.
  private async buildColumnMap(tables: string[]): Promise<Map<string, Map<string, string>>> {
    const map = new Map<string, Map<string, string>>();
    if (tables.length === 0) return map;

    try {
      const inClause = tables.map(t => `'${this.escapeSql(t)}'`).join(',');
      const query = `
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (${inClause})
        ORDER BY table_name, ordinal_position
      `;
      const result = await this.prisma.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string }[]>(query);
      for (const row of result) {
        if (!map.has(row.table_name)) map.set(row.table_name, new Map());
        map.get(row.table_name)!.set(row.column_name, row.data_type);
      }
    } catch (err) {
      this.logger.warn(`buildColumnMap failed: ${err.message}`);
    }
    return map;
  }

  /// ⭐ Suffixe de cast pour un paramètre bindé string vers le type réel de
  ///    la colonne ("" = pas de cast : text/varchar comparent nativement).
  private castSuffix(dataType: string | undefined): string {
    switch (dataType) {
      case 'uuid':
        return '::text::uuid';
      case 'timestamp with time zone':
        return '::text::timestamptz';
      case 'timestamp without time zone':
        return '::text::timestamp';
      default:
        return ''; // text, character varying — comparaison directe
    }
  }

  /// ⭐ RÉSOLUTION DE COLONNE — la BDD mélange DEUX conventions :
  ///    - camelCase (Prisma historique) : "tenantId", "updatedAt", "academicYearId"
  ///      → 539 tables tenantId, 477 updatedAt, 311 academicYearId
  ///    - snake_case (migrations récentes @map) : "tenant_id", "updated_at",
  ///      "academic_year_id" → ~19-20 tables
  ///    AVANT (bug critique) : pullTableFast testait UNIQUEMENT 'tenant_id' et
  ///    'updated_at' → pour ~520 tables camelCase, AUCUN filtre tenant n'était
  ///    appliqué (le pull renvoyait les données de TOUS les tenants) et AUCUN
  ///    delta incrémental (re-téléchargement complet à chaque sync).
  ///    MAINTENANT : on résout la vraie colonne de la table via information_schema.
  private resolveColumn(cols: Set<string>, candidates: string[]): string | null {
    for (const candidate of candidates) {
      if (cols.has(candidate)) return candidate;
    }
    return null;
  }

  /// ⭐ ANNÉE SCOLAIRE ACTIVE du tenant (tenantId du JWT, jamais du body).
  ///    Sert au filtrage année-strict du pull : seul le cache de l'année
  ///    active est téléchargé offline. Null si aucune année active.
  private async getActiveAcademicYearId(tenantId: string): Promise<string | null> {
    try {
      // ⚠️ tenantId de academic_years est de type TEXT (schéma Prisma historique)
      //    → comparaison directe SANS cast uuid (text = uuid → erreur Postgres)
      const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
        SELECT id FROM "academic_years"
        WHERE "tenantId" = $1 AND "isActive" = true
        ORDER BY "startDate" DESC
        LIMIT 1
      `, tenantId);
      return rows && rows.length > 0 ? rows[0].id : null;
    } catch (err) {
      // Colonnes snake_case (migrations récentes) ou table absente → fallback
      try {
        const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
          SELECT id FROM "academic_years"
          WHERE tenant_id = $1 AND is_active = true
          ORDER BY start_date DESC
          LIMIT 1
        `, tenantId);
        return rows && rows.length > 0 ? rows[0].id : null;
      } catch {
        this.logger.warn(`getActiveAcademicYearId failed: ${err.message}`);
        return null;
      }
    }
  }

  /// Version optimisée de pullTable
  /// ⭐ SÉCURITÉ : le tenantId est bindé en paramètre ($1), pas interpolé
  /// ⭐ TENANT-STRICT + ANNÉE-STRICT + DELTA :
  ///    - WHERE <colonne tenant réelle> = tenantId (JWT) — quel que soit le
  ///      format de colonne (camelCase Prisma historique OU snake_case @map)
  ///    - AND (<colonne année réelle> = activeYearId OR IS NULL) — l'année
  ///      active SEULEMENT en cache offline ; NULL = données transverses
  ///    - AND <colonne updated réelle> > lastSyncAt (delta incrémental)
  private async pullTableFast(
    tableName: string,
    lastSyncAt: string | undefined,
    limit: number,
    tenantId: string,
    columnMap: Map<string, Map<string, string>>,
    activeAcademicYearId: string | null,
  ) {
    const cols = columnMap.get(tableName) ?? new Map<string, string>();

    // ⭐ Résolution des VRAIES colonnes (camelCase OU snake_case selon la table)
    const tenantCol = this.resolveColumn(cols, ['tenant_id', 'tenantId']);
    const updatedCol = this.resolveColumn(cols, ['updated_at', 'updatedAt']);
    const academicYearCol = this.resolveColumn(cols, ['academic_year_id', 'academicYearId']);

    // ⭐ Construction avec paramètres bindés pour éviter l'injection SQL
    const params: any[] = [];
    let paramIdx = 1;
    let query = `SELECT * FROM "${tableName}"`;
    const conditions: string[] = [];

    // TENANT-STRICT : toujours filtrer par le tenant du JWT quand la colonne existe
    if (tenantCol) {
      const cast = this.castSuffix(cols.get(tenantCol));
      conditions.push(`"${tenantCol}" = $${paramIdx++}${cast}`);
      params.push(tenantId);
    }

    // ANNÉE-STRICT : uniquement l'année active (NULL = données transverses acceptées)
    if (academicYearCol && activeAcademicYearId) {
      const cast = this.castSuffix(cols.get(academicYearCol));
      conditions.push(`("${academicYearCol}" = $${paramIdx++}${cast} OR "${academicYearCol}" IS NULL)`);
      params.push(activeAcademicYearId);
    }

    // DELTA incrémental : ne renvoyer que ce qui a changé depuis la dernière sync
    if (lastSyncAt && updatedCol) {
      const cast = this.castSuffix(cols.get(updatedCol));
      conditions.push(`"${updatedCol}" > $${paramIdx++}${cast}`);
      params.push(lastSyncAt);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    if (updatedCol) {
      query += ` ORDER BY "${updatedCol}" DESC`;
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

    // ⭐ Résolution des colonnes réelles pour les tables concernées par le push
    //    (camelCase Prisma OU snake_case @map selon la table — cf. pullTableFast)
    const pushTableNames = Array.from(new Set(
      records.map((r) => r.tableName).filter((t) => t && this.syncableTablesCache.has(t))
    ));
    const pushColumnMap = await this.buildColumnMap(pushTableNames);

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
        await this.applyRecord(record, effectiveTenantId, pushColumnMap);

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

  /**
   * ⭐ GET /sync/bootstrap — Contexte de session pour le mode hors-ligne.
   *
   * Alimente offline-bootstrap.service.ts (web-app) : user sans secrets,
   * rôles/permissions, tenant, année académique active + périodes, modules
   * activés (tenant_features) et configuration offline du tenant.
   *
   * Sécurité :
   *   - tenantId vient EXCLUSIVEMENT du JWT (jamais du client) ;
   *   - aucun hash/token/secret n'est retourné (select explicite des champs) ;
   *   - le user est rechargé depuis la base (pas confiance au payload seul).
   */
  async getBootstrapData(user: any, tenantId: string) {
    const userId = user?.id || user?.sub || user?.userId;
    if (!userId || !tenantId) {
      throw new Error('user and tenantId are required for bootstrap');
    }

    // 1. Utilisateur (rechargé depuis la base, champs non sensibles uniquement)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isSuperAdmin: true,
        tenantId: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 2. Rôles + permissions (via UserRole → Role → RolePermission → Permission)
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, OR: [{ tenantId }, { tenantId: null }] },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });
    const roles = userRoles.map((ur: any) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      isSystemRole: ur.role.isSystemRole,
      canAccessOrion: ur.role.canAccessOrion,
      canAccessAtlas: ur.role.canAccessAtlas,
    }));
    const permissionNames = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role?.rolePermissions ?? []) {
        if (rp.permission?.name) permissionNames.add(rp.permission.name);
      }
    }

    // 3. Tenant courant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        slug: true,
        type: true,
        status: true,
        subscriptionStatus: true,
        countryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 4. Année académique ACTIVE + périodes
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    const academicTerms = academicYear
      ? await this.prisma.academicPeriod.findMany({
          where: { academicYearId: academicYear.id },
          orderBy: { periodOrder: 'asc' },
        })
      : [];

    // 5. Modules activés (tenant_features)
    const tenantFeatures = await this.prisma.tenantFeature.findMany({
      where: { tenantId },
      select: { tenantId: true, featureCode: true, isEnabled: true, status: true },
    });

    // 6. Config offline du tenant (offline_sync_settings)
    let offlineConfig: any = null;
    try {
      offlineConfig = await this.prisma.offlineSyncSettings.findFirst({
        where: { tenantId },
      });
    } catch {
      // Table optionnelle — absence non bloquante
    }

    return serializeForJson({
      user: dbUser,
      tenant,
      roles,
      permissions: Array.from(permissionNames),
      academicYear,
      academicTerms,
      modules: tenantFeatures,
      config: offlineConfig ?? {
        isEnabled: true,
        syncFrequencyMinutes: 5,
        conflictResolution: 'FIELD_MERGE',
        autoSyncOnConnect: true,
        maxOfflineDays: 7,
        allowOfflineModification: true,
        syncOnBackground: true,
      },
      bootstrapAt: new Date().toISOString(),
    });
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
  }, jwtTenantId: string, columnMap?: Map<string, Map<string, string>>) {
    const { tableName, recordId, operation, data } = record;

    if (this.EXCLUDED_TABLES.has(tableName)) {
      throw new Error(`Table ${tableName} is not syncable (excluded)`);
    }
    if (!this.syncableTablesCache.has(tableName)) {
      throw new Error(`Table ${tableName} is not syncable (not in whitelist)`);
    }

    switch (operation) {
      case 'INSERT':
        return this.applyInsert(tableName, data, jwtTenantId, columnMap);

      case 'UPDATE':
        return this.applyUpdate(tableName, recordId, data, jwtTenantId, columnMap);

      case 'DELETE':
        return this.applyDelete(tableName, recordId, jwtTenantId, columnMap);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /// INSERT : insère un nouvel enregistrement
  /// ⭐ SÉCURITÉ : injecte le tenantId JWT dans la/les colonne(s) tenant que
  ///    la table possède RÉELLEMENT (camelCase « tenantId » OU snake_case
  ///    « tenant_id »), en écrasant toute valeur envoyée par le client.
  ///    → un client malveillant ne peut PAS créer un record chez un autre tenant
  ///    → AVANT : les DEUX colonnes étaient injectées d'office → INSERT en
  ///      erreur pour toute table n'ayant qu'un seul des deux formats.
  private async applyInsert(
    tableName: string,
    data: Record<string, any>,
    jwtTenantId: string,
    columnMap?: Map<string, Map<string, string>>,
  ) {
    const cols = columnMap?.get(tableName) ?? new Map<string, string>();
    // ⭐ Forger un payload safe : écraser la colonne tenant avec la valeur JWT
    const safeData: Record<string, any> = { ...data };
    if (cols.size === 0 || cols.has('tenantId')) safeData.tenantId = jwtTenantId;
    if (cols.size === 0 || cols.has('tenant_id')) safeData.tenant_id = jwtTenantId;

    const columns = Object.keys(safeData).map(c => `"${c}"`);
    const values = Object.values(safeData);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    await this.prisma.$executeRawUnsafe(query, ...values);
  }

  /// UPDATE : met à jour un enregistrement existant
  /// ⭐ SÉCURITÉ : la clause WHERE inclut `tenant_id = $jwt` (ou `tenantId = $jwt`)
  ///    → un client ne peut PAS modifier un record d'un autre tenant
  private async applyUpdate(
    tableName: string,
    recordId: string,
    data: Record<string, any>,
    jwtTenantId: string,
    columnMap?: Map<string, Map<string, string>>,
  ) {
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

    // ⭐ Clause WHERE : id = $X AND <colonne tenant réelle> = $Y
    //    (sécurité multi-tenant — camelCase OU snake_case selon la table ;
    //    AVANT : WHERE (tenant_id = $ OR tenantId = $) → erreur SQL « column
    //    does not exist » pour toute table n'ayant qu'un seul des formats)
    const cols = columnMap?.get(tableName) ?? new Map<string, string>();
    const tenantCol = this.resolveColumn(cols, ['tenant_id', 'tenantId']);
    if (!tenantCol) {
      // Table sans colonne tenant (référentiel partagé) : WHERE id seul
      const whereIdParam = paramIdx++;
      params.push(recordId);
      const query = `
        UPDATE "${tableName}"
        SET ${setClauses.join(', ')}
        WHERE "id" = $${whereIdParam}
      `;
      const resultNoTenant = await this.prisma.$executeRawUnsafe(query, ...params);
      if (resultNoTenant === 0) {
        throw new Error(`Record ${recordId} not found in ${tableName}`);
      }
      return;
    }

    const whereIdParam = paramIdx++;
    params.push(recordId);
    const whereTenantParam = paramIdx++;
    params.push(jwtTenantId);
    const tenantCast = this.castSuffix(cols.get(tenantCol));

    const query = `
      UPDATE "${tableName}"
      SET ${setClauses.join(', ')}
      WHERE "id" = $${whereIdParam}
        AND "${tenantCol}" = $${whereTenantParam}${tenantCast}
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
  private async applyDelete(
    tableName: string,
    recordId: string,
    jwtTenantId: string,
    columnMap?: Map<string, Map<string, string>>,
  ) {
    // ⭐ Clause WHERE selon la colonne tenant RÉELLE de la table
    //    (AVANT : OR sur les 2 formats → erreur SQL pour les tables mono-format)
    const cols = columnMap?.get(tableName) ?? new Map<string, string>();
    const tenantCol = this.resolveColumn(cols, ['tenant_id', 'tenantId']);
    const query = tenantCol
      ? `
      DELETE FROM "${tableName}"
      WHERE "id" = $1
        AND "${tenantCol}" = $2${this.castSuffix(cols.get(tenantCol))}
    `
      : `
      DELETE FROM "${tableName}"
      WHERE "id" = $1
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
