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
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';

export interface SubmitTestimonialDto {
  /** Note 1-5 étoiles */
  rating: number;
  /** Texte du témoignage (min 20 caractères) */
  content: string;
  /** Rôle affiché : "Directeur", "Enseignant", "Secrétaire"... */
  authorRole?: string;
  /** Ville (obligatoire) */
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

/** Adresse email de l'admin qui doit recevoir une notification à chaque avis. */
const ADMIN_NOTIFICATION_EMAIL = 'admin@academiahelm.com';

@Injectable()
export class SaisieMasterTestimonialService {
  private readonly logger = new Logger(SaisieMasterTestimonialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Soumet un nouveau témoignage pour un prospect authentifié.
   * Le prospect doit exister — on dénormalise son nom/école dans le
   * témoignage pour qu'il survive à une éventuelle suppression du compte.
   *
   * Le témoignage est créé avec isPublished=false : il faut qu'un admin
   * le modère avant publication sur la landing.
   *
   * ⭐ Règle anti-spam : un prospect ne peut soumettre qu'un SEUL témoignage.
   * S'il en a déjà un (publié ou en attente), on rejette avec 409 Conflict.
   *
   * ⭐ Notification : un email est envoyé à admin@academiahelm.com pour
   * prévenir l'admin qu'un avis est en attente de modération.
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

    // ⭐ Ville obligatoire (demande utilisateur — pour savoir d'où vient le
    // promoteur qui a laissé l'avis)
    const city = (dto.city || '').trim();
    if (city.length < 2) {
      throw new BadRequestException(
        'La ville est obligatoire',
      );
    }

    // Récupérer le prospect pour dénormaliser l'identité
    const prospect = await this.prisma.saisieMasterProspect.findUnique({
      where: { id: prospectId },
      select: {
        firstName: true,
        lastName: true,
        schoolName: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (!prospect) {
      throw new NotFoundException('Prospect introuvable');
    }

    // ⭐ Anti-spam : vérifier qu'un témoignage n'existe pas déjà pour ce prospect
    const existing = await this.prisma.saisieMasterTestimonial.findFirst({
      where: { prospectId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Vous avez déjà soumis un témoignage. Un seul avis par compte est autorisé.',
      );
    }

    const authorName = `${prospect.firstName} ${prospect.lastName}`.trim();
    const authorRole = (dto.authorRole || 'Directeur').trim();

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

    // ⭐ Envoyer un email de notification à l'admin (best-effort, non bloquant)
    // pour qu'il puisse modérer rapidement l'avis depuis admin.academiahelm.com
    void this.sendAdminNotification(testimonial.id, {
      authorName,
      authorRole,
      schoolName: prospect.schoolName,
      city,
      rating: Math.round(rating),
      content,
      prospectEmail: prospect.email,
      prospectPhone: prospect.phoneNumber,
    }).catch((err) => {
      this.logger.warn(
        `⚠️  Notification email admin échouée pour témoignage #${testimonial.id}: ${err.message}`,
      );
    });

    return {
      id: testimonial.id,
      isPublished: false,
      message:
        'Merci pour votre témoignage ! Il sera publié après validation de notre équipe.',
    };
  }

  /**
   * Envoie un email à admin@academiahelm.com pour prévenir qu'un témoignage
   * est en attente de modération.
   */
  private async sendAdminNotification(
    testimonialId: string,
    data: {
      authorName: string;
      authorRole: string;
      schoolName: string;
      city: string;
      rating: number;
      content: string;
      prospectEmail: string;
      prospectPhone: string | null;
    },
  ): Promise<void> {
    const stars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
    const adminUrl = 'https://admin.academiahelm.com/saisiemaster/testimonials';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau témoignage SaisieMaster à modérer</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f5f7;color:#1a1a1a;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0D1F6E 0%,#1A3A8F 100%);padding:24px;text-align:center;">
    <img src="https://www.academiahelm.com/images/logo-Academia%20Hub.png" alt="Academia Helm" style="height:40px;margin-bottom:8px;" />
    <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700;">Nouveau témoignage SaisieMaster</h1>
    <p style="color:#a8c5f0;font-size:13px;margin:4px 0 0;">À modérer depuis le back-office admin</p>
  </div>

  <!-- Body -->
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
      <h2 style="font-size:16px;color:#0D1F6E;margin:0 0 16px;">Détails du témoignage</h2>

      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:6px 0;color:#666;width:140px;">Auteur</td>
          <td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${data.authorName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Fonction</td>
          <td style="padding:6px 0;color:#1a1a1a;">${data.authorRole}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">École</td>
          <td style="padding:6px 0;color:#1a1a1a;">${data.schoolName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Ville</td>
          <td style="padding:6px 0;color:#1a1a1a;">${data.city}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Email</td>
          <td style="padding:6px 0;color:#1a1a1a;">${data.prospectEmail}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Téléphone</td>
          <td style="padding:6px 0;color:#1a1a1a;">${data.prospectPhone || '—'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Note</td>
          <td style="padding:6px 0;font-size:18px;color:#FCD116;">${stars} <span style="color:#666;font-size:13px;">(${data.rating}/5)</span></td>
        </tr>
      </table>

      <div style="margin-top:20px;padding:16px;background:#f8f9fa;border-left:3px solid #FCD116;border-radius:4px;">
        <p style="margin:0 0 6px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Témoignage</p>
        <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.6;font-style:italic;">${data.content}</p>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${adminUrl}" style="display:inline-block;background:#0D1F6E;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Modérer ce témoignage →
      </a>
    </div>

    <p style="font-size:12px;color:#999;text-align:center;">
      ID : ${testimonialId} · Connectez-vous à admin.academiahelm.com pour valider ou rejeter cet avis.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f4f5f7;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#666;font-size:12px;margin:0;">
      © 2026 Academia Helm — YEHI OR Tech · Parakou, Bénin<br/>
      Notification automatique — SaisieMaster testimonials
    </p>
  </div>
</body>
</html>`;

    await this.emailService.sendEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `📝 Nouveau témoignage SaisieMaster — ${data.authorName} (${data.schoolName}, ${data.city})`,
      html,
      fromName: 'SaisieMaster Notifications',
    });

    this.logger.log(
      `📧 Email de notification envoyé à ${ADMIN_NOTIFICATION_EMAIL} pour témoignage #${testimonialId}`,
    );
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

  // ===========================================================================
  // ⭐ ADMIN : modération des témoignages (depuis admin.academiahelm.com)
  // ===========================================================================

  /**
   * Liste TOUS les témoignages (admin only) — peu importe le statut.
   * Tri : non publiés d'abord (à modérer en priorité), puis plus récents.
   */
  async listAllForAdmin(filters?: {
    onlyPending?: boolean;
    onlyPublished?: boolean;
  }): Promise<
    Array<{
      id: string;
      prospectId: string | null;
      authorName: string;
      authorRole: string;
      schoolName: string;
      city: string | null;
      rating: number;
      content: string;
      isPublished: boolean;
      isFeatured: boolean;
      createdAt: string;
      publishedAt: string | null;
    }>
  > {
    const where: { isPublished?: boolean } = {};
    if (filters?.onlyPending) where.isPublished = false;
    if (filters?.onlyPublished) where.isPublished = true;

    const rows = await this.prisma.saisieMasterTestimonial.findMany({
      where,
      orderBy: [
        { isPublished: 'asc' }, // non publiés d'abord
        { createdAt: 'desc' },
      ],
      take: 200,
    });

    return rows.map((t) => ({
      id: t.id,
      prospectId: t.prospectId,
      authorName: t.authorName,
      authorRole: t.authorRole,
      schoolName: t.schoolName,
      city: t.city,
      rating: t.rating,
      content: t.content,
      isPublished: t.isPublished,
      isFeatured: t.isFeatured,
      createdAt: t.createdAt.toISOString(),
      publishedAt: t.publishedAt ? t.publishedAt.toISOString() : null,
    }));
  }

  /**
   * Publie un témoignage (isPublished=true). Le rend visible sur la landing.
   */
  async publish(id: string): Promise<{ success: boolean }> {
    await this.prisma.saisieMasterTestimonial.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    this.logger.log(`✅ Témoignage #${id} publié par admin`);
    return { success: true };
  }

  /**
   * Dépublie un témoignage (isPublished=false). Le masque de la landing.
   */
  async unpublish(id: string): Promise<{ success: boolean }> {
    await this.prisma.saisieMasterTestimonial.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });
    this.logger.log(`⏸️ Témoignage #${id} dépublié par admin`);
    return { success: true };
  }

  /**
   * Met en avant un témoignage (isFeatured=true). Affiché en priorité sur la landing.
   */
  async feature(id: string): Promise<{ success: boolean }> {
    await this.prisma.saisieMasterTestimonial.update({
      where: { id },
      data: { isFeatured: true },
    });
    this.logger.log(`⭐ Témoignage #${id} mis en avant par admin`);
    return { success: true };
  }

  /**
   * Retire la mise en avant d'un témoignage (isFeatured=false).
   */
  async unfeature(id: string): Promise<{ success: boolean }> {
    await this.prisma.saisieMasterTestimonial.update({
      where: { id },
      data: { isFeatured: false },
    });
    return { success: true };
  }

  /**
   * Supprime définitivement un témoignage.
   */
  async delete(id: string): Promise<{ success: boolean }> {
    await this.prisma.saisieMasterTestimonial.delete({
      where: { id },
    });
    this.logger.log(`🗑️ Témoignage #${id} supprimé par admin`);
    return { success: true };
  }
}
