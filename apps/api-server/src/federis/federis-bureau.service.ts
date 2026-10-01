/**
 * FederisBureauService — CRUD du Bureau du patronat (Academia Federis)
 *
 * « Bureau & Membres » (cahier des charges §7.1 / §11) : composition du bureau
 * institutionnel — Président, Vice-Président, Secrétaire Général, Trésorier…
 *
 * Persisté dans la table patronat_bureau_members (VRAIES données — remplace
 * les données de démonstration de l'ancienne page) :
 *   GET    /federis/patronat/bureau        — composition du bureau
 *   POST   /federis/patronat/bureau        — ajouter un membre
 *   PATCH  /federis/patronat/bureau/:id    — modifier (rôle, identité, état)
 *   DELETE /federis/patronat/bureau/:id    — retirer un membre
 *
 * Règles de protection (pattern FederisUsersService) :
 *   - Lecture : tous les membres du patronat ;
 *   - Création / modification / suppression : COORDONNATEUR uniquement ;
 *   - Un membre lié à un compte utilisateur (userId) reste synchronisé avec
 *     ce compte (l'annuaire bureau est la vitrine publique du personnel).
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import {
  normalizePatronatFunction,
  MANAGE_USERS,
  type PatronatFunction,
} from './federis-roles';

/** Rôles du bureau institutionnel (gouvernance — distincts des fonctions applicatives). */
export const BUREAU_ROLES = {
  PRESIDENT: 'Président',
  VICE_PRESIDENT: 'Vice-Président',
  SECRETAIRE_GENERAL: 'Secrétaire Général',
  SECRETAIRE_GENERAL_ADJOINT: 'Secrétaire Général Adjoint',
  TRESORIER_GENERAL: 'Trésorier Général',
  TRESORIER_ADJOINT: 'Trésorier Adjoint',
  COORDONNATEUR: 'Coordonnateur',
  CHARGE_MISSION: 'Chargé de mission',
  MEMBRE: 'Membre',
  CONSEILLER: 'Conseiller',
} as const;

export type BureauRoleKey = keyof typeof BUREAU_ROLES;
export const BUREAU_ROLE_KEYS = Object.keys(BUREAU_ROLES) as BureauRoleKey[];

export class CreateBureauMemberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName!: string;

  @IsIn(BUREAU_ROLE_KEYS)
  role!: BureauRoleKey;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Lien optionnel vers un compte membre existant (PatronatUser). */
  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdateBureauMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsIn(BUREAU_ROLE_KEYS)
  role?: BureauRoleKey;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  isActive?: boolean;
}

/** Ordre protocolaire d'affichage du bureau. */
const ROLE_ORDER: Record<string, number> = {
  PRESIDENT: 1,
  VICE_PRESIDENT: 2,
  SECRETAIRE_GENERAL: 3,
  SECRETAIRE_GENERAL_ADJOINT: 4,
  TRESORIER_GENERAL: 5,
  TRESORIER_ADJOINT: 6,
  COORDONNATEUR: 7,
  CHARGE_MISSION: 8,
  CONSEILLER: 9,
  MEMBRE: 10,
};

@Injectable()
export class FederisBureauService {
  private readonly logger = new Logger(FederisBureauService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Résout le patronat + la fonction du demandeur (pattern FederisUsersService). */
  private async resolveContext(tenantId: string, userId?: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!patronat) {
      throw new NotFoundException('Aucun espace patronat associé à ce compte.');
    }

    let fn: PatronatFunction = 'VIEWER';
    if (userId) {
      const link = await this.prisma.patronatUser.findFirst({
        where: { tenantId, userId, isActive: true },
        select: { role: true },
      });
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      fn = normalizePatronatFunction(link?.role ?? user?.role);
    }
    return { patronat, fn };
  }

  private assertCoordinator(fn: PatronatFunction): void {
    if (!MANAGE_USERS.includes(fn)) {
      throw new ForbiddenException(
        'La gestion du bureau est réservée au coordonnateur du patronat.',
      );
    }
  }

