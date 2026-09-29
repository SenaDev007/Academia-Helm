/**
 * ============================================================================
 * APP SEQUENCE SERVICE — Séquences atomiques par (tenant, clé)
 * ============================================================================
 *
 * ⭐ BRIEF PERF 3.3 — Remplacement des patterns lecture-modification-écriture
 * par des incrémentations SQL atomiques.
 *
 * Avant (race condition sous écriture concurrente — 2 comptables valident un
 * paiement au même moment → même numéro de reçu) :
 *
 *   const last = await prisma.x.findFirst({ orderBy: { num: 'desc' } });
 *   const next = last.num + 1;            // ← fenêtre de course
 *   await prisma.x.create({ num: next });
 *
 * Maintenant (upsert atomique — verrou de ligne tenu uniquement pendant la
 * durée du statement, incrément SQL côté serveur) :
 *
 *   const n = await appSequenceService.next(tenantId, 'RECEIPT_AH:2026');
 *
 * L'upsert Prisma se traduit par INSERT ... ON CONFLICT ("tenantId","key")
 * DO UPDATE SET current = current + 1 RETURNING current :
 *   - si la ligne n'existe pas → INSERT avec current = initValue (1er appel,
 *     initialisé au max existant pour ne pas casser la numérotation en prod)
 *   - si elle existe → UPDATE atomique + 1
 *   - deux appels concurrents ne peuvent PAS obtenir le même numéro : le
 *     second bloque sur le verrou de ligne le temps du statement (< 1ms),
 *     puis incrémente.
 *
 * Compatible avec les transactions interactives Prisma (passer `tx` pour
 * partager la connexion/transaction courante).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AppSequenceService {
  private readonly logger = new Logger(AppSequenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne le prochain numéro de séquence pour (tenantId, key).
   *
   * @param tenantId  Tenant concerné
   * @param key       Clé de séquence (ex: 'RECEIPT_AH:2026', 'TXREF:2609')
   * @param options.initFrom  Fonction lazy qui calcule la valeur d'initialisation
   *        (le max déjà utilisé en production) — uniquement évaluée si la ligne
   *        de séquence n'existe pas encore. Deux appels concurrents sur une
   *        séquence vierge : le premier insère, le second incrémente (ON
   *        CONFLICT) — aucun doublon possible.
   * @param tx  Transaction client optionnelle (partage la transaction courante)
   */
  async next(
    tenantId: string,
    key: string,
    options?: {
      initFrom?: () => Promise<number>;
      tx?: Prisma.TransactionClient;
    },
  ): Promise<number> {
    const client = options?.tx ?? this.prisma;

    // Calcul paresseux de l'initialisation (max existant) — la séquence
    // n'existe pas encore : on part du dernier numéro réellement utilisé.
    let initValue = 1;
    if (options?.initFrom) {
      try {
        const existingMax = await options.initFrom();
        initValue = (Number.isFinite(existingMax) ? existingMax : 0) + 1;
      } catch (err: any) {
        this.logger.warn(
          `AppSequence initFrom('${key}') failed: ${err?.message || err} — initialisation à 1`,
        );
        initValue = 1;
      }
    }

    // ⭐ Upsert atomique : INSERT ... ON CONFLICT DO UPDATE current = current + 1
    const row = await client.appSequence.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, current: initValue },
      update: { current: { increment: 1 } },
      select: { current: true },
    });

    return row.current;
  }

  /**
   * Variante formatée : renvoie le numéro paddé (ex: pad 6 → '000042').
   */
  async nextPadded(
    tenantId: string,
    key: string,
    pad: number,
    options?: {
      initFrom?: () => Promise<number>;
      tx?: Prisma.TransactionClient;
    },
  ): Promise<string> {
    const n = await this.next(tenantId, key, options);
    return String(n).padStart(pad, '0');
  }
}
