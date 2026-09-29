/**
 * FederisGradingRulesService — Règles de calcul par type d'examen
 * ═══════════════════════════════════════════════════════════════════════════
 * Module « Paramètres — Règles de calcul » (Academia Federis — 2026-09-30).
 *
 * Sémantique « SOURCE DE VÉRITÉ » (cahier des charges utilisateur) :
 *   1. Par défaut, les règles du BACKEND s'appliquent :
 *        · seuil d'admission (passMark)  = 10/20
 *        · seuil de rachat  (rescueMark) = 9,5/20
 *      Le module Paramètres AFFICHE ces défauts (jamais un écran vide).
 *   2. Dès qu'une règle est définie dans le module Paramètres (ligne
 *      federis_grading_rules), ELLE DEVIENT la source de vérité du backend :
 *      délibération (seuils du jury), décisions provisoires des relevés,
 *      statistiques du registre et PDF.
 *   3. « Réinitialiser » supprime la ligne → retour immédiat aux défauts.
 *
 * Modèle de moyenne (structurel, non paramétrable — affiché à titre indicatif) :
 *   · CEP          → moyenne SIMPLE (primaire, sans coefficients)
 *   · BEPC/BAC/CAP → moyenne PONDÉRÉE (secondaire, Σ(note×coef) / Σcoef)
 *
 * Endpoints (exposés par FederisExamsController, espace « settings ») :
 *   GET    /federis/settings/grading-rules            — configuration complète
 *   PUT    /federis/settings/grading-rules/:examType  — définir / modifier
 *   DELETE /federis/settings/grading-rules/:examType  — réinitialiser (défauts)
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService } from './federis-patronat.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_DELIBERATION,
  normalizePatronatFunction,
  type PatronatFunction,
} from './federis-roles';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

// ── DTO ─────────────────────────────────────────────────────────────────────

export class UpdateGradingRuleDto {
  /** Moyenne d'admission (ex. 10, 12…) */
  @IsNumber()
  passMark!: number;

  /** Seuil de rachat — cas limites soumis au jury (doit être < passMark). */
  @IsNumber()
  rescueMark!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

// ── Règles par défaut du BACKEND (source de vérité tant qu'aucune surcharge) ─

export interface EffectiveGradingRules {
  passMark: number;
  rescueMark: number;
  /** Une règle personnalisée existe (source de vérité = Paramètres). */
  isCustom: boolean;
  /** Modèle de moyenne appliqué par le backend (informatif). */
  averageModel: 'simple' | 'ponderee';
}

/** Types d'examen gérés par les règles de calcul. */
export const GRADING_EXAM_TYPES = ['CEP', 'BEPC', 'BAC', 'CAP'] as const;
export type GradingExamType = (typeof GRADING_EXAM_TYPES)[number];

/** Défauts backend — reference absolue affichée dans le module Paramètres. */
export const DEFAULT_GRADING_RULES: Record<string, { passMark: number; rescueMark: number }> = {
  CEP: { passMark: 10, rescueMark: 9.5 },
  BEPC: { passMark: 10, rescueMark: 9.5 },
  BAC: { passMark: 10, rescueMark: 9.5 },
  CAP: { passMark: 10, rescueMark: 9.5 },
};

export const GRADING_TYPE_LABELS: Record<string, string> = {
  CEP: 'CEP (Certificat d\u2019Études Primaires)',
  BEPC: 'BEPC (Brevet d\u2019Études du Premier Cycle)',
  BAC: 'Baccalauréat',
  CAP: 'CAP (Certificat d\u2019Aptitude Professionnelle)',
};

function normalizeExamType(examType: string): GradingExamType | null {
  const up = (examType ?? '').toUpperCase();
  return (GRADING_EXAM_TYPES as readonly string[]).includes(up)
    ? (up as GradingExamType)
    : null;
}