  /** Composition du bureau (lecture : tous les membres). */
  async listBureau(tenantId: string, userId?: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);

    const members = await this.prisma.patronatBureauMember.findMany({
      where: { patronatId: patronat.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      members: members
        .map((m) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          role: m.role,
          roleLabel: BUREAU_ROLES[m.role as BureauRoleKey] ?? m.role,
          email: m.email,
          phone: m.phone,
          photoUrl: m.photoUrl,
          userId: m.userId,
          isActive: m.isActive,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }))
        // Ordre protocolaire : Président → Vice-Président → Secrétaire → …
        .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)),
      catalog: BUREAU_ROLE_KEYS.map((key) => ({ key, label: BUREAU_ROLES[key] })),
      canManage: MANAGE_USERS.includes(fn),
    };
  }

  /** Ajout d'un membre au bureau (coordonnateur uniquement). */
  async createMember(tenantId: string, userId: string, dto: CreateBureauMemberDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCoordinator(fn);

    // Lien optionnel vers un compte membre du patronat
    let linkedUserId: string | null = null;
    if (dto.userId) {
      const link = await this.prisma.patronatUser.findFirst({
        where: { patronatId: patronat.id, userId: dto.userId, isActive: true },
        select: { userId: true },
      });
      if (!link) {
        throw new BadRequestException(
          "Le compte membre indiqué n'appartient pas à ce patronat.",
        );
      }
      linkedUserId = link.userId;
    }

    const member = await this.prisma.patronatBureauMember.create({
      data: {
        tenantId: patronat.tenantId,
        patronatId: patronat.id,
        userId: linkedUserId,
        role: dto.role,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        isActive: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_BUREAU_MEMBER_CREATED',
        resource: 'PatronatBureauMember',
        resourceId: member.id,
        tableName: 'patronat_bureau_members',
        recordId: member.id,
        newData: { name: `${member.firstName} ${member.lastName}`, role: member.role },
      },
    });

    this.logger.log(
      `Membre de bureau créé : ${member.firstName} ${member.lastName} (${member.role}) — patronat ${patronat.id}`,
    );
    return { success: true, member };
  }

  /** Modification d'un membre (rôle, identité, état). */
  async updateMember(tenantId: string, userId: string, memberId: string, dto: UpdateBureauMemberDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCoordinator(fn);

    const existing = await this.prisma.patronatBureauMember.findFirst({
      where: { id: memberId, patronatId: patronat.id },
    });
    if (!existing) {
      throw new NotFoundException('Membre du bureau introuvable.');
    }

    const member = await this.prisma.patronatBureauMember.update({
      where: { id: memberId },
      data: {
        ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_BUREAU_MEMBER_UPDATED',
        resource: 'PatronatBureauMember',
        resourceId: member.id,
        tableName: 'patronat_bureau_members',
        recordId: member.id,
        newData: {
          name: `${member.firstName} ${member.lastName}`,
          role: member.role,
          isActive: member.isActive,
        },
      },
    });

    return { success: true, member };
  }

  /** Retrait définitif d'un membre du bureau. */
  async deleteMember(tenantId: string, userId: string, memberId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCoordinator(fn);

    const existing = await this.prisma.patronatBureauMember.findFirst({
      where: { id: memberId, patronatId: patronat.id },
    });
    if (!existing) {
      throw new NotFoundException('Membre du bureau introuvable.');
    }

    await this.prisma.patronatBureauMember.delete({ where: { id: memberId } });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_BUREAU_MEMBER_REMOVED',
        resource: 'PatronatBureauMember',
        resourceId: memberId,
        tableName: 'patronat_bureau_members',
        recordId: memberId,
        newData: { name: `${existing.firstName} ${existing.lastName}`, role: existing.role },
      },
    });

    this.logger.log(`Membre de bureau retiré : ${existing.firstName} ${existing.lastName}`);
    return { success: true };
  }
}
