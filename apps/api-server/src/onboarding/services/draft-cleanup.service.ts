/**
 * ============================================================================
 * DRAFT CLEANUP SERVICE - NETTOYAGE AUTOMATIQUE DES DRAFTS EXPIRÉS
 * ============================================================================
 *
 * Supprime les drafts d'onboarding expirés (après 4 heures).
 *
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

/** Durée de vie des drafts (en heures). Au-delà, ils sont considérés expirés et supprimés. */
export const DRAFT_EXPIRY_HOURS = 4;

@Injectable()
export class DraftCleanupService {
  private readonly logger = new Logger(DraftCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tâche cron qui supprime automatiquement les drafts expirés
   * Exécutée tous les jours à 2h00 du matin
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredDrafts() {
    this.logger.log('🧹 Starting cleanup of expired onboarding drafts...');

    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() - DRAFT_EXPIRY_HOURS);

    try {
      const result = await this.prisma.onboardingDraft.deleteMany({
        where: {
          createdAt: {
            lt: expiryThreshold,
          },
          status: {
            // ⭐ Ne JAMAIS supprimer les drafts COMPLETED ou PAYMENT_COMPLETED
            // (l'activation peut encore être en cours pour PAYMENT_COMPLETED)
            notIn: ['COMPLETED', 'PAYMENT_COMPLETED'],
          },
        },
      });

      this.logger.log(`✅ Cleanup completed: ${result.count} expired draft(s) deleted`);

      // ⭐ Purge RGPD/sécurité : nullifier les promoterPasswordHash résiduels des
      //    drafts COMPLETED/PAYMENT_COMPLETED de plus de 7 jours. Ces drafts ne
      //    sont jamais supprimés (traçabilité) mais le hash bcrypt n'a plus
      //    aucune utilité une fois le compte promoteur créé.
      await this.purgeStalePasswordHashes();

      return {
        success: true,
        deletedCount: result.count,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`❌ Error during draft cleanup: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * ⭐ Nullifie les promoterPasswordHash des drafts terminés de plus de 7 jours.
   *    Les drafts COMPLETED/PAYMENT_COMPLETED sont conservés (audit/traçabilité)
   *    mais le hash du mot de passe promoteur doit disparaître (l'activation
   *    le nullifie déjà — ceci nettoie les drafts antérieurs / échecs d'activation).
   */
  private async purgeStalePasswordHashes(): Promise<void> {
    try {
      const staleThreshold = new Date();
      staleThreshold.setDate(staleThreshold.getDate() - 7);

      const result = await this.prisma.onboardingDraft.updateMany({
        where: {
          status: { in: ['COMPLETED', 'PAYMENT_COMPLETED', 'CANCELLED'] },
          createdAt: { lt: staleThreshold },
          promoterPasswordHash: { not: null },
        },
        data: { promoterPasswordHash: null },
      });

      if (result.count > 0) {
        this.logger.log(`🧹 Purged stale promoterPasswordHash on ${result.count} old completed draft(s)`);
      }
    } catch (error: any) {
      // Non-bloquant : ne pas faire échouer le cron principal
      this.logger.warn(`⚠️  Password hash purge failed: ${error.message}`);
    }
  }

  /**
   * Méthode manuelle pour déclencher le nettoyage
   * Utile pour les tests ou le nettoyage à la demande
   */
  async cleanupExpiredDraftsManually() {
    this.logger.log('🧹 Manual cleanup of expired onboarding drafts triggered...');
    return this.cleanupExpiredDrafts();
  }

  /**
   * Compte le nombre de drafts expirés sans les supprimer
   */
  async countExpiredDrafts(): Promise<number> {
    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() - DRAFT_EXPIRY_HOURS);

    return this.prisma.onboardingDraft.count({
      where: {
        createdAt: { lt: expiryThreshold },
        status: { notIn: ['COMPLETED', 'PAYMENT_COMPLETED'] },
      },
    });
  }
}
