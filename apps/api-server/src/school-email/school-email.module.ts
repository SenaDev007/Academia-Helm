/**
 * ============================================================================
 * 📧 TÂCHE 181 — MODULE E-MAIL ÉCOLE (service central d'envoi)
 * ============================================================================
 *
 * DOSSIER DU SERVICE CENTRAL au sens du cahier des charges (section 9.4) :
 * Resend et Nodemailer ne peuvent être importés QUE depuis ce dossier
 * (règle ESLint no-restricted-imports — voir .eslintrc.js de l'api-server).
 *
 * @Global() : les modules applicatifs (Communication, RH, Finance, Examen,
 * Pédagogie, Élèves…) injectent CentralEmailService sans import de module.
 *
 * ⭐ Pattern anti-circular-dependency (même approche que CommunicationModule
 * avec setEmailLogService) : ce module importe CommunicationModule (pour le
 * transport plateforme Resend des e-mails système) et PUSSE CentralEmailService
 * dans EmailService via un setter au démarrage. CommunicationModule ignore
 * totalement school-email → aucun cycle.
 *
 * NB : PrismaService n'est PAS redéclaré ici (DatabaseModule est @Global —
 * chaque instance chargerait un client 536 modèles + un Pool pg).
 * ============================================================================
 */

import { Global, Module, OnModuleInit } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { SettingsModule } from '../settings/settings.module';
import { EmailService as PlatformEmailService } from '../communication/services/email.service';
import { EmailCryptoService } from './email-crypto.service';
import { SchoolEmailSettingsService } from './school-email-settings.service';
import { CentralEmailService } from './central-email.service';
import { EmailQueueDispatcherService } from './email-queue-dispatcher.service';
import { GoogleOauthService } from './google-oauth.service';
import { EmailBrandingService } from './email-branding.service';
import { SchoolEmailController } from './school-email.controller';

@Global()
@Module({
  // ⭐ SettingsModule : fournit RolesPermissionsService + FeatureFlagsService
  //    au PermissionGuard de SchoolEmailController (pattern identique à
  //    pedagogy/finance/exams/teacher-portal). Sans cet import, Nest ne peut
  //    pas résoudre le guard → crash au démarrage (boucle Railway 24/11).
  imports: [CommunicationModule, SettingsModule],
  controllers: [SchoolEmailController],
  providers: [
    EmailCryptoService,
    SchoolEmailSettingsService,
    CentralEmailService,
    EmailQueueDispatcherService,
    // ⭐ TÂCHE 183 (Phase 2) — Google OAuth2 PKCE + API Gmail (gmail.send).
    //    CacheService (CommonModule @Global) porte les states OAuth (TTL 10 min).
    GoogleOauthService,
    // ⭐ Branding école — logo en-tête/pied + coordonnées sur tous les envois.
    EmailBrandingService,
  ],
  exports: [
    EmailCryptoService,
    SchoolEmailSettingsService,
    CentralEmailService,
    EmailQueueDispatcherService,
    GoogleOauthService,
    EmailBrandingService,
  ],
})
export class SchoolEmailModule implements OnModuleInit {
  constructor(
    private readonly centralEmailService: CentralEmailService,
    private readonly platformEmailService: PlatformEmailService,
  ) {}

  /** ⭐ Bridge tâche 181 : EmailService (Communication) route via le central. */
  onModuleInit() {
    this.platformEmailService.setCentralEmailService(this.centralEmailService);
  }
}
