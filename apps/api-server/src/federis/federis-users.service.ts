/**
 * FederisUsersService — Gestion des comptes membres d'un patronat
 *
 * Pattern Helm (staff-credential.service) adapté à Federis : le COORDONNATEUR
 * (responsable du patronat) crée les comptes des autres membres — secrétaire,
 * trésorier, organisateur, chargé de mission. Chaque compte :
 *   - User (rôle PATRONAT_<FONCTION>, tenant = tenant du patronat) → login
 *     portail PATRONAT avec auto-résolution du tenant (auth.service)
 *   - PatronatUser (lien patronat ↔ user, clé de fonction)
 *   - PatronatBureauMember (annuaire « Bureau & Membres »)
 *   - AuditLog (traçabilité — jamais de suppression physique)
 *
 * Règles de protection :
 *   - Seul le COORDONNATEUR gère les comptes (403 sinon)
 *   - Impossible de désactiver / rétrograder le dernier coordonnateur actif
 *   - Impossible de désactiver son propre compte
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import {
  CREATABLE_FUNCTIONS,
  MANAGE_USERS,
  PATRONAT_FUNCTIONS,
  normalizePatronatFunction,
  patronatFunctionLabel,
  type PatronatFunction,
  type PatronatFunctionKey,
} from './federis-roles';

export class CreatePatronatUserDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  phone?: string;
  /** Fonction : COORDONNATEUR | SECRETAIRE | TRESORIER | ORGANISATEUR | CHARGE_MISSION */
  function!: PatronatFunctionKey;
  password!: string;
}

export class UpdatePatronatUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  function?: PatronatFunctionKey;
  isActive?: boolean;
}

export class ResetPatronatUserPasswordDto {
  password!: string;
}

@Injectable()
export class FederisUsersService {
  private readonly logger = new Logger(FederisUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Résolution du demandeur ──────────────────────────────────────────────

  /**
   * Résout le patronat + la fonction du demandeur.
   * Le tenant du JWT est la source primaire ; le lien PatronatUser fournit la
   * fonction (fallback : User.role du JWT, normalisé).
   */
  async resolveContext(tenantId: string, userId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        orgLevel: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    });
    if (!patronat) {
      throw new NotFoundException('Aucun espace patronat associé à ce compte.');
    }

    const link = await this.prisma.patronatUser.findFirst({
      where: { tenantId, userId, isActive: true },
      select: { id: true, role: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    const fn = normalizePatronatFunction(link?.role ?? user?.role);
    return { patronat, fn, linkId: link?.id ?? null, userEmail: user?.email ?? null };
  }

  /** Garde : réservé au coordonnateur. */
  assertCoordinator(fn: PatronatFunction): void {
    if (!MANAGE_USERS.includes(fn)) {
      throw new ForbiddenException(
        'La gestion des comptes est réservée au coordonnateur du patronat.',
      );
    }
  }

  // ── Liste des membres ────────────────────────────────────────────────────

  async listUsers(tenantId: string, userId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCoordinator(fn);

    const members = await this.prisma.patronatUser.findMany({
      where: { tenantId: patronat.tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastLogin: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Téléphones depuis l'annuaire du bureau (User n'a pas de colonne phone)
    const bureau = await this.prisma.patronatBureauMember.findMany({
      where: { tenantId: patronat.tenantId },
      select: { userId: true, phone: true },
    });
    const phonesByUser = new Map(
      bureau.filter((b) => b.userId).map((b) => [b.userId as string, b.phone]),
    );

    return {
      members: members.map((m) => {
        const normalized = normalizePatronatFunction(m.role);
        return {
          id: m.id,
          userId: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          phone: phonesByUser.get(m.user.id) ?? null,
          function: normalized,
          functionLabel: patronatFunctionLabel(normalized),
          isActive: m.isActive && m.user.status === 'active',
          lastLoginAt: m.user.lastLogin,
          createdAt: m.user.createdAt,
          isSelf: m.user.id === userId,
        };
      }),
      catalog: CREATABLE_FUNCTIONS.map((key) => ({
        key,
        ...PATRONAT_FUNCTIONS[key],
      })),
    };
  }

  // ── Création d'un compte membre ─────────────────────────────────────────

  async createUser(tenantId: string, userId: string, dto: CreatePatronatUserDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCoordinator(fn);

    const firstName = dto.firstName?.trim() ?? '';
    const lastName = dto.lastName?.trim() ?? '';
    const email = dto.email?.trim().toLowerCase() ?? '';
    const phone = dto.phone?.trim() ?? '';

    if (!firstName || !lastName) {
      throw new BadRequestException('Le prénom et le nom sont requis.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Adresse email invalide.');
    }
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (!CREATABLE_FUNCTIONS.includes(dto.function)) {
      throw new BadRequestException(
        `Fonction invalide. Fonctions acceptées : ${CREATABLE_FUNCTIONS.join(', ')}.`,
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        'Un compte existe déjà avec cet email. Chaque membre doit avoir un email unique.',
      );
    }

    const conf = PATRONAT_FUNCTIONS[dto.function];
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: patronat.tenantId,
          email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          role: conf.userRole,
          status: 'active',
        },
      });

      await tx.patronatUser.create({
        data: {
          patronatId: patronat.id,
          tenantId: patronat.tenantId,
          userId: user.id,
          role: dto.function,
          isActive: true,
          createdBy: userId,
        },
      });

      // Annuaire « Bureau & Membres »
      await tx.patronatBureauMember.create({
        data: {
          tenantId: patronat.tenantId,
          patronatId: patronat.id,
          userId: user.id,
          role: dto.function,
          firstName,
          lastName,
          phone: phone || null,
          email,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_MEMBER_ACCOUNT_CREATED',
          resource: 'PatronatUser',
          resourceId: user.id,
          tableName: 'patronat_users',
          recordId: user.id,
          newData: { email, function: dto.function, functionLabel: conf.label },
        },
      });

      return user;
    });

