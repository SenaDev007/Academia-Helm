import {
  Controller,
  Post,
  Body,
  Get,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SyncService, SyncRequest, SyncResponse } from './sync.service';
import { SchemaValidatorService, SchemaValidationResult } from './schema-validator.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { DeviceTrackingService } from '../auth/services/device-tracking.service';
import {
  OfflineSyncRequestDto,
  OfflineSyncResponseDto,
} from './dto/offline-sync.dto';
import { SyncPullRequestDto, SyncPullResponseDto } from './dto/sync-pull.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(
    private syncService: SyncService,
    private schemaValidator: SchemaValidatorService,
    private offlineSyncService: OfflineSyncService,
    private deviceTrackingService: DeviceTrackingService,
  ) {}

  /**
   * Synchronisation offline → PostgreSQL (NOUVEAU)
   * 
   * Endpoint principal pour synchroniser les opérations offline
   * 
   * FLUX :
   * 1. Détection connexion disponible (middleware)
   * 2. Vérification version schéma
   * 3. Envoi opérations par ordre chronologique
   * 4. Validation serveur (tenantId & permissions)
   * 5. Appliquer règles métier serveur
   * 6. Retourner résultat par opération
   */
  /** Alias spec ERP : POST /sync/push = POST /sync/offline */
  @Post('push')
  async syncPush(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() request: OfflineSyncRequestDto,
    @Req() req: Request,
  ): Promise<OfflineSyncResponseDto> {
    return this.syncOffline(tenantId, user, request, req);
  }

  @Post('offline')
  async syncOffline(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() request: OfflineSyncRequestDto,
    @Req() req: Request,
  ): Promise<OfflineSyncResponseDto> {
    if (request.tenantId !== tenantId) {
      throw new BadRequestException('tenantId mismatch between request and authentication');
    }
    const ip = (req as any).ip ?? req.socket?.remoteAddress ?? undefined;
    return this.offlineSyncService.syncOfflineOperations(
      request,
      user.id,
      ip,
      user?.tenantId ?? null,
    );
  }

  /**
   * Synchronisation descendante (PostgreSQL → client)
   * Retourne les enregistrements modifiés après last_sync_at.
   */
  @Post('pull')
  async syncPull(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: SyncPullRequestDto,
    @Req() req: Request,
  ): Promise<SyncPullResponseDto> {
    if (body.tenant_id !== tenantId) {
      throw new BadRequestException('tenant_id mismatch');
    }
    const ip = (req as any).ip ?? req.socket?.remoteAddress ?? undefined;
    return this.offlineSyncService.pull(body, user.id, ip, user?.tenantId ?? null);
  }

  /**
   * Liste des appareils du tenant (spec : PLATFORM_OWNER, PLATFORM_ADMIN, Promoteur, + DIRECTOR / ADMIN)
   */
  @Get('devices')
  @UseGuards(RolesGuard)
  @Roles('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'PROMOTEUR', 'PROMOTER', 'DIRECTOR', 'ADMIN')
  async getDevices(@TenantId() tenantId: string) {
    const devices = await this.deviceTrackingService.getTenantDevices(tenantId);
    return { success: true, devices };
  }

  /**
   * Synchronisation montante (SQLite → PostgreSQL) [LEGACY]
   * @deprecated Utiliser POST /sync/offline à la place
   */
  @Post('up')
  async syncUp(@Body() request: SyncRequest): Promise<SyncResponse> {
    return this.syncService.syncUp(request);
  }

  /**
   * Synchronisation descendante (PostgreSQL → SQLite) [LEGACY]
   */
  @Post('down')
  async syncDown(@Body() request: SyncRequest): Promise<SyncResponse> {
    return this.syncService.syncDown(request);
  }

  /**
   * Validation de conformité (sans sync)
   */
  @Post('validate')
  async validate(
    @Body() body: { sqliteSchemaHash: string; sqliteVersion: string },
  ): Promise<SchemaValidationResult> {
    return this.schemaValidator.validateSQLiteConformity(
      body.sqliteSchemaHash,
      body.sqliteVersion,
    );
  }

  /**
   * Récupère le hash du schéma Prisma actuel
   * Public : nécessaire avant push/pull quand le JWT n’est pas encore propagé au client sync.
   */
  @Public()
  @Get('schema-hash')
  async getSchemaHash(): Promise<{ hash: string }> {
    return {
      hash: this.schemaValidator.getPrismaSchemaHash(),
    };
  }
}

