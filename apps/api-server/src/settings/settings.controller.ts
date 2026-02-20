import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
import { RolesPermissionsService } from './services/roles-permissions.service';
import { BillingSettingsService } from './services/billing-settings.service';
import { IdentityProfileService } from './services/identity-profile.service';

/**
 * Controller principal pour le Module Paramètres
 * Tous les endpoints sont protégés par JWT
 */
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
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
    private readonly rolesPermissionsService: RolesPermissionsService,
    private readonly billingSettingsService: BillingSettingsService,
    private readonly identityProfileService: IdentityProfileService,
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
  async getActiveIdentityProfile(@TenantId() tenantId: string) {
    return this.identityProfileService.getActiveProfile(tenantId);
  }

  @Get('identity/history')
  async getIdentityHistory(
    @TenantId() tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.identityProfileService.getVersionHistory(tenantId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('identity/version/:versionId')
  async getIdentityVersion(
    @TenantId() tenantId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.identityProfileService.getProfileById(tenantId, versionId);
  }

  @Get('identity/compare')
  async compareIdentityVersions(
    @TenantId() tenantId: string,
    @Query('versionA') versionA: string,
    @Query('versionB') versionB: string,
  ) {
    return this.identityProfileService.compareVersions(
      tenantId,
      parseInt(versionA),
      parseInt(versionB),
    );
  }

  @Get('identity/preview')
  async getDocumentPreview(@TenantId() tenantId: string) {
    return this.identityProfileService.generateDocumentPreview(tenantId);
  }

  @Get('identity/at-date')
  async getIdentityAtDate(
    @TenantId() tenantId: string,
    @Query('date') dateStr: string,
  ) {
    const date = new Date(dateStr);
    return this.identityProfileService.getProfileAtDate(tenantId, date);
  }

  @Post('identity')
  async createIdentityVersion(
    @TenantId() tenantId: string,
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
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { changeReason, ...profileData } = data;

    return this.identityProfileService.createNewVersion(
      tenantId,
      profileData,
      user.id,
      changeReason,
      ipAddress,
      userAgent,
    );
  }

  @Put('identity/activate/:versionId')
  async activateIdentityVersion(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('versionId') versionId: string,
    @Body() data: { reason?: string },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.identityProfileService.activateVersion(
      tenantId,
      versionId,
      user.id,
      data.reason,
      ipAddress,
      userAgent,
    );
  }

  @Put('identity/visuals')
  async updateIdentityVisuals(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      logoUrl?: string;
      stampUrl?: string;
      directorSignatureUrl?: string;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.identityProfileService.updateVisuals(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================

  @Get('features')
  async getAllFeatures(@TenantId() tenantId: string) {
    return this.featureFlagsService.getAllFeatures(tenantId);
  }

  @Get('features/billing-impact')
  async getBillingImpact(@TenantId() tenantId: string) {
    return this.featureFlagsService.calculateBillingImpact(tenantId);
  }

  @Get('features/:featureCode')
  async getFeature(
    @TenantId() tenantId: string,
    @Param('featureCode') featureCode: string,
  ) {
    return this.featureFlagsService.getFeature(tenantId, featureCode);
  }

  @Get('features/:featureCode/check')
  async checkFeature(
    @TenantId() tenantId: string,
    @Param('featureCode') featureCode: string,
  ) {
    return this.featureFlagsService.isFeatureEnabled(tenantId, featureCode);
  }

  @Post('features/:featureCode/enable')
  async enableFeature(
    @TenantId() tenantId: string,
    @Param('featureCode') featureCode: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.featureFlagsService.enableFeature(
      tenantId,
      featureCode,
      user.id,
      body.reason,
      ipAddress,
      userAgent,
    );
  }

  @Post('features/:featureCode/disable')
  async disableFeature(
    @TenantId() tenantId: string,
    @Param('featureCode') featureCode: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.featureFlagsService.disableFeature(
      tenantId,
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
  async getPedagogicalStructure(@TenantId() tenantId: string) {
    return this.pedagogicalStructureService.getStructure(tenantId);
  }

  @Put('pedagogical-structure')
  async updatePedagogicalStructure(
    @TenantId() tenantId: string,
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
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.pedagogicalStructureService.updateStructure(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get('pedagogical-structure/levels')
  async getLevels(@TenantId() tenantId: string) {
    return this.pedagogicalStructureService.getLevels(tenantId);
  }

  @Get('pedagogical-structure/tracks')
  async getTracks(@TenantId() tenantId: string) {
    return this.pedagogicalStructureService.getTracks(tenantId);
  }

  // ============================================================================
  // OPTION BILINGUE
  // ============================================================================

  @Get('bilingual')
  async getBilingualSettings(@TenantId() tenantId: string) {
    return this.bilingualSettingsService.getSettings(tenantId);
  }

  @Put('bilingual')
  async updateBilingualSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      isEnabled?: boolean;
      separateSubjects?: boolean;
      separateGrades?: boolean;
      defaultUILanguage?: string;
      billingImpactAcknowledged?: boolean;
    },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.bilingualSettingsService.updateSettings(
      tenantId,
      data,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get('bilingual/check-migration')
  async checkBilingualMigration(@TenantId() tenantId: string) {
    const needed = await this.bilingualSettingsService.checkMigrationNeeded(tenantId);
    return { migrationNeeded: needed };
  }

  @Post('bilingual/migrate')
  async startBilingualMigration(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.bilingualSettingsService.startMigration(tenantId, user.id);
  }

  @Get('bilingual/billing-impact')
  async getBilingualBillingImpact(@TenantId() tenantId: string) {
    return this.bilingualSettingsService.getBillingImpact(tenantId);
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
  async getAcademicYears(@TenantId() tenantId: string) {
    return this.academicYearSettingsService.getAll(tenantId);
  }

  @Get('academic-years/active')
  async getActiveAcademicYear(@TenantId() tenantId: string) {
    return this.academicYearSettingsService.getActive(tenantId);
  }

  @Get('academic-years/:id')
  async getAcademicYearById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.academicYearSettingsService.getById(tenantId, id);
  }

  @Post('academic-years')
  async createAcademicYear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      name: string;
      label: string;
      preEntryDate?: string;
      startDate: string;
      endDate: string;
    },
  ) {
    return this.academicYearSettingsService.create(
      tenantId,
      {
        ...data,
        preEntryDate: data.preEntryDate ? new Date(data.preEntryDate) : undefined,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
      user.id,
    );
  }

  @Put('academic-years/:id')
  async updateAcademicYear(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: {
      name?: string;
      label?: string;
      preEntryDate?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.academicYearSettingsService.update(
      tenantId,
      id,
      {
        ...data,
        preEntryDate: data.preEntryDate ? new Date(data.preEntryDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      user.id,
    );
  }

  @Post('academic-years/:id/activate')
  async activateAcademicYear(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.academicYearSettingsService.activate(tenantId, id, user.id);
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
      startDate: string;
      endDate: string;
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
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        preEntryDate: data.preEntryDate ? new Date(data.preEntryDate) : undefined,
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

  @Post('academic-years/generate-next')
  async generateNextAcademicYear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.academicYearSettingsService.generateNext(tenantId, user.id);
  }

  // ============================================================================
  // RÔLES & PERMISSIONS
  // ============================================================================

  @Get('roles')
  async getRoles(@TenantId() tenantId: string) {
    return this.rolesPermissionsService.getRoles(tenantId);
  }

  @Get('roles/:id')
  async getRoleById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.rolesPermissionsService.getRoleById(tenantId, id);
  }

  @Post('roles')
  async createRole(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      name: string;
      description?: string;
      canAccessOrion?: boolean;
      canAccessAtlas?: boolean;
      allowedLevelIds?: string[];
      permissionIds?: string[];
    },
  ) {
    return this.rolesPermissionsService.createRole(tenantId, data, user.id);
  }

  @Put('roles/:id')
  async updateRole(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: {
      name?: string;
      description?: string;
      canAccessOrion?: boolean;
      canAccessAtlas?: boolean;
      allowedLevelIds?: string[];
    },
  ) {
    return this.rolesPermissionsService.updateRole(tenantId, id, data, user.id);
  }

  @Delete('roles/:id')
  async deleteRole(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.rolesPermissionsService.deleteRole(tenantId, id, user.id);
  }

  @Get('permissions')
  async getPermissions() {
    return this.rolesPermissionsService.getPermissions();
  }

  @Get('permissions/grouped')
  async getPermissionsGrouped() {
    return this.rolesPermissionsService.getPermissionsGrouped();
  }

  @Put('roles/:id/permissions')
  async updateRolePermissions(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data: { permissionIds: string[] },
  ) {
    return this.rolesPermissionsService.updateRolePermissions(
      tenantId,
      id,
      data.permissionIds,
      user.id,
    );
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