    this.logger.log(
      `Compte membre créé : ${email} (${conf.label}) — patronat « ${patronat.name} »`,
    );

    return {
      success: true,
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        function: dto.function,
        functionLabel: conf.label,
      },
      message: `Compte ${conf.label} créé. Le membre peut se connecter sur le portail Patronat avec son email et son mot de passe.`,
    };
  }

  // ── Modification d'un membre ─────────────────────────────────────────────

  async updateUser(tenantId: string, userId: string, targetId: string, dto: UpdatePatronatUserDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCoordinator(fn);

    const target = await this.prisma.patronatUser.findFirst({
      where: { id: targetId, tenantId: patronat.tenantId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!target) throw new NotFoundException('Membre introuvable dans ce patronat.');

    // Protection : ne pas se désactiver soi-même
    if (dto.isActive === false && target.userId === userId) {
      throw new BadRequestException("Vous ne pouvez pas désactiver votre propre compte.");
    }

    const currentFn = normalizePatronatFunction(target.role);

    // Protection du dernier coordonnateur actif
    if (
      (dto.isActive === false || (dto.function && dto.function !== 'COORDONNATEUR')) &&
      currentFn === 'COORDONNATEUR'
    ) {
      const activeCoordinators = await this.prisma.patronatUser.count({
        where: {
          tenantId: patronat.tenantId,
          isActive: true,
          role: { in: ['COORDONNATEUR', 'PATRONAT_COORDONNATEUR', 'PATRONAT_ADMIN'] },
        },
      });
      if (activeCoordinators <= 1) {
        throw new BadRequestException(
          "Impossible : ce membre est le dernier coordonnateur actif du patronat. Nommez d'abord un autre coordonnateur.",
        );
      }
    }

    if (dto.function && !CREATABLE_FUNCTIONS.includes(dto.function)) {
      throw new BadRequestException(`Fonction invalide : ${dto.function}.`);
    }

    const newFn = dto.function ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: any = { updatedAt: new Date() };
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (newFn) data.role = newFn;
      const link = await tx.patronatUser.update({ where: { id: target.id }, data });

      const userData: any = {};
      if (dto.firstName?.trim()) userData.firstName = dto.firstName.trim();
      if (dto.lastName?.trim()) userData.lastName = dto.lastName.trim();
      if (newFn) {
        userData.role = PATRONAT_FUNCTIONS[newFn].userRole;
        // désactivation de compte = User.status suspended (jamais de suppression)
        userData.status = dto.isActive === false ? 'suspended' : 'active';
      } else if (dto.isActive !== undefined) {
        userData.status = dto.isActive ? 'active' : 'suspended';
      }
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: target.userId }, data: userData });
      }

      // Annuaire bureau synchronisé
      const bureauData: any = { isActive: dto.isActive ?? target.isActive };
      if (newFn) bureauData.role = newFn;
      if (dto.firstName?.trim()) bureauData.firstName = dto.firstName.trim();
      if (dto.lastName?.trim()) bureauData.lastName = dto.lastName.trim();
      if (dto.phone !== undefined) bureauData.phone = dto.phone?.trim() || null;
      await tx.patronatBureauMember.updateMany({
        where: { tenantId: patronat.tenantId, userId: target.userId },
        data: bureauData,
      });

      await tx.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_MEMBER_ACCOUNT_UPDATED',
          resource: 'PatronatUser',
          resourceId: target.id,
          tableName: 'patronat_users',
          recordId: target.id,
          newData: {
            email: target.user.email,
            function: newFn ?? currentFn,
            isActive: dto.isActive ?? target.isActive,
          },
        },
      });

      return link;
    });

    return {
      success: true,
      member: {
        id: updated.id,
        function: normalizePatronatFunction(updated.role),
        functionLabel: patronatFunctionLabel(normalizePatronatFunction(updated.role)),
        isActive: updated.isActive,
      },
    };
  }

  // ── Réinitialisation du mot de passe ─────────────────────────────────────

  async resetPassword(
    tenantId: string,
    userId: string,
    targetId: string,
    dto: ResetPatronatUserPasswordDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCoordinator(fn);

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères.");
    }

    const target = await this.prisma.patronatUser.findFirst({
      where: { id: targetId, tenantId: patronat.tenantId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!target) throw new NotFoundException('Membre introuvable dans ce patronat.');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.userId },
        data: { passwordHash: hashedPassword },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_MEMBER_PASSWORD_RESET',
          resource: 'PatronatUser',
          resourceId: target.id,
          tableName: 'users',
          recordId: target.userId,
          newData: { email: target.user.email },
        },
      }),
    ]);

    return {
      success: true,
      message: `Mot de passe réinitialisé pour ${target.user.email}.`,
    };
  }
}
