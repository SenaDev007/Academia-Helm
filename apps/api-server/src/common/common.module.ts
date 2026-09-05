/**
 * ============================================================================
 * COMMON MODULE - SERVICES ET GUARDS COMMUNS
 * ============================================================================
 */

import { Module, Global, Controller } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { PermissionsService } from './services/permissions.service';
import { DashboardService } from './services/dashboard.service';
import { AccessDeniedLogService } from './services/access-denied-log.service';
import { SubdomainService } from './services/subdomain.service';
import { PuppeteerPoolService } from './services/puppeteer-pool.service';
import { DomainManagementService } from './services/domain-management.service';
import { CredentialEncryptionService } from './services/credential-encryption.service';
import { StorageService } from './services/storage.service';
import { PermissionsController } from './controllers/permissions.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { OpenRouterModule } from './services/openrouter.module';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../security/security.module';
import { AdminStructureService } from '../admin-structure/admin-structure.service';
import { MatriculeGeneratorService } from './services/matricule-generator.service';
import { ModelEnsembleService } from './services/model-ensemble.service';
import { AccessScopeService } from './context/access-scope.service';

@Global()
@Module({
  imports: [
    DatabaseModule, // Pour accéder à PrismaService
    SecurityModule, // Pour accéder à PlatformOwnerService
    OpenRouterModule, // Pour accéder à OpenRouterService (IA partagée)
  ],
  controllers: [PermissionsController, DashboardController],
  providers: [
    CacheService,
    PermissionsService,
    DashboardService,
    AccessDeniedLogService,
    SubdomainService,
    PuppeteerPoolService,
    DomainManagementService,
    CredentialEncryptionService,
    StorageService, // ✅ Singleton global — évite 4 instances de S3Client
    AdminStructureService, // Pour LevelScopeGuard
    MatriculeGeneratorService,
    ModelEnsembleService, // ⭐ Multi-modèle IA (GLM 5.2 + MiniMax-M3 + GPT-OSS-120B)
    AccessScopeService, // ⭐ Filtre Rôles × Pistes × Niveaux — résolution du périmètre serveur
  ],
  exports: [
    CacheService,
    PermissionsService,
    DashboardService,
    AccessDeniedLogService,
    SubdomainService,
    PuppeteerPoolService,
    DomainManagementService,
    CredentialEncryptionService,
    StorageService, // ✅ Exporté pour tous les feature modules
    OpenRouterModule,
    AdminStructureService, // Pour LevelScopeGuard dans autres modules
    MatriculeGeneratorService,
    ModelEnsembleService, // ⭐ Exporté pour que tous les agents puissent l'utiliser
    AccessScopeService, // ⭐ Exporté pour JwtStrategy + guards + services métier
  ],
})
export class CommonModule {}
