import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchemaValidatorService } from '../schema-validator.service';
import {
  OfflineSyncRequestDto,
  OfflineSyncResponseDto,
  OfflineOperationResultDto,
  OfflineOperationDto,
  OperationSyncStatus,
  OfflineOperationType,
} from '../dto/offline-sync.dto';
import { SyncPullRequestDto, SyncPullResponseDto } from '../dto/sync-pull.dto';
import { ConflictDetectionService } from './conflict-detection.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service de synchronisation offline → PostgreSQL
 * 
 * RÈGLES :
 * - Transaction serveur par batch
 * - Rejet si schéma incompatible
 * - Journalisation serveur obligatoire
 * - PostgreSQL gagne en cas de conflit
 */
@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);

  constructor(
    private prisma: PrismaService,
    private schemaValidator: SchemaValidatorService,
    private conflictDetection: ConflictDetectionService,
  ) {}

  /**
   * Synchronise les opérations offline vers PostgreSQL
   * 
   * FLUX :
   * 1. Détection connexion disponible (vérifiée par middleware)
   * 2. Vérification version schéma
   * 3. Envoi opérations par ordre chronologique
   * 4. Validation serveur (tenantId & permissions)
   * 5. Appliquer règles métier serveur
   * 6. Retourner résultat par opération
   */
  async syncOfflineOperations(
    request: OfflineSyncRequestDto,
    userId: string,
    ipAddress?: string,
  ): Promise<OfflineSyncResponseDto> {
    const syncId = uuidv4();
    this.logger.log(`[${syncId}] Début synchronisation offline pour tenant ${request.tenantId}`);

    // ÉTAPE 0: VALIDATION APPAREIL (si device_id fourni)
    let deviceIdForLastSync: string | null = null;
    if (request.device_id) {
      const device = await this.prisma.userDevice.findFirst({
        where: {
          OR: [{ id: request.device_id }, { deviceHash: request.device_id }],
          userId,
          tenantId: request.tenantId,
          revokedAt: null,
        },
      });
      if (!device) {
        throw new ForbiddenException('Appareil non reconnu ou révoqué');
      }
      deviceIdForLastSync = device.id;
    }

    // ÉTAPE 1: VALIDATION SCHÉMA (OBLIGATOIRE)
    const schemaValidation = await this.schemaValidator.validateSQLiteConformity(
      request.sqliteSchemaHash,
      request.sqliteVersion,
    );

    if (!schemaValidation.isValid) {
      const errorMessage = schemaValidation.errors?.join(', ') || 'Schéma incompatible';
      this.logger.warn(`[${syncId}] Schéma SQLite incompatible: ${errorMessage}`);
      throw new BadRequestException(
        `Schéma SQLite incompatible: ${errorMessage}. Mise à jour de l'application requise.`,
      );
    }

    // ÉTAPE 2: VÉRIFICATION TENANT & PERMISSIONS
    await this.validateTenantAndPermissions(request.tenantId, userId);

    // ÉTAPE 3: TRAITEMENT DES OPÉRATIONS PAR BATCH (Transaction)
    const results: OfflineOperationResultDto[] = [];
    let successfulCount = 0;
    let conflictedCount = 0;
    let failedCount = 0;

    // Trier les opérations par ordre chronologique (déjà fait côté client, mais on vérifie)
    const sortedOperations = [...request.operations].sort((a, b) => {
      const timeA = a.local_updated_at ? new Date(a.local_updated_at).getTime() : 0;
      const timeB = b.local_updated_at ? new Date(b.local_updated_at).getTime() : 0;
      return timeA - timeB;
    });

    // Traitement par batch (groupe par table pour optimiser les transactions)
    const operationsByTable = this.groupOperationsByTable(sortedOperations);

    for (const [tableName, operations] of Object.entries(operationsByTable)) {
      this.logger.log(`[${syncId}] Traitement ${operations.length} opérations pour table ${tableName}`);

      // Transaction par table
      try {
        const tableResults = await this.processBatchTransaction(
          request.tenantId,
          tableName,
          operations,
          syncId,
        );
        results.push(...tableResults);

        // Compter les résultats
        for (const result of tableResults) {
          if (result.status === OperationSyncStatus.SUCCESS) {
            successfulCount++;
          } else if (result.status === OperationSyncStatus.CONFLICT) {
            conflictedCount++;
          } else {
            failedCount++;
          }
        }
      } catch (error: any) {
        this.logger.error(`[${syncId}] Erreur transaction pour table ${tableName}`, error);
        // Marquer toutes les opérations de ce batch comme failed
        for (const operation of operations) {
          results.push({
            operation_id: operation.id,
            status: OperationSyncStatus.ERROR,
            error_message: `Erreur transaction: ${error.message}`,
          });
          failedCount++;
        }
      }
    }

    const syncedIds = results
      .filter((r) => r.status === OperationSyncStatus.SUCCESS && r.server_record_id)
      .map((r) => r.server_record_id as string);
    const conflicts = results
      .filter((r) => r.status === OperationSyncStatus.CONFLICT)
      .map((r) => ({ operation_id: r.operation_id, reason: r.conflict_reason, server_data: r.server_data }));

    const response: OfflineSyncResponseDto = {
      sync_id: syncId,
      tenantId: request.tenantId,
      success: failedCount === 0 && conflictedCount === 0,
      status: failedCount === 0 && conflictedCount === 0 ? 'success' : conflictedCount > 0 ? 'partial' : 'error',
      synced_ids: syncedIds,
      conflicts,
      total_operations: request.operations.length,
      successful_operations: successfulCount,
      conflicted_operations: conflictedCount,
      failed_operations: failedCount,
      results,
      schema_validation_status: schemaValidation.isValid ? 'OK' : 'INCOMPATIBLE',
      completed_at: new Date().toISOString(),
    };

    this.logger.log(
      `[${syncId}] Synchronisation terminée: ${successfulCount} succès, ${conflictedCount} conflits, ${failedCount} échecs`,
    );

    // Mise à jour lastSyncAt sur l'appareil (ERP institutionnel)
    if (deviceIdForLastSync) {
      await this.prisma.userDevice.update({
        where: { id: deviceIdForLastSync },
        data: { lastSyncAt: new Date(), lastUsedAt: new Date() },
      }).catch((err) => this.logger.warn(`[${syncId}] Mise à jour lastSyncAt ignorée: ${err.message}`));
    }

    // Journalisation sécurité : conflits ou anomalie
    if (conflictedCount > 0) {
      await this.logSecurityEvent(request.tenantId, userId, 'SYNC_CONFLICT', 'MEDIUM', {
        syncId,
        conflictedCount,
        total: request.operations.length,
      }, ipAddress);
    }
    if (failedCount >= 5) {
      await this.logSecurityEvent(request.tenantId, userId, 'SYNC_ANOMALY', 'HIGH', {
        syncId,
        failedCount,
        total: request.operations.length,
      }, ipAddress);
    }

    return response;
  }

  private async logSecurityEvent(
    tenantId: string,
    userId: string | null,
    eventType: string,
    severity: string,
    metadata: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          tenantId,
          userId: userId ?? undefined,
          eventType,
          severity,
          ipAddress: ipAddress ?? undefined,
          metadata: metadata as any,
        },
      });
    } catch (e) {
      this.logger.warn('Log SecurityEvent ignoré', e);
    }
  }

  /**
   * Synchronisation descendante (PostgreSQL → client) : enregistrements modifiés après last_sync_at
   */
  async pull(
    request: SyncPullRequestDto,
    userId: string,
    ipAddress?: string,
  ): Promise<SyncPullResponseDto> {
    await this.validateTenantAndPermissions(request.tenant_id, userId);

    const since = new Date(request.last_sync_at);

    if (request.device_id) {
      const device = await this.prisma.userDevice.findFirst({
        where: {
          OR: [{ id: request.device_id }, { deviceHash: request.device_id }],
          userId,
          tenantId: request.tenant_id,
          revokedAt: null,
        },
      });
      if (device) {
        await this.prisma.userDevice.update({
          where: { id: device.id },
          data: { lastSyncAt: new Date(), lastUsedAt: new Date() },
        });
      }
    }

    const [students, studentEnrollments, payments] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId: request.tenant_id, updatedAt: { gt: since } },
      }),
      this.prisma.studentEnrollment.findMany({
        where: { tenantId: request.tenant_id, updatedAt: { gt: since } },
      }),
      this.prisma.payment.findMany({
        where: { tenantId: request.tenant_id, updatedAt: { gt: since } },
      }),
    ]);

    const pulledAt = new Date().toISOString();
    return {
      tenant_id: request.tenant_id,
      last_sync_at: request.last_sync_at,
      pulled_at: pulledAt,
      entities: {
        students: students as any[],
        studentEnrollments: studentEnrollments as any[],
        payments: payments as any[],
      },
    };
  }

  /**
   * Valide le tenant et les permissions de l'utilisateur
   */
  private async validateTenantAndPermissions(tenantId: string, userId: string): Promise<void> {
    // Vérifier que l'utilisateur appartient au tenant
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, role: true, status: true },
    });

    if (!user) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }

    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Accès interdit: tenant non autorisé');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException('Compte utilisateur inactif');
    }

    // Vérifier que le tenant existe et est actif
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant non trouvé');
    }

    if (tenant.status !== 'active') {
      throw new ForbiddenException('Tenant inactif');
    }
  }

  /**
   * Groupe les opérations par table pour traitement par batch
   */
  private groupOperationsByTable(
    operations: OfflineOperationDto[],
  ): Record<string, OfflineOperationDto[]> {
    return operations.reduce((acc, op) => {
      if (!acc[op.table_name]) {
        acc[op.table_name] = [];
      }
      acc[op.table_name].push(op);
      return acc;
    }, {} as Record<string, OfflineOperationDto[]>);
  }

  /**
   * Traite un batch d'opérations dans une transaction
   */
  private async processBatchTransaction(
    tenantId: string,
    tableName: string,
    operations: OfflineOperationDto[],
    syncId: string,
  ): Promise<OfflineOperationResultDto[]> {
    const results: OfflineOperationResultDto[] = [];

    // Utiliser Prisma transaction pour garantir atomicité
    await this.prisma.$transaction(
      async (tx) => {
        for (const operation of operations) {
          try {
            // Vérifier que le tenantId correspond
            if (operation.payload.tenantId && operation.payload.tenantId !== tenantId) {
              results.push({
                operation_id: operation.id,
                status: OperationSyncStatus.ERROR,
                error_message: 'tenantId mismatch',
              });
              continue;
            }

            // Appliquer l'opération selon le type
            let result: OfflineOperationResultDto;

            switch (operation.operation_type) {
              case OfflineOperationType.INSERT:
                result = await this.handleInsert(tx, tableName, operation, tenantId);
                break;
              case OfflineOperationType.UPDATE:
                result = await this.handleUpdate(tx, tableName, operation, tenantId);
                break;
              case OfflineOperationType.DELETE:
                result = await this.handleDelete(tx, tableName, operation, tenantId);
                break;
              default:
                result = {
                  operation_id: operation.id,
                  status: OperationSyncStatus.ERROR,
                  error_message: `Type d'opération invalide: ${operation.operation_type}`,
                };
            }

            results.push(result);

            // Journaliser l'opération (dans une table d'audit si nécessaire)
            // TODO: Implémenter journalisation serveur
          } catch (error: any) {
            this.logger.error(`[${syncId}] Erreur traitement opération ${operation.id}`, error);
            results.push({
              operation_id: operation.id,
              status: OperationSyncStatus.ERROR,
              error_message: error.message || 'Erreur inconnue',
            });
          }
        }
      },
      {
        timeout: 30000, // 30 secondes max par transaction
      },
    );

    return results;
  }

  /**
   * Gère une opération INSERT
   */
  private async handleInsert(
    tx: any,
    tableName: string,
    operation: OfflineOperationDto,
    tenantId: string,
  ): Promise<OfflineOperationResultDto> {
    // Vérifier si l'enregistrement existe déjà (conflit)
    const existing = await this.findExistingRecord(tx, tableName, operation.record_id, tenantId);

    if (existing) {
      // Conflit : enregistrement déjà existant
      const conflict = await this.conflictDetection.detectConflict(existing, operation.payload);

      if (conflict.hasConflict) {
        return {
          operation_id: operation.id,
          status: OperationSyncStatus.CONFLICT,
          server_record_id: existing.id,
          server_data: existing,
          conflict_reason: conflict.reason,
        };
      }

      // Pas de conflit réel : retourner SUCCESS avec données existantes
      return {
        operation_id: operation.id,
        status: OperationSyncStatus.SUCCESS,
        server_record_id: existing.id,
      };
    }

    // Créer l'enregistrement
    const payload = { ...operation.payload, tenantId };
    const created = await tx[this.getModelName(tableName)].create({
      data: this.sanitizePayload(payload, tableName),
    });

    return {
      operation_id: operation.id,
      status: OperationSyncStatus.SUCCESS,
      server_record_id: created.id,
    };
  }

  /**
   * Gère une opération UPDATE
   */
  private async handleUpdate(
    tx: any,
    tableName: string,
    operation: OfflineOperationDto,
    tenantId: string,
  ): Promise<OfflineOperationResultDto> {
    // Vérifier si l'enregistrement existe
    const existing = await this.findExistingRecord(tx, tableName, operation.record_id, tenantId);

    if (!existing) {
      // Enregistrement supprimé côté serveur : conflit
      return {
        operation_id: operation.id,
        status: OperationSyncStatus.CONFLICT,
        conflict_reason: 'Enregistrement supprimé côté serveur',
        error_message: 'Impossible de mettre à jour un enregistrement supprimé',
      };
    }

    // Détecter conflit (modification serveur depuis dernière sync)
    const conflict = await this.conflictDetection.detectConflict(existing, operation.payload);

    if (conflict.hasConflict) {
      // Conflit : PostgreSQL gagne
      return {
        operation_id: operation.id,
        status: OperationSyncStatus.CONFLICT,
        server_record_id: existing.id,
        server_data: existing,
        conflict_reason: conflict.reason,
      };
    }

    // Pas de conflit : appliquer la mise à jour
    const payload = { ...operation.payload, tenantId };
    const updated = await tx[this.getModelName(tableName)].update({
      where: { id: operation.record_id },
      data: this.sanitizePayload(payload, tableName, true), // true = isUpdate
    });

    return {
      operation_id: operation.id,
      status: OperationSyncStatus.SUCCESS,
      server_record_id: updated.id,
    };
  }

  /**
   * Gère une opération DELETE (soft delete)
   */
  private async handleDelete(
    tx: any,
    tableName: string,
    operation: OfflineOperationDto,
    tenantId: string,
  ): Promise<OfflineOperationResultDto> {
    // Vérifier si l'enregistrement existe
    const existing = await this.findExistingRecord(tx, tableName, operation.record_id, tenantId);

    if (!existing) {
      // Déjà supprimé : succès
      return {
        operation_id: operation.id,
        status: OperationSyncStatus.SUCCESS,
        server_record_id: operation.record_id,
      };
    }

    // Soft delete (pas de suppression physique)
    const updated = await tx[this.getModelName(tableName)].update({
      where: { id: operation.record_id },
      data: { status: 'DELETED' },
    });

    return {
      operation_id: operation.id,
      status: OperationSyncStatus.SUCCESS,
      server_record_id: updated.id,
    };
  }

  /**
   * Trouve un enregistrement existant
   */
  private async findExistingRecord(tx: any, tableName: string, recordId: string, tenantId: string): Promise<any> {
    const model = this.getModelName(tableName);
    return tx[model].findUnique({
      where: { id: recordId },
    });
  }

  /**
   * Convertit le nom de table en nom de modèle Prisma
   */
  private getModelName(tableName: string): string {
    // Mapping table → modèle Prisma (camelCase)
    const mapping: Record<string, string> = {
      students: 'student',
      payments: 'payment',
      student_fee_profiles: 'studentFeeProfile',
      collection_cases: 'collectionCase',
      student_documents: 'studentDocument',
    };

    return mapping[tableName] || tableName;
  }

  /**
   * Nettoie le payload (enlève colonnes techniques, etc.)
   */
  private sanitizePayload(payload: any, tableName: string, isUpdate = false): any {
    // Enlever colonnes techniques offline
    const sanitized = { ...payload };
    delete sanitized.local_id;
    delete sanitized.sync_status;
    delete sanitized.local_updated_at;
    delete sanitized.device_id;

    // Si UPDATE, enlever les champs qui ne doivent pas être mis à jour
    if (isUpdate) {
      delete sanitized.id; // ID ne change jamais
      delete sanitized.createdAt; // createdAt ne change jamais
    }

    return sanitized;
  }
}
