/**
 * ============================================================================
 * AUTO CHANNEL SERVICE — Canaux officiels (V6, spec §6) — révisé Task 77
 * ============================================================================
 *
 * ⭐ TASK 77 (retour promoteur) — ALIGNEMENT SPÉCIFICATION :
 *   1. Les canaux officiels ne sont plus créés en bloc « à la hâte » : chaque
 *      canal n'existe que si le MODULE MÉTIER correspondant est ACTIVÉ pour
 *      le tenant (table tenant_features). Un canal sans module actif derrière
 *      est une coquille vide (ex : « Transport scolaire » alors qu'aucune
 *      école ne gère le transport des élèves).
 *   2. « Calendrier scolaire » et « Informations pédagogiques » sont RETIRÉS
 *      des canaux auto-créés (demande explicite promoteur — pas de module
 *      source, canaux restés vides). L'administration peut toujours créer
 *      manuellement un canal (bouton « + Nouveau canal »).
 *   3. AUTO-RETRAIT : à chaque sync, les canaux système (createdBy='system')
 *      retirés de la liste courante OU dont le module a été désactivé, et
 *      SANS message, sont supprimés proprement (abonnements + messages +
 *      conversation miroir + canal) — purge automatique partout.
 *
 * Canaux officiels selon les modules activés :
 *   📢 Direction      — TOUJOURS (cœur institutionnel)
 *   📚 Vie scolaire   — TOUJOURS (discipline/absences = modules cœur)
 *   🚌 Transport      — seulement si feature TRANSPORT activée
 *   💰 Finance        — seulement si feature FINANCE activée
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface OfficialChannelDef {
  name: string;
  description: string;
  /** Feature qui doit être ACTIVÉE pour que le canal existe (null = toujours). */
  requiresFeature?: string | null;
}

/** Canaux officiels — conditionnels aux modules activés (Task 77). */
export const DEFAULT_OFFICIAL_CHANNELS: ReadonlyArray<OfficialChannelDef> = [
  { name: 'Direction', description: 'Communiqués officiels de la direction de l\u2019établissement.', requiresFeature: null },
  { name: 'Vie scolaire', description: 'Discipline, absences et vie quotidienne de l\u2019établissement.', requiresFeature: null },
  { name: 'Finance', description: 'Échéances de paiement, frais de scolarité et informations financières.', requiresFeature: 'FINANCE' },
  { name: 'Transport scolaire', description: 'Horaires, itinéraires et informations du transport scolaire.', requiresFeature: 'TRANSPORT' },
];

/**
 * ⭐ TASK 77 — Modules DIFFÉRÉS : features actives en base mais dont le module
 * métier n'est PAS encore livré dans l'app (masqués « temporairement » dans la
 * sidebar : Transport, Bibliothèque, Infirmerie, QHSE — aucune école ne gère
 * encore ces fonctions). Le canal correspondant n'est pas créé tant que le
 * module n'est pas sorti : retirer l'entrée de cet ensemble le jour où le
 * module est livré → le canal apparaîtra automatiquement à la sync suivante.
 */
const DEFERRED_CHANNEL_MODULES = new Set<string>(['TRANSPORT']);

