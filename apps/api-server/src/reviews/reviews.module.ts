import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { StorageService } from '../common/services/storage.service';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, StorageService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
