import { Module } from '@nestjs/common';
import { AtlasController } from './atlas.controller';
import { AtlasService } from './atlas.service';
// PrismaService retiré — fourni globalement par DatabaseModule (@Global)
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [AtlasController],
  providers: [AtlasService],
  exports: [AtlasService],
})
export class AtlasModule {}
