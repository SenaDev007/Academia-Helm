import { Module } from '@nestjs/common';
import { AtlasController } from './atlas.controller';
import { AtlasService } from './atlas.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [AtlasController],
  providers: [AtlasService, PrismaService],
  exports: [AtlasService],
})
export class AtlasModule {}
