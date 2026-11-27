/**
 * ============================================================================
 * AUTO GROUP SERVICE — ⭐ 2026-11-27 : FIN DES COMMUNAUTÉS AUTO-CRÉÉES
 * ============================================================================
 *
 * Retour promoteur (Helm Connect « à la WhatsApp / Telegram ») :
 *   « On va supprimer toutes ces créations automatiques de groupes et de
 *    canaux. Le promoteur ou celui qui est délégué sera libre de créer
 *    lui-même le canal, le groupe — et au cours de la création, il y aura
 *    la fonctionnalité d'ajout de tous les parents d'élèves de cette
 *    classe, des enseignants du niveau, etc. »
 *
 * Ce service ne CRÉE donc PLUS AUCUN groupe. À chaque sync il :
 *   1. SUPPRIME proprement TOUTES les communautés auto-créées du tenant :
 *      conversations createdBy='system' (classes, « Parents – {niveau} »,
 *      « Enseignants », « Administration », conseils de classe/pédagogique,
 *      canaux par piste FR/EN…) AVEC leurs participants, leurs messages et
 *      leurs lignes chat_auto_groups. Suppression DÉFINITIVE (le mécanisme
 *      de création a été retiré — elles ne reviennent plus) ;
 *   2. Ne touche JAMAIS :
 *      - les groupes créés manuellement par l'école (createdBy = userId
 *        réel, bouton « + Nouveau groupe ») ;
 *      - les groupes dynamiques manuels (chat_dynamic_groups) ;
 *      - les conversations DIRECT (createdBy = un des participants).
 *
 * L'école crée ses groupes via le bouton « + Nouveau groupe » de la
 * section Communautés, avec sélection d'audiences (parents d'une classe,
 * tous les parents, enseignants d'un niveau…) — voir AudienceService.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AutoGroupService {
  private readonly logger = new Logger(AutoGroupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⭐ 2026-11-27 — Purge définitive de TOUTES les communautés auto-créées.
   * Idempotent : sans groupes système en base, ne fait rien (purged=0).
   * Les groupes manuels de l'école ne sont JAMAIS supprimés.
   */
  async retireSystemGroups(tenantId: string): Promise<{ purged: number }> {
    // 1. Toutes les conversations de groupe auto-créées du tenant.
    //    createdBy='system' n'est JAMAIS un userId réel → seuls les groupes
    //    automatiques (classes, rôles, niveaux, conseils, pistes FR/EN)
    //    correspondent. Les groupes manuels ont createdBy = userId réel.
    const systemGroups: Array<{ id: string; name: string | null; type: string }> =
      await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "name", "type" FROM "chat_conversations"
         WHERE "tenantId" = $1 AND "createdBy" = 'system' AND "type" = 'GROUP'`,
        tenantId,
      );

    for (const grp of systemGroups) {
      try {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_message_read_receipts" WHERE "messageId" IN
             (SELECT "id" FROM "chat_messages" WHERE "conversationId" = $1)`, grp.id,
        );
      } catch { /* table/FK absente — continuer */ }
      try {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_participants" WHERE "conversationId" = $1`, grp.id,
        );
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_messages" WHERE "conversationId" = $1`, grp.id,
        );
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "chat_conversations" WHERE "id" = $1`, grp.id,
        );
        this.logger.log(
          `retireSystemGroups: retrait définitif de la communauté auto-créée « ${grp.name || grp.id} » (tenant ${tenantId})`,
        );
      } catch (e: any) {
        this.logger.warn(`retireSystemGroups: échec pour « ${grp.name || grp.id} » (${grp.id}): ${e.message}`);
      }
    }

    // 2. Purge des lignes chat_auto_groups restantes (orphelines ou liées à
    //    des conversations déjà supprimées) — la table ne sert plus à rien.
    let orphanAutoGroups = 0;
    try {
      orphanAutoGroups = Number(await this.prisma.$executeRawUnsafe(
        `DELETE FROM "chat_auto_groups" WHERE "tenantId" = $1`, tenantId,
      ));
    } catch (e: any) {
      this.logger.warn(`retireSystemGroups: purge chat_auto_groups échouée: ${e.message}`);
    }

    const purged = systemGroups.length;
    if (purged > 0 || orphanAutoGroups > 0) {
      this.logger.log(
        `retireSystemGroups tenant=${tenantId}: ${purged} communauté(s) système supprimée(s), ${orphanAutoGroups} ligne(s) chat_auto_groups purgée(s) — l'école crée désormais elle-même ses groupes`,
      );
    }
    return { purged };
  }

  /**
   * Plus aucune communauté automatique n'existe : renvoie TOUJOURS une
   * liste vide (compatibilité des clients qui appellent encore cet endpoint).
   */
  async listAutoGroups(_tenantId: string, _academicYearId: string): Promise<any[]> {
    return [];
  }

  /**
   * Compatibilité des appelants historiques (POST /chat/auto-groups/sync) :
   * la « sync » est désormais une PURGE — aucun groupe n'est créé.
   */
  async syncAutoGroups(tenantId: string, _academicYearId: string): Promise<any> {
    const { purged } = await this.retireSystemGroups(tenantId);
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      purged,
      total: 0,
      message: 'Création automatique désactivée — l\u2019école crée elle-même ses groupes et canaux.',
    };
  }
}
