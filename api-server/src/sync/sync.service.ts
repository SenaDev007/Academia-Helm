/**
 * Service de Synchronisation avec Validation Préalable
 * 
 * OBJECTIF : Synchroniser les données entre SQLite (local) et PostgreSQL (central)
 * avec validation stricte de conformité des schémas
 * 
 * PRINCIPE : Aucune sync sans validation préalable
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchemaValidatorService, SchemaValidationResult } from './schema-validator.service';

export interface SyncRequest {
  tenantId: string;
  sqliteSchemaHash: string;
  sqliteVersion: string;
  lastSyncTimestamp?: string;
}

export interface SyncResponse {
  success: boolean;
  recordsSynced: number;
  conflicts: number;
  errors: string[];
  validationResult?: SchemaValidationResult;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private schemaValidator: SchemaValidatorService
  ) {}

  /**
   * Synchronisation montante (SQLite → PostgreSQL)
   * 
   * VALIDATION OBLIGATOIRE avant traitement
   */
  async syncUp(request: SyncRequest): Promise<SyncResponse> {
    this.logger.log(`Début synchronisation montante pour tenant ${request.tenantId}`);

    // ÉTAPE 1: VALIDATION DE CONFORMITÉ (OBLIGATOIRE)
    const validationResult = await this.schemaValidator.validateSQLiteConformity(
      request.sqliteSchemaHash,
      request.sqliteVersion
    );

    // BLOQUER si non conforme
    await this.schemaValidator.blockSyncIfInvalid(validationResult);

    this.logger.log('✅ Validation de conformité réussie');

    // ÉTAPE 2: TRAITEMENT DE LA SYNCHRONISATION
    try {
      // Ici, vous implémenterez la logique de sync réelle
      // Pour l'instant, placeholder

      const recordsSynced = 0;
      const conflicts = 0;
      const errors: string[] = [];

      this.logger.log(`Synchronisation montante terminée: ${recordsSynced} enregistrements`);

      return {
        success: true,
        recordsSynced,
        conflicts,
        errors,
        validationResult,
      };
    } catch (error: any) {
      this.logger.error('Erreur lors de la synchronisation montante', error);
      throw new BadRequestException(`Erreur de synchronisation: ${error.message}`);
    }
  }

  /**
   * Synchronisation descendante (PostgreSQL → SQLite)
   * 
   * VALIDATION OBLIGATOIRE avant traitement
   */
  async syncDown(request: SyncRequest): Promise<SyncResponse> {
    this.logger.log(`Début synchronisation descendante pour tenant ${request.tenantId}`);

    // ÉTAPE 1: VALIDATION DE CONFORMITÉ (OBLIGATOIRE)
    const validationResult = await this.schemaValidator.validateSQLiteConformity(
      request.sqliteSchemaHash,
      request.sqliteVersion
    );

    // BLOQUER si non conforme
    await this.schemaValidator.blockSyncIfInvalid(validationResult);

    this.logger.log('✅ Validation de conformité réussie');

    // ÉTAPE 2: TRAITEMENT DE LA SYNCHRONISATION
    try {
      // Ici, vous implémenterez la logique de sync réelle
      // Pour l'instant, placeholder

      const recordsSynced = 0;
      const conflicts = 0;
      const errors: string[] = [];

      this.logger.log(`Synchronisation descendante terminée: ${recordsSynced} enregistrements`);

      return {
        success: true,
        recordsSynced,
        conflicts,
        errors,
        validationResult,
      };
    } catch (error: any) {
      this.logger.error('Erreur lors de la synchronisation descendante', error);
      throw new BadRequestException(`Erreur de synchronisation: ${error.message}`);
    }
  }

  /**
   * Vérification de conformité (sans sync)
   */
  async validateConformity(
    sqliteSchemaHash: string,
    sqliteVersion: string
  ): Promise<SchemaValidationResult> {
    return this.schemaValidator.validateSQLiteConformity(sqliteSchemaHash, sqliteVersion);
  }
}

