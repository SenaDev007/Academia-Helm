import { Module } from '@nestjs/common';
import { SaraController } from './sara.controller';
import { SaraService } from './sara.service';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [SaraController],
  providers: [SaraService],
  exports: [SaraService],
})
export class SaraModule {}
