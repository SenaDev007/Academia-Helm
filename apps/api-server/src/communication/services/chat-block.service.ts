/**
 * ============================================================================
 * CHAT BLOCK SERVICE — Blocage des membres Helm Connect (V5, chantier 1)
 * ============================================================================
 *
 * ⭐ Parité Yeshua Connect `blocks/route.ts` — une ligne chat_user_blocks
 *    = « blockerId a bloqué blockedId » (dans UN sens).
 *
 * Effets (tous côté serveur, vérifiés dans les DEUX sens à chaque requête) :
 *   • POST /chat/conversations/direct (création/ouverture de DM) → 403 ;
 *   • envoi de message dans un privé (conversation DIRECT à 2) → 403 ;
 *   • démarrage d'appel (CallSignalService.start) sur un privé → 403 ;
 *   • les groupes/canaux communs restent OUVERTS (on bloque la personne,
 *     pas la communauté — comme Telegram).
 *
 * Audit : BLOCK_USER / UNBLOCK_USER dans chat_audit_logs
 * (via ChatService.auditLog — mécanisme existant).
 *
 * Multi-tenant strict : tenantId filtré dans toutes les requêtes.
 * ============================================================================
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

export interface BlockedUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  blockedAt: string;
}

@Injectable()
export class ChatBlockService {
  private readonly logger = new Logger(ChatBlockService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  BLOCAGE / DÉBLOCAGE
  // ═════════════════════════════════════════════════════════════════

  /**
   * Bloque un membre (idempotent — ON CONFLICT DO NOTHING).
   * Impossible de se bloquer soi-même.
   */
  async blockUser(
    tenantId: string,
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean; blocked: boolean }> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Impossible de se bloquer soi-même');
    }
    // Le membre à bloquer doit exister dans le tenant
    const target: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "users" WHERE "id" = $1 AND ("tenantId" = $2 OR $2 IS NULL)`,
      blockedId,
      tenantId,
    );
    if (target.length === 0) {
      throw new NotFoundException('Membre introuvable');
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_user_blocks" ("id", "tenantId", "blockerId", "blockedId", "createdAt")
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ("blockerId", "blockedId", "tenantId") DO NOTHING`,
      randomUUID(),
      tenantId,
      blockerId,
      blockedId,
    );
    this.logger.log(`blockUser: ${blockerId} a bloqué ${blockedId} (tenant ${tenantId})`);
    return { success: true, blocked: true };
  }

  /**
   * Débloque un membre (idempotent — pas d'erreur si non bloqué).
   */
  async unblockUser(
    tenantId: string,
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean; unblocked: boolean }> {
    const res = await this.prisma.$executeRawUnsafe(
      `DELETE FROM "chat_user_blocks"
       WHERE "blockerId" = $1 AND "blockedId" = $2 AND "tenantId" = $3`,
      blockerId,
      blockedId,
      tenantId,
    );
    this.logger.log(
      `unblockUser: ${blockerId} a débloqué ${blockedId} (tenant ${tenantId}) — ${res} ligne(s)`,
    );
    return { success: true, unblocked: res > 0 };
  }

  // ═════════════════════════════════════════════════════════════════
  //  LISTES
  // ═════════════════════════════════════════════════════════════════

  /**
   * Liste les membres que J'AI bloqués (fiche complète pour l'interface).
   * Si includeBlockedMe → ajoute `blockedMe: string[]` (ids de ceux qui m'ont
   * bloqué, pour griser discrètement les actions sans révéler qui).
   */
  async listBlocks(
    tenantId: string,
    userId: string,
    includeBlockedMe = false,
  ): Promise<{ blocked: BlockedUser[]; blockedMe: string[] }> {
    const iBlocked: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT u."id" AS "userId", u."firstName", u."lastName", u."avatarUrl", u."role",
             b."createdAt" AS "blockedAt"
      FROM "chat_user_blocks" b
      JOIN "users" u ON u."id" = b."blockedId"
      WHERE b."blockerId" = $1 AND b."tenantId" = $2
      ORDER BY b."createdAt" DESC
    `,
      userId,
      tenantId,
    );

    let blockedMe: string[] = [];
    if (includeBlockedMe) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ blockerId: string }>>(
        `SELECT "blockerId" FROM "chat_user_blocks" WHERE "blockedId" = $1 AND "tenantId" = $2`,
        userId,
        tenantId,
      );
      blockedMe = rows.map((r) => r.blockerId);
    }

    return {
      blocked: iBlocked.map((r) => ({
        userId: r.userId,
        name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Membre',
        avatarUrl: r.avatarUrl || undefined,
        role: r.role || undefined,
        blockedAt: new Date(r.blockedAt).toISOString(),
      })),
      blockedMe,
    };
  }

  /**
   * Ids des membres bloqués PAR moi (pour les exclure des suggestions
   * « invitable », recherche, etc.).
   */
  async getBlockedByUserIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ blockedId: string }>>(
      `SELECT "blockedId" FROM "chat_user_blocks" WHERE "blockerId" = $1 AND "tenantId" = $2`,
      userId,
      tenantId,
    );
    return rows.map((r) => r.blockedId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  VÉRIFICATIONS (utilisées par chat.service + call-signal.service)
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ Vérifie si un blocage existe dans un sens OU dans l'autre entre deux
   *    membres. Retourne true si l'un des deux a bloqué l'autre.
   *    Tolérant si la table n'existe pas encore (migration en attente) :
   *    on log un warning et on autorise (comportement par défaut inchangé).
   */
  async isBlockedEitherDirection(tenantId: string, userA: string, userB: string): Promise<boolean> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT id FROM "chat_user_blocks"
        WHERE "tenantId" = $1
          AND (
            ("blockerId" = $2 AND "blockedId" = $3)
            OR ("blockerId" = $3 AND "blockedId" = $2)
          )
        LIMIT 1
      `,
        tenantId,
        userA,
        userB,
      );
      return rows.length > 0;
    } catch (e: any) {
      // Table absente (migration non appliquée) — ne pas bloquer la messagerie
      this.logger.warn(
        `isBlockedEitherDirection: check impossible (${e.message}) — autorisé par défaut`,
      );
      return false;
    }
  }

  /**
   * ⭐ Throw une ForbiddenException si un blocage existe dans un sens ou
   *    l'autre — message uniforme « Vous ne pouvez pas contacter ce membre ».
   */
  async assertNotBlocked(tenantId: string, userA: string, userB: string): Promise<void> {
    if (userA === userB) return; // conversation avec soi-même : déjà refusé en amont
    const blocked = await this.isBlockedEitherDirection(tenantId, userA, userB);
    if (blocked) {
      throw new ForbiddenException('Vous ne pouvez pas contacter ce membre');
    }
  }
}
