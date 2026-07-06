/**
 * ============================================================================
 * TENANT PAYMENT CONFIG SERVICE
 * ============================================================================
 * Gère la configuration des paiements en ligne (FeexPay / Fedapay) par école.
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
        provider: 'feexpay',
        isActive: false,
        feexpayApiKey: null,
        feexpayShopId: null,
        feexpaySecretKey: null,
        fedapayPublicKey: null,
        fedapaySecretKey: null,
        webhookSecret: null,
      };
    }
    // Masquer les clés secrètes dans la réponse (ne pas exposer les clés complètes)
    return {
      ...config,
      feexpayApiKey: config.feexpayApiKey ? this.maskKey(config.feexpayApiKey) : null,
      feexpaySecretKey: config.feexpaySecretKey ? this.maskKey(config.feexpaySecretKey) : null,
      fedapaySecretKey: config.fedapaySecretKey ? this.maskKey(config.fedapaySecretKey) : null,
      webhookSecret: config.webhookSecret ? this.maskKey(config.webhookSecret) : null,
    };
  }

  /**
   * Récupère la config complète SANS masquer les clés (usage interne uniquement).
   * Utilisé par le service de paiement pour appeler l'API FeexPay/Fedapay.
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
    feexpayApiKey?: string;
    feexpayShopId?: string;
    feexpaySecretKey?: string;
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
    if (data.feexpayShopId !== undefined) updateData.feexpayShopId = data.feexpayShopId;
    if (data.fedapayPublicKey !== undefined) updateData.fedapayPublicKey = data.fedapayPublicKey;

    // Ne mettre à jour les clés que si elles ne sont pas masquées
    if (data.feexpayApiKey && !data.feexpayApiKey.includes('****')) updateData.feexpayApiKey = data.feexpayApiKey;
    if (data.feexpaySecretKey && !data.feexpaySecretKey.includes('****')) updateData.feexpaySecretKey = data.feexpaySecretKey;
    if (data.fedapaySecretKey && !data.fedapaySecretKey.includes('****')) updateData.fedapaySecretKey = data.fedapaySecretKey;
    if (data.webhookSecret && !data.webhookSecret.includes('****')) updateData.webhookSecret = data.webhookSecret;

    return this.prisma.tenantPaymentConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: data.provider || 'feexpay',
        isActive: data.isActive ?? false,
        feexpayApiKey: data.feexpayApiKey && !data.feexpayApiKey.includes('****') ? data.feexpayApiKey : null,
        feexpayShopId: data.feexpayShopId || null,
        feexpaySecretKey: data.feexpaySecretKey && !data.feexpaySecretKey.includes('****') ? data.feexpaySecretKey : null,
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
    // Vérifier si AU MOINS UN des deux fournisseurs a ses clés configurées
    // (l'école peut utiliser les deux indépendamment)
    const feexpayReady = !!(config.feexpayApiKey && config.feexpayShopId);
    const fedapayReady = !!(config.fedapayPublicKey && config.fedapaySecretKey);
    return feexpayReady || fedapayReady;
  }

  /**
   * Masque une clé API pour l'affichage (ne montre que les 4 derniers caractères).
   */
  private maskKey(key: string): string {
    if (!key || key.length <= 8) return '****';
    return '****' + key.substring(key.length - 4);
  }
}
