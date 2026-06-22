import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DataUrlValidationPipe } from '../common/pipes/data-url-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewStatusDto } from './reviews.dto';

const REVIEW_PHOTO_LIMITS = {
  // 2 Mo max pour une photo de profil — suffisant pour un avatar 512x512.
  maxFileSize: 2 * 1024 * 1024,
  allowedMime: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
  ],
};

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
  ) {}

  @Public()
  @Throttle({ medium: { limit: 20, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.reviewsService.create(dto);
  }

  /**
   * Vérifie si un tenant a déjà soumis un avis/témoignage.
   * Endpoint public (pas d'auth requise) — utilisé par le frontend
   * pour désactiver pro-activement le bouton "Donner mon avis" sans
   * attendre que l'utilisateur remplisse le formulaire.
   *
   * Réponse : `{ hasReview: boolean, review?: {...} }`
   */
  @Public()
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @Get('check-tenant/:tenantId')
  checkTenant(@Param('tenantId') tenantId: string) {
    return this.reviewsService.checkTenantReview(tenantId);
  }

  /**
   * Upload photo via data URL (base64) — pattern standard Helm.
   * Body: { photoDataUrl: string }
   *
   * Le frontend compresse l'image côté navigateur et envoie le data URL en JSON.
   * Le data URL est retourné tel quel et sera stocké directement dans review.photoUrl.
   *
   * Limite : 2 Mo, formats image uniquement.
   *
   * Convention nom endpoint : POST /<resource>/upload-<type>
   */
  @Public()
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @Post('upload-photo')
  async uploadPhotoDataUrl(
    @Body('photoDataUrl', new DataUrlValidationPipe({
      allowedMimeTypes: REVIEW_PHOTO_LIMITS.allowedMime,
      maxBytes: REVIEW_PHOTO_LIMITS.maxFileSize,
      fieldName: 'photoDataUrl',
    })) photoDataUrl: string,
  ) {
    // Le pipe a déjà validé le format, le MIME type et la taille.
    // Retourner le data URL tel quel — il sera stocké directement dans review.photoUrl.
    return { url: photoDataUrl };
  }

  @Public()
  @Get('published')
  getPublished(
    @Query('limit') limit?: string,
    @Query('minRating') minRating?: string,
  ) {
    return this.reviewsService.getPublished(
      limit ? parseInt(limit, 10) : 9,
      minRating ? parseInt(minRating, 10) : 4,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Patch('admin/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviewsService.updateStatus(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('admin/pending')
  getPending() {
    return this.reviewsService.getPending();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Delete('admin/:id')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
