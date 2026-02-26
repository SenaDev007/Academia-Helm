import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { GeneralSettingsService } from './services/general-settings.service';
import { FeatureFlagsService } from './services/feature-flags.service';
import { SecuritySettingsService } from './services/security-settings.service';
import { OrionSettingsService } from './services/orion-settings.service';
import { AtlasSettingsService } from './services/atlas-settings.service';
import { OfflineSyncSettingsService } from './services/offline-sync-settings.service';
import { SettingsHistoryService } from './services/settings-history.service';
import { AdministrativeSealsService } from './services/administrative-seals.service';
import { ElectronicSignaturesService } from './services/electronic-signatures.service';
import { SealGenerationService } from './services/seal-generation.service';
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
import { DatabaseModule } from '../database/database.module';
import { OrionModule } from '../orion/orion.module';
import { TenantFeaturesModule } from '../tenant-features/tenant-features.module';
import { PermissionGuard } from '../common/guards/permission.guard';

/**
 * Module Paramètres — Centre de contrôle stratégique d'Academia Helm
 * 
 * Ce module centralise toutes les configurations de l'application :
 * - Paramètres généraux & identité
 * - Structure pédagogique (niveaux, cycles, séries)
 * - Option bilingue
 * - Feature flags (modules & fonctionnalités)
 * - Communication (SMS, Email, WhatsApp)
 * - Années scolaires
 * - Rôles & permissions
 * - Paramètres de sécurité & conformité
 * - Paramètres ORION (IA de pilotage)
 * - Paramètres ATLAS (Chatbot IA)
 * - Paramètres de synchronisation offline
 * - Cachets administratifs & signatures électroniques
 * - Historique & audit
 */
@Module({
  imports: [DatabaseModule, OrionModule, TenantFeaturesModule],
  controllers: [SettingsController],
  providers: [
    PermissionGuard,
    GeneralSettingsService,
    PedagogicalStructureService,
    BilingualSettingsService,
    FeatureFlagsService,
    CommunicationSettingsService,
    AcademicYearSettingsService,
    AcademicPeriodSettingsService,
    EducationStructureService,
    RolesPermissionsService,
    RolesPermissionsBootstrapService,
    BillingSettingsService,
    IdentityProfileService,
    SecuritySettingsService,
    OrionSettingsService,
    AtlasSettingsService,
    OfflineSyncSettingsService,
    SettingsHistoryService,
    AdministrativeSealsService,
    ElectronicSignaturesService,
    SealGenerationService,
  ],
  exports: [
    RolesPermissionsBootstrapService,
    GeneralSettingsService,
    PedagogicalStructureService,
    BilingualSettingsService,
    FeatureFlagsService,
    CommunicationSettingsService,
    AcademicYearSettingsService,
    AcademicPeriodSettingsService,
    EducationStructureService,
    RolesPermissionsService,
    BillingSettingsService,
    IdentityProfileService,
    SecuritySettingsService,
    OrionSettingsService,
    AtlasSettingsService,
    OfflineSyncSettingsService,
    SettingsHistoryService,
    AdministrativeSealsService,
    ElectronicSignaturesService,
    SealGenerationService,
  ],
})
export class SettingsModule {}

