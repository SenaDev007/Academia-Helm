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
    // ── Fire-and-forget : ne pas bloquer le démarrage de NestJS ──
    // Ces opérations (triggers SQL, finance, HR fix) peuvent prendre 10-30s
    // chacune. Si on les attend, NestJS ne commence pas à écouter sur le port
    // 3000 → Fly.io health check échoue → 503.
    //
    // On les lance en arrière-plan. NestJS commence à écouter immédiatement.
    // Les triggers seront appliqués pendant que l'app tourne (idempotent).
    this.bootstrap.runModule1Triggers().catch((err) =>
      console.error('[DatabaseBootstrap] runModule1Triggers failed:', err?.message || err),
    );
    this.bootstrap.runFinanceTriggers().catch((err) =>
      console.error('[DatabaseBootstrap] runFinanceTriggers failed:', err?.message || err),
    );
    this.bootstrap.runHrStatusDataFix().catch((err) =>
      console.error('[DatabaseBootstrap] runHrStatusDataFix failed:', err?.message || err),
    );
  }
}
