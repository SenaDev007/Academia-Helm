import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Healthcheck endpoints — liveness SANS base de données.
 *
 * ⭐ AUDIT COÛT NEON (2026-11-03) : /health faisait `SELECT 1` et Railway
 *    l'interroge toutes les 30 s → 2 880 requêtes/jour qui maintenaient le
 *    compute Neon éveillé 24/7 (scale-to-zero totalement neutralisé, ~$65/mois).
 *
 *    - GET /health    → liveness pure (200 tant que le process vit).
 *      C'est LE point surveillé par Railway : il ne doit JAMAIS dépendre de
 *      la DB. Neon se réveille tout seul (sous la seconde pour un SELECT) à
 *      la première vraie requête ; l'app tolère déjà le cold start
 *      (connectionTimeoutMillis 30 s + retry $extends dans PrismaService
 *      + warm-up login côté front).
 *    - GET /health/db → deep-check diagnostic (ping DB réel avec timeout 2 s).
 *      À appeler ponctuellement pour diagnostiquer, PAS pour monitorer.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    // ⭐ Liveness pur — ne touche PAS Prisma : sinon le healthcheck Railway
    //    réveille Neon toutes les 30 s et le scale-to-zero ne sert à rien.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Academia Helm API',
      version: '1.0.0',
    };
  }

  @Get('db')
  async checkDb() {
    try {
      // Ping DB avec timeout de 2 s — si Neon dort, il répond quand même
      // (cold start ~5-10 s absorbé par le timeout 30 s des vraies requêtes).
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 2000),
        ),
      ]);

      return {
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        db: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown DB error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
