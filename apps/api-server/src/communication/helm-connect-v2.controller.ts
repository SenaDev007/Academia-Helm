/**
 * ============================================================================
 * HELM CONNECT V2 — Controller (Dynamic Groups + Notifications + Scheduled Announcements)
 * ============================================================================
 *
 * Endpoints REST pour V2.
 *
 *   Dynamic Groups :
 *     GET    /chat/v2/dynamic-groups                              — list
 *     POST   /chat/v2/dynamic-groups                              — create
 *     GET    /chat/v2/dynamic-groups/:id                          — details
 *     POST   /chat/v2/dynamic-groups/:id/sync                     — re-sync members
 *     POST   /chat/v2/dynamic-groups/sync-all                     — re-sync all (admin/cron)
 *
 *   Notification Preferences :
 *     GET    /chat/v2/notifications/preferences                   — get my prefs
 *     PUT    /chat/v2/notifications/preferences                   — update prefs
 *     POST   /chat/v2/notifications/dnd/enable                     — enable DND (1H/8H/24H/FOREVER)
 *     POST   /chat/v2/notifications/dnd/disable                   — disable DND
 *     POST   /chat/v2/notifications/conversations/:id/mute        — mute conversation
 *     POST   /chat/v2/notifications/conversations/:id/unmute      — unmute conversation
 *     GET    /chat/v2/notifications/muted-conversations           — list muted
 *     GET    /chat/v2/notifications/should-notify?eventType=X&conversationId=Y  — debug
 *
 *   Scheduled Announcements :
 *     POST   /chat/v2/announcements/dispatch                      — run dispatcher (admin/cron)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DynamicGroupService, DynamicGroupSourceType } from './services/dynamic-group.service';
import { NotificationPreferencesService, MuteDuration, EventType } from './services/notification-preferences.service';
import { ScheduledAnnouncementDispatcher } from './services/scheduled-announcement-dispatcher';
import { GlobalSearchService, SearchType } from './services/global-search.service';
import { ConversationDocumentCenterService } from './services/document-center.service';
// ⭐ V4 — Fichiers transverses + historique d'appels global
import { FilesCenterService } from './services/files-center.service';
import { CallSignalService } from './services/call-signal.service';
// ⭐ V5 (chantier 2) — Matrice « qui contacte qui » (politique par tenant)
import { CommunicationPermissionsService } from './services/communication-permissions.service';
// ⭐ V5 (chantier 8) — ATLAS dans le chat
import { ChatAtlasService } from './services/chat-atlas.service';
// ⭐ V6 (spec §8) — SARA (rédaction assistée) : le service était enregistré
//    dans le module mais AUCUN contrôleur ne l'exposait → inaccessible.
import { CommunicationSaraService } from './services/communication-sara.service';

/** Rôles autorisés à modifier la politique de contact du tenant. */
const POLICY_ADMIN_ROLES = new Set([
  'ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'PROMOTER', 'PROMOTEUR',
  'DIRECTOR', 'DIRECTEUR', 'DIRECTOR_GENERAL', 'DIRECTEUR_GENERAL',
  'SCHOOL_DIRECTOR', 'DIRECTEUR_ETABLISSEMENT',
]);

