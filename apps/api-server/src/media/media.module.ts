import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { ImageOptimizationService } from './image-optimization.service';

@Module({
  controllers: [MediaController],
  providers: [ImageOptimizationService],
  exports: [ImageOptimizationService],
})
export class MediaModule {}
