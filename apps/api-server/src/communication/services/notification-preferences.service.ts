/**
 * ============================================================================
 * HELM CONNECT V2.3 — Notification Preferences Service
 * ============================================================================
 *
 * Gère les préférences de notification d'un utilisateur :
 *   - Mode silencieux global (DND) avec expiration (1h, 8h, 24h, jusqu'à réactivation)
 *   - Filtres par type d'événement (messages, annonces, mentions, fichiers)
 *   - Plages horaires "quiet hours" (ex: pas de notifications 22h–07h)
 *   - Mode silencieux par conversation (surdiner une conv spécifique)
 *
 * ⭐ Logique d'évaluation :
 *   shouldNotifyUser(userId, eventType, conversationId?) → boolean
 *   Retourne TRUE si une notification push doit être envoyée.
 *
 * ⭐ Intégration :
 *   - Le ChatGateway (Socket.io) appelle shouldNotifyUser() avant d'envoyer
 *     un push au destinataire.
 *   - Le service push (push-notification.service.ts) appelle shouldNotifyUser()
 *     pour filtrer les notifications.
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

export type EventType = 'MESSAGE' | 'GROUP_MESSAGE' | 'ANNOUNCEMENT' | 'MENTION' | 'FILE' | 'INVITATION' | 'REACTION';
export type MuteDuration = '1H' | '8H' | '24H' | 'FOREVER';

const MUTE_DURATIONS_MS: Record<MuteDuration, number | null> = {
  '1H': 60 * 60 * 1000,
  '8H': 8 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  'FOREVER': null,
};

export interface NotificationPreferences {
  userId: string;
  dndEnabled: boolean;
  dndUntil?: Date | null;
  dndExceptions: string[];          // EventTypes that bypass DND
  enableMessages: boolean;
  enableGroupMessages: boolean;
  enableAnnouncements: boolean;
  enableMentions: boolean;
  enableFiles: boolean;
  enableInvitations: boolean;
  quietHoursStart?: string | null;  // "22:00"
  quietHoursEnd?: string | null;    // "07:00"
  timezone: string;
}

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  GET — Get user's preferences (auto-create if not exist)
  // ═════════════════════════════════════════════════════════════════
  async getPreferences(userId: string, tenantId: string): Promise<NotificationPreferences> {
    let rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "chat_notification_preferences" WHERE "userId" = $1
    `, userId);
    if (rows.length === 0) {
      // Auto-create with defaults
      const id = randomUUID();
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_notification_preferences"
          ("id", "userId", "tenantId", "dndEnabled", "dndUntil", "dndExceptions",
           "enableMessages", "enableGroupMessages", "enableAnnouncements",
           "enableMentions", "enableFiles", "enableInvitations",
           "quietHoursStart", "quietHoursEnd", "timezone", "createdAt", "updatedAt")
        VALUES
          ($1, $2, $3, FALSE, NULL, '[]'::jsonb,
           TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
           NULL, NULL, 'UTC', NOW(), NOW())
      `, id, userId, tenantId);
      rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "chat_notification_preferences" WHERE "userId" = $1
      `, userId);
    }
    const r = rows[0];
    return {
      userId: r.userId,
      dndEnabled: r.dndEnabled,
      dndUntil: r.dndUntil,
      dndExceptions: typeof r.dndExceptions === 'string' ? JSON.parse(r.dndExceptions) : (r.dndExceptions || []),
      enableMessages: r.enableMessages,
      enableGroupMessages: r.enableGroupMessages,
      enableAnnouncements: r.enableAnnouncements,
      enableMentions: r.enableMentions,
      enableFiles: r.enableFiles,
      enableInvitations: r.enableInvitations,
      quietHoursStart: r.quietHoursStart,
      quietHoursEnd: r.quietHoursEnd,
      timezone: r.timezone,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  UPDATE — Update preferences
  // ═════════════════════════════════════════════════════════════════
  async updatePreferences(
    userId: string,
    tenantId: string,
    updates: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    // Ensure record exists
    await this.getPreferences(userId, tenantId);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const setIfDefined = (col: string, val: any) => {
      if (val !== undefined) {
        fields.push(`"${col}" = $${paramIdx++}`);
        values.push(val);
      }
    };

    setIfDefined('dndEnabled', updates.dndEnabled);
    setIfDefined('dndUntil', updates.dndUntil);
    setIfDefined('dndExceptions', updates.dndExceptions ? JSON.stringify(updates.dndExceptions) : undefined);
    setIfDefined('enableMessages', updates.enableMessages);
    setIfDefined('enableGroupMessages', updates.enableGroupMessages);
    setIfDefined('enableAnnouncements', updates.enableAnnouncements);
    setIfDefined('enableMentions', updates.enableMentions);
    setIfDefined('enableFiles', updates.enableFiles);
    setIfDefined('enableInvitations', updates.enableInvitations);
    setIfDefined('quietHoursStart', updates.quietHoursStart);
    setIfDefined('quietHoursEnd', updates.quietHoursEnd);
    setIfDefined('timezone', updates.timezone);

    if (fields.length > 0) {
      fields.push('"updatedAt" = NOW()');
      values.push(userId);
      await this.prisma.$executeRawUnsafe(`
        UPDATE "chat_notification_preferences"
        SET ${fields.join(', ')}
        WHERE "userId" = $${paramIdx}
      `, ...values);
    }

    return this.getPreferences(userId, tenantId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ENABLE DND — Enable Do Not Disturb mode for a duration
  // ═════════════════════════════════════════════════════════════════
  async enableDnd(
    userId: string,
    tenantId: string,
    duration: MuteDuration,
    exceptions: string[] = ['ANNOUNCEMENT'],
  ): Promise<NotificationPreferences> {
    const ms = MUTE_DURATIONS_MS[duration];
    const dndUntil = ms ? new Date(Date.now() + ms) : null;
    return this.updatePreferences(userId, tenantId, {
      dndEnabled: true,
      dndUntil: dndUntil,
      dndExceptions: exceptions,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  DISABLE DND — Disable Do Not Disturb
  // ═════════════════════════════════════════════════════════════════
  async disableDnd(userId: string, tenantId: string): Promise<NotificationPreferences> {
    return this.updatePreferences(userId, tenantId, {
      dndEnabled: false,
      dndUntil: null,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  MUTE CONVERSATION — Mute a specific conversation
  // ═════════════════════════════════════════════════════════════════
  async muteConversation(
    userId: string,
    tenantId: string,
    conversationId: string,
    duration: MuteDuration,
  ): Promise<{ success: boolean; mutedUntil: Date | null }> {
    const ms = MUTE_DURATIONS_MS[duration];
    const mutedUntil = ms ? new Date(Date.now() + ms) : null;

    // Upsert (meme pattern as markAsRead)
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_conversation_mutes"
        ("id", "userId", "conversationId", "tenantId", "mutedUntil", "mutedAt")
      VALUES
        ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT ("userId", "conversationId")
      DO UPDATE SET "mutedUntil" = EXCLUDED."mutedUntil", "mutedAt" = NOW()
    `, id, userId, conversationId, tenantId, mutedUntil);

    return { success: true, mutedUntil };
  }

  // ═════════════════════════════════════════════════════════════════
  //  UNMUTE CONVERSATION
  // ═════════════════════════════════════════════════════════════════
  async unmuteConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_conversation_mutes"
      SET "mutedUntil" = NOW() - INTERVAL '1 second'
      WHERE "userId" = $1 AND "conversationId" = $2
    `, userId, conversationId);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  EVALUATE — Should the user receive a notification for this event?
  //    This is the CORE decision function called by PushNotificationService.
  // ═════════════════════════════════════════════════════════════════
  async shouldNotifyUser(
    userId: string,
    tenantId: string,
    eventType: EventType,
    conversationId?: string,
  ): Promise<{ shouldNotify: boolean; reason: string }> {
    let prefs: NotificationPreferences;
    try {
      prefs = await this.getPreferences(userId, tenantId);
    } catch (e: any) {
      // If preferences can't be loaded, default to "yes notify" (fail-safe)
      return { shouldNotify: true, reason: 'Default (prefs not loaded)' };
    }

    // 1. Check if event type is globally enabled
    const eventTypeEnabled: Record<EventType, boolean> = {
      MESSAGE: prefs.enableMessages,
      GROUP_MESSAGE: prefs.enableGroupMessages,
      ANNOUNCEMENT: prefs.enableAnnouncements,
      MENTION: prefs.enableMentions,
      FILE: prefs.enableFiles,
      INVITATION: prefs.enableInvitations,
      REACTION: prefs.enableMessages,  // Reactions use same flag as messages
    };

    if (!eventTypeEnabled[eventType]) {
      return { shouldNotify: false, reason: `Event type ${eventType} disabled` };
    }

    // 2. Check DND (Do Not Disturb)
    if (prefs.dndEnabled) {
      const now = new Date();
      const stillInDnd = !prefs.dndUntil || new Date(prefs.dndUntil) > now;
      if (stillInDnd) {
        // Check if this event type is in the exceptions list
        if (prefs.dndExceptions.includes(eventType)) {
          // Bypass DND
          return { shouldNotify: true, reason: 'DND exception' };
        }
        return { shouldNotify: false, reason: 'DND active' };
      } else {
        // DND expired — auto-clear it
        await this.disableDnd(userId, tenantId);
      }
    }

    // 3. Check quiet hours (e.g., 22:00–07:00)
    if (prefs.quietHoursStart && prefs.quietHoursEnd) {
      const now = new Date();
      const localHour = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: prefs.timezone || 'UTC',
      });
      const start = prefs.quietHoursStart;
      const end = prefs.quietHoursEnd;
      // Handle overnight wrap (e.g., 22:00 → 07:00)
      const inQuietHours = start < end
        ? (localHour >= start && localHour < end)
        : (localHour >= start || localHour < end);
      if (inQuietHours && !prefs.dndExceptions.includes(eventType)) {
        return { shouldNotify: false, reason: `Quiet hours (${start}–${end})` };
      }
    }

    // 4. Check per-conversation mute
    if (conversationId) {
      const mutes: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "mutedUntil" FROM "chat_conversation_mutes"
        WHERE "userId" = $1 AND "conversationId" = $2
      `, userId, conversationId);
      if (mutes.length > 0) {
        const mutedUntil = mutes[0].mutedUntil ? new Date(mutes[0].mutedUntil) : null;
        if (mutedUntil === null || mutedUntil > new Date()) {
          return { shouldNotify: false, reason: 'Conversation muted' };
        }
      }
    }

    return { shouldNotify: true, reason: 'OK' };
  }

  // ═════════════════════════════════════════════════════════════════
  //  GET MUTED CONVERSATIONS — List conversations muted by a user
  // ═════════════════════════════════════════════════════════════════
  async getMutedConversations(userId: string): Promise<Array<{
    conversationId: string;
    mutedUntil: Date | null;
    mutedAt: Date;
  }>> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "conversationId", "mutedUntil", "mutedAt"
      FROM "chat_conversation_mutes"
      WHERE "userId" = $1
        AND ("mutedUntil" IS NULL OR "mutedUntil" > NOW())
      ORDER BY "mutedAt" DESC
    `, userId);
    return rows.map(r => ({
      conversationId: r.conversationId,
      mutedUntil: r.mutedUntil,
      mutedAt: r.mutedAt,
    }));
  }
}
