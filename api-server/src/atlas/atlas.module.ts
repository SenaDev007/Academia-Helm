import { Module } from '@nestjs/common';
import { AtlasController } from './atlas.controller';
import { AtlasService } from './atlas.service';
import { OpenRouterModule } from '../common/services/openrouter.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [OpenRouterModule, AIModule],
  controllers: [AtlasController],
  providers: [AtlasService],
  exports: [AtlasService],
})
export class AtlasModule {}
