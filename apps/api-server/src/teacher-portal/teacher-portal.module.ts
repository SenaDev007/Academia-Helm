/**
 * ============================================================================
 * HELM ENSEIGNANT — MODULE DU PORTAIL ENSEIGNANT AUTONOME
 * ============================================================================
 *
 * Mini-SaaS intégré à Academia Helm. L'enseignant est son propre tenant
 * (`type: 'TEACHER'`) : il s'inscrit avec son email, active ses niveaux
 * (maternelle / primaire / secondaire) et reçoit toutes les classes et
 * matières du niveau — l'espace pédagogique existant fonctionne alors sans
 * modification (tenantId + academicYearId + teacherId).
 *
 * Dépendances :
 *   - SettingsModule    → EducationStructureService (référentiel officiel)
 *   - PedagogyModule    → AcademicStructurePrismaService (classes)
 *                          SubjectsPrismaService (matières)
 *   - CommonModule (global) → SubdomainService, AccessScopeService
 *   - DatabaseModule (global) → PrismaService
 *   - PortalModule     → PortalSessionService (sessions de portail)
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SettingsModule } from '../settings/settings.module';
import { PedagogyModule } from '../pedagogy/pedagogy.module';
import { PortalModule } from '../portal/portal.module';
import { BillingModule } from '../billing/billing.module';
import { CommunicationModule } from '../communication/communication.module';
import { TeacherProvisioningService } from './services/teacher-provisioning.service';
import { TeacherPortalAuthService } from './services/teacher-portal-auth.service';
import { TeacherSubscriptionService } from './services/teacher-subscription.service';
import { TeacherPortalController } from './controllers/teacher-portal.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    SettingsModule,
    PedagogyModule,
    PortalModule,
    // ⭐ Abonnement 2 000 FCFA/mois — même widget FedaPay que le patronat :
    //    FedaPayService (transactions + webhooks) + EmailService (rappels).
    BillingModule,
    CommunicationModule,
  ],
  providers: [PrismaService, TeacherProvisioningService, TeacherPortalAuthService, TeacherSubscriptionService],
  controllers: [TeacherPortalController],
  exports: [TeacherProvisioningService, TeacherPortalAuthService, TeacherSubscriptionService],
})
export class TeacherPortalModule {}
