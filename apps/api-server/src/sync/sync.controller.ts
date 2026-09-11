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
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
   *
   * ⭐ SÉCURITÉ MULTI-TENANT STRICTE : le tenantId est TOUJOURS extrait du JWT
   *    via le décorateur @TenantId(). La valeur du body `dto.tenantId` est
   *    IGNORÉE et ÉCRASÉE inconditionnellement. Un client malveillant ne peut
   *    PAS récupérer les données d'un autre tenant en spoofant le body.
   *
   *    Avant : `if (!dto.tenantId) dto.tenantId = tenantId;` → si le client
   *    envoyait `tenantId: '<uuid-autre-école>'`, le backend retournait les
   *    données de cette autre école (faille critique).
   */
  @Post('pull')
  async pull(
    @Body() dto: SyncPullDto,
    @TenantId() tenantId: string,
  ) {
    // ⭐ ÉCRASEMENT INCONDITIONNEL : le JWT prime sur le body
    dto.tenantId = tenantId;
    this.logger.log(`Pull request: tenant=${tenantId}, tables=${dto.tables?.length || 'all'}`);
    return this.syncService.pull(dto, tenantId);
  }

  /**
   * POST /api/sync/push
   * Envoie les écritures locales de l'app desktop vers Neon.
   *
   * ⭐ SÉCURITÉ MULTI-TENANT STRICTE : idem pull — le tenantId vient du JWT,
   *    pas du body. La valeur du body est ignorée et écrasée.
   *
   * ⭐ Idempotence : chaque enregistrement doit avoir un `localId` (ou `id`).
   *    Le service vérifie dans `_sync_outbox` si ce local_id a déjà été traité
   *    pour ce tenant. Si oui, il renvoie SUCCESS sans réappliquer.
   *    Voir create_sync_outbox_idempotency.sql pour le schéma.
   */
  @Post('push')
  async push(
    @Body() dto: SyncPushDto,
    @TenantId() tenantId: string,
  ) {
    // ⭐ ÉCRASEMENT INCONDITIONNEL : le JWT prime sur le body
    dto.tenantId = tenantId;
    this.logger.log(`Push request: tenant=${tenantId}, ${dto.records?.length || dto.operations?.length || 0} records`);
    return this.syncService.push(dto, tenantId);
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
   * GET /api/sync/bootstrap
   * ⭐ Contexte de démarrage pour le mode hors-ligne (offline-bootstrap.service.ts) :
   *    user (sans secrets) + rôles/permissions + tenant + année académique
   *    active + périodes + modules activés (tenant_features) + config offline.
   *
   *    Appelé une fois au post-login pour pré-remplir IndexedDB et permettre
   *    l'affichage hors ligne du contexte de session (bannière, sidebar, rôles).
   *    ⚠️ Sécurité : tenantId vient du JWT (@TenantId), jamais du query/body.
   */
  @Get('bootstrap')
  async bootstrap(
    @CurrentUser() user: any,
    @TenantId() tenantId: string,
  ) {
    this.logger.log(`Bootstrap request: tenant=${tenantId}, user=${user?.id ?? user?.sub ?? 'unknown'}`);
    return this.syncService.getBootstrapData(user, tenantId);
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
