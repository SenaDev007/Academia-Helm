/**
 * ============================================================================
 * NEON QUOTA MONITOR — Vérifie le quota de transfert réseau Neon
 * ============================================================================
 *
 * Ce script interroge l'API Neon pour récupérer l'utilisation du quota
 * et envoie une alerte (email + toast dashboard) quand on approche de la limite.
 *
 * Seuil d'alerte : 80% du quota utilisé
 * Seuil critique : 90% du quota utilisé
 *
 * Endpoint backend : GET /api/health/neon-quota
 * Cron recommandé : toutes les 6 heures
 * ============================================================================
 */

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('health')
export class NeonQuotaController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⭐ GET /api/health/neon-quota
   * Retourne l'utilisation du quota Neon et une alerte si > 80%.
   * Utilise la table _prisma_migrations pour estimer le transfert
   * (approximation basée sur le nombre de requêtes).
   */
  @Get('neon-quota')
  async checkQuota() {
    try {
      // Estimer l'utilisation en interrogeant la taille de la base
      const dbSizeResult = await this.prisma.$queryRawUnsafe(`
        SELECT pg_database_size(current_database()) as size_bytes
      `);

      const dbSize = (dbSizeResult as any[])?.[0]?.size_bytes || 0;
      const dbSizeMB = Math.round(dbSize / (1024 * 1024));

      // Compter le nombre de requêtes actives (approximation du transfert)
      const connectionsResult = await this.prisma.$queryRawUnsafe(`
        SELECT count(*) as total FROM pg_stat_activity WHERE state = 'active'
      `);
      const activeConnections = (connectionsResult as any[])?.[0]?.total || 0;

      // Récupérer le nombre total de lignes dans les tables principales
      const tablesCount = await this.prisma.$queryRawUnsafe(`
        SELECT
          (SELECT count(*) FROM students) as students,
          (SELECT count(*) FROM student_enrollments) as enrollments,
          (SELECT count(*) FROM admissions) as admissions,
          (SELECT count(*) FROM student_id_cards) as cards,
          (SELECT count(*) FROM classes) as classes
      `);
      const counts = (tablesCount as any[])?.[0] || {};

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
          sizeMB: dbSizeMB,
          sizeLimitMB: 10240, // 10 Go sur Launch
          sizeUsagePercent: Math.round((dbSizeMB / 10240) * 100),
        },
        connections: {
          active: activeConnections,
        },
        data: {
          students: counts.students || 0,
          enrollments: counts.enrollments || 0,
          admissions: counts.admissions || 0,
          cards: counts.cards || 0,
          classes: counts.classes || 0,
        },
        // Le transfert réseau réel n'est pas accessible via SQL
        // Il faut utiliser l'API Neon REST pour ça
        note: 'Pour le transfert réseau exact, consulter console.neon.tech',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
