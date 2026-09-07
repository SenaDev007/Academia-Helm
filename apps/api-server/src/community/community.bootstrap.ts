/**
 * ============================================================================
 * COMMUNITY BOOTSTRAP — Idempotent (démarrage API + après migration)
 * ============================================================================
 *
 * 1. Tables : la migration 20260907150000 (v1) les crée ; ce bootstrap les
 *    ré-assure (CREATE TABLE IF NOT EXISTS) — même politique que le
 *    chat Helm Connect (belt and braces, Railway deploys migrations).
 * 2. Canaux par défaut : les 7 espaces de la stratégie marketing
 *    (annonces, conseils quotidiens, discussion, formation, support,
 *    témoignages, sondages) — insérés seulement s'ils n'existent pas.
 * 3. Admin : COMMUNITY_ADMIN_EMAIL + COMMUNITY_ADMIN_PASSWORD (env) →
 *    SUPER_ADMIN upserté. Sans env → pas d'admin (créable ensuite via
 *    script scripts/bootstrap-community-admin.js).
 * 4. Configuration : COMMUNITY_AUTO_APPROVE (défaut true).
 * 5. ⭐ v2 (20260908090000) : colonnes scope/tenant_id/group_kind/parent_id/
 *    auto_managed + tables community_member_schools / community_events +
 *    STRUCTURE AUTOMATIQUE PAR ÉCOLE — pour chaque tenant actif :
 *    salon #ecole-{slug} + groupe administrateurs + groupe enseignants
 *    (« un canal sera créé de façon dynamique et automatiquement pour
 *    chaque école »). Les écoles créées plus tard obtiennent leur
 *    structure à la volée (provision / admin sync).
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

// ⭐ v2 — DDL idempotent (colonnes + nouvelles tables), miroir de la
//    migration 20260908090000 : le bootstrap ré-assure tout au démarrage.
const V2_DDL_SQL = [
  `ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'GLOBAL'`,
  `ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS "tenant_id" TEXT`,
  `ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS "group_kind" TEXT`,
  `ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS "parent_id" TEXT`,
  `ALTER TABLE community_channels ADD COLUMN IF NOT EXISTS "auto_managed" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "community_channels_tenant_scope_idx" ON "community_channels"("scope","tenant_id") WHERE "scope" = 'SCHOOL'`,
  `CREATE INDEX IF NOT EXISTS "community_channels_parent_idx" ON "community_channels"("parent_id") WHERE "parent_id" IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_channels_school_salon_uniq" ON "community_channels"("tenant_id") WHERE "scope" = 'SCHOOL' AND "group_kind" = 'SALON' AND "auto_managed"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_channels_school_group_uniq" ON "community_channels"("tenant_id","group_kind") WHERE "scope" = 'SCHOOL' AND "group_kind" <> 'SALON' AND "auto_managed"`,
  `ALTER TABLE community_members ADD COLUMN IF NOT EXISTS "linked_user_id" TEXT`,
  `ALTER TABLE community_members ADD COLUMN IF NOT EXISTS "linked_at" TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS "community_members_linked_user_idx" ON "community_members"("linked_user_id") WHERE "linked_user_id" IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS "community_member_schools" (
    "id" TEXT NOT NULL, "member_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL,
    "school_role" TEXT NOT NULL DEFAULT 'TEACHER', "school_name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'APP_LINK',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_member_schools_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "community_member_schools_uniq" ON "community_member_schools"("member_id","tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "community_member_schools_tenant_idx" ON "community_member_schools"("tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "community_member_schools_member_idx" ON "community_member_schools"("member_id")`,
  `CREATE TABLE IF NOT EXISTS "community_events" (
    "id" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'LIVE', "title" TEXT NOT NULL,
    "description" TEXT, "audience" TEXT NOT NULL DEFAULT 'GLOBAL',
    "tenant_id" TEXT, "group_kind" TEXT, "channel_id" TEXT, "host_member_id" TEXT,
    "external_url" TEXT, "replay_url" TEXT, "scheduled_at" TIMESTAMPTZ NOT NULL,
    "started_at" TIMESTAMPTZ, "ended_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_events_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "community_events_status_idx" ON "community_events"("status","scheduled_at")`,
  `CREATE INDEX IF NOT EXISTS "community_events_audience_idx" ON "community_events"("audience","tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "community_events_channel_idx" ON "community_events"("channel_id") WHERE "channel_id" IS NOT NULL`,
  `ALTER TABLE community_invites ADD COLUMN IF NOT EXISTS "tenant_id" TEXT`,
  `ALTER TABLE community_invites ADD COLUMN IF NOT EXISTS "school_role" TEXT`,
  `CREATE INDEX IF NOT EXISTS "community_invites_tenant_idx" ON "community_invites"("tenant_id") WHERE "tenant_id" IS NOT NULL`,
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
      // ⭐ v2 — colonnes/tables idempotentes (safe même si la migration a déjà joué)
      for (const sql of V2_DDL_SQL) {
        await this.prisma.$executeRawUnsafe(sql).catch((e: any) => {
          // ADD COLUMN IF NOT EXISTS existe depuis PG 9.2 ; UNIQUE INDEX
          // partiels idempotents — en cas d'environnement exotique on log sans casser
          this.logger.warn(`DDL v2 ignoré : ${e?.message}`);
        });
      }
      await this.ensureDefaultChannels();
      await this.ensureAllSchoolStructures();
      await this.ensureAdmin();
      this.logger.log('Bootstrap communauté v2 : OK (tables + canaux + écoles + admin)');
    } catch (e: any) {
      this.logger.warn(`Bootstrap communauté ignoré : ${e?.message}`);
    }
  }

  private async ensureDefaultChannels() {
    let position = 0;
    for (const ch of DEFAULT_CHANNELS) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO community_channels (id, slug, name, description, icon, type, position, invite_token, scope)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'GLOBAL'
         WHERE NOT EXISTS (SELECT 1 FROM community_channels WHERE slug = $2)`,
        randomUUID(), ch.slug, ch.name, ch.description, ch.icon, ch.type, position++,
        randomUUID().replace(/-/g, '').slice(0, 12),
      );
    }
  }

  /**
   * ⭐ v2 — Pour CHAQUE tenant actif : salon de l'école + groupe
   * administrateurs + groupe enseignants (« canal créé de façon dynamique
   * et automatique pour chaque école »). Idempotent — rejouable à chaque
   * démarrage ; les écoles créées en cours d'exploitation sont couvertes
   * par le provision à la volée + l'action admin « Synchroniser ».
   */
  private async ensureAllSchoolStructures() {
    const tenants = (await this.prisma.$queryRawUnsafe(
      `SELECT id, name, slug FROM tenants WHERE status = 'active' ORDER BY name ASC`,
    )) as any[];
    let created = 0;
    for (const t of tenants) {
      const r = await this.ensureSchoolStructure(t);
      created += r;
    }
    if (tenants.length) {
      this.logger.log(`Structures écoles : ${tenants.length} école(s) vérifiée(s), ${created} canal(canal) créé(s)`);
    }
  }

  /** Structure d'une école (idempotent) : renvoie le nombre de canaux créés */
  async ensureSchoolStructure(tenant: { id: string; name: string; slug: string }): Promise<number> {
    const base = this.schoolSlugBase(tenant.slug);
    const salonSlug = `ecole-${base}`;
    const adminsSlug = `grp-admins-${base}`;
    const teachersSlug = `grp-enseignants-${base}`;
    let created = 0;

    // 1. Salon de l'école (annonces générales de l'école)
    const salon = await this.upsertSchoolChannel({
      slug: salonSlug,
      name: `${tenant.name}`,
      description: `Salon de ${tenant.name} — annonces générales de l\u2019école et échanges entre membres de l\u2019établissement.`,
      icon: '🏫',
      type: 'ANNOUNCEMENT',
      position: 1000,
      tenantId: tenant.id,
      groupKind: 'SALON',
      parentId: null,
    });
    if (salon.created) created++;

    // 2. Groupe des administrateurs de l'école
    const admins = await this.upsertSchoolChannel({
      slug: adminsSlug,
      name: `Administrateurs — ${tenant.name}`,
      description: `Groupe réservé aux administrateurs de ${tenant.name} (direction, gouvernance, administration).`,
      icon: '🛡️',
      type: 'TEXT',
      position: 1010,
      tenantId: tenant.id,
      groupKind: 'ADMINS',
      parentId: salon.channel?.id ?? null,
    });
    if (admins.created) created++;

    // 3. Groupe des enseignants de l'école
    const teachers = await this.upsertSchoolChannel({
      slug: teachersSlug,
      name: `Enseignants — ${tenant.name}`,
      description: `Groupe des enseignants de ${tenant.name} — formations, lives et échanges pédagogiques dédiés.`,
      icon: '👨‍🏫',
      type: 'TEXT',
      position: 1020,
      tenantId: tenant.id,
      groupKind: 'TEACHERS',
      parentId: salon.channel?.id ?? null,
    });
    if (teachers.created) created++;

    return created;
  }

  private async upsertSchoolChannel(input: {
    slug: string; name: string; description: string; icon: string;
    type: string; position: number; tenantId: string;
    groupKind: string; parentId: string | null;
  }): Promise<{ channel: any; created: boolean }> {
    const existing = (await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_channels WHERE slug = $1 LIMIT 1`, input.slug,
    )) as any[];
    if (existing.length) {
      // Ré-assure les colonnes v2 (cas d'un salon pré-existant du même slug)
      await this.prisma.$executeRawUnsafe(
        `UPDATE community_channels SET scope = 'SCHOOL', tenant_id = $2, group_kind = $3,
                 parent_id = COALESCE(parent_id, $4), auto_managed = true, updated_at = NOW()
         WHERE id = $1 AND (tenant_id IS DISTINCT FROM $2 OR group_kind IS DISTINCT FROM $3 OR auto_managed = false)`,
        existing[0].id, input.tenantId, input.groupKind, input.parentId,
      );
      return { channel: existing[0], created: false };
    }
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO community_channels
         (id, slug, name, description, icon, type, position, invite_token, scope, tenant_id, group_kind, parent_id, auto_managed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SCHOOL',$9,$10,$11,true)`,
      id, input.slug, input.name, input.description, input.icon, input.type,
      input.position, randomUUID().replace(/-/g, '').slice(0, 12),
      input.tenantId, input.groupKind, input.parentId,
    );
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_channels WHERE id = $1 LIMIT 1`, id,
    )) as any[];
    return { channel: rows[0] ?? null, created: true };
  }

  /** Slug canonique du tenant : minuscules, tirets, collision-safe (unique en base) */
  private schoolSlugBase(tenantSlug: string): string {
    return (tenantSlug ?? 'ecole')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'ecole';
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
