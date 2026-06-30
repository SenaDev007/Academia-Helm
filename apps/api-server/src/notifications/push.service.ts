/**
 * ============================================================================
 * PUSH SERVICE — Web Push notifications (VAPID)
 * ============================================================================
 *
 * Envoie des notifications push aux navigateurs des utilisateurs via l'API
 * Web Push (RFC 8030). Utilise le package `web-push` qui gère le chiffrement
 * AES128-GCM + VAPID JWT.
 *
 * Configuration (env vars) :
 *   - VAPID_PUBLIC_KEY   : clé publique VAPID (base64 URL-safe)
 *   - VAPID_PRIVATE_KEY  : clé privée VAPID (base64 URL-safe)
 *   - VAPID_SUBJECT      : mailto:contact@academiahelm.com (ou URL)
 *
 * Générer les clés : npx web-push generate-vapid-keys
 *
 * Flow :
 *   1. Le frontend enregistre un service worker (/sw.js)
 *   2. Le frontend appelle pushManager.subscribe({ applicationServerKey })
 *   3. Le frontend POST /notifications/subscribe avec l'objet subscription
 *   4. Ce service stocke la subscription en DB (PushSubscription)
 *   5. Quand une notification in-app est créée, sendToUser() envoie un push
 *      à toutes les subscriptions de l'utilisateur (multi-device)
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private isConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Configure web-push avec les clés VAPID au démarrage du module.
   * Si les clés ne sont pas configurées, le service reste inactif (no-op).
   */
  async onModuleInit() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT')
      || 'mailto:contact@academiahelm.com';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not configured — Web Push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.',
      );
      this.isConfigured = false;
      return;
    }

    try {
      // Import dynamique pour éviter l'erreur si le package n'est pas installé
      const webPush = await import('web-push');
      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.isConfigured = true;
      this.logger.log('Web Push configured with VAPID keys');
    } catch (err: any) {
      this.logger.warn(
        `Web Push setup failed (package web-push peut-être absent) : ${err.message}`,
      );
      this.isConfigured = false;
    }
  }

  /**
   * Retourne la clé publique VAPID (pour le frontend).
   * Retourne null si Web Push n'est pas configuré.
   */
  getPublicKey(): string | null {
    if (!this.isConfigured) return null;
    return this.configService.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  /**
   * Enregistre ou met à jour un abonnement push pour un utilisateur.
   * Si l'endpoint existe déjà, on met à jour les clés (rotation possible).
   */
  async subscribe(userId: string, tenantId: string, subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  }, userAgent?: string) {
    try {
      const data: any = {
        tenantId,
        userId,
        endpoint: subscription.endpoint,
        keysP256dh: subscription.keys.p256dh,
        keysAuth: subscription.keys.auth,
        expirationTime: subscription.expirationTime
          ? new Date(subscription.expirationTime)
          : null,
        userAgent: userAgent || null,
      };

      // Upsert : si l'endpoint existe déjà (même navigateur), on met à jour
      return await this.prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: data,
        update: {
          keysP256dh: data.keysP256dh,
          keysAuth: data.keysAuth,
          expirationTime: data.expirationTime,
          userAgent: data.userAgent,
        },
      });
    } catch (err: any) {
      this.logger.error(`subscribe failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Supprime un abonnement push (quand l'utilisateur se désabonne ou logout).
   */
  async unsubscribe(userId: string, endpoint: string) {
    try {
      return await this.prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
    } catch (err: any) {
      this.logger.error(`unsubscribe failed: ${err.message}`);
      return;
    }
  }

  /**
   * Envoie une notification push à toutes les subscriptions d'un utilisateur.
   *
   * @param userId   - destinataire
   * @param payload  - { title, body, data?: { url?, ... } }
   *
   * Fire-and-forget : ne lève jamais d'erreur bloquante. Les subscriptions
   * invalides (410 Gone) sont automatiquement supprimées de la DB.
   */
  async sendToUser(userId: string, payload: {
    title: string;
    body: string;
    data?: any;
    icon?: string;
    tag?: string;
  }): Promise<void> {
    if (!this.isConfigured) return; // no-op si VAPID non configuré

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });

      if (subscriptions.length === 0) return;

      const webPush = await import('web-push');
      const payloadStr = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/images/logo-Academia Hub.png',
        badge: '/web-app-manifest-192x192.png',
        tag: payload.tag || 'academia-helm-notification',
        data: {
          url: payload.data?.url || '/app',
          notificationId: payload.data?.notificationId || null,
          ...payload.data,
        },
      });

      // Envoyer en parallèle à toutes les subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keysP256dh,
                  auth: sub.keysAuth,
                },
                expirationTime: sub.expirationTime?.getTime() || null,
              } as any,
              payloadStr,
            );
            return { endpoint: sub.endpoint, ok: true };
          } catch (err: any) {
            // 410 Gone / 404 → subscription invalide, on la supprime
            if (err.statusCode === 410 || err.statusCode === 404) {
              await this.prisma.pushSubscription
                .delete({ where: { endpoint: sub.endpoint } })
                .catch(() => {});
              this.logger.log(`Removed expired push subscription: ${sub.endpoint.substring(0, 60)}...`);
            } else {
              this.logger.warn(
                `Push failed for ${sub.endpoint.substring(0, 60)}...: ${err.message}`,
              );
            }
            return { endpoint: sub.endpoint, ok: false, error: err.message };
          }
        }),
      );

      const success = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      const failed = results.length - success;
      if (success > 0) {
        this.logger.log(
          `Push sent to user ${userId}: ${success} success, ${failed} failed`,
        );
      }
    } catch (err: any) {
      this.logger.error(`sendToUser failed: ${err.message}`);
    }
  }
}
