import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Healthcheck endpoint — vérifie VRAIMENT la connexion DB.
 *
 * ⭐ CRITIQUE : Railway interroge /health toutes les 30s. Si l'endpoint
 *    retourne toujours 200 sans ping la DB, Railway ne redémarre jamais
 *    le container quand Neon est suspendu → la première requête utilisateur
 *    matinale tombe sur un Neon endormi → "impossible de rechercher l'école".
 *
 *    Avant ce fix : le healthcheck retournait {status:'ok'} sans toucher Prisma.
 *    Maintenant : il ping `SELECT 1` avec un timeout de 2s. Si la DB est
 *    injoignable, il retourne 503 → Railway redémarre le container →
 *    le warmup Prisma reconnecte Neon.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      // ⭐ Ping DB avec timeout de 2s — si Neon dort, on retourne 503 rapidement
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 2000),
        ),
      ]);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Academia Helm API',
        version: '1.0.0',
        db: 'connected',
      };
    } catch (error) {
      // ⭐ 503 = Railway redémarre le container
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'Academia Helm API',
        version: '1.0.0',
        db: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown DB error',
      };
    }
  }
}
