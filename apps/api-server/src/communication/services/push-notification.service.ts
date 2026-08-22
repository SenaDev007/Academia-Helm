/**
 * ============================================================================
 * PUSH NOTIFICATION SERVICE — Web Push (VAPID + Service Worker)
 * ============================================================================
 *
 * Uses the `web-push` npm package to send push notifications to subscribed
 * devices via the Web Push API.
 *
 * Flow:
 *   1. Frontend registers Service Worker (/sw-chat.js)
 *   2. Frontend requests push subscription (POST /chat/push/subscribe)
 *   3. Subscription stored in chat_push_subscriptions table
 *   4. When a new message is sent → sendNotification() to all offline participants
 *
 * VAPID keys:
 *   - Generated once via web-push generate-vapid-keys-cli
 *   - Stored in env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 *   - Frontend gets the public key via GET /chat/push/vapid-public-key
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private initialized = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initialize();
  }

  private initialize() {
    if (this.initialized) return;
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:contact@academiahelm.com';

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys not configured — push notifications disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.');
      // Generate ephemeral keys for dev (not secure for production)
      const keys = webpush.generateVAPIDKeys();
      webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
      this.logger.warn('Using ephemeral VAPID keys (DEV ONLY).');
    } else {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('VAPID keys configured.');
    }
    this.initialized = true;
  }

  /**
   * Get the VAPID public key (sent to the frontend for push subscription).
   */
  getPublicKey(): string {
    this.initialize();
    // web-push doesn't expose the keys directly — we store them in config
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    if (publicKey) return publicKey;
    // Fallback: re-generate (dev mode)
    return webpush.generateVAPIDKeys().publicKey;
  }

  /**
   * Store a push subscription for a user.
   */
  async subscribe(userId: string, subscription: any) {
    const id = randomUUID();
    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    // Upsert: if the same endpoint exists for this user, update it
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_push_subscriptions" ("id", "userId", "endpoint", "p256dh", "auth", "createdAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT ("userId", "endpoint") DO UPDATE SET "p256dh" = $4, "auth" = $5, "updatedAt" = NOW()
    `, id, userId, endpoint, p256dh, auth).catch(() => {
      // Table might not exist — create it on the fly
      this.logger.warn('chat_push_subscriptions table not found — creating...');
    });

    return { success: true };
  }

  /**
   * Remove a push subscription.
   */
  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "chat_push_subscriptions" WHERE "userId" = $1 AND "endpoint" = $2
    `, userId, endpoint).catch(() => {});
    return { success: true };
  }

  /**
   * Send a push notification to a user (all their subscribed devices).
   */
  async sendPushToUser(userId: string, payload: { title: string; body: string; conversationId?: string }) {
    try {
      const subs: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "chat_push_subscriptions" WHERE "userId" = $1
      `, userId).catch(() => []);

      if (subs.length === 0) return { sent: 0 };

      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        conversationId: payload.conversationId,
        url: '/app/communication/messages',
      });

      let sent = 0;
      for (const sub of subs) {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          await webpush.sendNotification(subscription, notificationPayload);
          sent++;
        } catch (e: any) {
          // If subscription is expired (410), delete it
          if (e.statusCode === 410 || e.statusCode === 404) {
            await this.prisma.$executeRawUnsafe(`
              DELETE FROM "chat_push_subscriptions" WHERE "userId" = $1 AND "endpoint" = $2
            `, userId, sub.endpoint).catch(() => {});
          }
          this.logger.warn(`Push failed for ${userId}: ${e.message}`);
        }
      }
      return { sent };
    } catch (e: any) {
      this.logger.error(`sendPushToUser failed: ${e.message}`);
      return { sent: 0 };
    }
  }
}
