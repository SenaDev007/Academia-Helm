import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ReviewSource, ReviewStatus } from '@prisma/client';
import { CreateReviewDto, UpdateReviewStatusDto } from './reviews.dto';

/**
 * Détermine le logo d'un tenant (TenantIdentityProfile active → SchoolSettings → School.logo).
 * Retourne une URL publique prête à être affichée sur le landing page.
 */
async function resolveTenantLogo(
  prisma: PrismaService,
  tenantId: string,
): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      schoolSettings: { select: { logoUrl: true } },
      schools: { select: { logo: true } },
      identityProfiles: {
        where: { isActive: true },
        select: { logoUrl: true },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });
  if (!tenant) return null;
  return (
    tenant.identityProfiles?.[0]?.logoUrl ||
    tenant.schoolSettings?.logoUrl ||
    tenant.schools?.logo ||
    null
  );
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReviewDto) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    // ─── Reviews déposées depuis l'application par un tenant authentifié ───
    // Si un tenantId valide est fourni, on approuve immédiatement l'avis et on
    // attache le logo de l'école comme photoUrl (sauf si l'utilisateur a
    // explicitement fourni sa propre photo — cas des enseignants/parents
    // connectés qui envoient une photo personnalisée).
    // ─── Reviews déposées depuis le landing page public (sans tenantId) ───
    // Elles restent PENDING jusqu'à modération admin.
    let status: ReviewStatus = ReviewStatus.PENDING;
    let publishedAt: Date | null = null;
    let photoUrl: string | null = dto.photoUrl?.trim() || null;
    let tenantVerified = false;

    if (dto.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: dto.tenantId },
        select: { id: true },
      });
      if (tenant) {
        tenantVerified = true;
        status = ReviewStatus.APPROVED;
        publishedAt = new Date();
        // Si l'utilisateur n'a pas fourni de photo, on utilise le logo de
        // l'école : c'est ce qui sera affiché sur le landing page public.
        if (!photoUrl) {
          photoUrl = await resolveTenantLogo(this.prisma, dto.tenantId);
        }
      }
    }

    return this.prisma.review.create({
      data: {
        authorName: dto.authorName.trim(),
        authorRole: dto.authorRole?.trim() || null,
        schoolName: dto.schoolName.trim(),
        city: dto.city.trim(),
        photoUrl,
        rating: dto.rating,
        comment: dto.comment.trim(),
        tenantId: tenantVerified ? dto.tenantId : null,
        status,
        publishedAt,
        source: tenantVerified ? ReviewSource.IN_APP : ReviewSource.MANUAL,
      },
    });
  }

  async getPublished(limit = 9, minRating = 4) {
    const take = Math.min(Math.max(Number(limit) || 9, 1), 50);
    const min = Math.min(Math.max(Number(minRating) || 1, 1), 5);

    const [reviewsRaw, agg, grouped] = await Promise.all([
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
          tenantId: true,
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

    // ─── Enrichir chaque review avec le logo du tenant (si applicable) ───
    // Pour les avis déposés depuis l'application par un tenant, on expose le
    // logo de l'école en plus de la photo de l'auteur. Le front-end l'utilise
    // pour distinguer visuellement "avis école" (logo) vs "avis enseignant /
    // parent" (initiales ou photo fournie).
    const tenantIds = Array.from(
      new Set(
        reviewsRaw
          .map((r) => r.tenantId)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const tenantLogoMap = new Map<string, string | null>();
    if (tenantIds.length > 0) {
      const tenants = await this.prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: {
          id: true,
          schoolSettings: { select: { logoUrl: true } },
          schools: { select: { logo: true } },
          identityProfiles: {
            where: { isActive: true },
            select: { logoUrl: true, tenantId: true },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });
      for (const t of tenants) {
        const logo =
          t.identityProfiles?.[0]?.logoUrl ||
          t.schoolSettings?.logoUrl ||
          t.schools?.logo ||
          null;
        tenantLogoMap.set(t.id, logo);
      }
    }

    const reviews = reviewsRaw.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorRole: r.authorRole,
      schoolName: r.schoolName,
      city: r.city,
      photoUrl: r.photoUrl,
      rating: r.rating,
      comment: r.comment,
      featured: r.featured,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      tenantId: r.tenantId,
      tenantLogoUrl: r.tenantId ? tenantLogoMap.get(r.tenantId) ?? null : null,
    }));

    const total = agg._count ?? 0;
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

  /**
   * Liste les avis en attente de modération (admin dashboard).
   */
  async getPending() {
    return this.prisma.review.findMany({
      where: { status: ReviewStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        authorName: true,
        authorRole: true,
        schoolName: true,
        city: true,
        photoUrl: true,
        rating: true,
        comment: true,
        createdAt: true,
        tenantId: true,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateReviewStatusDto) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    const publishedAt =
      dto.status === ReviewStatus.APPROVED
        ? existing.publishedAt ?? new Date()
        : null;

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
