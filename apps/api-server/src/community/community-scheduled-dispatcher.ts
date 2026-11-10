/**
 * ============================================================================
 * COMMUNITY SCHEDULED DISPATCHER — Publication automatique des posts
 * ============================================================================
 *
 * ⭐ AUDIT COÛT NEON (2026-11) — v3 événementielle.
 *    Historique : @Interval(30 s) → 2 880 requêtes/jour (pg_stat_statements :
 *    20 660 appels cumulés — les plus fréquentes de toute la base) ;
 *    interim 15 min (4b2d12d) → encore 96 réveils/jour. Désormais :
 *      - chaque post PENDING est armé en mémoire (setTimeout) à sa date
 *        exacte → publication à l'heure, zéro requête périodique ;
 *      - CommunityAdminService appelle notifyScheduledChanged() à chaque
 *        création/modification (action utilisateur → réarmement) ;
 *      - onModuleInit rattrape au démarrage (1 requête/déploiement) ;
 *      - @Cron 6 h = balayage de rattrapage anti-crash (4 requêtes/jour).
 *
 * Garanties conservées :
 *   - Idempotent : statut PENDING uniquement, passage SENT atomique
 *     (UPDATE ... WHERE status='PENDING' RETURNING → un seul worker gagne)
 *   - Résilient : échec → FAILED + reason, jamais de republication
 *   - Borné : 10 posts par cycle (anti-avalanche)
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommunityRepository } from './community.repository';

@Injectable()
export class CommunityScheduledDispatcher implements OnModuleInit {
  private readonly logger = new Logger(CommunityScheduledDispatcher.name);
  private running = false;
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly repo: CommunityRepository) {}

  /** Rattrapage au démarrage : arme tous les posts PENDING (1 requête/déploiement). */
  async onModuleInit(): Promise<void> {
    setTimeout(() => {
      this.notifyScheduledChanged().catch(() => {});
    }, 30_000);
  }

  /**
   * Réarmement complet (appelé par CommunityAdminService après création/modif/
   * annulation d'un post, et au démarrage). Action utilisateur → requête
   * légitime. Remplace l'ancien polling 30 s.
   */
  async notifyScheduledChanged(): Promise<void> {
    try {
      await this.repo.recoverStaleSendingPosts();
      const pending = (await this.repo.listScheduledPosts('PENDING')) as any[];
      this.clearTimers();
      let hasDue = false;
      for (const post of pending) {
        const when = new Date(post.scheduled_at).getTime();
        if (!Number.isFinite(when)) continue;
        if (when <= Date.now()) hasDue = true;
        this.armPost(post.id, when);
      }
      if (hasDue) await this.sweep();
    } catch (e: any) {
      this.logger.warn(`Rattrapage posts programmés : ${e?.message}`);
    }
  }

  /** Arme la publication d'un post à sa date exacte (in-process, zéro polling DB). */
  private armPost(id: string, when: number): void {
    const delay = when - Date.now();
    // Déjà dû → sweep immédiat ; horizon > 24 j → balayage 6 h s'en charge
    if (delay > 24 * 24 * 60 * 60 * 1000) return;
    const fire = () => {
      this.timers.delete(id);
      this.sweep().catch(() => {});
    };
    const t: NodeJS.Timeout = delay <= 0 ? setTimeout(fire, 0) : setTimeout(fire, delay);
    (t as any).unref?.(); // ne retient pas l'arrêt du process
    this.timers.set(id, t);
  }

  private clearTimers(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  /** Balayage de rattrapage 4×/jour (00/06/12/18 h) — ex-polling 30 s. */
  @Cron('0 */6 * * *')
  async sweep(): Promise<void> {
    if (this.running) return; // ⭐ pas de réentrance (cycle > durée possible)
    this.running = true;
    try {
      // ⭐ Récupération : un claim 'SENDING' abandonné (crash) > 5 min → re-PENDING
      await this.repo.recoverStaleSendingPosts();
      const due = (await this.repo.dueScheduledPosts()) as any[];
      for (const post of due) {
        await this.publish(post);
      }
    } catch (e: any) {
      this.logger.warn(`Cycle dispatcher communauté échoué : ${e?.message}`);
    } finally {
      this.running = false;
    }
  }

  private async publish(post: any) {
    // ⭐ Claim atomique : seul le worker qui gagne l'UPDATE publie
    const claimed = await this.repo.claimScheduledPost(post.id);
    if (!claimed) return;
    try {
      const message = await this.repo.insertMessage({
        channelId: post.channel_id,
        memberId: post.author_id,
        type: post.type ?? 'ANNOUNCEMENT',
        content: post.content,
      });
      await this.repo.updateScheduledPost(post.id, {
        status: 'SENT',
        sent_message_id: message.id,
      });
      this.logger.log(`Post programmé publié dans #${post.channel_name} (${post.id})`);
    } catch (e: any) {
      await this.repo.updateScheduledPost(post.id, {
        status: 'FAILED',
        failure_reason: String(e?.message ?? e).slice(0, 500),
      });
      this.logger.error(`Post programmé ${post.id} échoué : ${e?.message}`);
    }
  }
}
