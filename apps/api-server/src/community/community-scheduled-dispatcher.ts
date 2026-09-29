/**
 * ============================================================================
 * COMMUNITY SCHEDULED DISPATCHER — Publication automatique des posts
 * ============================================================================
 *
 * Le moteur du « conseil quotidien » : chaque post programmé (table
 * community_scheduled_posts) est publié à l'heure prévue dans son canal,
 * signé de son auteur. Intervalle 30 s (Interval de @nestjs/schedule,
 * ScheduleModule déjà enregistré à la racine).
 *
 * Garanties :
 *   - Idempotent : statut PENDING uniquement, passage SENT atomique
 *     (UPDATE ... WHERE status='PENDING' RETURNING → un seul worker gagne)
 *   - Résilient : échec → FAILED + reason, jamais de republication
 *   - Borné : 10 posts par cycle (anti-avalanche)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CommunityRepository } from './community.repository';

@Injectable()
export class CommunityScheduledDispatcher {
  private readonly logger = new Logger(CommunityScheduledDispatcher.name);
  private running = false;

  constructor(private readonly repo: CommunityRepository) {}

  @Interval(30000)
  async tick() {
    if (this.running) return; // ⭐ pas de réentrance (cycle > 30 s possible)
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
