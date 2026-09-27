/**
 * FederisSchoolService — Portail école : validation des rattachements patronat
 *
 * Pattern Helm (PedagogicalDirectorController / AccessRequestsController) :
 * le patronat demande le rattachement (PatronatSchool.status = PENDING, créé
 * par federis-patronat.service.requestSchoolLink) ; l'ÉTABLISSEMENT Helm
 * valide ou refuse depuis son propre portail (/app/federis).
 *
 *   GET   /federis/school/patronats            — demandes reçues par l'école
 *   POST  /federis/school/patronats/:id/approve  — PENDING → JOINED
 *   POST  /federis/school/patronats/:id/reject   — PENDING → REJECTED (motif)
 *   POST  /federis/school/patronats/:id/suspend  — JOINED → SUSPENDED (motif)
 *
 * Garde : tenant courant de type SCHOOL + appartenance de l'utilisateur.
 * Audit des deux côtés (tenant école + tenant patronat).
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Rôles de direction autorisés à valider un rattachement (pattern Helm). */
const SCHOOL_DIRECTION_ROLES = [
  'PROMOTEUR',
  'PROMOTER',
  'SCHOOL_OWNER',
  'DIRECTEUR',
  'DIRECTOR',
  'DIRECTEUR_GENERAL',
  'DIRECTEUR_ETABLISSEMENT',
  'PROVISEUR',
  'ADMIN',
  'SECRETAIRE',
  'SECRETARY',
  'SECRETAIRE_COMPTABLE',
  'SUPER_ADMIN',
];

export class RejectLinkDto {
  reason?: string;
}

export class SuspendLinkDto {
  reason?: string;
}

