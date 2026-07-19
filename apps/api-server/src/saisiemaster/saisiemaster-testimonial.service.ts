/**
 * ============================================================================
 * SAISIEMASTER TESTIMONIAL SERVICE
 * ============================================================================
 *
 * Gère les témoignages laissés par les utilisateurs SaisieMaster :
 *  - submit(prospectId, payload) : crée un témoignage (non publié par défaut)
 *  - listMine(prospectId)        : liste les témoignages d'un prospect
 *  - listPublished()             : liste publique pour la landing page
 *
 * Modération :
 *  - Les témoignages sont isPublished=false par défaut.
 *  - Un admin les modère depuis le dashboard platform.
 *  - Une fois publiés, ils s'affichent sur la landing SaisieMaster.
 * ============================================================================
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface SubmitTestimonialDto {
  /** Note 1-5 étoiles */
  rating: number;
  /** Texte du témoignage (min 20 caractères) */
  content: string;
  /** Rôle affiché : "Directeur", "Enseignant", "Secrétaire"... */
  authorRole?: string;
  /** Ville (optionnel) */
  city?: string;
}

export interface PublicTestimonial {
  id: string;
  authorName: string;
  authorRole: string;
  schoolName: string;
  city: string | null;
  rating: number;
  content: string;
  createdAt: string;
}

@Injectable()
export class SaisieMasterTestimonialService {
  private readonly logger = new Logger(SaisieMasterTestimonialService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soumet un nouveau témoignage pour un prospect authentifié.
   * Le prospect doit exister — on dénormalise son nom/école dans le
   * témoignage pour qu'il survive à une éventuelle suppression du compte.
   *
   * Le témoignage est créé avec isPublished=false : il faut qu'un admin
   * le modère avant publication sur la landing.
   */
  async submit(
    prospectId: string,
    dto: SubmitTestimonialDto,
  ): Promise<{
    id: string;
    isPublished: boolean;
    message: string;
  }> {
    if (!prospectId) {
      throw new BadRequestException('prospectId is required');
    }

    // Validation rating
    const rating = Number(dto.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('La note doit être entre 1 et 5');
    }

    // Validation content
    const content = (dto.content || '').trim();
    if (content.length < 20) {
      throw new BadRequestException(
        'Le témoignage doit contenir au moins 20 caractères',
      );
    }
    if (content.length > 2000) {
      throw new BadRequestException(
        'Le témoignage ne peut pas dépasser 2000 caractères',
      );
    }

    // Récupérer le prospect pour dénormaliser l'identité
    const prospect = await this.prisma.saisieMasterProspect.findUnique({
      where: { id: prospectId },
      select: {
        firstName: true,
        lastName: true,
        schoolName: true,
        city: true,
      },
    });

    if (!prospect) {
      throw new NotFoundException('Prospect introuvable');
    }

    const authorName = `${prospect.firstName} ${prospect.lastName}`.trim();
    const authorRole = (dto.authorRole || 'Directeur').trim();
    const city = dto.city?.trim() || prospect.city || null;

    const testimonial = await this.prisma.saisieMasterTestimonial.create({
      data: {
        prospectId,
        authorName,
        authorRole,
        schoolName: prospect.schoolName,
        city,
        rating: Math.round(rating),
        content,
        isPublished: false,
        isFeatured: false,
      },
    });

    this.logger.log(
      `📝 Nouveau témoignage SaisieMaster #${testimonial.id} par ${authorName} (${prospect.schoolName}) — note ${rating}/5`,
    );

    return {
      id: testimonial.id,
      isPublished: false,
      message:
        'Merci pour votre témoignage ! Il sera publié après validation de notre équipe.',
    };
  }

  /**
   * Liste les témoignages d'un prospect (peu importe le statut de publication).
   * Utilisé dans l'éditeur pour montrer à l'utilisateur ses propres avis.
   */
  async listMine(prospectId: string) {
    return this.prisma.saisieMasterTestimonial.findMany({
      where: { prospectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        content: true,
        authorRole: true,
        city: true,
        isPublished: true,
        isFeatured: true,
        createdAt: true,
        publishedAt: true,
      },
    });
  }

  /**
   * Liste publique des témoignages publiés, pour la landing page.
   * Tri : featured d'abord, puis plus récents.
   */
  async listPublished(limit = 12): Promise<PublicTestimonial[]> {
    const rows = await this.prisma.saisieMasterTestimonial.findMany({
      where: { isPublished: true },
      orderBy: [
        { isFeatured: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: Math.min(Math.max(limit, 1), 50),
    });

    return rows.map((t) => ({
      id: t.id,
      authorName: t.authorName,
      authorRole: t.authorRole,
      schoolName: t.schoolName,
      city: t.city,
      rating: t.rating,
      content: t.content,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
