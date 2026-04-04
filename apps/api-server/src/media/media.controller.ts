import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageOptimizationService } from './image-optimization.service';
import { OptimizeImageDto } from './dto/optimize-image.dto';

/**
 * Optimisation d’images (Sharp) — à appeler avant persistance lourde (identité, uploads).
 */
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly imageOptimization: ImageOptimizationService) {}

  @Post('optimize')
  @HttpCode(200)
  @Throttle({ medium: { limit: 40, ttl: 60000 } })
  async optimize(@Body() body: OptimizeImageDto) {
    return this.imageOptimization.optimizeDataUrl(body.dataUrl);
  }
}
