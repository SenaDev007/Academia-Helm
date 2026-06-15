import { Module } from '@nestjs/common';
import { SaraController } from './sara.controller';
import { SaraService } from './sara.service';
import { OpenRouterModule } from '../common/services/openrouter.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [OpenRouterModule, AIModule],
  controllers: [SaraController],
  providers: [SaraService],
  exports: [SaraService],
})
export class SaraModule {}
