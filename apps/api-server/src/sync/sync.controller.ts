/**
 * ============================================================================
 * SYNC CONTROLLER — Endpoint de synchronisation descendante
 * ============================================================================
 *
 * GET /api/sync/delta?since=ISO_DATE&tenantId=XXX
 *   → Retourne tous les changements Neon depuis la date donnée
 *
 * GET /api/sync/token
 *   → Retourne le syncToken courant (timestamp)
 *
 * ⚠️ READ-ONLY — aucun impact sur le CRUD existant.
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * GET /api/sync/delta?since=2026-07-28T10:00:00Z
   *
   * Retourne tous les changements depuis la date donnée.
   * Si `since` n'est pas fourni, récupère TOUT (première sync).
   *
   * Response :
   * {
   *   "syncToken": "2026-07-28T11:00:00.000Z",
   *   "tenantId": "xxx",
   *   "since": "2026-07-28T10:00:00.000Z",
   *   "entities": {
   *     "students": [...],
   *     "classes": [...],
   *     "financeTransactions": [...],
   *     ...
   *   },
   *   "stats": { "totalEntities": 42 }
   * }
   */
  @Get('delta')
  async getDelta(
    @TenantId() tenantId: string,
    @Query('since') since?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId est requis');
    }

    return this.syncService.getDelta(tenantId, since);
  }

  /**
   * GET /api/sync/token
   * Retourne le syncToken courant (timestamp ISO).
   */
  @Get('token')
  async getToken() {
    return {
      syncToken: await this.syncService.getCurrentSyncToken(),
    };
  }
}
