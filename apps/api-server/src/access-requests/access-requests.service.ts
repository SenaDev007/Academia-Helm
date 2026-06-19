/**
 * ============================================================================
 * ACCESS REQUESTS SERVICE — Demandes d'accès PLATFORM_OWNER aux écoles
 * ============================================================================
 *
 * Flow :
 *   1. PLATFORM_OWNER tente de se connecter à une école via /login?portal=school
 *   2. auth.service.ts appelle checkOrCreateAccessRequest()
 *   3. Si PENDING → refuse le login + notifie le directeur/promoteur
 *   4. Si APPROVED → autorise le login
 *   5. Le directeur/promoteur peut approuver, refuser ou révoquer
 * ============================================================================
 */

import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';

@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Vérifie si un PLATFORM_OWNER a un accès approuvé à un tenant.
   * Si non, crée une demande PENDING et notifie le directeur/promoteur.
   *
   * @returns 'APPROVED' si accès autorisé, sinon lève ForbiddenException
   */
  async checkOrCreateAccessRequest(params: {
    platformOwnerId: string;
    tenantId: string;
    portalType: string;
    platformOwnerEmail: string;
    platformOwnerName: string;
  }): Promise<'APPROVED'> {
    const { platformOwnerId, tenantId, portalType, platformOwnerEmail, platformOwnerName } = params;

    // 1. Vérifier s'il existe une demande APPROVED (non révoquée)
    const approved = await this.prisma.platformOwnerAccessRequest.findFirst({
      where: {
        platformOwnerId,
        tenantId,
        status: 'APPROVED',
      },
    });

    if (approved) {
      return 'APPROVED';
    }

    // 2. Vérifier s'il existe déjà une demande PENDING
    const pending = await this.prisma.platformOwnerAccessRequest.findFirst({
      where: {
        platformOwnerId,
        tenantId,
        status: 'PENDING',
      },
    });

    if (pending) {
      throw new ForbiddenException(
        `PORTAL_ACCESS_PENDING:Votre demande d'accès à cet établissement est en attente d'approbation du directeur. ` +
        `Vous recevrez une notification dès qu'elle sera traitée.`,
      );
    }

    // 3. Créer une nouvelle demande PENDING
    await this.prisma.platformOwnerAccessRequest.create({
      data: {
        platformOwnerId,
        tenantId,
        portalType,
        status: 'PENDING',
      },
    });

    // 4. Notifier le directeur / promoteur de l'école
    await this.notifySchoolDirectors(tenantId, platformOwnerName, platformOwnerEmail, portalType);

    throw new ForbiddenException(
      `PORTAL_ACCESS_REQUESTED:Votre demande d'accès a été envoyée au directeur de l'établissement. ` +
      `Vous recevrez une notification par email dès qu'elle sera approuvée.`,
    );
  }

  /**
   * Liste les demandes d'accès pour un tenant (pour le directeur/promoteur).
   */
  async listByTenant(tenantId: string) {
    return this.prisma.platformOwnerAccessRequest.findMany({
      where: { tenantId },
      include: {
        platformOwner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  /**
   * Approuve une demande d'accès.
   * Only DIRECTOR or PROMOTER roles can approve.
   */
  async approve(requestId: string, reviewerId: string, reviewNote?: string) {
    const request = await this.prisma.platformOwnerAccessRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Demande d\'accès non trouvée');
    }

    if (request.status !== 'PENDING') {
      throw new ForbiddenException('Cette demande a déjà été traitée');
    }

    const updated = await this.prisma.platformOwnerAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        reviewNote: reviewNote || null,
      },
    });

    this.logger.log(`Access request ${requestId} approved by ${reviewerId}`);

    // Notifier le PLATFORM_OWNER que son accès est approuvé
    await this.notifyPlatformOwnerApproved(request.platformOwnerId, request.tenantId);

    return updated;
  }

  /**
   * Refuse une demande d'accès.
   */
  async reject(requestId: string, reviewerId: string, reviewNote?: string) {
    const request = await this.prisma.platformOwnerAccessRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Demande d\'accès non trouvée');
    }

    if (request.status !== 'PENDING') {
      throw new ForbiddenException('Cette demande a déjà été traitée');
    }

    const updated = await this.prisma.platformOwnerAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        reviewNote: reviewNote || null,
      },
    });

    this.logger.log(`Access request ${requestId} rejected by ${reviewerId}`);

    return updated;
  }

  /**
   * Révoque un accès précédemment approuvé.
   * Le directeur ou le promoteur peut révoquer à tout moment.
   */
  async revoke(requestId: string, revokerId: string, reviewNote?: string) {
    const request = await this.prisma.platformOwnerAccessRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Demande d\'accès non trouvée');
    }

    if (request.status !== 'APPROVED') {
      throw new ForbiddenException('Seul un accès approuvé peut être révoqué');
    }

    const updated = await this.prisma.platformOwnerAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: revokerId,
        reviewNote: reviewNote || null,
      },
    });

    this.logger.log(`Access request ${requestId} revoked by ${revokerId}`);

    return updated;
  }

  /**
   * Notifie le directeur et le promoteur de l'école qu'un PLATFORM_OWNER
   * a demandé un accès.
   */
  private async notifySchoolDirectors(
    tenantId: string,
    platformOwnerName: string,
    platformOwnerEmail: string,
    portalType: string,
  ) {
    try {
      // Trouver les utilisateurs avec le rôle DIRECTOR ou PROMOTER dans ce tenant
      const directors = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ['DIRECTOR', 'PROMOTER', 'ADMIN'] },
          status: { not: 'SUSPENDED' },
        },
        select: { email: true, firstName: true, lastName: true },
      });

      if (directors.length === 0) {
        this.logger.warn(`No directors found for tenant ${tenantId} to notify`);
        return;
      }

      // Récupérer le nom de l'école
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      const schoolName = tenant?.name || 'votre établissement';

      // Envoyer un email à chaque directeur/promoteur
      for (const director of directors) {
        const subject = `Nouvelle demande d'accès plateforme — ${schoolName}`;
        const html = `
          <h2 style="color:#0b2f73;">Nouvelle demande d'accès</h2>
          <p>Bonjour ${director.firstName} ${director.lastName},</p>
          <p><strong>${platformOwnerName}</strong> (${platformOwnerEmail}) a demandé un accès
          au portail <strong>${portalType}</strong> de <strong>${schoolName}</strong> sur Academia Helm.</p>
          <p>Pour approuver ou refuser cette demande, connectez-vous à votre espace Academia Helm
          et rendez-vous dans la section "Demandes d'accès".</p>
          <p style="color:#64748b;font-size:14px;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
          <p style="color:#0b2f73;font-weight:600;">Academia Helm</p>
        `;

        await this.emailService.sendCategorized({
          tenantId,
          category: 'ADMINISTRATIF',
          subCategory: 'demande_acces_plateforme',
          module: 'access-requests',
          to: director.email,
          toName: `${director.firstName} ${director.lastName}`,
          subject,
          html,
          recipientType: 'STAFF',
          recipientId: director.id,
          triggeredBy: 'SYSTEM',
          relatedEntityType: 'AccessRequest',
        });
      }

      this.logger.log(`Notified ${directors.length} directors about access request for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(`Failed to notify school directors: ${err?.message}`);
      // Non-bloquant — la demande est créée même si la notification échoue
    }
  }

  /**
   * Notifie le PLATFORM_OWNER que son accès a été approuvé.
   */
  private async notifyPlatformOwnerApproved(platformOwnerId: string, tenantId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: platformOwnerId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (!user) return;

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      const schoolName = tenant?.name || 'l\'établissement';

      await this.emailService.sendCategorized({
        tenantId,
        category: 'ADMINISTRATIF',
        subCategory: 'acces_approuve',
        module: 'access-requests',
        to: user.email,
        toName: `${user.firstName} ${user.lastName}`,
        subject: `Accès approuvé — ${schoolName}`,
        html: `
          <h2 style="color:#0b2f73;">Votre accès a été approuvé</h2>
          <p>Bonjour ${user.firstName} ${user.lastName},</p>
          <p>Votre demande d'accès à <strong>${schoolName}</strong> sur Academia Helm a été approuvée.</p>
          <p>Vous pouvez maintenant vous connecter au portail de l'établissement.</p>
          <p style="color:#64748b;font-size:14px;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
          <p style="color:#0b2f73;font-weight:600;">Équipe Academia Helm</p>
        `,
        recipientType: 'STAFF',
        recipientId: user.id,
        triggeredBy: 'SYSTEM',
        relatedEntityType: 'AccessRequest',
      });
    } catch (err) {
      this.logger.error(`Failed to notify platform owner: ${err?.message}`);
    }
  }
}