@Controller('chat/v2')
@UseGuards(JwtAuthGuard, TenantGuard)
export class HelmConnectV2Controller {
  constructor(
    private readonly dynamicGroupService: DynamicGroupService,
    private readonly notifPrefsService: NotificationPreferencesService,
    private readonly scheduledDispatcher: ScheduledAnnouncementDispatcher,
    private readonly globalSearchService: GlobalSearchService,
    private readonly documentCenterService: ConversationDocumentCenterService,
    // ⭐ V4 — Fichiers transverses + historique d'appels global
    private readonly filesCenterService: FilesCenterService,
    private readonly callSignalService: CallSignalService,
    // ⭐ V5 (chantier 2) — Matrice « qui contacte qui »
    private readonly permissionsService: CommunicationPermissionsService,
    // ⭐ V5 (chantier 8) — ATLAS dans le chat
    private readonly chatAtlasService: ChatAtlasService,
    // ⭐ V6 (spec §8) — SARA (rédaction assistée)
    private readonly saraService: CommunicationSaraService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  DYNAMIC GROUPS
  // ═════════════════════════════════════════════════════════════════
  @Get('dynamic-groups')
  async listDynamicGroups(
    @TenantId() tenantId: string,
    @Query('sourceType') sourceType?: string,
  ) {
    return this.dynamicGroupService.listDynamicGroups(tenantId, {
      sourceType: sourceType as DynamicGroupSourceType | undefined,
    });
  }

  @Post('dynamic-groups')
  async createDynamicGroup(
    @TenantId() tenantId: string,
    @Body() body: {
      creatorId: string;
      sourceType: DynamicGroupSourceType;
      sourceClassId?: string;
      sourceLevel?: string;
      sourceSubjectId?: string;
      sourceRole?: string;
      academicYearId?: string;
      displayName?: string;
      description?: string;
    },
  ) {
    if (!body.creatorId) throw new BadRequestException('creatorId is required');
    if (!body.sourceType) throw new BadRequestException('sourceType is required');
    return this.dynamicGroupService.createDynamicGroup(tenantId, body.creatorId, {
      sourceType: body.sourceType,
      sourceClassId: body.sourceClassId,
      sourceLevel: body.sourceLevel,
      sourceSubjectId: body.sourceSubjectId,
      sourceRole: body.sourceRole,
      academicYearId: body.academicYearId,
      displayName: body.displayName,
      description: body.description,
    });
  }

  @Get('dynamic-groups/:id')
  async getDynamicGroup(
    @TenantId() tenantId: string,
    @Param('id') groupId: string,
  ) {
    return this.dynamicGroupService.getDynamicGroup(tenantId, groupId);
  }

  @Post('dynamic-groups/:id/sync')
  async syncDynamicGroup(
    @TenantId() tenantId: string,
    @Param('id') groupId: string,
  ) {
    return this.dynamicGroupService.syncDynamicGroup(tenantId, groupId);
  }

  @Post('dynamic-groups/sync-all')
  async syncAllDynamicGroups(@TenantId() tenantId?: string) {
    return this.dynamicGroupService.syncAllDynamicGroups(tenantId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  NOTIFICATION PREFERENCES
  // ═════════════════════════════════════════════════════════════════
  @Get('notifications/preferences')
  async getPreferences(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.getPreferences(userId, tenantId);
  }

  @Put('notifications/preferences')
  async updatePreferences(
    @TenantId() tenantId: string,
    @Body() body: { userId: string } & Partial<{
      dndEnabled: boolean;
      dndUntil: string | null;
      dndExceptions: string[];
      enableMessages: boolean;
      enableGroupMessages: boolean;
      enableAnnouncements: boolean;
      enableMentions: boolean;
      enableFiles: boolean;
      enableInvitations: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      timezone: string;
    }>,
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    const { userId, ...updates } = body;
    return this.notifPrefsService.updatePreferences(userId, tenantId, {
      ...updates,
      dndUntil: body.dndUntil ? new Date(body.dndUntil) : body.dndUntil === null ? null : undefined,
    });
  }

  @Post('notifications/dnd/enable')
  async enableDnd(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; duration: MuteDuration; exceptions?: string[] },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.duration) throw new BadRequestException('duration is required (1H/8H/24H/FOREVER)');
    return this.notifPrefsService.enableDnd(body.userId, tenantId, body.duration, body.exceptions);
  }

  @Post('notifications/dnd/disable')
  async disableDnd(
    @Body() body: { userId: string },
    @TenantId() tenantId: string,
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.disableDnd(body.userId, tenantId);
  }

  @Post('notifications/conversations/:id/mute')
  async muteConversation(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId: string; duration: MuteDuration },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.duration) throw new BadRequestException('duration is required (1H/8H/24H/FOREVER)');
    return this.notifPrefsService.muteConversation(body.userId, tenantId, conversationId, body.duration);
  }

  @Post('notifications/conversations/:id/unmute')
  async unmuteConversation(
    @Param('id') conversationId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.unmuteConversation(body.userId, conversationId);
  }

  @Get('notifications/muted-conversations')
  async getMutedConversations(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.notifPrefsService.getMutedConversations(userId);
  }

  @Get('notifications/should-notify')
  async shouldNotify(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('eventType') eventType: EventType,
    @Query('conversationId') conversationId?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!eventType) throw new BadRequestException('eventType is required');
    return this.notifPrefsService.shouldNotifyUser(userId, tenantId, eventType, conversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  SCHEDULED ANNOUNCEMENTS DISPATCHER
  // ═════════════════════════════════════════════════════════════════
  @Post('announcements/dispatch')
  async dispatchScheduledAnnouncements() {
    return this.scheduledDispatcher.dispatchDueAnnouncements();
  }

  // ═════════════════════════════════════════════════════════════════
  //  V2.4 — GLOBAL SEARCH (recherche transversale)
  // ═════════════════════════════════════════════════════════════════
  /**
   * GET /chat/v2/search?q=...&types=message,person&dateFrom=...&dateTo=...
   *    Returns { messages, people, groups, files, announcements, total }
   *    Each section is limited to 10 items by default (max 50).
   */
  @Get('search')
  async globalSearch(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('q') query: string,
    @Query('types') typesStr?: string,            // comma-separated: message,person,group,file,announcement
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!query) throw new BadRequestException('q (query) is required');
    const types = typesStr
      ? (typesStr.split(',').filter(Boolean) as SearchType[])
      : undefined;
    return this.globalSearchService.globalSearch(tenantId, userId, query, {
      types,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V4 PHASE 2 — FICHIERS TRANSVERSES + HISTORIQUE D'APPELS GLOBAL
  //    (alimente les sections « Fichiers », « Vocaux » et « Appels » du
  //     panneau Helm Connect — toutes conversations confondues)
  // ═════════════════════════════════════════════════════════════════

  /** GET /chat/v2/files?type=media|document|audio|all — centre documentaire global. */
  @Get('files')
  async getUserFiles(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    const validTypes = ['media', 'document', 'audio', 'all'] as const;
    const fileType = validTypes.includes((type || 'all') as any) ? (type || 'all') as typeof validTypes[number] : 'all';
    const files = await this.filesCenterService.getUserFiles(
      tenantId, userId, fileType,
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
    const stats = await this.filesCenterService.getUserFilesStats(tenantId, userId);
    return { files, stats, type: fileType };
  }

  /** ⭐ V6 (spec §22) — GET /chat/v2/links — tous les liens partagés (transverse). */
  @Get('links')
  async getUserLinks(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.filesCenterService.getUserLinks(
      tenantId, userId, limit ? Math.min(parseInt(limit, 10) || 100, 200) : 100,
    );
  }

  /** ⭐ V6 (spec §22) — GET /chat/v2/pinned — tous les messages épinglés (transverse). */
  @Get('pinned')
  async getUserPinned(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.filesCenterService.getUserPinned(
      tenantId, userId, limit ? Math.min(parseInt(limit, 10) || 100, 200) : 100,
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V6 (spec §8) — SARA : assistante de rédaction (avant inaccessible)
  // ═════════════════════════════════════════════════════════════════

  /** POST /chat/v2/sara/draft — rédiger un message à partir d'un contexte. */
  @Post('sara/draft')
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // ⭐ FIX PERF — 'default' non enregistré → throttle inactif
  async saraDraft(
    @Body() body: { intent: string; targetAudience: string; tone?: string; keyPoints?: string[]; language?: string },
  ) {
    if (!body.intent || !body.targetAudience) throw new BadRequestException('intent et targetAudience requis');
    const tones = ['professional', 'friendly', 'urgent', 'empathetic'] as const;
    const tone = tones.includes(body.tone as any) ? body.tone as typeof tones[number] : 'professional';
    return this.saraService.draftMessage({
      intent: body.intent,
      targetAudience: body.targetAudience,
      tone,
      keyPoints: Array.isArray(body.keyPoints) ? body.keyPoints : [],
      language: body.language === 'en' ? 'en' : 'fr',
    });
  }

  /** POST /chat/v2/sara/refine — améliorer un texte existant. */
  @Post('sara/refine')
  @Throttle({ medium: { limit: 30, ttl: 60000 } }) // ⭐ FIX PERF — 'default' non enregistré → throttle inactif
  async saraRefine(
    @Body() body: { content: string; instruction: string },
  ) {
    if (!body.content || !body.instruction) throw new BadRequestException('content et instruction requis');
    return this.saraService.refineContent(body.content, body.instruction);
  }

  /** POST /chat/v2/sara/recommend-channel — canal recommandé pour un message. */
  @Post('sara/recommend-channel')
  async saraRecommendChannel(
    @Body() body: { messageType: string; priority: string },
  ) {
    if (!body.messageType || !body.priority) throw new BadRequestException('messageType et priority requis');
    return this.saraService.recommendChannel(body.messageType, body.priority);
  }

  /** GET /chat/v2/call-history — historique d'appels (toutes conversations). */
  @Get('call-history')
  async getCallHistory(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.callSignalService.getCallHistory(
      tenantId, userId, limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50,
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  V2.5 — CONVERSATION DOCUMENT CENTER
  // ═════════════════════════════════════════════════════════════════
  @Get('conversations/:id/media')
  async listMedia(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.documentCenterService.listMedia(tenantId, userId, conversationId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('conversations/:id/documents')
  async listDocuments(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.documentCenterService.listDocuments(tenantId, userId, conversationId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('conversations/:id/links')
  async listLinks(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.documentCenterService.listLinks(tenantId, userId, conversationId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('conversations/:id/pinned')
  async listPinned(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.documentCenterService.listPinned(tenantId, userId, conversationId);
  }

  @Post('messages/:id/pin')
  async pinMessage(
    @TenantId() tenantId: string,
    @Param('id') messageId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.documentCenterService.pinMessage(tenantId, body.userId, messageId);
  }

  @Post('messages/:id/unpin')
  async unpinMessage(
    @TenantId() tenantId: string,
    @Param('id') messageId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.documentCenterService.unpinMessage(tenantId, body.userId, messageId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 2, spéc école #7/#16) — POLITIQUE DE CONTACT
  //     GET /chat/v2/contact-policy  → lit la politique (défauts sûrs si absente)
  //     PUT /chat/v2/contact-policy  → met à jour (rôles admin/direction)
  // ═════════════════════════════════════════════════════════════════

  @Get('contact-policy')
  async getContactPolicy(@TenantId() tenantId: string) {
    const policy = await this.permissionsService.getPolicy(tenantId);
    return { tenantId, policy };
  }

  @Put('contact-policy')
  async updateContactPolicy(
    @TenantId() tenantId: string,
    @Body() body: {
      allowStudentToTeacher?: boolean;
      allowStudentToParent?: boolean;
      allowParentToTeacher?: boolean;
      restrictStudents?: boolean;
    },
    @CurrentUser() jwtUser: { id?: string; role?: string },
  ) {
    const role = String(jwtUser?.role || '').toUpperCase();
    if (!POLICY_ADMIN_ROLES.has(role)) {
      throw new ForbiddenException('Seuls les administrateurs de l\'établissement peuvent modifier la politique de contact.');
    }
    // Fusion partielle — seules les clés booléennes fournies sont appliquées
    const patch: any = {};
    for (const key of ['allowStudentToTeacher', 'allowStudentToParent', 'allowParentToTeacher', 'restrictStudents']) {
      if (typeof (body as any)[key] === 'boolean') patch[key] = (body as any)[key];
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Au moins un champ de politique est requis (allowStudentToTeacher, allowStudentToParent, allowParentToTeacher, restrictStudents)');
    }
    const policy = await this.permissionsService.setPolicy(tenantId, patch);
    return { tenantId, policy, updatedBy: jwtUser?.id };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 8, spéc #18) — ATLAS DANS LE CHAT
  //     POST /chat/v2/atlas/ask { question, conversationId? }
  //     Contexte STRICTEMENT limité aux données du tenant et de l'utilisateur.
  //     Rate-limit : 10 requêtes/minute (throttler 'medium' surcharge locale).
  // ═════════════════════════════════════════════════════════════════

  @Post('atlas/ask')
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async askAtlas(
    @TenantId() tenantId: string,
    @Body() body: { userId?: string; question: string; conversationId?: string },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    if (!body?.question || !body.question.trim()) {
      throw new BadRequestException('question is required');
    }
    const userId = body.userId || jwtUser?.id;
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatAtlasService.ask(tenantId, userId, body.question, body.conversationId);
  }
}
