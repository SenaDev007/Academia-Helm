/**
 * ============================================================================
 * COMMUNITY GUARD — Authentification des membres de la communauté Academia
 * ============================================================================
 *
 * Les membres de la communauté (prospects / clients du produit) ne sont PAS
 * des `users` applicatifs : ce sont des comptes légers (table
 * `community_members`) avec leur propre JWT (claim `typ: 'community'`).
 *
 * Ce guard s'applique via @UseGuards(CommunityAuthGuard) sur les contrôleurs
 * communauté ; les routes d'auth (login/register) restent @Public().
 * Le JwtAuthGuard global ignore ces routes (elles sont marquées @Public),
 * et l'AccessScopeGuard ne fait rien non plus pour elles.
 *
 * Le BFF (web-app) transmet le cookie httpOnly `community_token` sous forme
 * d'en-tête `Authorization: Bearer <jwt>` — jamais de token côté JS client.
 * ============================================================================
 */

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';

export const COMMUNITY_ROLES_KEY = 'communityRoles';
export const CommunityRoles = (...roles: string[]) => SetMetadata(COMMUNITY_ROLES_KEY, roles);

/** Hiérarchie des rôles communautaires */
export const COMMUNITY_ROLE_LEVEL: Record<string, number> = {
  MEMBER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export interface CommunityMemberSession {
  id: string;
  email: string;
  displayName: string;
  role: string;
  memberType: string;
  status: string;
  organization?: string | null;
  avatarUrl?: string | null;
}

@Injectable()
export class CommunityAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token communauté manquant');
    }
    const token = authHeader.slice(7);

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token communauté invalide ou expiré');
    }

    if (payload.typ !== 'community' || !payload.sub) {
      throw new UnauthorizedException('Token non communautaire');
    }

    // ⭐ Le token peut être valide alors que le compte a été banni/supprimé
    //    entre-temps → toujours revérifier en base (requête indexée, ~0,1 ms).
    const member = await this.prisma.$queryRawUnsafe(
      `SELECT id, email, display_name AS "displayName", role, member_type AS "memberType",
              status, organization, avatar_url AS "avatarUrl"
       FROM community_members WHERE id = $1 LIMIT 1`,
      payload.sub,
    ) as CommunityMemberSession[];

    if (!member.length) {
      throw new UnauthorizedException('Membre introuvable');
    }
    if (member[0].status === 'BANNED') {
      throw new ForbiddenException('Compte suspendu — contactez l\u2019équipe Academia Helm');
    }
    if (member[0].status === 'PENDING') {
      throw new ForbiddenException('Compte en attente de validation par l\u2019équipe');
    }

    request.communityMember = member[0];

    // ⭐ Vérification des rôles requis (@CommunityRoles('ADMIN', ...))
    const required = this.reflector.getAllAndOverride<string[]>(COMMUNITY_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length) {
      const memberLevel = COMMUNITY_ROLE_LEVEL[member[0].role] ?? 0;
      const requiredMin = Math.min(...required.map((r) => COMMUNITY_ROLE_LEVEL[r] ?? 0));
      if (memberLevel < requiredMin) {
        throw new ForbiddenException('Rôle communautaire insuffisant');
      }
    }

    // ⭐ Presence : last_seen_at rafraîchi (best-effort, sans bloquer la requête)
    this.prisma
      .$queryRawUnsafe(`UPDATE community_members SET last_seen_at = NOW() WHERE id = $1`, payload.sub)
      .catch(() => undefined);

    return true;
  }
}
