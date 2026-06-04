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

  /**
   * DEBUG — Diagnostic DB temporaire (à retirer après débogage)
   */
  @Public()
  @Get('debug/db-check')
  async debugDbCheck() {
    try {
      const staffCount = await this.prisma.staff.count();
      const staffSample = await this.prisma.staff.findMany({ take: 3 });
      const tenantCount = await this.prisma.tenant.count();
      const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
      const yearCount = await this.prisma.academicYear.count();
      const rawStaff: any = await this.prisma.$queryRaw`SELECT count(*)::int as count FROM staff`;
      const dbName: any = await this.prisma.$queryRaw`SELECT current_database() as db`;

      return {
        staffCount,
        staffSample: staffSample.map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, tenantId: s.tenantId })),
        tenantCount,
        tenants,
        yearCount,
        rawStaffCount: rawStaff,
        currentDatabase: dbName,
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET',
      };
    } catch (error: any) {
      return {
        error: error.message,
        code: error.code,
        meta: error.meta,
      };
    }
  }
}
