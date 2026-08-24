/**
 * ============================================================================
 * FCM SENDER SERVICE — Backend push notifications via Firebase Admin SDK (V3-4)
 * ============================================================================
 *
 * Envoie des push notifications FCM (Firebase Cloud Messaging) aux appareils
 * mobiles des utilisateurs (parents / enseignants / direction).
 *
 * Pattern :
 *   - Singleton Firebase app initialisé à la demande (lazy) avec les credentials
 *     lus depuis :
 *       1. FIREBASE_SERVICE_ACCOUNT_PATH (fichier JSON de service account)
 *       2. Ou les variables individuelles :
 *          FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *          (+ FIREBASE_CLIENT_ID / FIREBASE_CLIENT_X509_CERT_URL optionnels)
 *   - Si pas de credentials → mode "désactivé silencieux" (les méthodes
 *     retournent un résultat "skipped" sans crash, ce qui permet au reste
 *     de l'app de fonctionner — l'admin doit juste configurer Firebase).
 *   - Fire-and-forget : ne lève jamais d'erreur bloquante.
 *
 * Utilisé par :
 *   - NotificationService.create() → envoie un push FCM après création de
 *     l'in-app notification (en parallèle du Web Push VAPID via PushService).
 *   - HelmConnectNotificationBridgeService → envoie des pushes ciblés pour
 *     les événements Examens/Absences/Discipline.
 *
 * Stockage des tokens : table `fcm_device_tokens` (voir migration
 * 20260901150000_add_fcm_device_tokens). Les tokens sont enregistrés par
 * l'app mobile via POST /notifications/device-tokens.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

export interface FcmSendResult {
  success: boolean;
  sentCount: number;
  failureCount: number;
  skipped: boolean; // true if FCM is not configured
  errors: string[];
}

@Injectable()
export class FcmSenderService {
  private readonly logger = new Logger(FcmSenderService.name);
  private firebaseApp: any = null;
  private isInitialized = false;
  private isConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initialise Firebase Admin SDK à la demande (lazy).
   * Échoue silencieusement si les credentials ne sont pas configurés.
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Try to load credentials from FIREBASE_SERVICE_ACCOUNT_PATH
      const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKeyRaw = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      let serviceAccount: any = null;

      if (serviceAccountPath) {
        try {
          const fs = await import('fs');
          const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
          serviceAccount = JSON.parse(fileContent);
          this.logger.log(`Firebase service account loaded from ${serviceAccountPath}`);
        } catch (e: any) {
          this.logger.warn(`Failed to load Firebase service account from ${serviceAccountPath}: ${e.message}`);
        }
      } else if (projectId && clientEmail && privateKeyRaw) {
        // 2. Build service account from individual env vars
        // Private key: env vars escape \n as literal \\n, so we need to replace them back
        const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
        serviceAccount = {
          type: 'service_account',
          project_id: projectId,
          private_key_id: this.configService.get<string>('FIREBASE_PRIVATE_KEY_ID'),
          private_key: privateKey,
          client_email: clientEmail,
          client_id: this.configService.get<string>('FIREBASE_CLIENT_ID'),
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: this.configService.get<string>('FIREBASE_CLIENT_X509_CERT_URL'),
        };
        this.logger.log(`Firebase service account built from env vars (project: ${projectId})`);
      }

      if (!serviceAccount) {
        this.logger.warn(
          '🔥 FCM sender is NOT configured — push notifications to mobile devices will be skipped. ' +
          'To enable, set either FIREBASE_SERVICE_ACCOUNT_PATH or ' +
          '(FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) in .env.',
        );
        this.isConfigured = false;
        return;
      }

      // 3. Initialize Firebase Admin SDK
      //    Dynamic import so the dependency is loaded only if FCM is configured.
      const admin = await import('firebase-admin');
      // Avoid double-initialization in HMR / hot reload scenarios
      const existingApps = (admin as any).apps || [];
      if (existingApps.length > 0) {
        this.firebaseApp = existingApps[0];
      } else {
        this.firebaseApp = (admin as any).initializeApp({
          credential: (admin as any).credential.cert(serviceAccount),
        });
      }
      this.isConfigured = true;
      this.logger.log('✅ Firebase Admin SDK initialized — FCM push notifications enabled.');
    } catch (e: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${e.message}`, e.stack);
      this.isConfigured = false;
    }
  }

  /**
   * Envoie un push FCM à un utilisateur spécifique (tous ses appareils enregistrés).
   * Fire-and-forget — ne lève jamais d'erreur bloquante.
   */
  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
      type?: string; // ABSENCE_CREATED | EXAM_SCHEDULED | etc. — for client routing
    },
  ): Promise<FcmSendResult> {
    await this.initialize();
    if (!this.isConfigured) {
      return { success: false, sentCount: 0, failureCount: 0, skipped: true, errors: [] };
    }

    // Récupérer les tokens actifs de l'utilisateur
    let tokens: string[] = [];
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ fcmToken: string }>>(
        `SELECT "fcmToken" FROM "fcm_device_tokens"
         WHERE "userId" = $1 AND "isActive" = true`,
        userId,
      );
      tokens = rows.map((r) => r.fcmToken);
    } catch (e: any) {
      this.logger.warn(`sendToUser: failed to fetch tokens for user ${userId}: ${e.message}`);
      return { success: false, sentCount: 0, failureCount: 0, skipped: true, errors: [e.message] };
    }

    if (tokens.length === 0) {
      // No registered device — silent skip (user has not yet opened the mobile app)
      return { success: true, sentCount: 0, failureCount: 0, skipped: true, errors: [] };
    }

    return this.sendToTokens(tokens, payload);
  }

  /**
   * Envoie un push FCM à plusieurs utilisateurs (par ex. tous les parents d'une classe).
   */
  async sendToUsers(
    userIds: string[],
    payload: { title: string; body: string; data?: Record<string, string>; type?: string },
  ): Promise<FcmSendResult> {
    await this.initialize();
    if (!this.isConfigured || userIds.length === 0) {
      return { success: false, sentCount: 0, failureCount: 0, skipped: true, errors: [] };
    }

    // Récupérer tous les tokens actifs pour ces utilisateurs
    let tokens: string[] = [];
    try {
      // Neon/Postgres ne supporte pas directement ANY($1::text[]) avec un tableau
      // JS — on utilise une parameterized IN clause avec unnest.
      const rows = await this.prisma.$queryRawUnsafe<Array<{ fcmToken: string }>>(
        `SELECT "fcmToken" FROM "fcm_device_tokens"
         WHERE "userId" = ANY($1::text[]) AND "isActive" = true`,
        userIds,
      );
      tokens = rows.map((r) => r.fcmToken);
    } catch (e: any) {
      this.logger.warn(`sendToUsers: failed to fetch tokens: ${e.message}`);
      return { success: false, sentCount: 0, failureCount: 0, skipped: true, errors: [e.message] };
    }

    if (tokens.length === 0) {
      return { success: true, sentCount: 0, failureCount: 0, skipped: true, errors: [] };
    }

    return this.sendToTokens(tokens, payload);
  }

  /**
   * Envoie un message FCM à une liste de tokens.
   * Gère le batch (FCM limite à 500 tokens par appel multicast).
   */
  private async sendToTokens(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string>; type?: string },
  ): Promise<FcmSendResult> {
    const result: FcmSendResult = {
      success: true,
      sentCount: 0,
      failureCount: 0,
      skipped: false,
      errors: [],
    };

    try {
      const admin = await import('firebase-admin');
      const messaging = (admin as any).messaging(this.firebaseApp);

      // Build the multicast message
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          // FCM data payload must be all strings
          ...(payload.data || {}),
          type: payload.type || 'SYSTEM',
          // Add timestamp for client-side ordering
          timestamp: Date.now().toString(),
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'academia_helm_notifications',
            priority: 'high' as const,
            icon: '@mipmap/ic_notification',
            color: '#CFA63A', // Academia Helm gold
            sound: 'default',
            clickAction: 'FCM_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        tokens,
      };

      // Batch in chunks of 500 (FCM multicast limit)
      const BATCH_SIZE = 500;
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batchTokens = tokens.slice(i, i + BATCH_SIZE);
        const batchMessage = { ...message, tokens: batchTokens };

        try {
          const response = await messaging.sendEachForMulticast(batchMessage);
          result.sentCount += response.successCount;
          result.failureCount += response.failureCount;

          // Collect errors
          if (response.failureCount > 0) {
            for (let j = 0; j < response.responses.length; j++) {
              if (!response.responses[j].success) {
                const err = response.responses[j].error;
                const failedToken = batchTokens[j];

                // If the token is invalid/unregistered, mark it as inactive in DB
                if (
                  err &&
                  (err.code === 'messaging/registration-token-not-registered' ||
                    err.code === 'messaging/invalid-registration-token')
                ) {
                  this.deactivateToken(failedToken).catch((e) =>
                    this.logger.warn(`Failed to deactivate stale token: ${e.message}`),
                  );
                }
                result.errors.push(`Token ${failedToken.substring(0, 12)}...: ${err?.message || 'unknown'}`);
              }
            }
          }
        } catch (batchErr: any) {
          this.logger.error(`FCM batch send failed: ${batchErr.message}`, batchErr.stack);
          result.failureCount += batchTokens.length;
          result.errors.push(`Batch error: ${batchErr.message}`);
        }
      }

      this.logger.log(
        `FCM send result: ${result.sentCount} sent, ${result.failureCount} failed ` +
          `(of ${tokens.length} tokens for ${result.sentCount + result.failureCount} devices)`,
      );

      // If all failed, mark as not success
      if (result.sentCount === 0 && result.failureCount > 0) {
        result.success = false;
      }
    } catch (e: any) {
      this.logger.error(`FCM sendToTokens failed: ${e.message}`, e.stack);
      result.success = false;
      result.failureCount = tokens.length;
      result.errors.push(e.message);
    }

    return result;
  }

  /**
   * Désactive un token FCM en DB (token invalide / non enregistré côté Firebase).
   * Fire-and-forget.
   */
  private async deactivateToken(token: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "fcm_device_tokens" SET "isActive" = false, "updatedAt" = NOW()
         WHERE "fcmToken" = $1`,
        token,
      );
      this.logger.log(`Deactivated stale FCM token ${token.substring(0, 12)}...`);
    } catch (e: any) {
      this.logger.warn(`Failed to deactivate token: ${e.message}`);
    }
  }

  /**
   * Indique si le service FCM est configuré et prêt à envoyer.
   */
  async isReady(): Promise<boolean> {
    await this.initialize();
    return this.isConfigured;
  }
}
