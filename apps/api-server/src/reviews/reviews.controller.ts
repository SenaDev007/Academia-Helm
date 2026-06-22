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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewStatusDto } from './reviews.dto';
import { StorageService } from '../common/services/storage.service';

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
    private readonly storage: StorageService,
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
   * Upload public d'une photo de profil pour un avis déposé depuis le landing
   * page public (enseignant / parent / élève). L'URL retournée doit ensuite
   * être passée dans `photoUrl` du POST /reviews.
   *
   * Limite : 2 Mo, formats image uniquement.
   */
  @Public()
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @Post('upload-photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: REVIEW_PHOTO_LIMITS.maxFileSize },
    }),
  )
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier envoyé (champ "photo").');
    }
    if (!REVIEW_PHOTO_LIMITS.allowedMime.includes(file.mimetype)) {
      throw new BadRequestException(
        `Format non supporté : ${file.mimetype}. Formats acceptés : JPG, PNG, WebP, AVIF.`,
      );
    }
    const url = await this.storage.uploadFile(file, 'reviews-photos');
    return { url };
  }

  /**
   * Upload photo via data URL (base64) — pattern identique au logo école.
   * Body: { photoDataUrl: string }
   *
   * Le frontend compresse l'image côté navigateur et envoie le data URL en JSON.
   * Le data URL est retourné tel quel et sera stocké directement dans review.photoUrl.
   */
  @Public()
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @Post('upload-photo-data')
  async uploadPhotoDataUrl(@Body() body: { photoDataUrl: string }) {
    if (!body?.photoDataUrl || typeof body.photoDataUrl !== 'string') {
      throw new BadRequestException('photoDataUrl requis (data URL base64)');
    }
    const trimmed = body.photoDataUrl.trim();
    const m = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!m) {
      throw new BadRequestException('Format attendu : data URL base64 (data:image/...;base64,...).');
    }
    const mimeType = m[1].trim().toLowerCase();
    if (!REVIEW_PHOTO_LIMITS.allowedMime.includes(mimeType)) {
      throw new BadRequestException(
        `Format non supporté : ${mimeType}. Formats acceptés : JPG, PNG, WebP, AVIF.`,
      );
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(m[2], 'base64');
    } catch {
      throw new BadRequestException('Base64 invalide.');
    }
    if (buffer.length > REVIEW_PHOTO_LIMITS.maxFileSize) {
      throw new BadRequestException(
        `Image trop volumineuse (max ${Math.round(REVIEW_PHOTO_LIMITS.maxFileSize / 1024)} Ko).`,
      );
    }
    // Retourner le data URL tel quel — il sera stocké directement dans review.photoUrl
    return { url: trimmed };
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