@Injectable()
export class FederisSchoolService {
  private readonly logger = new Logger(FederisSchoolService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Contexte école : tenant SCHOOL actif + appartenance de l'utilisateur. */
  private async resolveSchoolContext(tenantId: string, userId: string, role?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, type: true, status: true },
    });
    if (!tenant || tenant.status !== 'active') {
      throw new ForbiddenException('Tenant introuvable ou inactif.');
    }
    if (tenant.type !== 'SCHOOL') {
      throw new ForbiddenException(
        "Ces fonctions sont réservées aux établissements Academia Helm (tenant SCHOOL).",
      );
    }

    // Appartenance : tenant direct ou UserTenant
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, role: true, isSuperAdmin: true },
    });
    if (!user) throw new ForbiddenException('Compte introuvable.');

    let belongs = user.tenantId === tenantId || user.isSuperAdmin;
    if (!belongs) {
      const link = await this.prisma.userTenant.findFirst({
        where: { userId, tenantId },
        select: { id: true },
      });
      belongs = !!link;
    }
    if (!belongs) {
      throw new ForbiddenException("Vous n'appartenez pas à cet établissement.");
    }

    // La validation d'un rattachement est une décision de direction /
    // secrétariat — pattern AccessRequestsController (@Roles direction).
    const effectiveRole = role ?? user.role ?? '';
    if (
      !user.isSuperAdmin &&
      !SCHOOL_DIRECTION_ROLES.includes(effectiveRole) &&
      !/^(PROMOTEUR|DIRECTEUR|SECRETAIRE|SECRETAIRE_COMPTABLE)_(MAT|PRI|SEC|MAT_PRI)$/.test(effectiveRole)
    ) {
      throw new ForbiddenException(
        "La validation des rattachements patronat est réservée à la direction et au secrétariat de l'établissement.",
      );
    }

    return { tenant, user };
  }

  /** Statuts lisibles côté école. */
  private statusLabel(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'En attente de votre validation';
      case 'JOINED':
        return 'Rattachée — active';
      case 'REJECTED':
        return 'Demande refusée';
      case 'SUSPENDED':
        return 'Rattachement suspendu';
      default:
        return status;
    }
  }

  /** Demandes de rattachement reçues par l'école (tous statuts). */
  async listPatronats(tenantId: string, userId: string, role?: string) {
    const { tenant } = await this.resolveSchoolContext(tenantId, userId, role);

    const links = await this.prisma.patronatSchool.findMany({
      where: { schoolTenantId: tenant.id },
      include: {
        patronat: {
          select: {
            id: true,
            name: true,
            orgLevel: true,
            territoryName: true,
            primaryEmail: true,
            primaryPhone: true,
            country: { select: { name: true, code: true } },
          },
        },
        academicYear: { select: { name: true, label: true } },
        _count: { select: { candidates: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      school: { id: tenant.id, name: tenant.name },
      pendingCount: links.filter((l) => l.status === 'PENDING').length,
      patronats: links.map((l) => ({
        id: l.id,
        patronat: {
          id: l.patronat?.id,
          name: l.patronat?.name ?? 'Patronat',
          orgLevel: l.patronat?.orgLevel,
          territoryName: l.patronat?.territoryName,
          country: l.patronat?.country?.name,
          email: l.patronat?.primaryEmail,
          phone: l.patronat?.primaryPhone,
        },
        academicYear: l.academicYear?.name,
        status: l.status,
        statusLabel: this.statusLabel(l.status),
        accessLevel: l.accessLevel,
        requestedAt: l.createdAt,
        joinedAt: l.joinedAt,
        suspendedAt: l.suspendedAt,
        suspendedReason: l.suspendedReason,
        candidatesCount: l._count.candidates,
      })),
    };
  }

  /** Charge un lien + vérifie qu'il concerne bien cette école. */
  private async getOwnedLink(tenantId: string, linkId: string) {
    const link = await this.prisma.patronatSchool.findFirst({
      where: { id: linkId, schoolTenantId: tenantId },
      include: { patronat: { select: { id: true, name: true, tenantId: true } } },
    });
    if (!link) {
      throw new NotFoundException("Demande de rattachement introuvable pour cet établissement.");
    }
    return link;
  }

  /** Validation par l'école : PENDING → JOINED. */
  async approveLink(tenantId: string, userId: string, role: string | undefined, linkId: string) {
    const { tenant } = await this.resolveSchoolContext(tenantId, userId, role);
    const link = await this.getOwnedLink(tenant.id, linkId);

    if (link.status !== 'PENDING') {
      throw new BadRequestException(
        'Cette demande ne peut être validée : elle n\'est plus en attente (statut actuel : ' +
          link.status +
          ').',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const done = await tx.patronatSchool.update({
        where: { id: link.id },
        data: { status: 'JOINED', joinedAt: new Date() },
      });
      // Audit côté école ET côté patronat (double traçabilité)
      await tx.auditLog.createMany({
        data: [
          {
            tenantId: tenant.id,
            userId,
            action: 'FEDERIS_SCHOOL_LINK_APPROVED',
            resource: 'PatronatSchool',
            resourceId: link.id,
            tableName: 'patronat_schools',
            recordId: link.id,
            newData: { patronat: link.patronat?.name, status: 'JOINED', by: 'SCHOOL' },
          },
          ...(link.patronat?.tenantId
            ? [
                {
                  tenantId: link.patronat.tenantId,
                  userId,
                  action: 'FEDERIS_SCHOOL_LINK_APPROVED',
                  resource: 'PatronatSchool',
                  resourceId: link.id,
                  tableName: 'patronat_schools',
                  recordId: link.id,
                  newData: { school: tenant.name, status: 'JOINED', by: 'SCHOOL' },
                },
              ]
            : []),
        ],
      });
      return done;
    });

    this.logger.log(
      `Rattachement validé : école « ${tenant.name} » → patronat « ${link.patronat?.name} »`,
    );

    return {
      success: true,
      status: updated.status,
      message: `Rattachement au patronat « ${link.patronat?.name} » validé. Vos élèves peuvent désormais être inscrits à ses examens nationaux.`,
    };
  }

  /** Refus par l'école : PENDING → REJECTED (motif conservé). */
  async rejectLink(
    tenantId: string,
    userId: string,
    role: string | undefined,
    linkId: string,
    dto: RejectLinkDto,
  ) {
    const { tenant } = await this.resolveSchoolContext(tenantId, userId, role);
    const link = await this.getOwnedLink(tenant.id, linkId);

    if (link.status !== 'PENDING') {
      throw new BadRequestException('Seule une demande en attente peut être refusée.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const done = await tx.patronatSchool.update({
        where: { id: link.id },
        data: {
          status: 'REJECTED',
          metadata: {
            rejectedBy: userId,
            rejectedAt: new Date().toISOString(),
            reason: dto.reason?.trim() || null,
            rejectedBySchool: tenant.name,
          },
        },
      });
      await tx.auditLog.createMany({
        data: [
          {
            tenantId: tenant.id,
            userId,
            action: 'FEDERIS_SCHOOL_LINK_REJECTED',
            resource: 'PatronatSchool',
            resourceId: link.id,
            tableName: 'patronat_schools',
            recordId: link.id,
            newData: { patronat: link.patronat?.name, reason: dto.reason?.trim() || null },
          },
          ...(link.patronat?.tenantId
            ? [
                {
                  tenantId: link.patronat.tenantId,
                  userId,
                  action: 'FEDERIS_SCHOOL_LINK_REJECTED',
                  resource: 'PatronatSchool',
                  resourceId: link.id,
                  tableName: 'patronat_schools',
                  recordId: link.id,
                  newData: { school: tenant.name, reason: dto.reason?.trim() || null },
                },
              ]
            : []),
        ],
      });
      return done;
    });

    return {
      success: true,
      status: updated.status,
      message: `Demande de rattachement refusée.`,
    };
  }

  /** Suspension : l'école met fin à un rattachement actif (JOINED → SUSPENDED). */
  async suspendLink(
    tenantId: string,
    userId: string,
    role: string | undefined,
    linkId: string,
    dto: SuspendLinkDto,
  ) {
    const { tenant } = await this.resolveSchoolContext(tenantId, userId, role);
    const link = await this.getOwnedLink(tenant.id, linkId);

    if (link.status !== 'JOINED') {
      throw new BadRequestException('Seul un rattachement actif peut être suspendu.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const done = await tx.patronatSchool.update({
        where: { id: link.id },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendedBy: userId,
          suspendedReason: dto.reason?.trim() || null,
        },
      });
      await tx.auditLog.createMany({
        data: [
          {
            tenantId: tenant.id,
            userId,
            action: 'FEDERIS_SCHOOL_LINK_SUSPENDED',
            resource: 'PatronatSchool',
            resourceId: link.id,
            tableName: 'patronat_schools',
            recordId: link.id,
            newData: { patronat: link.patronat?.name, reason: dto.reason?.trim() || null },
          },
          ...(link.patronat?.tenantId
            ? [
                {
                  tenantId: link.patronat.tenantId,
                  userId,
                  action: 'FEDERIS_SCHOOL_LINK_SUSPENDED',
                  resource: 'PatronatSchool',
                  resourceId: link.id,
                  tableName: 'patronat_schools',
                  recordId: link.id,
                  newData: { school: tenant.name, reason: dto.reason?.trim() || null },
                },
              ]
            : []),
        ],
      });
      return done;
    });

    return {
      success: true,
      status: updated.status,
      message: `Rattachement suspendu. Le patronat « ${link.patronat?.name} » n'a plus accès à vos données.`,
    };
  }
}
