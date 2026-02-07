/**
 * ============================================================================
 * DRAFT CLEANUP SERVICE - NETTOYAGE AUTOMATIQUE DES DRAFTS EXPIRÉS
 * ============================================================================
 * 
 * Service pour supprimer automatiquement les drafts d'onboarding expirés
 * après 24 heures pour éviter de surcharger la base de données.
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

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

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    try {
      // Supprimer tous les drafts créés il y a plus de 24 heures
      // et qui ne sont pas encore complétés
      const result = await this.prisma.onboardingDraft.deleteMany({
        where: {
          createdAt: {
            lt: twentyFourHoursAgo,
          },
          status: {
            not: 'COMPLETED', // Ne pas supprimer les drafts complétés
          },
        },
      });

      this.logger.log(`✅ Cleanup completed: ${result.count} expired draft(s) deleted`);

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
   * Méthode manuelle pour déclencher le nettoyage
   * Utile pour les tests ou le nettoyage à la demande
   */
  async cleanupExpiredDraftsManually() {
    this.logger.log('🧹 Manual cleanup of expired onboarding drafts triggered...');
    return this.cleanupExpiredDrafts();
  }

  /**
   * Compte le nombre de drafts expirés sans les supprimer
   * Utile pour le monitoring
   */
  async countExpiredDrafts(): Promise<number> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const count = await this.prisma.onboardingDraft.count({
      where: {
        createdAt: {
          lt: twentyFourHoursAgo,
        },
        status: {
          not: 'COMPLETED',
        },
      },
    });

    return count;
  }
}
