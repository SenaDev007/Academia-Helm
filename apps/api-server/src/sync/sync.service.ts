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
    this.logger.log(`Pull request: tables=${dto.tables?.length || 'all'}, lastSync=${dto.lastSyncAt || 'initial'}`);

    const tables = dto.tables?.length ? dto.tables : await this.getAllTableNames();
    const limit = dto.limit || 500;
    const results: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const tableName of tables) {
      if (this.EXCLUDED_TABLES.has(tableName)) continue;

      try {
        const records = await this.pullTable(tableName, dto.lastSyncAt, limit, dto.tenantId);
        results[tableName] = records;
        totalRecords += records.length;
      } catch (error) {
        this.logger.warn(`Pull failed for table ${tableName}: ${error.message}`);
        results[tableName] = [];
      }
    }

    this.logger.log(`Pull complete: ${totalRecords} records from ${Object.keys(results).length} tables`);

    return {
      success: true,
      pulledAt: new Date().toISOString(),
      lastSyncAt: dto.lastSyncAt,
      totalRecords,
      tables: results,
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
    this.logger.log(`Push request: ${dto.records.length} records`);

    const results: Array<{
      tableName: string;
      recordId: string;
      status: 'success' | 'conflict' | 'error';
      error?: string;
    }> = [];

    for (const record of dto.records) {
      try {
        await this.applyRecord(record);
        results.push({
          tableName: record.tableName,
          recordId: record.recordId,
          status: 'success',
        });
      } catch (error) {
        // Check if it's a conflict (version mismatch)
        if (error.message?.includes('conflict') || error.message?.includes('version')) {
          results.push({
            tableName: record.tableName,
            recordId: record.recordId,
            status: 'conflict',
            error: error.message,
          });
        } else {
          results.push({
            tableName: record.tableName,
            recordId: record.recordId,
            status: 'error',
            error: error.message,
          });
          this.logger.warn(`Push failed for ${record.tableName}/${record.recordId}: ${error.message}`);
        }
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const conflictCount = results.filter(r => r.status === 'conflict').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    this.logger.log(`Push complete: ${successCount} success, ${conflictCount} conflicts, ${errorCount} errors`);

    return {
      success: errorCount === 0,
      pushedAt: new Date().toISOString(),
      total: dto.records.length,
      success: successCount,
      conflicts: conflictCount,
      errors: errorCount,
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
