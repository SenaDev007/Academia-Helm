import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ReviewStatus } from '@prisma/client';
import { CreateReviewDto, UpdateReviewStatusDto } from './reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReviewDto) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    return this.prisma.review.create({
      data: {
        authorName: dto.authorName.trim(),
        authorRole: dto.authorRole?.trim() || null,
        schoolName: dto.schoolName.trim(),
        city: dto.city.trim(),
        photoUrl: dto.photoUrl?.trim() || null,
        rating: dto.rating,
        comment: dto.comment.trim(),
        tenantId: dto.tenantId ?? null,
        status: ReviewStatus.PENDING,
      },
    });
  }

  async getPublished(limit = 9, minRating = 4) {
    const take = Math.min(Math.max(Number(limit) || 9, 1), 50);
    const min = Math.min(Math.max(Number(minRating) || 1, 1), 5);

    const [reviews, agg, grouped] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          status: ReviewStatus.APPROVED,
          rating: { gte: min },
        },
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
        take,
        select: {
          id: true,
          authorName: true,
          authorRole: true,
          schoolName: true,
          city: true,
          photoUrl: true,
          rating: true,
          comment: true,
          featured: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.review.aggregate({
        where: { status: ReviewStatus.APPROVED },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { status: ReviewStatus.APPROVED },
        _count: true,
      }),
    ]);

    const total = agg._count?._all ?? 0;
    const average =
      total > 0 && agg._avg?.rating != null
        ? Math.round(agg._avg.rating * 10) / 10
        : 0;

    const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of grouped) {
      const r = row.rating as 1 | 2 | 3 | 4 | 5;
      if (r >= 1 && r <= 5) {
        counts[r] = row._count;
      }
    }

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (let star = 1 as const; star <= 5; star++) {
      const c = counts[star];
      distribution[star] =
        total > 0 ? Math.round((c / total) * 1000) / 10 : 0;
    }

    return {
      reviews,
      stats: {
        average,
        total,
        distribution,
      },
    };
  }

  async updateStatus(id: string, dto: UpdateReviewStatusDto) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    const publishedAt =
      dto.status === ReviewStatus.APPROVED ? new Date() : null;

    return this.prisma.review.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        publishedAt,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.review.delete({ where: { id } });
    return { ok: true };
  }
}
