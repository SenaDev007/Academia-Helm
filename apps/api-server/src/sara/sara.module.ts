import { Module } from '@nestjs/common';
import { SaraController } from './sara.controller';
import { SaraService } from './sara.service';

@Module({
  controllers: [SaraController],
  providers: [SaraService],
  exports: [SaraService],
})
export class SaraModule {}
