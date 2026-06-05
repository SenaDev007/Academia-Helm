import { Module, Global, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseTriggersBootstrapService } from './database-triggers-bootstrap.service';

/**
 * ============================================================================
 * DATABASE MODULE — PRISMA ONLY (TypeORM REMOVED)
 * ============================================================================
 *
 * TypeORM a été complètement supprimé pour résoudre le crash OOM Railway.
 * Tous les repositories utilisent désormais PrismaService.
 *
 * Avantages:
 * - Un seul ORM chargé en mémoire (-500MB+)
 * - Un seul pool de connexion PostgreSQL
 * - Pas de double chargement des métadonnées d'entités
 * ============================================================================
 */

@Global() // Global pour que PrismaService soit disponible partout
@Module({
  imports: [],
  providers: [PrismaService, DatabaseTriggersBootstrapService],
  exports: [PrismaService],
})
export class DatabaseModule implements OnApplicationBootstrap {
  constructor(private readonly bootstrap: DatabaseTriggersBootstrapService) {}

  async onApplicationBootstrap() {
    // Exécuter les triggers critiques au démarrage
    await this.bootstrap.runModule1Triggers();
    await this.bootstrap.runFinanceTriggers();
  }
}
