/**
 * ============================================================================
 * AUTO CHANNEL SERVICE — Création automatique des canaux officiels (V6, spec §6)
 * ============================================================================
 *
 * « Les différents canaux doivent être créés de façon automatique pour les
 *  écoles, de façon dynamique. »
 *
 * À l'activation d'un établissement (onboarding), puis périodiquement
 * (HelmConnectBootstrapService) et à l'ouverture de la section Canaux
 * (POST /chat/auto-channels/sync), ce service garantit l'existence des 6
 * canaux officiels de diffusion :
 *
 *   📢 Direction            — communiqués de la direction
 *   📚 Vie scolaire         — discipline, absences, vie quotidienne
 *   🚌 Transport scolaire   — horaires et infos transport
 *   💰 Finance              — échéances, frais de scolarité
 *   📖 Informations pédagogiques — conseils aux élèves/parents
 *   📅 Calendrier scolaire  — événements, vacances, examens
 *
 * + ABONNEMENT AUTOMATIQUE : tous les utilisateurs actifs du tenant sont
 *   abonnés (idempotent — index unique (channelId,userId)). Les nouveaux
 *   comptes créés ensuite sont rattrapés par la sync périodique.
 *
 * Idempotent : appelable autant de fois que nécessaire (aucun doublon).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Canaux officiels créés automatiquement pour chaque établissement. */
export const DEFAULT_OFFICIAL_CHANNELS: ReadonlyArray<{
  name: string;
  description: string;
}> = [
  { name: 'Direction', description: 'Communiqués officiels de la direction de l\u2019établissement.' },
  { name: 'Vie scolaire', description: 'Discipline, absences et vie quotidienne de l\u2019établissement.' },
  { name: 'Transport scolaire', description: 'Horaires, itinéraires et informations du transport scolaire.' },
  { name: 'Finance', description: 'Échéances de paiement, frais de scolarité et informations financières.' },
  { name: 'Informations pédagogiques', description: 'Conseils pédagogiques et informations destinées aux élèves et parents.' },
  { name: 'Calendrier scolaire', description: 'Événements, vacances, examens et dates importantes de l\u2019année scolaire.' },
];

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
    channels: Array<{ id: string; name: string; isOfficial: boolean }>;
  }> {
    let created = 0;
    let existing = 0;
    let subscribed = 0;
    const channels: Array<{ id: string; name: string; isOfficial: boolean }> = [];

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
    for (const def of DEFAULT_OFFICIAL_CHANNELS) {
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

    this.logger.log(
      `ensureDefaultChannels tenant=${tenantId}: ${created} créé(s), ${existing} existant(s), ${subscribed} nouvel(s) abonnement(s), ${activeUserIds.length} utilisateur(s) actif(s)`,
    );
    return { created, existing, subscribed, channels };
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
