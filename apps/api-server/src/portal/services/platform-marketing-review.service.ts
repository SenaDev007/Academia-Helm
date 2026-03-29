import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type PublicPlatformReviewDto = {
  id: string;
  quote: string;
  authorLabel: string;
  roleLabel: string;
  organizationLabel: string;
  rating: number;
  verifiedAt: string | null;
};

@Injectable()
export class PlatformMarketingReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(): Promise<PublicPlatformReviewDto[]> {
    const rows = await this.prisma.platformMarketingReview.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        quote: true,
        authorLabel: true,
        roleLabel: true,
        organizationLabel: true,
        rating: true,
        verifiedAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      quote: r.quote,
      authorLabel: r.authorLabel,
      roleLabel: r.roleLabel,
      organizationLabel: r.organizationLabel,
      rating: r.rating,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    }));
  }
}
