import { Module } from '@nestjs/common';
import { ContextController } from './context.controller';
import { ContextService } from './context.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [ContextController],
  providers: [ContextService, PrismaService],
  exports: [ContextService],
})
export class ContextModule {}
