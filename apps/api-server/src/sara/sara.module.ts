import { Module } from '@nestjs/common';
import { SaraController } from './sara.controller';
import { SaraService } from './sara.service';
import { SiteContentService } from './site-content.service';
import { VoiceService } from './voice.service';
import { OpenRouterModule } from '../common/services/openrouter.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [OpenRouterModule, AIModule],
  controllers: [SaraController],
  providers: [SaraService, SiteContentService, VoiceService],
  exports: [SaraService, VoiceService],
})
export class SaraModule {}
