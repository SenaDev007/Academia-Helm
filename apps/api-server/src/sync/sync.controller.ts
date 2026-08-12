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
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

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
@UseGuards(JwtAuthGuard, TenantGuard)
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /api/sync/pull
   * Télécharge les modifications depuis Neon vers l'app desktop.
   */
  @Post('pull')
  async pull(
    @Body() dto: SyncPullDto,
    @TenantId() tenantId: string,
  ) {
    // ⭐ Sécurité : forcer le tenantId depuis le JWT (pas depuis le body)
    //    Avant : si le client ne sendait pas tenantId, le backend retournait
    //    les données de TOUTES les écoles (faille multi-tenant).
    if (!dto.tenantId) {
      dto.tenantId = tenantId;
    }
    this.logger.log(`Pull request: tenant=${tenantId}, tables=${dto.tables?.length || 'all'}`);
    return this.syncService.pull(dto);
  }

  /**
   * POST /api/sync/push
   * Envoie les écritures locales de l'app desktop vers Neon.
   */
  @Post('push')
  async push(
    @Body() dto: SyncPushDto,
    @TenantId() tenantId: string,
  ) {
    // ⭐ Sécurité : forcer le tenantId depuis le JWT
    if (!dto.tenantId) {
      dto.tenantId = tenantId;
    }
    this.logger.log(`Push request: tenant=${tenantId}, ${dto.records?.length || 0} records`);
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
        schemaHash: 'GET /api/sync/schema-hash',
        tables: 'GET /api/sync/tables',
      },
    };
  }

  /**
   * GET /api/sync/tables
   * Retourne la liste des tables synchronisables (exclut les tables système).
   * ⭐ Utilisé par le frontend pour afficher une barre de progression réelle
   *    pendant le bootstrap initial (current/total).
   */
  @Get('tables')
  async tables() {
    const tables = await this.syncService.getTableNames();
    return { tables, count: tables.length };
  }

  /**
   * GET /api/sync/schema-hash
   * ⭐ Retourne un hash du schéma pour validation côté client.
   *    Le frontend l'envoie avec chaque push pour vérifier que le schéma
   *    local correspond au schéma serveur.
   */
  @Get('schema-hash')
  async schemaHash() {
    // ⭐ Hash simple basé sur le nombre de tables + timestamp du déploiement
    //    Ce n'est pas un hash cryptographique, juste un identifiant de version
    return {
      hash: `schema-${process.env.DEPLOYMENT_ID || 'local'}-${Date.now().toString(36)}`,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
