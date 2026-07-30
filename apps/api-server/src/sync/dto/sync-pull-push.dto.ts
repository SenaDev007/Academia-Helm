import { IsString, IsArray, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/// DTO pour une requête de pull (téléchargement de données depuis Neon)
export class SyncPullDto {
  /// Liste des tables à synchroniser (vide = toutes les tables)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tables?: string[];

  /// Timestamp de la dernière sync (format ISO 8601)
  /// Si null, télécharge toutes les données (sync initiale)
  @IsOptional()
  @IsString()
  lastSyncAt?: string;

  /// Nombre maximum d'enregistrements par table (défaut: 500)
  @IsOptional()
  limit?: number;

  /// ID du tenant (école) — filtre les données par école
  @IsOptional()
  @IsString()
  tenantId?: string;
}

/// DTO pour un enregistrement à pusher vers Neon
export class SyncPushRecordDto {
  @IsString()
  tableName: string;

  @IsString()
  recordId: string;

  @IsString()
  operation: 'INSERT' | 'UPDATE' | 'DELETE';

  @IsObject()
  data: Record<string, any>;

  @IsString()
  clientTimestamp: string;
}

/// DTO pour une requête de push (envoi des écritures locales vers Neon)
export class SyncPushDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncPushRecordDto)
  records: SyncPushRecordDto[];
}
