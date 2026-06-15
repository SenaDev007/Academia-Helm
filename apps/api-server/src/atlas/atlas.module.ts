import { Module } from '@nestjs/common';
import { AtlasController } from './atlas.controller';
import { AtlasService } from './atlas.service';
import { PrismaService } from '../database/prisma.service';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [AtlasController],
  providers: [AtlasService, PrismaService],
  exports: [AtlasService],
})
export class AtlasModule {}
