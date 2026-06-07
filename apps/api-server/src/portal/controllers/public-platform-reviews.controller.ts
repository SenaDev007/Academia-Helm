import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { PlatformMarketingReviewService } from '../services/platform-marketing-review.service';

@Controller('public/platform-reviews')
@Public()
export class PublicPlatformReviewsController {
  constructor(private readonly reviews: PlatformMarketingReviewService) {}

  @Get()
  @Throttle({ medium: { limit: 60, ttl: 60000 } })
  async list() {
    const reviews = await this.reviews.listPublished();
    return { reviews };
  }
}
