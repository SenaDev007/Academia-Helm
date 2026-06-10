import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FederisSyncService {
  private readonly logger = new Logger(FederisSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Synchronise les données des écoles affiliées vers le Patronat (Federis)
   * Cette tâche s'exécute périodiquement pour mettre à jour les statistiques.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySync() {
    this.logger.log('Starting daily Federis synchronization...');
    
    // 1. Récupérer tous les patronats actifs
    const patronats = await this.prisma.patronat.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const patronat of patronats) {
      await this.syncPatronatDataWithRetry(patronat.id);
    }

    this.logger.log('Federis synchronization completed.');
  }

  /**
   * Synchronisation avec mécanisme de Retry (Spécification Module 3)
   */
  async syncPatronatDataWithRetry(patronatId: string, retries = 3) {
    try {
      return await this.syncPatronatData(patronatId);
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Sync failed for ${patronatId}. Retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.syncPatronatDataWithRetry(patronatId, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Synchronise les données pour un patronat spécifique
   */
  async syncPatronatData(patronatId: string) {
    try {
      // Récupérer les écoles affiliées
      const affiliations = await this.prisma.patronatSchool.findMany({
        where: { patronatId, status: 'JOINED' },
        select: { schoolTenantId: true },
      });

      const schoolIds = affiliations.map(a => a.schoolTenantId).filter(Boolean) as string[];
      if (schoolIds.length === 0) return;

      // Calculer les statistiques consolidées
      const [studentCount, teacherCount, classCount, candidateCount] = await Promise.all([
        this.prisma.student.count({ where: { tenantId: { in: schoolIds }, isActive: true } }),
        this.prisma.teacher.count({ where: { tenantId: { in: schoolIds }, isActive: true } }),
        this.prisma.class.count({ where: { tenantId: { in: schoolIds }, isActive: true } }),
        this.prisma.examCandidate.count({ where: { schoolTenantId: { in: schoolIds } } }),
      ]);

      // Mettre à jour les métadonnées du patronat avec les stats fraîches
      await this.prisma.patronat.update({
        where: { id: patronatId },
        data: {
          metadata: {
            lastSync: new Date().toISOString(),
            stats: {
              studentCount,
              teacherCount,
              classCount,
              candidateCount,
              schoolCount: schoolIds.length,
            },
          },
        },
      });

      this.logger.debug(`Synced stats for patronat ${patronatId}: ${studentCount} students across ${schoolIds.length} schools.`);

      // 4. Analyse ORION (Phase 4 : Vigilance)
      await this.checkOrionAnomalies(patronatId, { studentCount, schoolCount: schoolIds.length });

    } catch (error) {
      this.logger.error(`Failed to sync data for patronat ${patronatId}`, error.stack);
    }
  }

  /**
   * Analyse ORION pour détecter des anomalies de remontée (Chutes de données)
   */
  private async checkOrionAnomalies(patronatId: string, currentStats: any) {
    const patronat = await this.prisma.patronat.findUnique({
      where: { id: patronatId },
      select: { metadata: true }
    });

    const oldStats = (patronat?.metadata as any)?.stats;
    if (!oldStats) return;

    // Détection d'une chute brutale d'élèves (> 20%)
    if (currentStats.studentCount < oldStats.studentCount * 0.8) {
      await this.prisma.orionAlert.create({
        data: {
          tenantId: (patronat as any).tenantId, // Le tenant Federis
          academicYearId: (patronat as any).currentAcademicYearId,
          type: 'ANOMALY',
          severity: 'HIGH',
          title: 'Chute brutale des effectifs consolidés',
          message: `Les effectifs sont passés de ${oldStats.studentCount} à ${currentStats.studentCount}. Vérifiez la synchronisation des écoles.`,
          status: 'OPEN',
        }
      });
    }
  }

  /**
   * Force une synchronisation immédiate pour un tenant
   */
  async triggerImmediateSync(tenantId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (!patronat) return;
    return this.syncPatronatData(patronat.id);
  }
}
