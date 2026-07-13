/**
 * ============================================================================
 * TENANT PAYMENT CONFIG SERVICE
 * ============================================================================
 * Gère la configuration des paiements en ligne (FedaPay / Fedapay) par école.
 * Chaque école configure son PROPRE compte — l'argent va directement sur le
 * compte de l'école, jamais sur le nôtre.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantPaymentConfigService {
  private readonly logger = new Logger(TenantPaymentConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère la config de paiement d'un tenant.
   */
  async getConfig(tenantId: string) {
    const config = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
    });
    if (!config) {
      return {
        tenantId,
        provider: 'fedapay',
        isActive: false,
        fedapayApiKey: null,
        fedapayShopId: null,
        fedapaySecretKey: null,
        fedapayPublicKey: null,
        fedapaySecretKey: null,
        webhookSecret: null,
      };
    }
    // Masquer les clés secrètes dans la réponse (ne pas exposer les clés complètes)
    return {
      ...config,
      fedapayApiKey: config.fedapayApiKey ? this.maskKey(config.fedapayApiKey) : null,
      fedapaySecretKey: config.fedapaySecretKey ? this.maskKey(config.fedapaySecretKey) : null,
      fedapaySecretKey: config.fedapaySecretKey ? this.maskKey(config.fedapaySecretKey) : null,
      webhookSecret: config.webhookSecret ? this.maskKey(config.webhookSecret) : null,
    };
  }

  /**
   * Récupère la config complète SANS masquer les clés (usage interne uniquement).
   * Utilisé par le service de paiement pour appeler l'API FedaPay/Fedapay.
   */
  async getFullConfig(tenantId: string) {
    return this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Crée ou met à jour la config de paiement d'un tenant (upsert).
   */
  async upsertConfig(tenantId: string, data: {
    provider?: string;
    isActive?: boolean;
    fedapayApiKey?: string;
    fedapayShopId?: string;
    fedapaySecretKey?: string;
    fedapayPublicKey?: string;
    fedapaySecretKey?: string;
    webhookSecret?: string;
  }) {
    // Si les clés sont masquées (****), ne pas les écraser
    const existing = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
    });

    const updateData: any = {};
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.fedapayShopId !== undefined) updateData.fedapayShopId = data.fedapayShopId;
    if (data.fedapayPublicKey !== undefined) updateData.fedapayPublicKey = data.fedapayPublicKey;

    // Ne mettre à jour les clés que si elles ne sont pas masquées
    if (data.fedapayApiKey && !data.fedapayApiKey.includes('****')) updateData.fedapayApiKey = data.fedapayApiKey;
    if (data.fedapaySecretKey && !data.fedapaySecretKey.includes('****')) updateData.fedapaySecretKey = data.fedapaySecretKey;
    if (data.fedapaySecretKey && !data.fedapaySecretKey.includes('****')) updateData.fedapaySecretKey = data.fedapaySecretKey;
    if (data.webhookSecret && !data.webhookSecret.includes('****')) updateData.webhookSecret = data.webhookSecret;

    return this.prisma.tenantPaymentConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: data.provider || 'fedapay',
        isActive: data.isActive ?? false,
        fedapayApiKey: data.fedapayApiKey && !data.fedapayApiKey.includes('****') ? data.fedapayApiKey : null,
        fedapayShopId: data.fedapayShopId || null,
        fedapaySecretKey: data.fedapaySecretKey && !data.fedapaySecretKey.includes('****') ? data.fedapaySecretKey : null,
        fedapayPublicKey: data.fedapayPublicKey || null,
        fedapaySecretKey: data.fedapaySecretKey && !data.fedapaySecretKey.includes('****') ? data.fedapaySecretKey : null,
        webhookSecret: data.webhookSecret && !data.webhookSecret.includes('****') ? data.webhookSecret : null,
      },
      update: updateData,
    });
  }

  /**
   * Vérifie si les paiements en ligne sont activés pour un tenant.
   */
  async isOnlinePaymentEnabled(tenantId: string): Promise<boolean> {
    const config = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
    });
    if (!config || !config.isActive) return false;
    // Vérifier si FedaPay a ses clés configurées
    const fedapayReady = !!(config.fedapayApiKey && config.fedapayShopId) ||
                         !!(config.fedapayPublicKey && config.fedapaySecretKey);
    return fedapayReady;
  }

  /**
   * Masque une clé API pour l'affichage (ne montre que les 4 derniers caractères).
   */
  private maskKey(key: string): string {
    if (!key || key.length <= 8) return '****';
    return '****' + key.substring(key.length - 4);
  }
}
