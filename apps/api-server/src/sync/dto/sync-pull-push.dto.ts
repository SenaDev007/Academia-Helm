import { IsString, IsArray, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/// DTO pour une requête de pull (téléchargement de données depuis Neon)
export class SyncPullDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tables?: string[];

  /// Timestamp de la dernière sync (format ISO 8601)
  /// Si null, télécharge toutes les données (sync initiale)
  /// ⭐ Accepte à la fois lastSyncAt (camelCase) et last_sync_at (snake_case)
  @IsOptional()
  @IsString()
  lastSyncAt?: string;

  @IsOptional()
  @IsString()
  last_sync_at?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsOptional()
  @IsString()
  device_id?: string;
}

/// DTO pour un enregistrement à pusher vers Neon
/// ⭐ Accepte à la fois camelCase et snake_case
export class SyncPushRecordDto {
  @IsString()
  tableName?: string;

  @IsOptional()
  @IsString()
  table_name?: string;

  @IsString()
  recordId?: string;

  @IsOptional()
  @IsString()
  record_id?: string;

  @IsOptional()
  @IsString()
  operation?: string;

  @IsOptional()
  @IsString()
  operation_type?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsString()
  clientTimestamp?: string;
}

/// DTO pour une requête de push (envoi des écritures locales vers Neon)
/// ⭐ Accepte à la fois records et operations (réto-compatibilité frontend)
export class SyncPushDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncPushRecordDto)
  records?: SyncPushRecordDto[];

  @IsOptional()
  @IsArray()
  operations?: any[];

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  sqliteSchemaHash?: string;

  /// ⭐ Version du schéma SQLite local (envoyée par le frontend sync-engine)
  ///    Acceptée pour rétro-compatibilité — sinon NestJS rejette avec 400
  ///    "property sqliteVersion should not exist".
  @IsOptional()
  @IsString()
  sqliteVersion?: string;

  @IsOptional()
  @IsString()
  device_id?: string;
}
