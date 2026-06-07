import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

/**
 * Requête de synchronisation descendante (PostgreSQL → client)
 * Retourne les enregistrements modifiés après last_sync_at pour le tenant.
 */
export class SyncPullRequestDto {
  @IsString()
  @IsNotEmpty()
  tenant_id: string;

  @IsDateString()
  @IsNotEmpty()
  last_sync_at: string; // ISO 8601

  @IsString()
  @IsOptional()
  device_id?: string; // Pour mise à jour lastSyncAt côté appareil
}

/**
 * Réponse pull : entités modifiées par table
 */
export class SyncPullResponseDto {
  tenant_id: string;
  last_sync_at: string; // Echo
  pulled_at: string;   // ISO 8601
  entities: {
    students?: any[];
    studentEnrollments?: any[];
    payments?: any[];
    // Étendre selon tables synchronisables
  };
}