@Injectable()
export class AutoChannelService {
  private readonly logger = new Logger(AutoChannelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garantit l'existence des canaux officiels du tenant + abonne tous les
   * utilisateurs actifs. Idempotent — aucune erreur si tout existe déjà.
   */
  async ensureDefaultChannels(tenantId: string): Promise<{
    created: number;
    existing: number;
    subscribed: number;
    retired: number;
    channels: Array<{ id: string; name: string; isOfficial: boolean }>;
  }> {
    let created = 0;
    let existing = 0;
    let subscribed = 0;
    let retired = 0;
    const channels: Array<{ id: string; name: string; isOfficial: boolean }> = [];

    // 0. ⭐ Task 77 — features activées du tenant : un canal officiel n'existe
    //    que si son module métier est actif (ex : Transport si TRANSPORT).
    const enabledFeatures = new Set<string>(
      (await this.prisma.$queryRawUnsafe<Array<{ featureCode: string }>>(
        `SELECT "featureCode" FROM "tenant_features"
         WHERE "tenantId" = $1 AND "isEnabled" = true AND "status" = 'ACTIVE'`,
        tenantId,
      )).map(r => r.featureCode),
    );
    const activeDefs = DEFAULT_OFFICIAL_CHANNELS.filter(
      def =>
        !def.requiresFeature ||
        (enabledFeatures.has(def.requiresFeature) && !DEFERRED_CHANNEL_MODULES.has(def.requiresFeature)),
    );

    // 1. Récupérer les utilisateurs actifs du tenant (pour l'abonnement auto)
    const activeUserIds: string[] = (await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "users" WHERE "tenantId" = $1 AND "status" = 'active'`,
      tenantId,
    )).map(r => r.id);

    // 2. Canaux officiels existants (par nom, insensible à la casse)
    const existingChannels: Array<{ id: string; name: string; isOfficial: boolean }> =
      await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "name", "isOfficial" FROM "chat_channels"
         WHERE "tenantId" = $1 AND "name" ILIKE ANY($2::text[])`,
        tenantId,
        DEFAULT_OFFICIAL_CHANNELS.map(c => c.name),
      );
    const existingByName = new Map(existingChannels.map(c => [c.name.toLowerCase(), c]));

    // 3. Créer les canaux manquants + marquer officiels les homonymes manuels
    for (const def of activeDefs) {
      const key = def.name.toLowerCase();
      const found = existingByName.get(key);
      if (found) {
        if (!found.isOfficial) {
          // Canal manuel homonyme → on le promeut officiel (pas de doublon)
          await this.prisma.$executeRawUnsafe(
            `UPDATE "chat_channels" SET "isOfficial" = true, "updatedAt" = NOW() WHERE "id" = $1`,
            found.id,
          );
          found.isOfficial = true;
        }
        existing++;
        channels.push(found);
        continue;
      }
      const id = randomUUID();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_channels" ("id", "tenantId", "name", "description", "createdBy", "isOfficial", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'system', true, NOW(), NOW())`,
        id, tenantId, def.name, def.description,
      );
      created++;
      const row = { id, name: def.name, isOfficial: true };
      channels.push(row);
    }

    // ⭐ V6.1 (fix broadcast P2010) — Garantir la conversation miroir de
    //    TOUS les canaux du tenant (id du canal = id de la conversation,
    //    type CHANNEL). Auto-réparation : les canaux créés avant le
    //    correctif (officiels OU manuels) n'en avaient pas → la diffusion
    //    échouait (FK P2010). broadcastToChannel() se répare aussi
    //    lui-même à l'envoi (ensureChannelConversation).
    //    Idempotent (ON CONFLICT DO NOTHING).
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_conversations" ("id", "tenantId", "type", "name", "description", "createdBy", "createdAt", "updatedAt")
       SELECT c."id", c."tenantId", 'CHANNEL', c."name", c."description", c."createdBy", NOW(), NOW()
       FROM "chat_channels" c
       WHERE c."tenantId" = $1
       ON CONFLICT ("id") DO NOTHING`,
      tenantId,
    );

    // 4. Abonnement automatique de TOUS les utilisateurs actifs (idempotent)
    if (activeUserIds.length > 0 && channels.length > 0) {
      const channelIds = channels.map(c => c.id);
      const result = await this.prisma.$executeRawUnsafe(
        `INSERT INTO "chat_channel_subscribers" ("id", "channelId", "userId", "subscribedAt")
         SELECT gen_random_uuid()::text, c.id, u.id, NOW()
         FROM "chat_channels" c
         CROSS JOIN "users" u
         WHERE c.id = ANY($1::text[]) AND u.id = ANY($2::text[])
         ON CONFLICT ("channelId", "userId") DO NOTHING`,
        channelIds, activeUserIds,
      );
      // $executeRawUnsafe renvoie le nombre de lignes affectées
      subscribed = Number(result) || 0;
    }

    // ⭐ Task 77 — AUTO-RETRAIT des canaux officiels obsolètes : canaux
    //    système (createdBy='system', isOfficial=true) dont le nom n'est plus
    //    dans la liste courante (Calendrier scolaire, Informations
    //    pédagogiques…) OU dont le module a été désactivé, et SANS AUCUN
    //    message → suppression propre (abonnés + messages + conversation
    //    miroir + canal). Un canal avec des messages n'est jamais supprimé
    //    (contenu préservé — l'admin peut le supprimer manuellement).
    {
      const activeNames = activeDefs.map(d => d.name.toLowerCase());
      const systemChannels: Array<{ id: string; name: string; msgs: number }> =
        await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT c."id", c."name",
                  (SELECT count(*)::int FROM "chat_messages" m WHERE m."conversationId" = c."id") AS msgs
           FROM "chat_channels" c
           WHERE c."tenantId" = $1 AND c."isOfficial" = true AND c."createdBy" = 'system'`,
          tenantId,
        );
      for (const ch of systemChannels) {
        if (activeNames.includes(ch.name.toLowerCase())) continue;
        if (ch.msgs > 0) continue; // contenu existant — ne pas toucher
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
        this.logger.log(`ensureDefaultChannels: retrait du canal obsolète « ${ch.name} » (tenant ${tenantId})`);
      }
    }

    this.logger.log(
      `ensureDefaultChannels tenant=${tenantId}: ${created} créé(s), ${existing} existant(s), ${retired} retiré(s), ${subscribed} nouvel(s) abonnement(s), ${activeUserIds.length} utilisateur(s) actif(s)`,
    );
    return { created, existing, subscribed, retired, channels };
  }

  /**
   * Liste les canaux officiels d'un tenant (pour affichage/badge).
   */
  async listOfficialChannels(tenantId: string): Promise<any[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT "id", "name", "description", "isOfficial" FROM "chat_channels"
       WHERE "tenantId" = $1 AND "isOfficial" = true
       ORDER BY "createdAt" ASC`,
      tenantId,
    );
  }
}

/** randomUUID local (évite d'importer crypto partout — Node 19+ global). */
function randomUUID(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID: ru } = require('crypto') as typeof import('crypto');
  return ru();
}
