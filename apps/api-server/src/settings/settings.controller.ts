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
import { BilingualStructureService } from '../bilingual-structure/bilingual-structure.service';
import { CommunicationSettingsService } from './services/communication-settings.service';
import { AcademicYearSettingsService } from './services/academic-year-settings.service';
import { AcademicPeriodSettingsService } from './services/academic-period-settings.service';
import { SchoolCalendarConfigService } from './services/school-calendar-config.service';
import { EducationStructureService } from './services/education-structure.service';
import { RolesPermissionsService } from './services/roles-permissions.service';
import { RolesPermissionsBootstrapService } from './services/roles-permissions-bootstrap.service';
import { BillingSettingsService } from './services/billing-settings.service';
import { IdentityProfileService } from './services/identity-profile.service';
import { StampsSignaturesService } from './services/stamps-signatures.service';
import { SignatureTokenService } from './services/signature-token.service';
import { GeolocationService } from '../hr/geolocation.service';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';
import { Public } from '../auth/decorators/public.decorator';
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
    private readonly bilingualStructureService: BilingualStructureService,
    private readonly communicationSettingsService: CommunicationSettingsService,
    private readonly academicYearSettingsService: AcademicYearSettingsService,
    private readonly academicPeriodSettingsService: AcademicPeriodSettingsService,
    private readonly schoolCalendarConfigService: SchoolCalendarConfigService,
    private readonly educationStructureService: EducationStructureService,
    private readonly rolesPermissionsService: RolesPermissionsService,
    private readonly rolesPermissionsBootstrapService: RolesPermissionsBootstrapService,
    private readonly billingSettingsService: BillingSettingsService,
    private readonly identityProfileService: IdentityProfileService,
    private readonly stampsSignaturesService: StampsSignaturesService,
    private readonly signatureTokenService: SignatureTokenService,
    private readonly emailService: EmailService,
    private readonly geolocationService: GeolocationService,
    private readonly prisma: PrismaService,
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
      whatsapp?: string;
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

  /**
   * ⭐ PUT /settings/identity/card-settings
   * Met à jour les paramètres de carte scolaire (heures maternelle, design, etc.)
   * Effectue un UPDATE direct sur la version active (pas de nouvelle version).
   *
   * ⭐ P0.8 — Persistance des 19 champs Phase-5 manquants (cardSecondaryColor,
   *    cardFontFamily, cardPhotoPosition, etc.). Avant, seulement 11 champs étaient
   *    persistés — le frontend envoyait 30 champs mais 19 étaient silencieusement droppés.
   */
  @Put('identity/card-settings')
  async updateCardSettings(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      // Champs Phase 1 (déjà persistés avant)
      maternellePickupMorning?: string;
      maternellePickupAfternoon?: string;
      maternelleSingleExit?: boolean;
      maternelleSingleExitTime?: string;
      cardPrimaryColor?: string;
      cardShowQRCode?: boolean;
      cardShowPhoto?: boolean;
      cardShowGuardian?: boolean;
      cardShowEmergencyCall?: boolean;
      cardShowSchoolAddress?: boolean;
      cardConditionsText?: string;
      // ⭐ Champs Phase-5 (19 champs qui étaient droppés avant P0.8)
      cardSecondaryColor?: string;
      cardShowBarcode?: boolean;
      cardFooterText?: string;
      cardFontFamily?: string;
      cardFontSizeScale?: string;
      cardStudentNameStyle?: string;
      cardPhotoPosition?: string;
      cardPhotoSize?: string;
      cardPhotoShape?: string;
      cardHeaderStyle?: string;
      cardLogoPosition?: string;
      cardLogoSize?: string;
      cardShowMatricule?: boolean;
      cardShowBirthInfo?: boolean;
      cardShowGender?: boolean;
      cardShowLevel?: boolean;
      cardQrPosition?: string;
      cardQrSize?: string;
      cardQrWithLogo?: boolean;
      templateKey?: string;
    },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    // Update direct sur la version active
    const updated = await this.prisma.tenantIdentityProfile.updateMany({
      where: { tenantId: tid, isActive: true },
      data: {
        // Champs Phase 1
        ...(data.maternellePickupMorning !== undefined && { maternellePickupMorning: data.maternellePickupMorning }),
        ...(data.maternellePickupAfternoon !== undefined && { maternellePickupAfternoon: data.maternellePickupAfternoon }),
        ...(data.maternelleSingleExit !== undefined && { maternelleSingleExit: data.maternelleSingleExit }),
        ...(data.maternelleSingleExitTime !== undefined && { maternelleSingleExitTime: data.maternelleSingleExitTime }),
        ...(data.cardPrimaryColor !== undefined && { cardPrimaryColor: data.cardPrimaryColor }),
        ...(data.cardShowQRCode !== undefined && { cardShowQRCode: data.cardShowQRCode }),
        ...(data.cardShowPhoto !== undefined && { cardShowPhoto: data.cardShowPhoto }),
        ...(data.cardShowGuardian !== undefined && { cardShowGuardian: data.cardShowGuardian }),
        ...(data.cardShowEmergencyCall !== undefined && { cardShowEmergencyCall: data.cardShowEmergencyCall }),
        ...(data.cardShowSchoolAddress !== undefined && { cardShowSchoolAddress: data.cardShowSchoolAddress }),
        ...(data.cardConditionsText !== undefined && { cardConditionsText: data.cardConditionsText }),
        // ⭐ Champs Phase-5 (19 champs ajoutés en P0.8)
        ...(data.cardSecondaryColor !== undefined && { cardSecondaryColor: data.cardSecondaryColor }),
        ...(data.cardShowBarcode !== undefined && { cardShowBarcode: data.cardShowBarcode }),
        ...(data.cardFooterText !== undefined && { cardFooterText: data.cardFooterText }),
        ...(data.cardFontFamily !== undefined && { cardFontFamily: data.cardFontFamily }),
        ...(data.cardFontSizeScale !== undefined && { cardFontSizeScale: data.cardFontSizeScale }),
        ...(data.cardStudentNameStyle !== undefined && { cardStudentNameStyle: data.cardStudentNameStyle }),
        ...(data.cardPhotoPosition !== undefined && { cardPhotoPosition: data.cardPhotoPosition }),
        ...(data.cardPhotoSize !== undefined && { cardPhotoSize: data.cardPhotoSize }),
        ...(data.cardPhotoShape !== undefined && { cardPhotoShape: data.cardPhotoShape }),
        ...(data.cardHeaderStyle !== undefined && { cardHeaderStyle: data.cardHeaderStyle }),
        ...(data.cardLogoPosition !== undefined && { cardLogoPosition: data.cardLogoPosition }),
        ...(data.cardLogoSize !== undefined && { cardLogoSize: data.cardLogoSize }),
        ...(data.cardShowMatricule !== undefined && { cardShowMatricule: data.cardShowMatricule }),
        ...(data.cardShowBirthInfo !== undefined && { cardShowBirthInfo: data.cardShowBirthInfo }),
        ...(data.cardShowGender !== undefined && { cardShowGender: data.cardShowGender }),
        ...(data.cardShowLevel !== undefined && { cardShowLevel: data.cardShowLevel }),
        ...(data.cardQrPosition !== undefined && { cardQrPosition: data.cardQrPosition }),
        ...(data.cardQrSize !== undefined && { cardQrSize: data.cardQrSize }),
        ...(data.cardQrWithLogo !== undefined && { cardQrWithLogo: data.cardQrWithLogo }),
      },
    });
    return { success: true, updated: updated.count };
  }

  // ============================================================================
  // ⭐ GÉOLOCALISATION ÉCOLE — pour pointage enseignants
  // ============================================================================
  //
  // Permet au directeur de configurer les coordonnées GPS de l'école
  // + le rayon de tolérance (par défaut 100m).
  // Utilisé ensuite par AttendancePrismaService.selfCheckIn() pour vérifier
  // la position de l'enseignant au moment du pointage.

  @Get('identity/geolocation')
  async getSchoolGeolocation(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    const coords = await this.geolocationService.getSchoolCoordinates(tid);
    if (!coords) {
      return {
        configured: false,
        latitude: null,
        longitude: null,
        geoRadius: 100,
        message: 'Coordonnées GPS non configurées. Utilisez PUT /settings/identity/geolocation pour les définir.',
      };
    }
    return {
      configured: true,
      ...coords,
    };
  }

  @Put('identity/geolocation')
  async updateSchoolGeolocation(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: {
      latitude: number;
      longitude: number;
      geoRadius?: number;
    },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      throw new BadRequestException('latitude et longitude (numbers) sont requis');
    }
    const result = await this.geolocationService.updateSchoolCoordinates(
      tid,
      data.latitude,
      data.longitude,
      data.geoRadius,
    );
    return {
      success: true,
      configured: true,
      ...result,
    };
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

  /**
   * ⭐ DISCORD PARITY — Génère un cachet NOMINATIF pour un titulaire de poste.
   *
   * Body: { holderName, holderRole, educationLevelId? }
   * Returns: { stampUrl, generatedAt }
   *
   * Le cachet nominatif est un tampon rectangulaire professionnel (effet encre,
   * rotation légère, double bordure) avec le nom du titulaire (grand) + le
   * rôle/libellé (plus petit). Sauvegardé en PNG dans le dossier tenant-stamps.
   */
  @Post('stamps/generate-nominative')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async generateNominativeStamp(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() body: { holderName: string; holderRole: string; educationLevelId?: string | null },
  ) {
    if (!body?.holderName?.trim()) {
      throw new BadRequestException('holderName est requis');
    }
    if (!body?.holderRole?.trim()) {
      throw new BadRequestException('holderRole est requis');
    }
    return this.stampsSignaturesService.generateNominativeStamp(
      this.resolveTid(tenantId, user, req),
      body.holderName,
      body.holderRole,
      body.educationLevelId ?? null,
    );
  }

  /**
   * ⭐ Génère les DEUX cachets (circulaire nominatif + rectangulaire
   *    nominatif) pour un staff spécifique.
   *
   * Appelé par le bouton « Cachet » dans RH > Administration pour chaque
   * staff. Le cachet circulaire a le RÔLE du titulaire au centre (au lieu
   * du logo), et le cachet rectangulaire a le nom du titulaire (grand) +
   * le rôle en dessous.
   *
   * Les deux PNGs sont sauvegardés dans uploads/tenant-stamps/<tenantId>/
   * <levelFolder>/nominative/ et leurs URLs sont retournées pour
   * affichage immédiat dans le modal du frontend.
   */
  @Post('stamps/generate-for-staff')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async generateStampsForStaff(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() body: { holderName: string; holderRole: string; educationLevelId?: string | null },
  ) {
    if (!body?.holderName?.trim()) {
      throw new BadRequestException('holderName est requis');
    }
    if (!body?.holderRole?.trim()) {
      throw new BadRequestException('holderRole est requis');
    }
    return this.stampsSignaturesService.generateStampsForStaff(
      this.resolveTid(tenantId, user, req),
      body.holderName,
      body.holderRole,
      body.educationLevelId ?? null,
    );
  }

  @Get('stamps/asset')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'read')
  async getStampsAsset(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Query('type') type: 'circular' | 'rectangular' | 'oval' | 'signature' | 'nominative_circular' | 'nominative_rectangular',
    @Query('education_level_id') educationLevelId: string | undefined,
    @Query('signature_id') signatureId: string | undefined,
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (!type || !['circular', 'rectangular', 'oval', 'signature', 'nominative_circular', 'nominative_rectangular'].includes(type)) {
      throw new BadRequestException('Paramètre type requis: circular, rectangular, oval, signature, nominative_circular ou nominative_rectangular');
    }
    const filePath =
      type === 'signature'
        ? this.stampsSignaturesService.getAssetPath(tid, 'signature', signatureId ?? '')
        : type === 'nominative_circular' || type === 'nominative_rectangular'
          ? this.stampsSignaturesService.getAssetPath(tid, type as any, signatureId ?? '')
          : this.stampsSignaturesService.getAssetPath(tid, type as any, educationLevelId ?? null);
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

  /**
   * ⭐ Réinitialise la signature d'un titulaire (passe signatureUrl à null).
   *
   * Appelé par le bouton « Réinitialiser » dans RH > Administration quand
   * une signature existe déjà pour un staff (rôle + niveau). Après reset,
   * le bouton « Lien signature » réapparaît et le staff peut re-signer.
   *
   * ⭐ La signature est identifiée par (tenantId, role, educationLevelId).
   *    On ne supprime PAS la ligne tenant_signatures (qui contient aussi
   *    holderFirstName/holderLastName) — on passe juste signatureUrl à
   *    null pour que la signature ne soit plus affichée ni appliquée sur
   *    les documents.
   */
  @Post('signature/reset')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async resetSignature(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() body: { role: string; educationLevelId?: string | null },
  ) {
    if (!body?.role?.trim()) {
      throw new BadRequestException('role est requis');
    }
    const tid = this.resolveTid(tenantId, user, req);
    const levelId = body.educationLevelId ?? null;

    // ⭐ Le frontend peut envoyer le role sous différentes formulations :
    //    "Promoteur / Fondateur", "Promoteur", "PROMOTEUR". On fait un
    //    matching flexible côté backend en comparant le premier mot et
    //    la version uppercased.
    const roleInput = body.role.trim();
    const roleInputFirstWord = roleInput.split(/[\/\s]/)[0].trim();
    const roleInputUpper = roleInput.toUpperCase();

    // ⭐ Cherche toutes les signatures pour ce tenant (toutes formulations
    //    de rôle confondues) puis filtre côté JS pour matcher.
    const allSigs = await this.prisma.tenantSignature.findMany({
      where: { tenantId: tid },
    });
    const matchingSigs = allSigs.filter((s: any) => {
      // Match par niveau
      const levelMatch = levelId != null
        ? s.educationLevelId === levelId
        : (s.educationLevelId === null || s.educationLevelId === undefined);
      if (!levelMatch) return false;
      const sRole = String(s.role || '');
      // Match par libellé exact
      if (sRole === roleInput) return true;
      // Match par uppercased (PROMOTEUR == PROMOTEUR)
      if (sRole.toUpperCase() === roleInputUpper) return true;
      // Match par premier mot ("Promoteur" == "Promoteur / Fondateur")
      if (sRole === roleInputFirstWord) return true;
      // Match inverse : premier mot de la DB == premier mot de l'input
      const sRoleFirstWord = sRole.split(/[\/\s]/)[0].trim();
      if (sRoleFirstWord === roleInputFirstWord) return true;
      return false;
    });

    if (matchingSigs.length === 0) {
      return { success: true, message: 'Aucune signature à réinitialiser.' };
    }

    // ⭐ Passe signatureUrl à null pour toutes les signatures matchées
    //    (généralement une seule, mais on gère le cas où plusieurs
    //    formulations existent pour le même rôle+level).
    for (const sig of matchingSigs) {
      await this.prisma.tenantSignature.update({
        where: { id: sig.id },
        data: {
          signatureUrl: null,
          generatedAt: null,
        },
      });
    }

    this.logger.log(`Signature réinitialisée: tenant=${tid} role=${body.role} level=${levelId ?? 'global'} (${matchingSigs.length} match(es))`);
    return {
      success: true,
      message: `Signature réinitialisée (${matchingSigs.length} entrée(s) mise(s) à jour). Le bouton "Lien signature" est de nouveau visible.`,
    };
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

  /**
   * ⭐ CANVA SIGNATURE FLOW — Request a signature upload link.
   *
   * Instead of auto-generating a cursive text signature, this endpoint:
   * 1. Creates a 32-char hex token (valid 30 days)
   * 2. Sends an email to the staff member with a link to /signature/canvas/[token]
   * 3. The staff opens the link, draws/uploads their signature on a canvas page
   * 4. On submit, the canvas page POSTs the PNG to /settings/signature/upload/:token
   * 5. The signature is stored and auto-applied everywhere it's needed
   */
  @Post('signature/request-canva-link')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  async requestSignatureCanvaLink(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() body: {
      staffId?: string;
      role: string;
      holderFirstName: string;
      holderLastName: string;
      email: string;
      educationLevelId?: string | null;
    },
  ) {
    const tid = this.resolveTid(tenantId, user, req);
    if (!body?.email?.trim()) throw new BadRequestException('email est requis');
    if (!body?.role?.trim()) throw new BadRequestException('role est requis');
    if (!body?.holderFirstName?.trim()) throw new BadRequestException('holderFirstName est requis');

    // 1. Create the magic-link token
    const { token, expiresAt } = await this.signatureTokenService.createToken({
      tenantId: tid,
      staffId: body.staffId || null,
      role: body.role,
      holderFirstName: body.holderFirstName,
      holderLastName: body.holderLastName,
      educationLevelId: body.educationLevelId ?? null,
      email: body.email,
    });

    // 2. Build the signature upload URL (self-hosted canvas page)
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || 'https://academiahelm.com';
    const signatureUrl = `${frontendUrl}/signature/canvas/${token}`;

    // 3. Get the school name (for the email to be sent on behalf of the school)
    let schoolName = 'Academia Helm';
    let schoolLogoUrl: string | null = null;
    try {
      const profile = await this.identityProfileService.getActiveProfile(tid);
      if (profile?.schoolName) schoolName = profile.schoolName;
      if (profile?.logoUrl) schoolLogoUrl = profile.logoUrl;
    } catch { /* fallback to default */ }

    // 4. Send the email on behalf of the school
    const holderName = `${body.holderFirstName} ${body.holderLastName}`.trim();
    const roleLabel = body.role.replace(/_/g, ' ');
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${schoolLogoUrl ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${schoolLogoUrl}" alt="${schoolName}" style="max-height: 60px; max-width: 200px; object-fit: contain;" /></div>` : ''}
        <h2 style="color: #1e3a8a;">Signature requise — ${schoolName}</h2>
        <p>Bonjour <strong>${holderName}</strong>,</p>
        <p>L'administration de <strong>${schoolName}</strong> vous invite à enregistrer votre signature manuscrite pour votre poste de <strong>${roleLabel}</strong>.</p>
        <p>Cliquez sur le lien ci-dessous pour dessiner ou télécharger votre signature. Elle sera automatiquement appliquée sur tous les documents officiels vous concernant.</p>
        <p style="margin: 24px 0;">
          <a href="${signatureUrl}"
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px;
                    text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Enregistrer ma signature
          </a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">
          Ce lien expire le ${expiresAt.toLocaleDateString('fr-FR')}.<br/>
          Si vous n'avez pas demandé ce lien, ignorez cet email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;"/>
        <p style="color: #9ca3af; font-size: 12px;">${schoolName} — Plateforme de gestion scolaire Academia Helm</p>
      </div>
    `;

    try {
      // ⭐ Send email ON BEHALF OF THE SCHOOL (not Academia Helm)
      //    Same pattern as staff credentials email — uses schoolName as fromName
      await this.emailService.sendEmail({
        to: body.email,
        fromName: schoolName,
        subject: `Signature requise — ${roleLabel} — ${schoolName}`,
        html,
        text: `Bonjour ${holderName}, ${schoolName} vous invite à enregistrer votre signature ici: ${signatureUrl}`,
      });
    } catch (e: any) {
      this.logger.warn(`Could not send signature email to ${body.email}: ${e.message}`);
      // Don't fail the whole request — return the URL so the admin can share it manually
    }

    return {
      success: true,
      sentTo: body.email,
      signatureUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * ⭐ CANVA SIGNATURE FLOW — Upload a signature via magic-link token.
   *
   * Public endpoint (no JWT) — authenticated by the token in the URL.
   * Accepts a base64 PNG data URL or a multipart file upload.
   * Persists the signature to tenant_signatures and marks the token as used.
   */
  @Post('signature/upload/:token')
  @Public()
  async uploadSignatureByToken(
    @Param('token') token: string,
    @Body() body: { signatureDataUrl?: string },
  ) {
    // 1. Validate the token
    const tokenData = await this.signatureTokenService.validateToken(token);

    // 2. Get the signature image (base64 data URL from the canvas page)
    if (!body?.signatureDataUrl?.trim()) {
      throw new BadRequestException('signatureDataUrl est requis (base64 PNG data URL)');
    }
    const dataUrl = body.signatureDataUrl;
    const base64Match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!base64Match) {
      throw new BadRequestException('signatureDataUrl doit être une data URL base64 (data:image/png;base64,...)');
    }
    const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
    const buffer = Buffer.from(base64Match[2], 'base64');

    // 3. Generate or update the signature via the existing service
    //    We use generateSignature which creates/updates a tenant_signatures row.
    //    The signature image is stored as a file on disk (via the existing
    //    svgToPng path pattern, but we upload the raw PNG buffer instead).
    try {
      // Save the PNG buffer to the signatures directory
      const fs = await import('fs/promises');
      const path = await import('path');
      const SIGNATURES_DIR = 'uploads/tenant-signatures';
      const dir = path.join(process.cwd(), SIGNATURES_DIR, tokenData.tenantId);
      await fs.mkdir(dir, { recursive: true });
      // ⭐ FIX : nettoyer le role du filename pour retirer les caractères
      //    spéciaux (slash, espace, accent) qui cassent le filesystem.
      //    AVANT : role = "Directeur / Directrice" → filename =
      //    "signature-Directeur/Directrice-1234567.png" → le / créait un
      //    sous-dossier et l'écriture échouait avec "Échec de
      //    l'enregistrement de la signature".
      //    APRÈS : roleSlug = "directeur-directrice" → filename =
      //    "signature-directeur-directrice-1234567.png" (plat, valide).
      const roleSlug = (tokenData.role || 'role')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // retire les accents
        .replace(/[^a-z0-9]+/g, '-')    // remplace tout non-alphanumérique par -
        .replace(/^-+|-+$/g, '');       // retire les - en début/fin
      const fileName = `signature-${roleSlug}-${Date.now()}.${ext}`;
      const filePath = path.join(dir, fileName);
      await fs.writeFile(filePath, buffer);
      const signatureUrl = `${SIGNATURES_DIR}/${tokenData.tenantId}/${fileName}`;

      // 4. Upsert the tenant_signatures row (create or update by role + level)
      //    generateSignature already does this — but it generates its own SVG.
      //    Instead, we directly upsert the DB row with our uploaded URL.
      const existing = tokenData.educationLevelId
        ? await this.prisma.tenantSignature.findFirst({
            where: { tenantId: tokenData.tenantId, role: tokenData.role, educationLevelId: tokenData.educationLevelId },
          })
        : await this.prisma.tenantSignature.findFirst({
            where: { tenantId: tokenData.tenantId, role: tokenData.role, educationLevelId: null },
          });

      if (existing) {
        await this.prisma.tenantSignature.update({
          where: { id: existing.id },
          data: {
            signatureUrl,
            holderFirstName: tokenData.holderFirstName,
            holderLastName: tokenData.holderLastName,
            generatedAt: new Date(),
          },
        });
      } else {
        await this.prisma.tenantSignature.create({
          data: {
            tenantId: tokenData.tenantId,
            role: tokenData.role,
            holderFirstName: tokenData.holderFirstName,
            holderLastName: tokenData.holderLastName,
            educationLevelId: tokenData.educationLevelId || null,
            signatureUrl,
            generatedAt: new Date(),
          } as any,
        });
      }

      // 5. Mark the token as used
      await this.signatureTokenService.markUsed(token);

      this.logger.log(`Signature uploaded via token for ${tokenData.email} (role=${tokenData.role})`);

      return {
        success: true,
        signatureUrl,
        message: 'Signature enregistrée avec succès. Elle sera automatiquement appliquée sur vos documents officiels.',
      };
    } catch (e: any) {
      this.logger.error(`Signature upload failed: ${e.message}`);
      throw new BadRequestException(`Échec de l'enregistrement de la signature: ${e.message}`);
    }
  }

  /**
   * ⭐ CANVA SIGNATURE FLOW — Get token info (for the canvas page to display
   * the staff name + role). Public endpoint — authenticated by the token.
   */
  @Get('signature/token-info/:token')
  @Public()
  async getSignatureTokenInfo(@Param('token') token: string) {
    const tokenData = await this.signatureTokenService.validateToken(token);
    return {
      holderName: `${tokenData.holderFirstName} ${tokenData.holderLastName}`.trim(),
      role: tokenData.role,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt.toISOString(),
    };
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

  /**
   * ⭐ POST /settings/bilingual/seed-en-structure
   *    Re-créé manuellement la structure pédagogique EN (Nursery 1/2, Primary 1-6)
   *    à partir de la structure FR existante. Opération idempotente.
   *    Utile si l'auto-seed à l'activation bilingue a échoué, ou si de nouvelles
   *    classes FR ont été ajoutées après l'activation.
   */
  @Post('bilingual/seed-en-structure')
  async seedEnStructure(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.bilingualStructureService.seedEnglishStructureForTenant(
      this.resolveTid(tenantId, user, req),
    );
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
      admissionOpenDate?: string;
      admissionCloseDate?: string;
      admissionEnabled?: boolean;
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
      // ⭐ Paramètres d'admission publique
      admissionOpenDate: data?.admissionOpenDate != null && String(data.admissionOpenDate).trim() !== '' ? new Date(data.admissionOpenDate) : null,
      admissionCloseDate: data?.admissionCloseDate != null && String(data.admissionCloseDate).trim() !== '' ? new Date(data.admissionCloseDate) : null,
      admissionEnabled: data?.admissionEnabled,
    };
    return this.academicYearSettingsService.update(tid, id, body, user.id);
  }

  /**
   * ⭐ GET /settings/academic-years/:id/admission-status
   * Retourne l'état d'ouverture des admissions publiques pour cette année.
   * Utilisé par le portail public pour savoir si les admissions sont ouvertes.
   */
  @Get('academic-years/:id/admission-status')
  async getAdmissionStatus(
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');

    const year = await this.academicYearSettingsService.getById(tid, id);
    const now = new Date();
    let isOpen = year.admissionEnabled !== false; // null/undefined = true par défaut
    let reason = '';

    if (!isOpen) {
      reason = 'Admissions désactivées manuellement par l\'établissement.';
    } else if (year.admissionOpenDate && now < year.admissionOpenDate) {
      isOpen = false;
      reason = `Les admissions ouvriront le ${year.admissionOpenDate.toLocaleDateString('fr-FR')}.`;
    } else if (year.admissionCloseDate && now > year.admissionCloseDate) {
      isOpen = false;
      reason = `Les admissions sont closes depuis le ${year.admissionCloseDate.toLocaleDateString('fr-FR')}.`;
    } else {
      reason = 'Admissions ouvertes.';
    }

    return {
      isOpen,
      reason,
      admissionEnabled: year.admissionEnabled !== false,
      admissionOpenDate: year.admissionOpenDate,
      admissionCloseDate: year.admissionCloseDate,
      checkedAt: now.toISOString(),
    };
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

  /**
   * PROMOTE — Clôture l'année active courante ET active la suivante en une
   * transaction atomique. Crée aussi les enrollments PROMOTION pour chaque
   * élève actif. C'est l'action "Passer à l'année suivante".
   *
   * Différent de /close qui refuse de clôturer l'année active.
   */
  @Post('academic-years/:id/promote')
  async promoteAcademicYear(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.academicYearSettingsService.promote(tid, id, user.id);
  }

  @Get('academic-years/:id/stats')
  async getAcademicYearStats(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.academicYearSettingsService.getYearStats(tenantId, id);
  }

  // ============================================================================
  // CONFIGURATION DU CALENDRIER SCOLAIRE (par tenant)
  // ============================================================================

  /**
   * Récupère la config du calendrier scolaire du tenant.
   * Retourne les valeurs par défaut (Bénin) si aucune config n'existe en base.
   */
  @Get('school-calendar-config')
  async getSchoolCalendarConfig(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    const config = await this.schoolCalendarConfigService.getForTenant(tid);
    const raw = await this.schoolCalendarConfigService.getRawForTenant(tid);
    return { config, isCustom: !!raw, raw };
  }

  /**
   * Met à jour (ou crée) la config du calendrier scolaire du tenant.
   * Permet à l'admin d'adapter les règles si le gouvernement change les dates
   * (ex : rentrée décalée au 4e lundi de septembre).
   */
  @Put('school-calendar-config')
  async updateSchoolCalendarConfig(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.schoolCalendarConfigService.upsert(tid, data ?? {}, user.id);
  }

  /**
   * Réinitialise la config du calendrier aux valeurs par défaut (Bénin).
   */
  @Post('school-calendar-config/reset')
  async resetSchoolCalendarConfig(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const fromUser = typeof user?.tenantId === 'string' ? user.tenantId : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const fromHeader = req?.headers?.['x-tenant-id'];
    const tid = tenantId ?? fromUser ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
    if (!tid || typeof tid !== 'string') throw new BadRequestException('Contexte tenant manquant.');
    return this.schoolCalendarConfigService.reset(tid, user.id);
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
    const canCrossTenant =
      roleStr === 'PLATFORM_OWNER' ||
      roleStr === 'PLATFORM_ADMIN' ||
      roleStr === 'SUPER_ADMIN' ||
      user?.isSuperAdmin === true;
    if (canCrossTenant) {
      const fromHeader = req?.headers?.['x-tenant-id'];
      const fromQuery = req?.query?.tenant_id;
      const override =
        tenantId ??
        (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ??
        (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
      if (override && typeof override === 'string') return override;
      // Sinon : tenant du JWT (ex. directeur, ou PO après sélection d'établissement)
      if (fromUser && typeof fromUser === 'string') return fromUser;
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

  /**
   * DELETE /settings/education/classrooms/:id
   * Suppression définitive d'une classe officielle (Classroom).
   * Cas d'usage : la classe a été créée par erreur ou n'est plus utilisée
   * cette année. Refusée si des élèves y sont inscrits ou si des sections
   * physiques y sont liées (l'utilisateur doit d'abord les réaffecter/supprimer).
   */
  @Delete('education/classrooms/:id')
  async deleteEducationClassroom(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.educationStructureService.deleteClassroom(this.resolveTid(tenantId, user, req), id);
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

  /**
   * ⭐ PUT /settings/education/grades/:id/enabled
   * Active/désactive individuellement une classe pédagogique (EducationGrade).
   * Permet à l'école de n'activer que les classes réellement disponibles
   * au niveau Secondaire (ex: 6e+5e mais pas 2nde).
   */
  @Put('education/grades/:id/enabled')
  async setEducationGradeEnabled(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { isEnabled: boolean },
  ) {
    return this.educationStructureService.setGradeEnabled(this.resolveTid(tenantId, user, req), id, data.isEnabled);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SÉRIES DU 2ND CYCLE SECONDAIRE — CRUD
  //  Permet à l'utilisateur d'ajouter/supprimer des séries (A1, A2, B, C, D,
  //  G1, G2, F1-F4, ou toute série personnalisée). L'ajout crée
  //  automatiquement les 3 grades (2nde X, 1ère X, Terminale X).
  // ═══════════════════════════════════════════════════════════════════════

  /** GET /settings/education/series — Liste toutes les séries du tenant. */
  @Get('education/series')
  async listEducationSeries(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.educationStructureService.listSeries(this.resolveTid(tenantId, user, req));
  }

  /** POST /settings/education/series — Crée une série + auto-crée les 3 grades. */
  @Post('education/series')
  async createEducationSeries(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Body() data: { code: string; name?: string; order?: number },
  ) {
    return this.educationStructureService.createSeries(
      this.resolveTid(tenantId, user, req),
      data,
    );
  }

  /** DELETE /settings/education/series/:id — Supprime une série + ses 3 grades. */
  @Delete('education/series/:id')
  async deleteEducationSeries(
    @TenantId() tenantId: string | undefined,
    @CurrentUser() user: any,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.educationStructureService.deleteSeries(
      this.resolveTid(tenantId, user, req),
      id,
    );
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

