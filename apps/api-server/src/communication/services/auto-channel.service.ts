/**
 * ============================================================================
 * AUTO CHANNEL SERVICE — ⭐ 2026-11-26 : FIN DES CANAUX OFFICIELS AUTO-CRÉÉS
 * ============================================================================
 *
 * Retour promoteur (nettoyage profond du module Konnect) :
 *   « Actuellement, il y a les canaux finance, vie scolaire […] créés
 *    automatiquement […] Définitivement, les canaux finance, vie scolaire et
 *    direction : supprimer ces canaux-là. […] On va laisser les canaux pour
 *    que l'école même soit libre de créer ses propres canaux et d'intégrer
 *    qui elle veut dans ces canaux. »
 *
 * Ce service ne CRÉE donc PLUS AUCUN canal. À chaque sync il :
 *   1. SUPPRIME proprement tous les canaux système (createdBy='system') du
 *      tenant — Direction, Vie scolaire, Finance, Transport scolaire et tout
 *      autre canal auto-créé historique — AVEC leurs abonnés, leurs messages
 *      et leur conversation miroir. Suppression DÉFINITIVE (le mécanisme de
 *      création ayant été retiré, ils ne reviennent plus) ;
 *   2. Dé-mote les homonymes manuels promus « officiels » par l'ancien
 *      mécanisme (isOfficial → false) : ils redeviennent d'ordinaires canaux
 *      de l'école, que l'école administre elle-même (membres, diffusion…) ;
 *   3. Ne touche JAMAIS les canaux créés manuellement par l'école.
 *
 * Les écoles créent leurs canaux via le bouton « + Nouveau canal » de la
 * section Canaux (chat.service.createChannel — inchangé).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Signature de retour conservée pour les appelants existants (bootstrap, onboarding, controller). */
export interface OfficialChannelsSyncResult {
  created: number;
  existing: number;
  subscribed: number;
  retired: number;
  channels: Array<{ id: string; name: string; isOfficial: boolean }>;
}

@Injectable()
export class AutoChannelService {
  private readonly logger = new Logger(AutoChannelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⭐ 2026-11-26 — Purge définitive des canaux officiels auto-créés.
   * Idempotent : sans canaux système en base, ne fait rien (retired=0).
   * Les canaux manuels de l'école ne sont JAMAIS supprimés.
   */
  async ensureDefaultChannels(tenantId: string): Promise<OfficialChannelsSyncResult> {
    let retired = 0;

    // 1. Tous les canaux système du tenant (Direction, Vie scolaire, Finance,
    //    Transport scolaire, Calendrier scolaire, Infos pédagogiques… créés
    //    historiquement par ce service ou le bootstrap).
    const systemChannels: Array<{ id: string; name: string }> =
      await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "name" FROM "chat_channels"
         WHERE "tenantId" = $1 AND "createdBy" = 'system'`,
        tenantId,
      );

    for (const ch of systemChannels) {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "chat_channel_subscribers" WHERE "channelId" = $1`, ch.id,
      );
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "chat_messages" WHERE "conversationId" = $1`, ch.id,
      );
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "chat_conversations" WHERE "id" = $1`, ch.id,
      );
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "chat_channels" WHERE "id" = $1`, ch.id,
      );
      retired++;
      this.logger.log(
        `ensureDefaultChannels: retrait définitif du canal système « ${ch.name} » (tenant ${tenantId})`,
      );
    }

    // 2. Homonymes manuels anciennement promus « officiels » → canaux normaux.
    //    L'école les administre elle-même (membres, renommage, suppression).
    const demoted = await this.prisma.$executeRawUnsafe(
      `UPDATE "chat_channels" SET "isOfficial" = false, "updatedAt" = NOW()
       WHERE "tenantId" = $1 AND "isOfficial" = true AND "createdBy" <> 'system'`,
      tenantId,
    );
    if (Number(demoted) > 0) {
      this.logger.log(
        `ensureDefaultChannels: ${Number(demoted)} canal(aux) manuel(s) « officiel(s) » reconverti(s) en canal(aux) de l'école (tenant ${tenantId})`,
      );
    }

    if (retired > 0) {
      this.logger.log(
        `ensureDefaultChannels tenant=${tenantId}: ${retired} canal(aux) système supprimé(s) — l'école crée désormais ses propres canaux`,
      );
    }
    return { created: 0, existing: 0, subscribed: 0, retired, channels: [] };
  }

  /**
   * Plus aucun canal officiel n'existe : renvoie la liste des canaux du
   * tenant créés par l'école (section Canaux), pour l'affichage.
   */
  async listOfficialChannels(tenantId: string): Promise<any[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT "id", "name", "description", "isOfficial" FROM "chat_channels"
       WHERE "tenantId" = $1
       ORDER BY "createdAt" ASC`,
      tenantId,
    );
  }
}
