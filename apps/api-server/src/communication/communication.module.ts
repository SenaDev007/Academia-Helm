/**
 * ============================================================================
 * COMMUNICATION MODULE
 * ============================================================================
 * 
 * Module pour les services de communication (Email, WhatsApp, SMS)
 * + Traçabilité catégorisée (EmailLogService) + Inbound (Volet 2)
 * 
 * ============================================================================
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ParentProvisioningModule } from '../students/parent-provisioning.module';
import { EmailService } from './services/email.service';
import { EmailLogService } from './services/email-log.service';
import { InboundEmailService } from './services/inbound-email.service';
import { EmailTrackingService } from './services/email-tracking.service';
import { WhatsAppService } from './services/whatsapp.service';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import { WhatsAppTemplateRegistry } from './services/whatsapp-template.registry';
import { SmsService } from './services/sms.service';
import { VoiceService } from './services/voice.service';
import { CommunicationDashboardService } from './services/communication-dashboard.service';
import { InternalMessagingService } from './services/internal-messaging.service';
import { AnnouncementsServiceV2 } from './services/announcements.service';
import { TemplateService } from './services/template.service';
import { CommunicationOrionService } from './services/communication-orion.service';
import { CommunicationSaraService } from './services/communication-sara.service';
import { ScheduledEmailService } from './services/scheduled-email.service';
import { ScheduledEmailDispatcherService } from './services/scheduled-email-dispatcher.service';
// ⭐ V6 (spec §4/§6) — Canaux officiels automatiques + bootstrap périodique
import { AutoChannelService } from './services/auto-channel.service';
import { HelmConnectBootstrapService } from './services/helm-connect-bootstrap.service';
import { CommunicationV2Controller } from './communication-v2.controller';
import { CommunicationPrismaController } from './communication-prisma.controller';
import { CommunicationPrismaService } from './communication-prisma.service';
import { MessagesPrismaController } from './messages-prisma.controller';
import { MessagesPrismaService } from './messages-prisma.service';
import { SchedulingPrismaController } from './scheduling-prisma.controller';
import { SchedulingPrismaService } from './scheduling-prisma.service';
import { AutomationPrismaController } from './automation-prisma.controller';
import { AutomationPrismaService } from './automation-prisma.service';
import { TemplatesPrismaController } from './templates-prisma.controller';
import { TemplatesPrismaService } from './templates-prisma.service';
import { EmailLogController } from './email-log.controller';
import { WhatsAppLogController } from './whatsapp-log.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { ScheduledEmailController } from './scheduled-email.controller';
import { DatabaseModule } from '../database/database.module';
import { ChatService } from './services/chat.service';
import { ChatController } from './chat.controller';
import { FileServingController } from './file-serving.controller';
import { ChatGateway } from './chat.gateway';
import { PushNotificationService } from './services/push-notification.service';
import { AnnouncementService } from './services/announcement.service';
import { AnnouncementController } from './announcement.controller';
import { DynamicGroupService } from './services/dynamic-group.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { ScheduledAnnouncementDispatcher } from './services/scheduled-announcement-dispatcher';
import { HelmConnectV2Controller } from './helm-connect-v2.controller';
import { GlobalSearchService } from './services/global-search.service';
import { ConversationDocumentCenterService } from './services/document-center.service';
import { PollService } from './services/poll.service';
import { PollController } from './poll.controller';
import { HelmConnectNotificationBridgeService } from './services/helm-connect-bridge.service';
// ⭐ V3-3: ORION-powered chat conversation summaries
import { ChatSummaryService } from './services/chat-summary.service';
// ⭐ V3-2: Whisper-powered audio transcriptions
import { ChatTranscriptionService } from './services/chat-transcription.service';
// ⭐ V3-11: Auto-groups (Communautés) auto-creation per academic year
import { AutoGroupService } from './services/auto-group.service';
// ⭐ LiveKit SFU — Discord-style voice/stage/live channels
import { LiveKitTokenService } from './services/livekit-token.service';
// ⭐ V4 — Chaîne média des appels (LiveKit → Agora → Daily) + signalisation
import { CallSignalController } from './call-signal.controller';
import { CallSignalService } from './services/call-signal.service';
import { CallProviderChainService } from './services/call-provider-chain.service';
// ⭐ 2026-10-14 — P2P WebRTC fallback 1-à-1 (porté de Yeshua Connect)
//    Quand la chaîne média LiveKit/Agora/Daily échoue, signalisation HTTP
//    via /chat/calls/webrtc pour s'échanger offer/answer/ice entre les 2 navigateurs.
import { P2PWebrtcController } from './p2p-webrtc.controller';
import { P2PWebrtcSignalService } from './services/p2p-webrtc-signal.service';
// ⭐ 2026-10-15 — Canaux par piste FR/EN (administration, pédagogique, conseil par niveau)
import { AutoChannelByTrackService } from './services/auto-channel-by-track.service';
// ⭐ 2026-10-15 — DMs automatiques (parent↔enseignant, enseignant↔collègue, promoteur↔tous)
import { AutoDmService } from './services/auto-dm.service';
// ⭐ V4 — Fichiers transverses (sections Fichiers/Vocaux/Appels)
import { FilesCenterService } from './services/files-center.service';
// ⭐ V5 (chantier 1) — Blocage d'utilisateurs (parité Yeshua blocks)
import { ChatBlockService } from './services/chat-block.service';
// ⭐ V5 (chantier 2) — Matrice « qui contacte qui » (politique par tenant)
import { CommunicationPermissionsService } from './services/communication-permissions.service';
// ⭐ V5 (chantier 5) — Antivirus optionnel des uploads (VirusTotal/ClamAV)
import { FileScannerService } from './services/file-scanner.service';
// ⭐ V5 (chantier 8) — ATLAS dans le chat (question + contexte utilisateur)
import { ChatAtlasService } from './services/chat-atlas.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    // ⭐ ParentProvisioningModule provides ParentUserProvisioningService (auto-
    //    creates User accounts for guardians). Imported here INSTEAD of
    //    StudentsModule to avoid the circular dependency
    //    (CommunicationModule ↔ StudentsModule).
    ParentProvisioningModule,
    // ⭐ JwtModule pour ChatGateway (vérification du JWT lors du handshake Socket.io)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    CommunicationV2Controller,
    CommunicationPrismaController,
    MessagesPrismaController,
    SchedulingPrismaController,
    AutomationPrismaController,
    TemplatesPrismaController,
    EmailLogController,
    WhatsAppLogController,
    WhatsAppWebhookController,
    ScheduledEmailController,
    // ⭐ Chat (messagerie interne type WhatsApp)
    ChatController,
    // ⭐ Chat — File serving controller (streams public/* files via NestJS route
    //    to bypass the express.static not being invoked issue). See file-serving.controller.ts.
    FileServingController,
    // ⭐ Helm Connect — Annonces officielles V1
    AnnouncementController,
    // ⭐ Helm Connect V2 — Dynamic Groups + Notifications + Scheduled Announcements
    HelmConnectV2Controller,
    // ⭐ Helm Connect V2.6 — Polls (Telegram-style)
    PollController,
    // ⭐ V4 — Signalisation + arbitrage média des appels (porté de Yeshua Connect)
    CallSignalController,
    // ⭐ 2026-10-14 — P2P WebRTC fallback 1-à-1 (porté de Yeshua Connect)
    P2PWebrtcController,
  ],
  providers: [
    EmailService,
    EmailLogService,
    InboundEmailService,
    EmailTrackingService,
    WhatsAppService,
    WhatsAppLogService,
    WhatsAppTemplateRegistry,
    SmsService,
    VoiceService,
    CommunicationDashboardService,
    InternalMessagingService,
    AnnouncementsServiceV2,
    TemplateService,
    CommunicationOrionService,
    CommunicationSaraService,
    // Scheduled emails (programmation d'envoi à date/heure précise)
    ScheduledEmailService,
    ScheduledEmailDispatcherService,
    // Prisma CRUD services
    CommunicationPrismaService,
    MessagesPrismaService,
    SchedulingPrismaService,
    AutomationPrismaService,
    TemplatesPrismaService,
    // ⭐ Chat (messagerie interne type WhatsApp)
    ChatService,
    ChatGateway,
    PushNotificationService,
    // ⭐ Helm Connect — Annonces officielles V1
    AnnouncementService,
    // ⭐ Helm Connect V2 — Dynamic Groups + Notifications + Scheduled Announcements
    DynamicGroupService,
    NotificationPreferencesService,
    ScheduledAnnouncementDispatcher,
    // ⭐ Helm Connect V2.4 — Global Search
    GlobalSearchService,
    // ⭐ Helm Connect V2.5 — Conversation Document Center
    ConversationDocumentCenterService,
    // ⭐ Helm Connect V2.6 — Polls
    PollService,
    // ⭐ V3-4 — Helm Connect Notification Bridge (Examens/Absences/Discipline → Helm Connect)
    HelmConnectNotificationBridgeService,
    // ⭐ V3-3 — ORION-powered chat conversation summaries
    ChatSummaryService,
    // ⭐ V3-2 — Whisper-powered audio transcriptions
    ChatTranscriptionService,
    // ⭐ V3-11 — Auto-groups (Communautés) auto-creation per academic year
    AutoGroupService,
    // ⭐ LiveKit SFU — Discord-style voice/stage/live channels (token minting)
    LiveKitTokenService,
    // ⭐ V4 — Chaîne média des appels (LiveKit → Agora → Daily, santé partagée,
    //    arbitrage persisté par appel/canal) + signalisation (ringing/accept/…)
    CallProviderChainService,
    CallSignalService,
    // ⭐ 2026-10-14 — P2P WebRTC fallback 1-à-1 (porté de Yeshua Connect)
    P2PWebrtcSignalService,
    // ⭐ 2026-10-15 — Canaux par piste FR/EN (administration, pédagogique, conseil par niveau)
    AutoChannelByTrackService,
    // ⭐ 2026-10-15 — DMs automatiques (parent↔enseignant, enseignant↔collègue, promoteur↔tous)
    AutoDmService,
    FilesCenterService,
    // ⭐ V5 — Blocage d'utilisateurs + matrice de contact + antivirus + ATLAS chat
    ChatBlockService,
    CommunicationPermissionsService,
    FileScannerService,
    ChatAtlasService,
    // ⭐ V6 (spec §4/§6) — Canaux officiels automatiques + bootstrap périodique
    AutoChannelService,
    HelmConnectBootstrapService,
  ],
  exports: [
    EmailService,
    EmailLogService,
    InboundEmailService,
    EmailTrackingService,
    WhatsAppService,
    WhatsAppLogService,
    WhatsAppTemplateRegistry,
    SmsService,
    VoiceService,
    CommunicationDashboardService,
    InternalMessagingService,
    AnnouncementsServiceV2,
    TemplateService,
    CommunicationOrionService,
    CommunicationSaraService,
    ScheduledEmailService,
    CommunicationPrismaService,
    MessagesPrismaService,
    SchedulingPrismaService,
    AutomationPrismaService,
    TemplatesPrismaService,
    // ⭐ Chat exports
    ChatService,
    // ⭐ V3-4 — Bridge pour notifications multi-canal depuis Examens/Absences/Discipline
    HelmConnectNotificationBridgeService,
    // ⭐ V3-3 — Chat summary service (exposed for ChatController)
    ChatSummaryService,
    // ⭐ V3-2 — Chat transcription service (exposed for ChatController)
    ChatTranscriptionService,
    // ⭐ V3-11 — Auto-groups service (Communautés)
    AutoGroupService,
    // ⭐ V6 — Bootstrap Helm Connect (canaux + groupes auto) — utilisé par
    //    l'onboarding via injection directe du module
    HelmConnectBootstrapService,
    AutoChannelService,
  ],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailLogService: EmailLogService,
    private readonly emailTrackingService: EmailTrackingService,
    private readonly whatsappService: WhatsAppService,
    private readonly whatsappLogService: WhatsAppLogService,
  ) {}

  /**
   * Injecte EmailLogService + EmailTrackingService dans EmailService pour
   * éviter la circular dependency. EmailService peut alors appeler
   * emailLogService.createLog() et emailTrackingService.injectTracking()
   * sans dépendre statiquement d'eux.
   *
   * De même, injecte WhatsAppLogService dans WhatsAppService pour la
   * traçabilité des messages WhatsApp (mirror du pattern email).
   */
  onModuleInit() {
    this.emailService.setEmailLogService(this.emailLogService);
    this.emailService.setEmailTrackingService(this.emailTrackingService);
    this.whatsappService.setWhatsAppLogService(this.whatsappLogService);
  }
}
