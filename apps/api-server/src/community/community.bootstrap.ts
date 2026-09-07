/**
 * ============================================================================
 * COMMUNITY BOOTSTRAP — Idempotent (démarrage API + après migration)
 * ============================================================================
 *
 * 1. Tables : la migration 20260907150000 les crée ; ce bootstrap les
 *    ré-assure (CREATE TABLE IF NOT EXISTS) — même politique que le
 *    chat Helm Connect (belt and braces, Railway deploys migrations).
 * 2. Canaux par défaut : les 7 espaces de la stratégie marketing
 *    (annonces, conseils quotidiens, discussion, formation, support,
 *    témoignages, sondages) — insérés seulement s'ils n'existent pas.
 * 3. Admin : COMMUNITY_ADMIN_EMAIL + COMMUNITY_ADMIN_PASSWORD (env) →
 *    SUPER_ADMIN upserté. Sans env → pas d'admin (créable ensuite via
 *    script scripts/bootstrap-community-admin.js).
 * 4. Configuration : COMMUNITY_AUTO_APPROVE (défaut true).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const DEFAULT_CHANNELS: {
  slug: string; name: string; icon: string; type: string; description: string;
}[] = [
  {
    slug: 'annonces',
    name: 'Annonces & nouveautés',
    icon: '📢',
    type: 'ANNOUNCEMENT',
    description: 'Mises à jour du produit, nouvelles fonctionnalités, feuilles de route — par l\u2019équipe Academia Helm.',
  },
  {
    slug: 'conseils-quotidiens',
    name: 'Conseils quotidiens',
    icon: '💡',
    type: 'ANNOUNCEMENT',
    description: 'Chaque jour, un conseil concret pour piloter votre école : gestion, finances, pédagogie, communication.',
  },
  {
    slug: 'discussion-generale',
    name: 'Discussion générale',
    icon: '💬',
    type: 'TEXT',
    description: 'Espace d\u2019entraide entre dirigeants d\u2019établissements — posez vos questions, partagez vos expériences.',
  },
  {
    slug: 'formation',
    name: 'Académie & formations',
    icon: '🎓',
    type: 'TEXT',
    description: 'Guides pratiques, tutoriels vidéo et ateliers pour maîtriser Academia Helm et la gestion scolaire.',
  },
  {
    slug: 'support',
    name: 'Support produit',
    icon: '🛠️',
    type: 'TEXT',
    description: 'Une question technique ? Un souci ? L\u2019équipe et la communauté vous répondent.',
  },
  {
    slug: 'temoignages',
    name: 'Témoignages & réussites',
    icon: '⭐',
    type: 'TEXT',
    description: 'Vos réussites avec Academia Helm — résultats, gains de temps, satisfactions. Vos retours inspirent les autres.',
  },
  {
    slug: 'sondages',
    name: 'Sondages & décisions',
    icon: '🗳️',
    type: 'TEXT',
    description: 'Votez sur les prochaines priorités du produit — votre avis oriente la feuille de route.',
  },
];

const TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "community_members" (
    "id" TEXT NOT NULL, "email" TEXT NOT NULL, "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL, "first_name" TEXT, "last_name" TEXT,
    "organization" TEXT, "country" TEXT, "phone" TEXT, "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER', "member_type" TEXT NOT NULL DEFAULT 'PROSPECT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE', "source" TEXT, "source_meta" JSONB,
    "bio" TEXT, "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_members_email_key" ON "community_members"("email")`,
  `CREATE INDEX IF NOT EXISTS "community_members_type_status_idx" ON "community_members"("member_type","status")`,
  `CREATE TABLE IF NOT EXISTS "community_channels" (
    "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
    "description" TEXT, "icon" TEXT, "type" TEXT NOT NULL DEFAULT 'TEXT',
    "position" INTEGER NOT NULL DEFAULT 0, "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invite_token" TEXT, "last_message_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_channels_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_channels_slug_key" ON "community_channels"("slug")`,
  `CREATE TABLE IF NOT EXISTS "community_messages" (
    "id" TEXT NOT NULL, "channel_id" TEXT NOT NULL, "member_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT', "content" TEXT,
    "attachment_url" TEXT, "attachment_name" TEXT, "attachment_size" INTEGER, "attachment_mime" TEXT,
    "reply_to_id" TEXT, "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMPTZ, "pinned_by" TEXT,
    "is_edited" BOOLEAN NOT NULL DEFAULT false, "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ, "edited_history" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "community_messages_channel_created_idx" ON "community_messages"("channel_id","created_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "community_messages_member_idx" ON "community_messages"("member_id")`,
  `CREATE TABLE IF NOT EXISTS "community_reactions" (
    "id" TEXT NOT NULL, "message_id" TEXT NOT NULL, "member_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_reactions_unique" ON "community_reactions"("message_id","member_id","emoji")`,
  `CREATE TABLE IF NOT EXISTS "community_polls" (
    "id" TEXT NOT NULL, "message_id" TEXT NOT NULL, "question" TEXT NOT NULL,
    "is_multi" BOOLEAN NOT NULL DEFAULT false, "options" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "expires_at" TIMESTAMPTZ, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_polls_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_polls_message_key" ON "community_polls"("message_id")`,
  `CREATE TABLE IF NOT EXISTS "community_poll_votes" (
    "id" TEXT NOT NULL, "poll_id" TEXT NOT NULL, "option_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_poll_votes_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_poll_votes_unique" ON "community_poll_votes"("poll_id","option_id","member_id")`,
  `CREATE TABLE IF NOT EXISTS "community_scheduled_posts" (
    "id" TEXT NOT NULL, "channel_id" TEXT NOT NULL, "author_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT', "content" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_message_id" TEXT, "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_scheduled_posts_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "community_scheduled_pending_idx" ON "community_scheduled_posts"("status","scheduled_at")`,
  `CREATE TABLE IF NOT EXISTS "community_channel_reads" (
    "member_id" TEXT NOT NULL, "channel_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_channel_reads_pkey" PRIMARY KEY ("member_id","channel_id"))`,
  `CREATE TABLE IF NOT EXISTS "community_invites" (
    "id" TEXT NOT NULL, "token" TEXT NOT NULL, "channel_id" TEXT,
    "member_type" TEXT NOT NULL DEFAULT 'PROSPECT', "created_by" TEXT,
    "note" TEXT, "max_uses" INTEGER, "uses_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_invites_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_invites_token_key" ON "community_invites"("token")`,
];

@Injectable()
export class CommunityBootstrap {
  private readonly logger = new Logger(CommunityBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<void> {
    try {
      for (const sql of TABLES_SQL) {
        await this.prisma.$executeRawUnsafe(sql);
      }
      await this.ensureDefaultChannels();
      await this.ensureAdmin();
      this.logger.log('Bootstrap communauté : OK (tables + canaux + admin)');
    } catch (e: any) {
      this.logger.warn(`Bootstrap communauté ignoré : ${e?.message}`);
    }
  }

  private async ensureDefaultChannels() {
    let position = 0;
    for (const ch of DEFAULT_CHANNELS) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO community_channels (id, slug, name, description, icon, type, position, invite_token)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8
         WHERE NOT EXISTS (SELECT 1 FROM community_channels WHERE slug = $2)`,
        randomUUID(), ch.slug, ch.name, ch.description, ch.icon, ch.type, position++,
        randomUUID().replace(/-/g, '').slice(0, 12),
      );
    }
  }

  private async ensureAdmin() {
    const email = this.config.get<string>('COMMUNITY_ADMIN_EMAIL')?.toLowerCase().trim();
    const password = this.config.get<string>('COMMUNITY_ADMIN_PASSWORD');
    if (!email || !password || password.length < 8) {
      return; // pas d'env configuré → admin créé via script dédié
    }
    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM community_members WHERE email = $1 LIMIT 1`, email,
    );
    if ((existing as any[]).length) return;
    const hash = await bcrypt.hash(password, 10);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO community_members
         (id, email, password_hash, display_name, role, member_type, status, source)
       VALUES ($1,$2,$3,$4,'SUPER_ADMIN','TEAM','ACTIVE','BOOTSTRAP')`,
      randomUUID(), email, hash, 'Équipe Academia Helm',
    );
    this.logger.log(`Admin communauté bootstrap : ${email}`);
  }
}
