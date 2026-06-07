import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule — alias léger pour exporter PrismaService.
 * Le DatabaseModule est global et exporte déjà PrismaService,
 * mais certains modules l'importent explicitement via ce chemin.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
