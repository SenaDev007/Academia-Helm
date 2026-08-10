import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SyncPullDto, SyncPushDto } from './dto/sync-pull-push.dto';

/**
 * ============================================================================
 * SYNC SERVICE — Synchronisation Neon ↔ SQLite (app desktop)
 * ============================================================================
 *
 * PULL : L'app desktop demande les modifications depuis Neon
 *   GET /api/sync/pull
 *   → Retourne les enregistrements modifiés depuis lastSyncAt
 *
 * PUSH : L'app desktop envoie ses écritures locales (outbox)
 *   POST /api/sync/push
 *   → Applique les INSERT/UPDATE/DELETE sur Neon
 *   → Retourne le résultat (success/conflict/error) pour chaque record
 * ============================================================================
 */

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  // Tables synchronisables (exclut les tables système et de sync)
  private readonly EXCLUDED_TABLES = new Set([
    '_prisma_migrations',
    '_sync_metadata',
    '_sync_outbox',
    '_sync_log',
    'audit_logs',
    'schema_migrations',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // PULL — Télécharge les modifications depuis Neon
  // ===========================================================================

  async pull(dto: SyncPullDto) {
    // ⭐ Normaliser snake_case → camelCase
    const lastSyncAt = dto.lastSyncAt || (dto as any).last_sync_at;
    const tenantId = dto.tenantId || (dto as any).tenant_id;

    this.logger.log(`Pull request: tables=${dto.tables?.length || 'all'}, lastSync=${lastSyncAt || 'initial'}, tenant=${tenantId || 'none'}`);

    const tables = dto.tables?.length ? dto.tables : await this.getAllTableNames();
    const limit = dto.limit || 500;
    const results: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const tableName of tables) {
      if (this.EXCLUDED_TABLES.has(tableName)) continue;

      try {
        const records = await this.pullTable(tableName, lastSyncAt, limit, tenantId);
        results[tableName] = records;
        totalRecords += records.length;
      } catch (error) {
        this.logger.warn(`Pull failed for table ${tableName}: ${error.message}`);
        results[tableName] = [];
      }
    }

    this.logger.log(`Pull complete: ${totalRecords} records from ${Object.keys(results).length} tables`);

    // ⭐ Format de retour compatible avec le frontend sync-engine
    //    Le frontend attend { entities: { tableName: [...] } }
    return {
      success: true,
      pulledAt: new Date().toISOString(),
      lastSyncAt: lastSyncAt,
      syncToken: `sync-${Date.now()}`,
      totalRecords,
      entities: results, // ⭐ format attendu par sync-engine.service.ts
      tables: results,   // rétro-compat
      stats: {
        totalEntities: totalRecords,
        tableCount: Object.keys(results).length,
      },
    };
  }

  /// Récupère les enregistrements d'une table
  private async pullTable(tableName: string, lastSyncAt: string | undefined, limit: number, tenantId?: string) {
    // Construire la requête SQL
    let query = `SELECT * FROM "${tableName}"`;

    const conditions: string[] = [];

    // Filtre par timestamp (delta sync)
    if (lastSyncAt) {
      const hasUpdatedAt = await this.columnExists(tableName, 'updated_at');
      if (hasUpdatedAt) {
        conditions.push(`"updated_at" > '${this.escapeSql(lastSyncAt)}'`);
      }
    }

    // Filtre par tenant
    if (tenantId) {
      const hasTenantId = await this.columnExists(tableName, 'tenant_id');
      if (hasTenantId) {
        conditions.push(`"tenant_id" = '${this.escapeSql(tenantId)}'`);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Tri par updated_at (si la colonne existe)
    const hasUpdatedAt = await this.columnExists(tableName, 'updated_at');
    if (hasUpdatedAt) {
      query += ' ORDER BY "updated_at" DESC';
    }

    query += ` LIMIT ${limit}`;

    const result = await this.prisma.$queryRawUnsafe(query);
    return result as any[];
  }

  // ===========================================================================
  // PUSH — Applique les écritures locales sur Neon
  // ===========================================================================

  async push(dto: SyncPushDto) {
    // ⭐ Normaliser : accepter à la fois records[] et operations[]
    let records: any[] = [];
    if (dto.records && dto.records.length > 0) {
      records = dto.records;
    } else if (dto.operations && dto.operations.length > 0) {
      // Convertir operations (snake_case) → records (camelCase)
      records = dto.operations.map((op: any) => ({
        tableName: op.table_name || op.tableName,
        recordId: op.record_id || op.recordId,
        operation: (op.operation_type || op.operation || 'UPDATE').toUpperCase(),
        data: op.payload || op.data || {},
        clientTimestamp: op.client_timestamp || op.clientTimestamp || new Date().toISOString(),
      }));
    }

    this.logger.log(`Push request: ${records.length} records`);

    const results: Array<{
      operation_id?: string;
      tableName: string;
      recordId: string;
      status: 'SUCCESS' | 'CONFLICT' | 'ERROR';
      error?: string;
    }> = [];

    for (const record of records) {
      try {
        await this.applyRecord(record);
        results.push({
          operation_id: (record as any).id,
          tableName: record.tableName,
          recordId: record.recordId,
          status: 'SUCCESS',
        });
      } catch (error) {
        if (error.message?.includes('conflict') || error.message?.includes('version')) {
          results.push({
            operation_id: (record as any).id,
            tableName: record.tableName,
            recordId: record.recordId,
            status: 'CONFLICT',
            error: error.message,
          });
        } else {
          results.push({
            operation_id: (record as any).id,
            tableName: record.tableName,
            recordId: record.recordId,
            status: 'ERROR',
            error: error.message,
          });
          this.logger.warn(`Push failed for ${record.tableName}/${record.recordId}: ${error.message}`);
        }
      }
    }

    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const conflictCount = results.filter(r => r.status === 'CONFLICT').length;
    const errorCount = results.filter(r => r.status === 'ERROR').length;

    this.logger.log(`Push complete: ${successCount} success, ${conflictCount} conflicts, ${errorCount} errors`);

    // ⭐ Format de retour compatible avec le frontend sync-engine
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
  private async applyRecord(record: {
    tableName: string;
    recordId: string;
    operation: string;
    data: Record<string, any>;
    clientTimestamp: string;
  }) {
    const { tableName, recordId, operation, data } = record;

    if (this.EXCLUDED_TABLES.has(tableName)) {
      throw new Error(`Table ${tableName} is not syncable`);
    }

    switch (operation) {
      case 'INSERT':
        return this.applyInsert(tableName, data);

      case 'UPDATE':
        return this.applyUpdate(tableName, recordId, data);

      case 'DELETE':
        return this.applyDelete(tableName, recordId);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /// INSERT : insère un nouvel enregistrement
  private async applyInsert(tableName: string, data: Record<string, any>) {
    const columns = Object.keys(data).map(c => `"${c}"`);
    const values = Object.values(data).map(v => this.formatSqlValue(v));

    const query = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`;

    await this.prisma.$executeRawUnsafe(query);
  }

  /// UPDATE : met à jour un enregistrement existant
  private async applyUpdate(tableName: string, recordId: string, data: Record<string, any>) {
    const setClauses = Object.entries(data)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => `"${key}" = ${this.formatSqlValue(value)}`);

    if (setClauses.length === 0) return;

    const query = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE "id" = '${this.escapeSql(recordId)}'`;

    await this.prisma.$executeRawUnsafe(query);
  }

  /// DELETE : supprime un enregistrement
  private async applyDelete(tableName: string, recordId: string) {
    const query = `DELETE FROM "${tableName}" WHERE "id" = '${this.escapeSql(recordId)}'`;
    await this.prisma.$executeRawUnsafe(query);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /// Récupère la liste de toutes les tables synchronisables
  private async getAllTableNames(): Promise<string[]> {
    const result = await this.prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return (result as any[])
      .map(r => r.table_name)
      .filter(name => !this.EXCLUDED_TABLES.has(name));
  }

  /// Vérifie si une colonne existe dans une table
  private async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = '${this.escapeSql(tableName)}'
        AND column_name = '${this.escapeSql(columnName)}'
    `);
    return (result as any[]).length > 0;
  }

  /// Échappe les chaînes pour SQL (anti-injection basique)
  private escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }

  /// Formate une valeur pour SQL
  private formatSqlValue(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'object') return `'${this.escapeSql(JSON.stringify(value))}'`;
    // String
    return `'${this.escapeSql(String(value))}'`;
  }
}
