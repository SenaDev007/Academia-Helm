/**
 * Service de Validation de Conformité PostgreSQL ↔ SQLite
 * 
 * OBJECTIF : Garantir que le schéma SQLite est strictement conforme
 * au schéma PostgreSQL avant toute synchronisation
 * 
 * PRINCIPE : Bloquer toute sync si divergence détectée
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  prismaSchemaHash: string;
  sqliteSchemaHash?: string;
  sqliteVersion?: string;
}

export interface TableComparison {
  tableName: string;
  existsInPostgres: boolean;
  existsInSQLite: boolean;
  columnsMatch: boolean;
  missingColumns: string[];
  extraColumns: string[];
}

@Injectable()
export class SchemaValidatorService {
  private readonly logger = new Logger(SchemaValidatorService.name);
  private readonly schemaPath = join(__dirname, '../../prisma/schema.prisma');

  constructor(private prisma: PrismaService) {}

  /**
   * Calcule le hash du schéma Prisma actuel
   */
  getPrismaSchemaHash(): string {
    try {
      const schemaContent = readFileSync(this.schemaPath, 'utf-8');
      return createHash('sha256').update(schemaContent).digest('hex');
    } catch (error) {
      this.logger.error('Erreur lors de la lecture du schéma Prisma', error);
      throw new Error('Impossible de lire le schéma Prisma');
    }
  }

  /**
   * Valide la conformité du schéma SQLite avec PostgreSQL
   * 
   * Cette méthode doit être appelée AVANT toute synchronisation
   */
  async validateSQLiteConformity(
    sqliteSchemaHash: string,
    sqliteVersion: string
  ): Promise<SchemaValidationResult> {
    const prismaSchemaHash = this.getPrismaSchemaHash();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérification 1: Hash du schéma
    if (sqliteSchemaHash !== prismaSchemaHash) {
      errors.push(
        `Hash du schéma non conforme. ` +
        `PostgreSQL: ${prismaSchemaHash.substring(0, 16)}..., ` +
        `SQLite: ${sqliteSchemaHash.substring(0, 16)}...`
      );
    }

    // Vérification 2: Version de migration
    // (à implémenter selon votre système de versionnement)

    // Vérification 3: Tables essentielles
    const essentialTables = await this.getEssentialTables();
    for (const table of essentialTables) {
      // Vérifier que la table existe dans PostgreSQL
      const existsInPostgres = await this.tableExistsInPostgres(table);
      if (!existsInPostgres) {
        errors.push(`Table manquante dans PostgreSQL: ${table}`);
      }
    }

    // Vérification 4: Colonnes structurantes
    const structuredColumns = ['tenantId', 'academicYearId', 'schoolLevelId'];
    for (const table of essentialTables) {
      const columns = await this.getTableColumns(table);
      for (const requiredColumn of structuredColumns) {
        if (!columns.includes(requiredColumn)) {
          warnings.push(`Colonne structurante manquante dans ${table}: ${requiredColumn}`);
        }
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.error('Validation de conformité échouée', { errors, warnings });
    } else if (warnings.length > 0) {
      this.logger.warn('Validation avec avertissements', { warnings });
    } else {
      this.logger.log('Validation de conformité réussie');
    }

    return {
      isValid,
      errors,
      warnings,
      prismaSchemaHash,
      sqliteSchemaHash,
      sqliteVersion,
    };
  }

  /**
   * Compare les schémas PostgreSQL et SQLite
   */
  async compareSchemas(
    sqliteTables: string[],
    sqliteColumns: Record<string, string[]>
  ): Promise<TableComparison[]> {
    const comparisons: TableComparison[] = [];
    const postgresTables = await this.getAllPostgresTables();

    // Tables dans PostgreSQL
    for (const table of postgresTables) {
      const columns = await this.getTableColumns(table);
      const sqliteTableColumns = sqliteColumns[table] || [];

      const missingColumns = columns.filter(c => !sqliteTableColumns.includes(c));
      const extraColumns = sqliteTableColumns.filter(c => !columns.includes(c));

      comparisons.push({
        tableName: table,
        existsInPostgres: true,
        existsInSQLite: sqliteTables.includes(table),
        columnsMatch: missingColumns.length === 0 && extraColumns.length === 0,
        missingColumns,
        extraColumns,
      });
    }

    // Tables dans SQLite mais pas dans PostgreSQL (erreur)
    for (const table of sqliteTables) {
      if (!postgresTables.includes(table) && !this.isTechnicalTable(table)) {
        comparisons.push({
          tableName: table,
          existsInPostgres: false,
          existsInSQLite: true,
          columnsMatch: false,
          missingColumns: [],
          extraColumns: [],
        });
      }
    }

    return comparisons;
  }

  /**
   * Vérifie si une table existe dans PostgreSQL
   */
  private async tableExistsInPostgres(tableName: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) as exists`,
        tableName
      );
      return result[0]?.exists || false;
    } catch (error) {
      this.logger.error(`Erreur lors de la vérification de la table ${tableName}`, error);
      return false;
    }
  }

  /**
   * Récupère toutes les tables PostgreSQL
   */
  private async getAllPostgresTables(): Promise<string[]> {
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      );
      return result.map(r => r.table_name);
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des tables PostgreSQL', error);
      return [];
    }
  }

  /**
   * Récupère les colonnes d'une table PostgreSQL
   */
  private async getTableColumns(tableName: string): Promise<string[]> {
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = $1
         ORDER BY ordinal_position`,
        tableName
      );
      return result.map(r => r.column_name);
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des colonnes de ${tableName}`, error);
      return [];
    }
  }

  /**
   * Récupère les tables essentielles
   */
  private async getEssentialTables(): Promise<string[]> {
    return [
      'tenants',
      'academic_years',
      'school_levels',
      'academic_tracks',
      'users',
      'students',
      'classes',
      'subjects',
      'exams',
      'grades',
      'payments',
      'tuition_payments',
    ];
  }

  /**
   * Vérifie si une table est technique (autorisée uniquement en SQLite)
   */
  private isTechnicalTable(tableName: string): boolean {
    const technicalTables = [
      'sync_operations',
      'sync_conflicts',
      'sync_logs',
      'schema_version',
    ];
    return technicalTables.includes(tableName);
  }

  /**
   * Bloque la synchronisation si le schéma n'est pas conforme
   */
  async blockSyncIfInvalid(validationResult: SchemaValidationResult): Promise<void> {
    if (!validationResult.isValid) {
      const errorMessage = `
🚨 SYNCHRONISATION BLOQUÉE - SCHÉMA NON CONFORME

Erreurs détectées:
${validationResult.errors.map(e => `  - ${e}`).join('\n')}

${validationResult.warnings.length > 0 ? `Avertissements:\n${validationResult.warnings.map(w => `  - ${w}`).join('\n')}` : ''}

ACTION REQUISE:
1. Régénérer le schéma SQLite: npm run generate:sqlite-schema
2. Appliquer les migrations SQLite: npm run migrate:sqlite
3. Vérifier la conformité: npm run validate:schema

PostgreSQL Hash: ${validationResult.prismaSchemaHash.substring(0, 16)}...
SQLite Hash: ${validationResult.sqliteSchemaHash?.substring(0, 16) || 'N/A'}...
      `.trim();

      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}

