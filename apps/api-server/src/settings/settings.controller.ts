import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  StreamableFile,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { GeneralSettingsService } from './services/general-settings.service';
import { FeatureFlagsService } from './services/feature-flags.service';
import { SecuritySettingsService } from './services/security-settings.service';
import { OrionSettingsService } from './services/orion-settings.service';
import { AtlasSettingsService } from './services/atlas-settings.service';
import { OfflineSyncSettingsService } from './services/offline-sync-settings.service';
import { SettingsHistoryService } from './services/settings-history.service';
import { AdministrativeSealsService } from './services/administrative-seals.service';
import { ElectronicSignaturesService } from './services/electronic-signatures.service';
import { PedagogicalStructureService } from './services/pedagogical-structure.service';
import { BilingualSettingsService } from './services/bilingual-settings.service';
import { CommunicationSettingsService } from './services/communication-settings.service';
import { AcademicYearSettingsService } from './services/academic-year-settings.service';
import { AcademicPeriodSettingsService } from './services/academic-period-settings.service';
import { EducationStructureService } from './services/education-structure.service';
import { RolesPermissionsService } from './services/roles-permissions.service';
import { RolesPermissionsBootstrapService } from './services/roles-permissions-bootstrap.service';
import { BillingSettingsService } from './services/billing-settings.service';
import { IdentityProfileService } from './services/identity-profile.service';
import { StampsSignaturesService } from './services/stamps-signatures.service';
import { StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { existsSync } from 'fs';

/**
 * Controller principal pour le Module Paramètres
 * Tous les endpoints sont protégés par JWT
 */
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly generalSettingsService: GeneralSettingsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly securitySettingsService: SecuritySettingsService,
    private readonly orionSettingsService: OrionSettingsService,
    private readonly atlasSettingsService: AtlasSettingsService,
    private readonly offlineSyncSettingsService: OfflineSyncSettingsService,
    private readonly settingsHistoryService: SettingsHistoryService,
    private readonly administrativeSealsService: AdministrativeSealsService,
    private readonly electronicSignaturesService: ElectronicSignaturesService,
    private readonly pedagogicalStructureService: PedagogicalStructureService,
    private readonly bilingualSettingsService: BilingualSettingsService,
    private readonly communicationSettingsService: CommunicationSettingsService,
    private readonly academicYearSettingsService: AcademicYearSettingsService,
    private readonly academicPeriodSettingsService: AcademicPeriodSettingsService,
    private readonly educationStructureService: EducationStructureService,
    private readonly rolesPermissionsService: RolesPermissionsService,
    private readonly rolesPermissionsBootstrapService: RolesPermissionsBootstrapService,
    private readonly billingSettingsService: BillingSettingsService,
    private readonly identityProfileService: IdentityProfileService,
    private readonly stampsSignaturesService: StampsSignaturesService,
  ) {}

  // ============================================================================
  // PARAMÈTRES GÉNÉRAUX & IDENTITÉ
  // ============================================================================

  @Get('general')
  async getGeneralSettings(@TenantId() tenantId: string) {
    return this.generalSettingsService.getSchoolSettings(tenantId);
  }

  @Put('general')
  async updateGeneralSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      schoolName?: string;
      logoUrl?: string;
      sealUrl?: string;
      signatureUrl?: string;
      timezone?: string;
      defaultLanguage?: string;
      currency?: string;
      currencySymbol?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.generalSettingsService.updateSchoolSettings(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // IDENTITÉ ÉTABLISSEMENT — SOURCE LÉGALE DE VÉRITÉ VERSIONNÉE
  // ============================================================================

  @Get('identity')
  async getActiveIdentityProfile(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.identityProfileService.getActiveProfile(this.resolveTid(tenantId, user, req));
  }

  @Get('identity/history')
  async getIdentityHistory(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.identityProfileService.getVersionHistory(this.resolveTid(tenantId, user, req), {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('identity/version/:versionId')
  async getIdentityVersion(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('versionId') versionId: string,
  ) {
    return this.identityProfileService.getProfileById(this.resolveTid(tenantId, user, req), versionId);
  }

  @Get('identity/compare')
  async compareIdentityVersions(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('versionA') versionA: string,
    @Query('versionB') versionB: string,
  ) {
    return this.identityProfileService.compareVersions(
      this.resolveTid(tenantId, user, req),
      parseInt(versionA),
      parseInt(versionB),
    );
  }

  @Get('identity/preview')
  async getDocumentPreview(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.identityProfileService.generateDocumentPreview(this.resolveTid(tenantId, user, req));
  }

  @Get('identity/at-date')
  async getIdentityAtDate(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('date') dateStr: string,
  ) {
    const date = new Date(dateStr);
    return this.identityProfileService.getProfileAtDate(this.resolveTid(tenantId, user, req), date);
  }

  @Post('identity')
  async createIdentityVersion(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Body() data: {
      schoolName: string;
      schoolAcronym?: string;
      schoolType?: string;
      authorizationNumber?: string;
      foundationDate?: string;
      slogan?: string;
      address?: string;
      city?: string;
      department?: string;
      country?: string;
      postalCode?: string;
      phonePrimary?: string;
      phoneSecondary?: string;
      email?: string;
      website?: string;
      currency?: string;
      timezone?: string;
      logoUrl?: string;
      stampUrl?: string;
      directorSignatureUrl?: string;
      changeReason?: string;
    },
    @Request() req: any,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { changeReason, ...profileData } = data;

    return this.identityProfileService.createNewVersion(
      tid,
      profileData,
      user.id,
      changeReason,
      ipAddress,
      userAgent,
    );
  }

  @Put('identity/activate/:versionId')
  async activateIdentityVersion(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('versionId') versionId: string,
    @Body() data: { reason?: string },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.identityProfileService.activateVersion(
      tid,
      versionId,
      user.id,
      data.reason,
      ipAddress,
      userAgent,
    );
  }

  @Put('identity/visuals')
  async updateIdentityVisuals(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      logoUrl?: string;
      stampUrl?: string;
      directorSignatureUrl?: string;
    },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.identityProfileService.updateVisuals(
      tid,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // FEATURE FLAGS (Modules & fonctionnalités — gouvernance SaaS)
  // ============================================================================

  @Get('features')
  async getAllFeatures(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.featureFlagsService.getAllModulesWithState(this.resolveTid(tenantId, user, req));
  }

  @Get('features/billing-impact')
  async getBillingImpact(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.featureFlagsService.calculateBillingImpact(this.resolveTid(tenantId, user, req));
  }

  @Post('features/enable-all')
  async enableAllFeatures(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.featureFlagsService.enableAllFeatures(
      tid,
      user.id,
      body.reason,
      ipAddress,
      userAgent,
    );
  }

  @Post('features/disable-all')
  async disableAllFeatures(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.featureFlagsService.disableAllFeatures(
      tid,
      user.id,
      body.reason,
      ipAddress,
      userAgent,
    );
  }

  @Get('features/:featureCode')
  async getFeature(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('featureCode') featureCode: string,
  ) {
    return this.featureFlagsService.getFeature(this.resolveTid(tenantId, user, req), featureCode);
  }

  @Get('features/:featureCode/check')
  async checkFeature(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('featureCode') featureCode: string,
  ) {
    return this.featureFlagsService.isFeatureEnabled(this.resolveTid(tenantId, user, req), featureCode);
  }

  @Post('features/:featureCode/enable')
  async enableFeature(
    @TenantId() tenantId: string | undefined,
    @Param('featureCode') featureCode: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.featureFlagsService.enableFeature(
      tid,
      featureCode,
      user.id,
      body.reason,
      ipAddress,
      userAgent,
    );
  }

  @Post('features/:featureCode/disable')
  async disableFeature(
    @TenantId() tenantId: string | undefined,
    @Param('featureCode') featureCode: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.featureFlagsService.disableFeature(
      tid,
      featureCode,
      user.id,
      body.reason,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // PARAMÈTRES DE SÉCURITÉ
  // ============================================================================

  @Get('security')
  async getSecuritySettings(@TenantId() tenantId: string) {
    return this.securitySettingsService.getSecuritySettings(tenantId);
  }

  @Put('security')
  async updateSecuritySettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      passwordMinLength?: number;
      passwordRequireUppercase?: boolean;
      passwordRequireLowercase?: boolean;
      passwordRequireNumbers?: boolean;
      passwordRequireSpecial?: boolean;
      passwordExpirationDays?: number | null;
      sessionTimeoutMinutes?: number;
      maxLoginAttempts?: number;
      lockoutDurationMinutes?: number;
      twoFactorEnabled?: boolean;
      requireEmailVerification?: boolean;
      auditLogRetentionDays?: number;
      dataRetentionYears?: number;
      gdprCompliant?: boolean;
      allowInspectionAccess?: boolean;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.securitySettingsService.updateSecuritySettings(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // PARAMÈTRES ORION (IA)
  // ============================================================================

  @Get('orion')
  async getOrionSettings(@TenantId() tenantId: string) {
    return this.orionSettingsService.getOrionSettings(tenantId);
  }

  @Put('orion')
  async updateOrionSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      isEnabled?: boolean;
      alertThresholdCritical?: number;
      alertThresholdWarning?: number;
      kpiCalculationFrequency?: string;
      autoGenerateInsights?: boolean;
      insightsFrequency?: string;
      visibleKPICategories?: string[];
      allowOrionExports?: boolean;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.orionSettingsService.updateOrionSettings(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // PARAMÈTRES ATLAS (Chatbot IA)
  // ============================================================================

  @Get('atlas')
  async getAtlasSettings(@TenantId() tenantId: string) {
    return this.atlasSettingsService.getAtlasSettings(tenantId);
  }

  @Put('atlas')
  async updateAtlasSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      isEnabled?: boolean;
      scope?: string;
      allowedModules?: string[];
      allowHumanHandoff?: boolean;
      conversationHistoryDays?: number;
      maxConversationsPerDay?: number | null;
      language?: string;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.atlasSettingsService.updateAtlasSettings(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // PARAMÈTRES SYNCHRONISATION OFFLINE
  // ============================================================================

  @Get('offline-sync')
  async getOfflineSyncSettings(@TenantId() tenantId: string) {
    return this.offlineSyncSettingsService.getOfflineSyncSettings(tenantId);
  }

  @Put('offline-sync')
  async updateOfflineSyncSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      isEnabled?: boolean;
      syncFrequencyMinutes?: number;
      conflictResolution?: string;
      autoSyncOnConnect?: boolean;
      maxOfflineDays?: number;
      allowOfflineModification?: boolean;
      syncOnBackground?: boolean;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.offlineSyncSettingsService.updateOfflineSyncSettings(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // HISTORIQUE & AUDIT
  // ============================================================================

  @Get('history')
  async getHistory(
    @TenantId() tenantId: string,
    @Query('category') category?: string,
    @Query('key') key?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const options = {
      category,
      key,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.settingsHistoryService.getHistory(tenantId, options);
  }

  @Get('history/:key')
  async getHistoryByKey(
    @TenantId() tenantId: string,
    @Param('key') key: string,
  ) {
    return this.settingsHistoryService.getHistoryByKey(tenantId, key);
  }

  // ============================================================================
  // CACHETS ADMINISTRATIFS
  // ============================================================================

  @Get('administrative-seals')
  async getAllSeals(
    @TenantId() tenantId: string,
    @Query('schoolId') schoolId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.administrativeSealsService.getAllSeals(tenantId, {
      schoolId,
      academicYearId,
      type,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('administrative-seals/:id')
  async getSealById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.administrativeSealsService.getSealById(tenantId, id);
  }

  @Post('administrative-seals')
  async createSeal(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      schoolId: string;
      academicYearId: string;
      type: 'INSTITUTIONAL' | 'NOMINATIVE' | 'TRANSACTIONAL';
      label: string;
      role?: string;
      holderName?: string;
      holderTitle?: string;
      validFrom?: string;
      validTo?: string;
    },
  ) {
    return this.administrativeSealsService.createSeal(
      tenantId,
      {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validTo: data.validTo ? new Date(data.validTo) : undefined,
      },
      user.id,
    );
  }

  @Put('administrative-seals/:id')
  async updateSeal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: {
      label?: string;
      role?: string;
      holderName?: string;
      holderTitle?: string;
      isActive?: boolean;
      validFrom?: string;
      validTo?: string;
    },
  ) {
    return this.administrativeSealsService.updateSeal(
      tenantId,
      id,
      {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validTo: data.validTo ? new Date(data.validTo) : undefined,
      },
      user.id,
    );
  }

  @Post('administrative-seals/:id/versions')
  async createSealVersion(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: {
      format: 'SVG' | 'PNG' | 'PDF';
      primaryColor?: string;
      secondaryColor?: string;
      shape: 'ROUND' | 'OVAL' | 'RECTANGULAR';
      logoUrl?: string;
      signatureUrl?: string;
      textLayout?: any;
      fontFamily?: string;
      fontWeight?: string;
      fontSize?: any;
      borderStyle?: string;
      borderThickness?: number;
      innerSymbols?: any;
      rotation?: number;
      opacity?: number;
    },
  ) {
    return this.administrativeSealsService.createSealVersion(tenantId, id, data, user.id);
  }

  @Post('administrative-seals/usage')
  async recordSealUsage(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      sealVersionId: string;
      documentType: string;
      documentId: string;
      schoolId: string;
      academicYearId: string;
    },
  ) {
    return this.administrativeSealsService.recordSealUsage(tenantId, data, user.id);
  }

  @Get('administrative-seals/:id/usage')
  async getSealUsageHistory(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('documentType') documentType?: string,
  ) {
    return this.administrativeSealsService.getSealUsageHistory(tenantId, id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      documentType,
    });
  }

  @Post('administrative-seals/:id/deactivate')
  async deactivateSeal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.administrativeSealsService.deactivateSeal(tenantId, id, user.id);
  }

  @Post('administrative-seals/:id/activate')
  async activateSeal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.administrativeSealsService.activateSeal(tenantId, id, user.id);
  }

  @Post('administrative-seals/check-expiring')
  async checkExpiringSeals(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.administrativeSealsService.checkExpiringSeals(
      tenantId,
      days ? parseInt(days, 10) : 30,
    );
  }

  // ============================================================================
  // CACHETS & SIGNATURES GÉNÉRÉS (tenant_stamps / tenant_signatures)
  // ============================================================================

  @Get('stamps')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'read')
  async getStamps(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('education_level_id') educationLevelId: string | undefined,
    @Query('list') list: string | undefined,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (list === 'true') {
      return this.stampsSignaturesService.getStampsList(tid);
    }
    return this.stampsSignaturesService.getStamps(tid, educationLevelId ?? null);
  }

  @Post('stamps/generate')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async generateStamps(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() body: { formats?: ('circular' | 'rectangular' | 'oval')[]; educationLevelId?: string | null },
  ) {
    return this.stampsSignaturesService.generateStamps(
      this.resolveTid(tenantId, user, req),
      { formats: body?.formats, educationLevelId: body?.educationLevelId ?? null },
    );
  }

  @Get('stamps/asset')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'read')
  async getStampsAsset(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('type') type: 'circular' | 'rectangular' | 'oval' | 'signature',
    @Query('education_level_id') educationLevelId: string | undefined,
    @Query('signature_id') signatureId: string | undefined,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (!type || !['circular', 'rectangular', 'oval', 'signature'].includes(type)) {
      throw new BadRequestException('Paramètre type requis: circular, rectangular, oval ou signature');
    }
    const filePath =
      type === 'signature'
        ? this.stampsSignaturesService.getAssetPath(tid, 'signature', signatureId ?? '')
        : this.stampsSignaturesService.getAssetPath(tid, type, educationLevelId ?? null);
    if (!filePath || !existsSync(filePath)) {
      throw new NotFoundException('Fichier non trouvé');
    }
    const stream = createReadStream(filePath);
    return new StreamableFile(stream, { type: 'image/png' });
  }

  @Get('signatures')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'read')
  async getSignaturesList(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('education_level_id') educationLevelId: string | undefined,
  ) {
    return this.stampsSignaturesService.getSignaturesList(
      this.resolveTid(tenantId, user, req),
      educationLevelId ?? null,
    );
  }

  @Post('signature/generate')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async generateSignature(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body()
    body: {
      role: string;
      holderFirstName: string;
      holderLastName: string;
      educationLevelId?: string | null;
    },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (!body?.role?.trim()) {
      throw new BadRequestException('Le rôle (département) est requis.');
    }
    return this.stampsSignaturesService.generateSignature(
      tid,
      body.role.trim(),
      body.holderFirstName ?? '',
      body.holderLastName ?? '',
      body.educationLevelId ?? null,
    );
  }

  // ============================================================================
  // SIGNATURES ÉLECTRONIQUES
  // ============================================================================

  @Get('electronic-signatures')
  async getUserSignatures(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.electronicSignaturesService.getUserSignatures(tenantId, user.id);
  }

  @Get('electronic-signatures/:id')
  async getSignatureById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.electronicSignaturesService.getSignatureById(tenantId, id);
  }

  @Post('electronic-signatures')
  async createSignature(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      role: string;
      signatureType: 'visual' | 'certified' | 'combined';
      signatureImageUrl?: string;
      expiresAt?: string;
    },
  ) {
    return this.electronicSignaturesService.createSignature(tenantId, user.id, {
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });
  }

  @Post('electronic-signatures/sign-document')
  async signDocument(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      documentType: string;
      documentId: string;
      signatureId: string;
      documentContent: any;
    },
  ) {
    return this.electronicSignaturesService.signDocument(tenantId, data, user.id);
  }

  @Get('electronic-signatures/verify/:token')
  async verifyDocument(@Param('token') token: string) {
    return this.electronicSignaturesService.verifyDocument(token);
  }

  @Post('electronic-signatures/:id/revoke')
  async revokeSignature(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.electronicSignaturesService.revokeSignature(tenantId, id, user.id);
  }

  @Get('electronic-signatures/documents/history')
  async getSignedDocumentsHistory(
    @TenantId() tenantId: string,
    @Query('signatureId') signatureId?: string,
    @Query('documentType') documentType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.electronicSignaturesService.getSignedDocumentsHistory(tenantId, {
      signatureId,
      documentType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // ============================================================================
  // STRUCTURE PÉDAGOGIQUE
  // ============================================================================

  @Get('pedagogical-structure')
  async getPedagogicalStructure(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.pedagogicalStructureService.getStructure(this.resolveTid(tenantId, user, req));
  }

  @Put('pedagogical-structure')
  async updatePedagogicalStructure(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Body() data: {
      maternelleEnabled?: boolean;
      primaireEnabled?: boolean;
      secondaireEnabled?: boolean;
      cyclesConfiguration?: any;
      activeSeries?: string[];
      allowLevelModification?: boolean;
    },
    @Request() req: any,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.pedagogicalStructureService.updateStructure(
      tid,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get('pedagogical-structure/levels')
  async getLevels(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.pedagogicalStructureService.getLevels(this.resolveTid(tenantId, user, req));
  }

  @Get('pedagogical-structure/tracks')
  async getTracks(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.pedagogicalStructureService.getTracks(this.resolveTid(tenantId, user, req));
  }

  // ============================================================================
  // OPTION BILINGUE
  // ============================================================================

  @Get('bilingual')
  async getBilingualSettings(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.bilingualSettingsService.getSettings(this.resolveTid(tenantId, user, req));
  }

  @Put('bilingual')
  async updateBilingualSettings(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Body() data: {
      isEnabled?: boolean;
      separateSubjects?: boolean;
      separateGrades?: boolean;
      defaultLanguage?: string;
      defaultUILanguage?: string;
      billingImpactAcknowledged?: boolean;
      pricingSupplement?: number;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.bilingualSettingsService.updateSettings(
      this.resolveTid(tenantId, user, req),
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get('bilingual/check-migration')
  async checkBilingualMigration(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const needed = await this.bilingualSettingsService.checkMigrationNeeded(this.resolveTid(tenantId, user, req));
    return { migrationNeeded: needed };
  }

  @Post('bilingual/migrate')
  async startBilingualMigration(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.bilingualSettingsService.startMigration(this.resolveTid(tenantId, user, req), user.id);
  }

  @Get('bilingual/billing-impact')
  async getBilingualBillingImpact(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.bilingualSettingsService.getBillingImpact(this.resolveTid(tenantId, user, req));
  }

  // ============================================================================
  // COMMUNICATION
  // ============================================================================

  @Get('communication')
  async getCommunicationSettings(@TenantId() tenantId: string) {
    return this.communicationSettingsService.getSettings(tenantId);
  }

  @Put('communication')
  async updateCommunicationSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      smsProvider?: string;
      smsCredentials?: any;
      smsEnabled?: boolean;
      whatsappProvider?: string;
      whatsappCredentials?: any;
      whatsappEnabled?: boolean;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpFromEmail?: string;
      smtpFromName?: string;
      smtpSecure?: boolean;
      emailEnabled?: boolean;
      defaultSenderName?: string;
      defaultSenderPhone?: string;
      dailySmsLimit?: number;
      dailyEmailLimit?: number;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.communicationSettingsService.updateSettings(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Post('communication/test-sms')
  async testSms(
    @TenantId() tenantId: string,
    @Body() data: { phoneNumber: string },
  ) {
    return this.communicationSettingsService.testSms(tenantId, data.phoneNumber);
  }

  @Post('communication/test-email')
  async testEmail(
    @TenantId() tenantId: string,
    @Body() data: { emailAddress: string },
  ) {
    return this.communicationSettingsService.testEmail(tenantId, data.emailAddress);
  }

  @Post('communication/test-whatsapp')
  async testWhatsapp(
    @TenantId() tenantId: string,
    @Body() data: { phoneNumber: string },
  ) {
    return this.communicationSettingsService.testWhatsapp(tenantId, data.phoneNumber);
  }

  @Get('communication/templates')
  async getMessageTemplates(
    @TenantId() tenantId: string,
    @Query('type') type?: string,
  ) {
    return this.communicationSettingsService.getTemplates(tenantId, type);
  }

  @Post('communication/templates')
  async upsertMessageTemplate(
    @TenantId() tenantId: string,
    @Body() data: {
      id?: string;
      name: string;
      type: string;
      channelId?: string;
      subject?: string;
      content: string;
      contentFr?: string;
      contentEn?: string;
      variables?: any;
      isActive?: boolean;
    },
  ) {
    return this.communicationSettingsService.upsertTemplate(tenantId, data);
  }

  // ============================================================================
  // ANNÉES SCOLAIRES
  // ============================================================================

  @Get('academic-years')
  async getAcademicYears(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') {
      throw new BadRequestException(
        'Contexte tenant manquant. Connectez-vous avec un établissement sélectionné ou envoyez l’en-tête x-tenant-id.',
      );
    }
    return this.academicYearSettingsService.getAll(tid);
  }

  @Get('academic-years/active')
  async getActiveAcademicYear(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') {
      throw new BadRequestException(
        'Contexte tenant manquant. Connectez-vous avec un établissement sélectionné ou envoyez l’en-tête x-tenant-id.',
      );
    }
    return this.academicYearSettingsService.getActive(tid);
  }

  @Get('academic-years/:id')
  async getAcademicYearById(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicYearSettingsService.getById(tid, id);
  }

  @Post('academic-years')
  async createAcademicYear(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      name: string;
      label: string;
      preEntryDate?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicYearSettingsService.create(
      tid,
      {
        name: data.name,
        label: data.label,
        preEntryDate: data.preEntryDate ? new Date(data.preEntryDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      user.id,
    );
  }

  @Post('academic-years/generate-next')
  async generateNextAcademicYear(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicYearSettingsService.generateNext(tid, user.id);
  }

  @Put('academic-years/:id')
  async updateAcademicYear(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      name?: string;
      label?: string;
      preEntryDate?: string;
      officialStartDate?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    this.logger.log(`PUT academic-years/${id} body keys: ${JSON.stringify(Object.keys(data || {}))} dates: preEntry=${data?.preEntryDate} official=${data?.officialStartDate} start=${data?.startDate} end=${data?.endDate}`);
    const body = {
      name: data?.name,
      label: data?.label,
      preEntryDate: data?.preEntryDate != null && String(data.preEntryDate).trim() !== '' ? new Date(data.preEntryDate) : undefined,
      officialStartDate: data?.officialStartDate != null && String(data.officialStartDate).trim() !== '' ? new Date(data.officialStartDate) : undefined,
      startDate: data?.startDate != null && String(data.startDate).trim() !== '' ? new Date(data.startDate) : undefined,
      endDate: data?.endDate != null && String(data.endDate).trim() !== '' ? new Date(data.endDate) : undefined,
    };
    return this.academicYearSettingsService.update(tid, id, body, user.id);
  }

  @Post('academic-years/:id/activate')
  async activateAcademicYear(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicYearSettingsService.activate(tid, id, user.id);
  }

  @Post('academic-years/:id/lock')
  async lockAcademicYear(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.academicYearSettingsService.lock(tenantId, id, user.id);
  }

  @Post('academic-years/:id/duplicate')
  async duplicateAcademicYear(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: {
      name: string;
      label: string;
      startDate?: string;
      endDate?: string;
      preEntryDate?: string;
      duplicateClasses?: boolean;
      duplicateFees?: boolean;
      duplicateSubjects?: boolean;
    },
  ) {
    return this.academicYearSettingsService.duplicate(
      tenantId,
      id,
      {
        name: data.name,
        label: data.label,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        preEntryDate: data.preEntryDate ? new Date(data.preEntryDate) : undefined,
        duplicateClasses: data.duplicateClasses,
        duplicateFees: data.duplicateFees,
        duplicateSubjects: data.duplicateSubjects,
      },
      user.id,
    );
  }

  @Delete('academic-years/:id')
  async deleteAcademicYear(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.academicYearSettingsService.delete(tenantId, id, user.id);
  }

  @Post('academic-years/:id/close')
  async closeAcademicYear(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicYearSettingsService.close(tid, id, user.id);
  }

  @Get('academic-years/:id/stats')
  async getAcademicYearStats(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.academicYearSettingsService.getYearStats(tenantId, id);
  }

  // ============================================================================
  // PÉRIODES ACADÉMIQUES (trimestres / semestres / séquences)
  // ============================================================================

  @Get('academic-years/:id/periods/current')
  async getCurrentAcademicPeriod(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicPeriodSettingsService.getCurrentPeriod(tid, id);
  }

  @Get('academic-years/:id/periods')
  async getAcademicYearPeriods(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicPeriodSettingsService.getByYear(tid, id);
  }

  @Post('academic-years/:id/periods/create-default')
  async createDefaultPeriodsForYear(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicPeriodSettingsService.ensureDefaultTrimestersForYear(tid, id, user.id);
  }

  @Post('academic-years/:id/periods')
  async createAcademicPeriod(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      name: string;
      type: string;
      periodOrder: number;
      startDate: string;
      endDate: string;
    },
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicPeriodSettingsService.create(
      tid,
      id,
      {
        name: data.name,
        type: data.type as 'TRIMESTER' | 'SEMESTER' | 'SEQUENCE' | 'CUSTOM',
        periodOrder: data.periodOrder,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
      user.id,
    );
  }

  @Put('periods/:id')
  async updateAcademicPeriod(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      name?: string;
      type?: string;
      periodOrder?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicPeriodSettingsService.update(
      tid,
      id,
      {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type as 'TRIMESTER' | 'SEMESTER' | 'SEQUENCE' | 'CUSTOM' }),
        ...(data.periodOrder !== undefined && { periodOrder: data.periodOrder }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
      },
      user.id,
    );
  }

  @Post('periods/:id/activate')
  async activateAcademicPeriod(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicPeriodSettingsService.activate(tid, id, user.id);
  }

  @Post('periods/:id/close')
  async closeAcademicPeriod(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const fromQuery = req?.query?.tenant_id;
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicPeriodSettingsService.close(tid, id, user.id);
  }

  // ============================================================================
  // STRUCTURE PÉDAGOGIQUE HIÉRARCHIQUE (niveaux → cycles → grades → classes physiques)
  // ============================================================================

  /**
   * Résout le tenant du contexte. Isolation stricte :
   * - Utilisateur normal : uniquement son tenant (user.tenantId).
   * - PLATFORM_OWNER / SUPER_ADMIN : peut passer tenant_id (query/header) pour vision cross-tenant.
   */
  private resolveTid(tenantId: string | undefined, user: any, req: any): string {
    const tid = this.resolveTidOptional(tenantId, user, req);
    if (tid == null) throw new BadRequestException('Contexte tenant manquant.');
    return tid;
  }

  /** True si l'utilisateur est PLATFORM_OWNER, PLATFORM_ADMIN ou isSuperAdmin (rôles plateforme visibles uniquement par eux). */
  private isPlatformUser(user: any): boolean {
    const roleStr = (user?.role as string)?.toUpperCase?.();
    return roleStr === 'PLATFORM_OWNER' || roleStr === 'PLATFORM_ADMIN' || user?.isSuperAdmin === true;
  }

  /** Comme resolveTid mais retourne null si PO sans tenant (pour getRoles = rôles système uniquement). */
  private resolveTidOptional(tenantId: string | undefined, user: any, req: any): string | null {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const roleStr = (user?.role as string)?.toUpperCase();
    const canCrossTenant = roleStr === 'PLATFORM_OWNER' || roleStr === 'SUPER_ADMIN' || user?.isSuperAdmin === true;
    if (canCrossTenant) {
      const fromHeader = req?.headers?.['x-tenant-id'];
      const fromQuery = req?.query?.tenant_id;
      const override = tenantId ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
      if (override && typeof override === 'string') return override;
      return null;
    }
    if (!fromUser || typeof fromUser !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return fromUser;
  }

  @Get('education/structure')
  async getEducationStructure(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.educationStructureService.getStructure(this.resolveTid(tenantId, user, req));
  }

  @Post('education/structure/initialize')
  async initializeEducationStructure(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.educationStructureService.initializeDefaultStructure(this.resolveTid(tenantId, user, req));
  }

  @Get('education/classrooms')
  async getEducationClassrooms(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('academic_year_id') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academic_year_id requis.');
    return this.educationStructureService.getClassrooms(this.resolveTid(tenantId, user, req), academicYearId);
  }

  @Post('education/classrooms')
  async createEducationClassroom(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: { academicYearId: string; gradeId: string; name: string; code?: string; capacity?: number },
  ) {
    if (!data.academicYearId || !data.gradeId) throw new BadRequestException('academicYearId et gradeId requis.');
    const tid = this.resolveTid(tenantId, user, req);
    return this.educationStructureService.createClassroom(tid, data.academicYearId, {
      gradeId: data.gradeId,
      name: data.name,
      code: data.code,
      capacity: data.capacity,
    });
  }

  @Put('education/classrooms/:id')
  async updateEducationClassroom(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { name?: string; code?: string; capacity?: number; isActive?: boolean; gradeId?: string },
  ) {
    return this.educationStructureService.updateClassroom(this.resolveTid(tenantId, user, req), id, data);
  }

  @Post('education/classrooms/:id/archive')
  async archiveEducationClassroom(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.educationStructureService.archiveClassroom(this.resolveTid(tenantId, user, req), id);
  }

  @Post('education/classrooms/duplicate')
  async duplicateEducationClassrooms(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: { oldAcademicYearId: string; newAcademicYearId: string },
  ) {
    if (!data.oldAcademicYearId || !data.newAcademicYearId)
      throw new BadRequestException('oldAcademicYearId et newAcademicYearId requis.');
    return this.educationStructureService.duplicateStructureToNewYear(
      this.resolveTid(tenantId, user, req),
      data.oldAcademicYearId,
      data.newAcademicYearId,
    );
  }

  @Put('education/levels/:id/enabled')
  async setEducationLevelEnabled(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { isEnabled: boolean },
  ) {
    return this.educationStructureService.setLevelEnabled(this.resolveTid(tenantId, user, req), id, data.isEnabled);
  }

  // ============================================================================
  // RÔLES & PERMISSIONS (RBAC multi-tenant — isolation stricte + audit)
  // Ordre guards : JWT → tenant → rôle → permission → feature flag (PermissionGuard)
  // ============================================================================

  /** Lecture rôles : tout utilisateur authentifié (pour afficher l’onglet RBAC avant attribution de rôles). */
  @Post('rbac/ensure-initialized')
  async ensureRbacInitialized() {
    await this.rolesPermissionsBootstrapService.ensurePermissionsAndRoles();
    return { ok: true, message: 'RBAC initialisé' };
  }

  @Get('roles')
  async getRoles(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const tid = this.resolveTidOptional(tenantId, user, req);
    const roles = await this.rolesPermissionsService.getRoles(tid);
    if (!this.isPlatformUser(user) && Array.isArray(roles)) {
      return roles.filter((r: { name: string }) => r.name !== 'PLATFORM_OWNER' && r.name !== 'PLATFORM_ADMIN');
    }
    return roles;
  }

  @Get('roles/:id')
  async getRoleById(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const role = await this.rolesPermissionsService.getRoleById(this.resolveTidOptional(tenantId, user, req), id);
    if (!this.isPlatformUser(user) && role && (role.name === 'PLATFORM_OWNER' || role.name === 'PLATFORM_ADMIN')) {
      throw new NotFoundException('Rôle non trouvé.');
    }
    return role;
  }

  @Post('roles')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async createRole(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      name: string;
      description?: string;
      canAccessOrion?: boolean;
      canAccessAtlas?: boolean;
      allowedLevelIds?: string[];
      permissionIds?: string[];
    },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    return this.rolesPermissionsService.createRole(tid, data, user.id);
  }

  @Put('roles/:id')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async updateRole(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: {
      name?: string;
      description?: string;
      canAccessOrion?: boolean;
      canAccessAtlas?: boolean;
      allowedLevelIds?: string[];
    },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const role = await this.rolesPermissionsService.getRoleById(this.resolveTidOptional(tenantId, user, req), id);
    if (!this.isPlatformUser(user) && role && (role.name === 'PLATFORM_OWNER' || role.name === 'PLATFORM_ADMIN')) {
      throw new ForbiddenException('Seuls les rôles plateforme peuvent modifier ce rôle.');
    }
    return this.rolesPermissionsService.updateRole(tid, id, data, user.id);
  }

  @Delete('roles/:id')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async deleteRole(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    return this.rolesPermissionsService.deleteRole(tid, id, user.id);
  }

  /** Lecture permissions : tout utilisateur authentifié (matrice RBAC). */
  @Get('permissions')
  async getPermissions() {
    return this.rolesPermissionsService.getPermissions();
  }

  @Get('permissions/grouped')
  async getPermissionsGrouped() {
    return this.rolesPermissionsService.getPermissionsGrouped();
  }

  @Put('roles/:id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async updateRolePermissions(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { permissionIds: string[] },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const role = await this.rolesPermissionsService.getRoleById(this.resolveTidOptional(tenantId, user, req), id);
    if (!this.isPlatformUser(user) && role && (role.name === 'PLATFORM_OWNER' || role.name === 'PLATFORM_ADMIN')) {
      throw new ForbiddenException('Seuls les rôles plateforme peuvent modifier les permissions de ce rôle.');
    }
    return this.rolesPermissionsService.updateRolePermissions(
      tid,
      id,
      data.permissionIds,
      user.id,
    );
  }

  /** Liste des utilisateurs du tenant avec leurs rôles (tout utilisateur authentifié pour l’onglet RBAC). */
  @Get('users')
  async getUsersWithRoles(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.rolesPermissionsService.getUsersWithRoles(this.resolveTid(tenantId, user, req));
  }

  /** Assigne un rôle à un utilisateur (audit + isolation tenant) */
  @Post('users/:userId/assign-role')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async assignRoleToUser(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() body: { roleId: string },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (!body?.roleId) throw new BadRequestException('roleId requis');
    const role = await this.rolesPermissionsService.getRoleById(this.resolveTidOptional(tenantId, user, req), body.roleId);
    if (!this.isPlatformUser(user) && role && (role.name === 'PLATFORM_OWNER' || role.name === 'PLATFORM_ADMIN')) {
      throw new ForbiddenException('Seuls les rôles plateforme peuvent attribuer PLATFORM_OWNER ou PLATFORM_ADMIN.');
    }
    return this.rolesPermissionsService.assignRoleToUser(tid, userId, body.roleId, user.id);
  }

  /** Révoque un rôle d'un utilisateur (audit) */
  @Post('users/:userId/revoke-role')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async revokeRoleFromUser(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() body: { roleId: string },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (!body?.roleId) throw new BadRequestException('roleId requis');
    const role = await this.rolesPermissionsService.getRoleById(this.resolveTidOptional(tenantId, user, req), body.roleId);
    if (!this.isPlatformUser(user) && role && (role.name === 'PLATFORM_OWNER' || role.name === 'PLATFORM_ADMIN')) {
      throw new ForbiddenException('Seuls les rôles plateforme peuvent révoquer PLATFORM_OWNER ou PLATFORM_ADMIN.');
    }
    return this.rolesPermissionsService.revokeRoleFromUser(tid, userId, body.roleId, user.id);
  }

  // ============================================================================
  // FACTURATION & ABONNEMENT SaaS
  // ============================================================================

  @Get('billing')
  async getBillingSettings(@TenantId() tenantId: string) {
    return this.billingSettingsService.getSubscription(tenantId);
  }

  @Get('billing/summary')
  async getBillingSummary(@TenantId() tenantId: string) {
    return this.billingSettingsService.getBillingSummary(tenantId);
  }

  @Get('billing/plans')
  async getAvailablePlans() {
    return this.billingSettingsService.getAvailablePlans();
  }

  @Put('billing')
  async updateBillingSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      billingCycle?: string;
      autoRenew?: boolean;
      bilingualEnabled?: boolean;
    },
  ) {
    return this.billingSettingsService.updateSubscription(
      tenantId,
      data,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('billing/change-plan')
  async changePlan(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: { planCode: string },
  ) {
    return this.billingSettingsService.changePlan(
      tenantId,
      data.planCode,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('billing/history')
  async getBillingHistory(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.billingSettingsService.getBillingHistory(tenantId, {
      limit: limit ? parseInt(String(limit)) : undefined,
      offset: offset ? parseInt(String(offset)) : undefined,
    });
  }

  @Get('billing/invoices')
  async getInvoices(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.billingSettingsService.getInvoices(tenantId, {
      status,
      limit: limit ? parseInt(String(limit)) : undefined,
    });
  }

  @Get('billing/features-impact')
  async getFeaturesBillingImpact(@TenantId() tenantId: string) {
    return this.billingSettingsService.calculateFeaturesBillingImpact(tenantId);
  }

  @Post('billing/cancel')
  async cancelSubscription(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: { reason: string },
  ) {
    return this.billingSettingsService.cancelSubscription(
      tenantId,
      data.reason,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('billing/reactivate')
  async reactivateSubscription(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.billingSettingsService.reactivateSubscription(
      tenantId,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}