@Injectable()
export class FederisGradingRulesService {
  private readonly logger = new Logger(FederisGradingRulesService.name);
  private schemaReady = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
  ) {}

  // ── Auto-guérison du schéma (pattern FederisGradesService) ───────────────
  //
  // Miroir EXACT de la migration 20260930100000_federis_grading_rules :
  // le déploiement Railway n'exécute pas prisma migrate deploy au démarrage —
  // la table est créée idempotemment au premier appel du service.

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      const tables: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_name='federis_grading_rules'`,
      )) as any[];
      if (tables && tables.length >= 1) {
        this.schemaReady = true;
        return;
      }
    } catch {
      /* table absente → création ci-dessous */
    }
    const statements = [
      `CREATE TABLE IF NOT EXISTS "federis_grading_rules" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "examType" TEXT NOT NULL,
          "passMark" DOUBLE PRECISION NOT NULL DEFAULT 10,
          "rescueMark" DOUBLE PRECISION NOT NULL DEFAULT 9.5,
          "updatedBy" TEXT,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "federis_grading_rules_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "federis_grading_rules_tenantId_idx"
          ON "federis_grading_rules"("tenantId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "federis_grading_rules_tenantId_examType_key"
          ON "federis_grading_rules"("tenantId", "examType")`,
    ];
    for (const sql of statements) {
      await this.prisma.$executeRawUnsafe(sql);
    }
    this.schemaReady = true;
    this.logger.log('Schéma règles de calcul assuré (migration 20260930100000)');
  }

  // ── Contexte & permissions (patronat requis) ──────────────────────────────

  private async resolveContext(tenantId: string, userId: string) {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);
    const link = await this.prisma.patronatUser.findFirst({
      where: { tenantId: patronat.tenantId, userId, isActive: true },
      select: { role: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const fn = normalizePatronatFunction(link?.role ?? user?.role);
    return { patronat, fn };
  }

  private assertRead(fn: PatronatFunction): void {
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new ForbiddenException('Accès réservé aux membres du patronat.');
    }
  }

  private assertWrite(fn: PatronatFunction): void {
    if (!WRITE_DELIBERATION.includes(fn)) {
      throw new ForbiddenException(
        'La modification des règles de calcul est réservée au coordonnateur, au secrétaire et à l\u2019organisateur.',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. RÉSOLUTION (consommée par délibération / notes / PDF — cœur du module)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Règles EFFECTIVES d'un type d'examen pour un patronat :
   * ligne personnalisée si elle existe (source de vérité), sinon défauts
   * backend. Ne lève JAMAIS (lecture pure — appelée dans les parcours chauds).
   */
  async resolveEffectiveRules(
    patronatTenantId: string,
    examType: string | null | undefined,
  ): Promise<EffectiveGradingRules> {
    const type = normalizeExamType(examType ?? '') ?? 'CEP';
    const def = DEFAULT_GRADING_RULES[type];
    let isCustom = false;
    let passMark = def.passMark;
    let rescueMark = def.rescueMark;
    try {
      await this.ensureSchema();
      const rule = await this.prisma.$queryRawUnsafe(
        `SELECT "passMark", "rescueMark" FROM "federis_grading_rules"
         WHERE "tenantId" = $1 AND "examType" = $2 LIMIT 1`,
        patronatTenantId,
        type,
      );
      const row = (rule as any[])?.[0];
      if (row) {
        passMark = Number(row.passMark);
        rescueMark = Number(row.rescueMark);
        isCustom = true;
      }
    } catch (err: any) {
      this.logger.warn(`resolveEffectiveRules — repli sur les défauts : ${err?.message}`);
    }
    return {
      passMark,
      rescueMark,
      isCustom,
      averageModel: type === 'CEP' ? 'simple' : 'ponderee',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. CONFIGURATION COMPLÈTE (module Paramètres)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Les 4 types d'examen avec leurs règles effectives — les défauts backend
   * sont AFFICHÉS quand aucune surcharge n'existe (jamais d'écran vide) et
   * marqués « Défaut du backend ».
   */
  async getGradingRulesConfig(tenantId: string, userId: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);

    const rules = (await this.prisma.$queryRawUnsafe(
      `SELECT "examType", "passMark", "rescueMark", "updatedAt", "updatedBy"
       FROM "federis_grading_rules" WHERE "tenantId" = $1`,
      patronat.tenantId,
    )) as any[];
    const byType = new Map<string, any>(rules.map((r) => [String(r.examType).toUpperCase(), r]));

    const types = GRADING_EXAM_TYPES.map((type) => {
      const def = DEFAULT_GRADING_RULES[type];
      const custom = byType.get(type);
      return {
        examType: type,
        label: GRADING_TYPE_LABELS[type],
        passMark: custom ? Number(custom.passMark) : def.passMark,
        rescueMark: custom ? Number(custom.rescueMark) : def.rescueMark,
        defaultPassMark: def.passMark,
        defaultRescueMark: def.rescueMark,
        isCustom: Boolean(custom),
        averageModel: type === 'CEP' ? 'simple' : 'ponderee',
        averageModelLabel:
          type === 'CEP'
            ? 'Moyenne simple — total / nombre d\u2019épreuves (primaire, sans coefficients)'
            : 'Moyenne pondérée — Σ(note × coefficient) / Σcoefficients (secondaire)',
        updatedAt: custom?.updatedAt ?? null,
      };
    });

    return {
      types,
      customCount: types.filter((t) => t.isCustom).length,
      semantics:
        'Par défaut, les règles du backend s\u2019appliquent (admission 10/20, rachat 9,5/20). Dès qu\u2019une règle est définie ici, elle devient la source de vérité du backend pour la délibération, les décisions et les documents officiels.',
      canManage: WRITE_DELIBERATION.includes(fn),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. DÉFINIR / MODIFIER (la ligne devient la source de vérité)
  // ═══════════════════════════════════════════════════════════════════════

  async upsertGradingRule(
    tenantId: string,
    userId: string,
    examType: string,
    dto: UpdateGradingRuleDto,
  ) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWrite(fn);

    const type = normalizeExamType(examType);
    if (!type) {
      throw new NotFoundException('Type d\u2019examen inconnu (CEP, BEPC, BAC ou CAP).');
    }

    const passMark = Number(dto.passMark);
    const rescueMark = Number(dto.rescueMark);
    if (Number.isNaN(passMark) || Number.isNaN(rescueMark)) {
      throw new BadRequestException('Seuils invalides.');
    }
    if (passMark < 0 || passMark > 20) {
      throw new BadRequestException('La moyenne d\u2019admission doit être comprise entre 0 et 20.');
    }
    if (rescueMark < 0 || rescueMark > 20) {
      throw new BadRequestException('Le seuil de rachat doit être compris entre 0 et 20.');
    }
    if (rescueMark >= passMark) {
      throw new BadRequestException(
        'Le seuil de rachat doit être inférieur à la moyenne d\u2019admission.',
      );
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "federis_grading_rules"
          ("id", "tenantId", "examType", "passMark", "rescueMark", "updatedBy", "metadata", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
       ON CONFLICT ("tenantId", "examType")
       DO UPDATE SET
          "passMark" = EXCLUDED."passMark",
          "rescueMark" = EXCLUDED."rescueMark",
          "updatedBy" = EXCLUDED."updatedBy",
          "metadata" = EXCLUDED."metadata",
          "updatedAt" = NOW()`,
      patronat.tenantId,
      type,
      passMark,
      rescueMark,
      userId,
      JSON.stringify({ comment: dto.comment ?? null, updatedAtIso: new Date().toISOString() }),
    );

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_GRADING_RULE_UPSERT',
          resource: 'FederisGradingRule',
          resourceId: `${patronat.tenantId}:${type}`,
          tableName: 'federis_grading_rules',
          recordId: `${patronat.tenantId}:${type}`,
          newData: { examType: type, passMark, rescueMark },
        },
      })
      .catch(() => undefined);

    this.logger.log(
      `Règle de calcul ${type} définie : admission ${passMark}/20, rachat ${rescueMark}/20 (${patronat.name})`,
    );

    return this.getGradingRulesConfig(tenantId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. RÉINITIALISER (suppression → retour aux défauts backend)
  // ═══════════════════════════════════════════════════════════════════════

  async resetGradingRule(tenantId: string, userId: string, examType: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertWrite(fn);

    const type = normalizeExamType(examType);
    if (!type) {
      throw new NotFoundException('Type d\u2019examen inconnu (CEP, BEPC, BAC ou CAP).');
    }

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "federis_grading_rules" WHERE "tenantId" = $1 AND "examType" = $2`,
      patronat.tenantId,
      type,
    );

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_GRADING_RULE_RESET',
          resource: 'FederisGradingRule',
          resourceId: `${patronat.tenantId}:${type}`,
          tableName: 'federis_grading_rules',
          recordId: `${patronat.tenantId}:${type}`,
          newData: { examType: type, resetToDefaults: true },
        },
      })
      .catch(() => undefined);

    this.logger.log(`Règle de calcul ${type} réinitialisée — défauts backend (${patronat.name})`);

    return this.getGradingRulesConfig(tenantId, userId);
  }
}
