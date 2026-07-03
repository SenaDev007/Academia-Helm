/**
 * SOUS-MODULE 8 — Paramétrage financier (FinancialSettings)
 *
 * SÉCURITÉ :
 * - `fedapaySecretKey` est CHIFFRÉ en base via AES-256-GCM (CredentialEncryptionService)
 * - Déchiffré à la volée lors de la lecture (getForTenant / getOrCreate)
 * - Le retour API masque partiellement la clé (4 derniers caractères visibles)
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { CredentialEncryptionService } from '../common/services/credential-encryption.service';

@Injectable()
export class FinancialSettingsService {
  private readonly logger = new Logger(FinancialSettingsService.name);
  private readonly SENSITIVE_FIELDS = ['fedapaySecretKey'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialEncryption: CredentialEncryptionService,
  ) {}

  /**
   * Récupère les settings d'un tenant avec fedapaySecretKey DÉCHIFFRÉE.
   * Pour usage interne (services backend qui ont besoin de la clé réelle).
   */
  async getForTenantDecrypted(tenantId: string) {
    const s = await this.prisma.financialSettings.findUnique({
      where: { tenantId },
    });
    if (!s) return null;
    return this.credentialEncryption.decryptFields(s as any, this.SENSITIVE_FIELDS) as any;
  }

  /**
   * Récupère les settings d'un tenant avec fedapaySecretKey MASQUÉE (API publique).
   * Retourne null pour la clé secrète — l'UI ne doit jamais afficher la vraie clé.
   */
  async getForTenant(tenantId: string) {
    const s = await this.prisma.financialSettings.findUnique({
      where: { tenantId },
    });
    if (!s) return null;
    // Masque la clé secrète pour l'API publique
    return {
      ...s,
      fedapaySecretKey: s.fedapaySecretKey ? this.maskSecret(s.fedapaySecretKey) : null,
    };
  }

  /**
   * Récupère ou crée les settings par défaut pour un tenant.
   */
  async getOrCreate(tenantId: string) {
    let s = await this.prisma.financialSettings.findUnique({ where: { tenantId } });
    if (!s) {
      s = await this.prisma.financialSettings.create({
        data: { tenantId },
      });
    }
    // Masque la clé secrète pour l'API publique
    return {
      ...s,
      fedapaySecretKey: s.fedapaySecretKey ? this.maskSecret(s.fedapaySecretKey) : null,
    };
  }

  /**
   * Masque une clé secrète pour affichage UI (ex: "sk_****1234").
   * Détecte si la valeur est chiffrée (base64 long) ou en clair.
   */
  private maskSecret(secret: string): string {
    try {
      // Si la valeur est chiffrée, on déchiffre d'abord
      if (this.credentialEncryption.isEncrypted(secret)) {
        const decrypted = this.credentialEncryption.decrypt(secret);
        if (decrypted && decrypted.length > 4) {
          return `${decrypted.substring(0, 3)}****${decrypted.substring(decrypted.length - 4)}`;
        }
        return '****';
      }
      // Valeur en clair (legacy, pas encore chiffrée)
      if (secret.length > 4) {
        return `${secret.substring(0, 3)}****${secret.substring(secret.length - 4)}`;
      }
      return '****';
    } catch {
      return '****';
    }
  }

  /**
   * Met à jour les settings.
   * - fedapaySecretKey est chiffrée avant stockage
   * - Si la valeur envoyée est "****" ou vide, on conserve l'ancienne (pas d'écrasement)
   * - Audit log automatique
   */
  async update(
    tenantId: string,
    data: Partial<{
      blockingThreshold: number;
      allowPartialPayment: boolean;
      minimumInstallmentAmount: number | null;
      autoClosureEnabled: boolean;
      autoClosureTime: string;
      reminderWarningDays: number;
      reminderUrgentDays: number;
      reminderFinalDays: number;
      cancellationDelayHours: number;
      budgetAlertThreshold: number;
      expenseReceiptThreshold: number | null;
      fedapayEnabled: boolean;
      fedapayPublicKey: string | null;
      fedapaySecretKey: string | null;
    }>,
    performedById?: string,
  ) {
    const existing = await this.prisma.financialSettings.findUnique({ where: { tenantId } });
    const payload: Record<string, unknown> = { updatedAt: new Date() };
    if (data.blockingThreshold != null) payload.blockingThreshold = new Prisma.Decimal(data.blockingThreshold);
    if (data.allowPartialPayment != null) payload.allowPartialPayment = data.allowPartialPayment;
    if (data.minimumInstallmentAmount !== undefined) payload.minimumInstallmentAmount = data.minimumInstallmentAmount == null ? null : new Prisma.Decimal(data.minimumInstallmentAmount);
    if (data.autoClosureEnabled != null) payload.autoClosureEnabled = data.autoClosureEnabled;
    if (data.autoClosureTime != null) payload.autoClosureTime = data.autoClosureTime;
    if (data.reminderWarningDays != null) payload.reminderWarningDays = data.reminderWarningDays;
    if (data.reminderUrgentDays != null) payload.reminderUrgentDays = data.reminderUrgentDays;
    if (data.reminderFinalDays != null) payload.reminderFinalDays = data.reminderFinalDays;
    if (data.cancellationDelayHours != null) payload.cancellationDelayHours = data.cancellationDelayHours;
    if (data.budgetAlertThreshold != null) payload.budgetAlertThreshold = data.budgetAlertThreshold;
    if (data.expenseReceiptThreshold !== undefined) payload.expenseReceiptThreshold = data.expenseReceiptThreshold == null ? null : new Prisma.Decimal(data.expenseReceiptThreshold);
    if (data.fedapayEnabled != null) payload.fedapayEnabled = data.fedapayEnabled;
    if (data.fedapayPublicKey !== undefined) payload.fedapayPublicKey = data.fedapayPublicKey;

    // Chiffrement de fedapaySecretKey si une nouvelle valeur est fournie
    if (data.fedapaySecretKey !== undefined) {
      if (data.fedapaySecretKey === null || data.fedapaySecretKey === '' || data.fedapaySecretKey.includes('****')) {
        // Conserver l'ancienne valeur (l'utilisateur n'a pas saisi de nouvelle clé)
        // Ne pas modifier payload.fedapaySecretKey
      } else {
        // Nouvelle clé en clair → chiffrer avant stockage
        payload.fedapaySecretKey = this.credentialEncryption.encrypt(data.fedapaySecretKey);
      }
    }

    const result = await this.prisma.financialSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...(payload as Record<string, unknown>) as any },
      update: payload as any,
    });
    if (performedById) {
      await this.prisma.financialAuditLog.create({
        data: {
          tenantId,
          entityType: 'FinancialSettings',
          entityId: result.id,
          action: 'UPDATE',
          oldValue: existing ? {
            blockingThreshold: existing.blockingThreshold?.toString(),
            autoClosureEnabled: existing.autoClosureEnabled,
            fedapayEnabled: existing.fedapayEnabled,
          } : undefined,
          newValue: {
            blockingThreshold: payload.blockingThreshold?.toString(),
            autoClosureEnabled: payload.autoClosureEnabled,
            fedapayEnabled: payload.fedapayEnabled,
            // Ne JAMAIS logger la vraie clé secrète
            fedapaySecretKeyUpdated: payload.fedapaySecretKey !== undefined,
          } as any,
          performedById,
        },
      });
    }
    // Retourne avec clé masquée
    return {
      ...result,
      fedapaySecretKey: result.fedapaySecretKey ? this.maskSecret(result.fedapaySecretKey) : null,
    };
  }

  /**
   * Migration : chiffre les clés fedapaySecretKey existantes en clair en DB.
   * À exécuter une seule fois après déploiement.
   */
  async migrateExistingSecrets(): Promise<{ migrated: number; skipped: number }> {
    const all = await this.prisma.financialSettings.findMany({
      where: { fedapaySecretKey: { not: null } },
      select: { id: true, tenantId: true, fedapaySecretKey: true },
    });
    let migrated = 0;
    let skipped = 0;
    for (const s of all) {
      if (!s.fedapaySecretKey) {
        skipped++;
        continue;
      }
      // Si déjà chiffrée, on skip
      if (this.credentialEncryption.isEncrypted(s.fedapaySecretKey)) {
        skipped++;
        continue;
      }
      // Chiffrer
      const encrypted = this.credentialEncryption.encrypt(s.fedapaySecretKey);
      await this.prisma.financialSettings.update({
        where: { id: s.id },
        data: { fedapaySecretKey: encrypted },
      });
      migrated++;
      this.logger.log(`Migrated fedapaySecretKey for tenant ${s.tenantId}`);
    }
    this.logger.log(`Migration complete: ${migrated} keys encrypted, ${skipped} already encrypted or null`);
    return { migrated, skipped };
  }
}
