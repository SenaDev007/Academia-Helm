import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncPullDto, SyncPushDto } from './dto/sync-pull-push.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * ============================================================================
 * SYNC CONTROLLER — Endpoints pour la sync desktop ↔ Neon
 * ============================================================================
 *
 * POST /api/sync/pull
 *   L'app desktop demande les modifications depuis Neon.
 *   Body: { tables?: string[], lastSyncAt?: string, limit?: number, tenantId?: string }
 *   Response: { success, pulledAt, lastSyncAt, totalRecords, tables: { [tableName]: records[] } }
 *
 * POST /api/sync/push
 *   L'app desktop envoie ses écritures locales (outbox) vers Neon.
 *   Body: { records: [{ tableName, recordId, operation, data, clientTimestamp }] }
 *   Response: { success, pushedAt, total, success, conflicts, errors, results: [...] }
 *
 * GET /api/sync/status
 *   Retourne le statut de sync (dernière sync, nombre de tables, etc.)
 *
 * GET /api/sync/tables
 *   Retourne la liste des tables synchronisables
 * ============================================================================
 */

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /api/sync/pull
   * Télécharge les modifications depuis Neon vers l'app desktop.
   */
  @Post('pull')
  async pull(@Body() dto: SyncPullDto) {
    this.logger.log(`Pull request received`);
    return this.syncService.pull(dto);
  }

  /**
   * POST /api/sync/push
   * Envoie les écritures locales de l'app desktop vers Neon.
   */
  @Post('push')
  async push(@Body() dto: SyncPushDto) {
    this.logger.log(`Push request received: ${dto.records?.length || 0} records`);
    return this.syncService.push(dto);
  }

  /**
   * GET /api/sync/status
   * Retourne le statut de sync (pour affichage dans l'UI desktop).
   */
  @Get('status')
  async status() {
    return {
      service: 'sync',
      version: '1.0.0',
      serverTime: new Date().toISOString(),
      endpoints: {
        pull: 'POST /api/sync/pull',
        push: 'POST /api/sync/push',
        status: 'GET /api/sync/status',
      },
    };
  }
}
