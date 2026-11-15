import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /** Racine — hors préfixe /api (Railway, healthchecks HTTP sur /) */
  @Public()
  @Get()
  getRoot() {
    return {
      status: 'ok',
      message: 'Academia Helm API is running 🚀',
      timestamp: new Date().toISOString(),
    };
  }

  /** Liveness — léger, sans DB (timeout Railway / probes) */
  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      // ⭐ 2026-11-15 — marqueur de build (audit Neon : l'ancien /health sans
      //    version rendait impossible de savoir quel build tourne en prod ;
      //    cette route ÉCLIPSE HealthController — cf. /api/health/db aussi).
      version: '1.0.5',
      service: 'Academia Helm API',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness avec vérification DB — sous /api/ready
   */
  @Public()
  @Get('ready')
  async getReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ready: true,
        timestamp: new Date().toISOString(),
        service: 'academia-hub-api',
        database: 'connected',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Database connection failed';
      throw new HttpException(
        {
          ready: false,
          error: 'Database not available',
          message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

}
