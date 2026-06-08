import { IsString, IsNotEmpty, IsArray, ValidateNested, IsEnum, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Type d'opération offline
 */
export enum OfflineOperationType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Opération offline à synchroniser
 */
export class OfflineOperationDto {
  @IsString()
  @IsNotEmpty()
  id: string; // UUID de l'opération

  @IsString()
  @IsNotEmpty()
  table_name: string; // Nom de la table (ex: 'students')

  @IsString()
  @IsNotEmpty()
  record_id: string; // ID de l'enregistrement

  @IsEnum(OfflineOperationType)
  operation_type: OfflineOperationType; // INSERT | UPDATE | DELETE

  @IsObject()
  payload: any; // JSON payload (état complet de l'entité)

  @IsString()
  @IsOptional()
  local_updated_at?: string; // Date modification locale (ISO 8601)

  @IsString()
  @IsOptional()
  device_id?: string; // Identifiant dispositif
}

/**
 * Requête de synchronisation offline
 */
export class OfflineSyncRequestDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string; // Tenant ID (vérifié par @TenantId decorator aussi)

  @IsString()
  @IsNotEmpty()
  sqliteSchemaHash: string; // Hash du schéma SQLite pour validation

  @IsString()
  @IsNotEmpty()
  sqliteVersion: string; // Version du schéma SQLite

  @IsString()
  @IsOptional()
  lastSyncTimestamp?: string; // Timestamp dernière sync (ISO 8601)

  /** Identifiant appareil (UserDevice.id ou deviceHash) pour mise à jour lastSyncAt et audit */
  @IsString()
  @IsOptional()
  device_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineOperationDto)
  operations: OfflineOperationDto[]; // Opérations à synchroniser (triées chronologiquement)
}

/**
 * Statut de traitement d'une opération
 */
export enum OperationSyncStatus {
  SUCCESS = 'SUCCESS',
  CONFLICT = 'CONFLICT',
  ERROR = 'ERROR',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

/**
 * Résultat de traitement d'une opération
 */
export class OfflineOperationResultDto {
  @IsString()
  @IsNotEmpty()
  operation_id: string; // ID de l'opération

  @IsEnum(OperationSyncStatus)
  status: OperationSyncStatus; // SUCCESS | CONFLICT | ERROR | VALIDATION_FAILED

  @IsString()
  @IsOptional()
  server_record_id?: string; // ID final sur serveur (si SUCCESS)

  @IsObject()
  @IsOptional()
  server_data?: any; // Données serveur (en cas de CONFLICT, contient la version serveur)

  @IsString()
  @IsOptional()
  error_message?: string; // Message d'erreur (si ERROR ou VALIDATION_FAILED)

  @IsString()
  @IsOptional()
  conflict_reason?: string; // Raison du conflit (si CONFLICT)
}

/**
 * Réponse de synchronisation offline (spec ERP : status, synced_ids, conflicts)
 */
export class OfflineSyncResponseDto {
  @IsString()
  @IsNotEmpty()
  sync_id: string; // UUID de la session de sync

  @IsString()
  @IsNotEmpty()
  tenantId: string;

  success: boolean; // True si aucune erreur fatale
  /** 'success' | 'partial' | 'error' pour compatibilité spec */
  status?: 'success' | 'partial' | 'error';
  /** IDs des enregistrements synchronisés (spec) */
  synced_ids?: string[];
  /** Conflits détectés (spec) */
  conflicts?: Array<{ operation_id: string; reason?: string; server_data?: any }>;

  total_operations: number; // Nombre total d'opérations traitées
  successful_operations: number; // Nombre d'opérations réussies
  conflicted_operations: number; // Nombre d'opérations en conflit
  failed_operations: number; // Nombre d'opérations échouées

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineOperationResultDto)
  results: OfflineOperationResultDto[]; // Résultat détaillé par opération

  @IsString()
  @IsOptional()
  schema_validation_status?: string; // OK | INCOMPATIBLE | WARNING

  @IsString()
  @IsOptional()
  completed_at?: string; // Date fin sync (ISO 8601)
}
