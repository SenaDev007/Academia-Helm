/**
 * FederisEpreuveService — Épreuves & catalogue (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * Module « Épreuves et documents » scindé en deux onglets (2026-09-29) :
 *
 *   1. ONGLET « ÉPREUVES » — création des épreuves avec les MÊMES champs
 *      enrichis que les fiches pédagogiques / épreuves enseignants d'Academia
 *      Helm (RichTextEditor : figures SVG, symboles maths, opérations posées,
 *      fractions, tableaux, lignes calligraphiques, images, polices…) :
 *        - En-tête personnalisable par le patronat, RÉUTILISABLE pour toutes
 *          les épreuves (patronats.epreuveHeader) + surcharge ponctuelle ;
 *        - Corps : Situation d'évaluation → Tâche → sections LIBRES
 *          (Problème 1/2/3, Exercices… — libre arbitre, AUCUN modèle
 *          standard imposé par matière) ;
 *        - Clé / grille de correction (pages séparées du PDF) ;
 *        - Génération PDF 100 % BACKEND (Puppeteer, pattern Helm —
 *          structure professionnelle : en-tête, corps, pied de page).
 *
 *   2. ONGLET « CATALOGUE » — épreuves catégorisées en dossiers :
 *        année scolaire (ex : 2025-2026) → examen (CEP / BEPC /
 *        Baccalauréat / CAP) → épreuves.
 *
 * Endpoints (FederisEpreuveController) :
 *   GET    /federis/patronat/epreuves                 — liste (onglet Épreuves)
 *   GET    /federis/patronat/epreuves/catalogue       — arborescence catalogue
 *   POST   /federis/patronat/epreuves                 — créer une épreuve
 *   GET    /federis/patronat/epreuves/:id             — détail (édition)
 *   PATCH  /federis/patronat/epreuves/:id             — mise à jour (autosave)
 *   DELETE /federis/patronat/epreuves/:id             — supprimer
 *   GET    /federis/patronat/epreuves/:id/pdf         — PDF (Puppeteer)
 *   GET    /federis/patronat/epreuves/header          — en-tête réutilisable
 *   PUT    /federis/patronat/epreuves/header          — définir l'en-tête
 *
 * ⚠️ ISOLATION TERRITORIALE (règle Federis) : TOUT est scopé par le tenant
 * du patronat connecté. Le patronat du Borgou ne voit QUE ses épreuves —
 * jamais celles de l'Alibori. Seul le patronat NATIONAL dispose d'une vue
 * d'ensemble (réseau des patronats territoriaux enfants).
 *
 * Permissions (pattern FederisQuestionBankService) :
 *   - Lecture (liste, catalogue, PDF, en-tête) : tous les membres ;
 *   - Écriture (créer/modifier/supprimer, en-tête) : COORDONNATEUR +
 *     ORGANISATEUR (WRITE_EXAM_ORG).
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { SCHOOL_FONTS_CSS } from '../common/pdf-school-fonts';
import {
  WRITE_EXAM_ORG,
  normalizePatronatFunction,
  type PatronatFunction,
} from './federis-roles';

// ── Constantes ──────────────────────────────────────────────────────────────

/** Catégories d'examen = dossiers du catalogue. */
export const EPREUVE_CATEGORIES = ['CEP', 'BEPC', 'BAC', 'CAP'] as const;
export type EpreuveCategory = (typeof EPREUVE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EpreuveCategory, string> = {
  CEP: 'CEP — Certificat d\u2019Études Primaires',
  BEPC: 'BEPC — Brevet d\u2019Études du Premier Cycle',
  BAC: 'Baccalauréat',
  CAP: 'CAP — Certificat d\u2019Aptitude Professionnelle',
};

export const CATEGORY_SHORT_LABELS: Record<EpreuveCategory, string> = {
  CEP: 'CEP',
  BEPC: 'BEPC',
  BAC: 'Baccalauréat',
  CAP: 'CAP',
};

/** Cycle de vie : brouillon → validée → verrouillée (immuable). */
export const EPREUVE_STATUSES = ['DRAFT', 'VALIDATED', 'LOCKED'] as const;
export type EpreuveStatus = (typeof EPREUVE_STATUSES)[number];

export const STATUS_LABELS: Record<EpreuveStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validée',
  LOCKED: 'Verrouillée',
};

/** Taille max d'un champ riche HTML (≈ 2 Mo — images data URL incluses). */
const RICH_FIELD_MAX = 2_000_000;

// ── DTO ─────────────────────────────────────────────────────────────────────

export class CreateEpreuveDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title!: string;

  @IsIn(EPREUVE_CATEGORIES as unknown as string[])
  examCategory!: EpreuveCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessionLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  durationLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  maxScoreLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  coefficient?: string;

  @IsOptional()
  showIdentityFields?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  customHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  situation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  tache?: string;

  /** Sections libres : [{ id, title, content }] */
  @IsOptional()
  sections?: any;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  cleCorrection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  grilleCorrection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  footerText?: string;
}

export class UpdateEpreuveDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title?: string;

  @IsOptional()
  @IsIn(EPREUVE_CATEGORIES as unknown as string[])
  examCategory?: EpreuveCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessionLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  durationLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  maxScoreLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  coefficient?: string;

  @IsOptional()
  showIdentityFields?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  customHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  situation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  tache?: string;

  @IsOptional()
  sections?: any;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  cleCorrection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  grilleCorrection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  footerText?: string;

  @IsOptional()
  @IsIn(EPREUVE_STATUSES as unknown as string[])
  status?: EpreuveStatus;
}

export class UpdateEpreuveHeaderDto {
  /** HTML riche de l'en-tête réutilisable ('' = réinitialiser). */
  @IsString()
  @MaxLength(RICH_FIELD_MAX)
  header!: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Échappement HTML des valeurs textuelles injectées dans le template PDF. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Section libre d'une épreuve (contenu JSON `sections`). */
interface EpreuveSection {
  id?: string;
  title?: string;
  content?: string;
}

@Injectable()
export class FederisEpreuveService {
  private readonly logger = new Logger(FederisEpreuveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  // ── Contexte & permissions (pattern FederisQuestionBankService) ──────────

  /** Résout le patronat + la fonction du demandeur — scopé par TENANT. */
  private async resolveContext(tenantId: string, userId?: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        abbreviation: true,
        legalName: true,
        logo: true,
        orgLevel: true,
        epreuveHeader: true,
        country: { select: { name: true } },
      },
    });
    if (!patronat) {
      throw new NotFoundException('Aucun espace patronat associé à ce compte.');
    }

    let fn: PatronatFunction = 'VIEWER';
    if (userId) {
      const link = await this.prisma.patronatUser.findFirst({
        where: { tenantId, userId, isActive: true },
        select: { role: true },
      });
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      fn = normalizePatronatFunction(link?.role ?? user?.role);
    }
    return { patronat, fn };
  }

  private assertCanWrite(fn: PatronatFunction): void {
    if (!WRITE_EXAM_ORG.includes(fn)) {
      throw new ForbiddenException(
        'Les épreuves sont gérées par le coordonnateur et l\u2019organisateur du patronat.',
      );
    }
  }

  /** Année scolaire active du patronat. */
  private async getActiveYear(tenantId: string) {
    return this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
  }

  // ── Auto-guérison du schéma (pattern ensure-tables main.ts) ─────────────
  //
  // Le déploiement Railway n'exécute PAS prisma migrate deploy au démarrage
  // (SKIP_MIGRATIONS=true par défaut). Pour que le module soit utilisable
  // immédiatement après déploiement — sans attendre une migration manuelle —
  // la table et la colonne sont créées IDEMPOTEMMENT au premier appel
  // (CREATE TABLE IF NOT EXISTS / DO $$ IF NOT EXISTS, miroir EXACT de la
  // migration 20260929150000_federis_exam_papers).

  private schemaReady = false;

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      await this.prisma.$queryRawUnsafe(`SELECT 1 FROM "federis_exam_papers" LIMIT 1`);
      await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.columns WHERE table_name='patronats' AND column_name='epreuveHeader' LIMIT 1`,
      ).then((r: any[]) => {
        if (!r || r.length === 0) throw new Error('colonne epreuveHeader absente');
      });
      this.schemaReady = true;
      return;
    } catch {
      /* table ou colonne absente → création idempotente ci-dessous */
    }

    const statements = [
      `CREATE TABLE IF NOT EXISTS "federis_exam_papers" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "patronatId" TEXT NOT NULL,
          "academicYearId" TEXT NOT NULL,
          "examCategory" TEXT NOT NULL,
          "subject" TEXT,
          "title" TEXT NOT NULL,
          "sessionLabel" TEXT,
          "durationLabel" TEXT,
          "maxScoreLabel" TEXT,
          "coefficient" TEXT,
          "showIdentityFields" BOOLEAN NOT NULL DEFAULT true,
          "customHeader" TEXT,
          "situation" TEXT,
          "tache" TEXT,
          "sections" JSONB,
          "cleCorrection" TEXT,
          "grilleCorrection" TEXT,
          "footerText" TEXT,
          "status" TEXT NOT NULL DEFAULT 'DRAFT',
          "createdBy" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "federis_exam_papers_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "federis_exam_papers_tenantId_academicYearId_examCategory_idx"
          ON "federis_exam_papers"("tenantId", "academicYearId", "examCategory")`,
      `CREATE INDEX IF NOT EXISTS "federis_exam_papers_tenantId_status_idx"
          ON "federis_exam_papers"("tenantId", "status")`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_exam_papers_tenantId_fkey') THEN
              ALTER TABLE "federis_exam_papers"
                  ADD CONSTRAINT "federis_exam_papers_tenantId_fkey"
                  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
          END IF;
      END $$`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_exam_papers_patronatId_fkey') THEN
              ALTER TABLE "federis_exam_papers"
                  ADD CONSTRAINT "federis_exam_papers_patronatId_fkey"
                  FOREIGN KEY ("patronatId") REFERENCES "patronats"("id") ON DELETE CASCADE;
          END IF;
      END $$`,
      `ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "epreuveHeader" TEXT`,
    ];

    for (const stmt of statements) {
      try {
        await this.prisma.$executeRawUnsafe(stmt);
      } catch (e: any) {
        if (!String(e?.message ?? '').includes('already exists')) {
          this.logger.warn(`FederisEpreuve ensure-schema : ${String(e?.message ?? e)}`);
        }
      }
    }

    this.schemaReady = true;
    this.logger.log('Schéma federis_exam_papers vérifié / créé (auto-guérison).');
  }

  /** Valide la structure des sections libres [{id, title, content}]. */
  private sanitizeSections(sections: any): EpreuveSection[] | null {
    if (!sections) return null;
    let list: EpreuveSection[] = [];
    if (Array.isArray(sections)) {
      list = sections;
    } else if (typeof sections === 'object') {
      // Tolérant : { items: [...] } ou { sections: [...] }
      const arr = (sections as any).items ?? (sections as any).sections;
      if (Array.isArray(arr)) list = arr;
      else return null;
    } else {
      return null;
    }
    const cleaned = list
      .filter((s) => s && typeof s === 'object')
      .slice(0, 40)
      .map((s, i) => ({
        id: typeof s.id === 'string' && s.id ? s.id.slice(0, 80) : `section-${i + 1}`,
        title:
          typeof s.title === 'string' && s.title.trim()
            ? s.title.trim().slice(0, 190)
            : `Section ${i + 1}`,
        content: typeof s.content === 'string' ? s.content.slice(0, RICH_FIELD_MAX) : '',
      }));
    return cleaned;
  }

  // ── Onglet « Épreuves » : liste + CRUD ────────────────────────────────────

  /**
   * Liste des épreuves du patronat (toutes années — le frontend groupe par
   * année / catégorie). Lecture : tous les membres.
   */
  async listEpreuves(tenantId: string, userId?: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);

    const papers = await this.prisma.federisExamPaper.findMany({
      where: { patronatId: patronat.id },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const years = await this.prisma.academicYear.findMany({
      where: { tenantId: patronat.tenantId },
      select: { id: true, label: true, name: true, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    const yearById = new Map(years.map((y) => [y.id, y]));

    return {
      academicYears: years,
      activeYearId: years.find((y) => y.isActive)?.id ?? null,
      canManage: WRITE_EXAM_ORG.includes(fn),
      epreuves: papers.map((p) => ({
        id: p.id,
        academicYearId: p.academicYearId,
        academicYearLabel: yearById.get(p.academicYearId)?.label ?? null,
        examCategory: p.examCategory,
        examCategoryLabel:
          CATEGORY_SHORT_LABELS[p.examCategory as EpreuveCategory] ?? p.examCategory,
        subject: p.subject,
        title: p.title,
        sessionLabel: p.sessionLabel,
        durationLabel: p.durationLabel,
        status: p.status,
        statusLabel: STATUS_LABELS[p.status as EpreuveStatus] ?? p.status,
        hasCorrection: !!(p.cleCorrection || p.grilleCorrection),
        sectionsCount: Array.isArray(p.sections) ? (p.sections as any[]).length : 0,
        updatedAt: p.updatedAt,
      })),
    };
  }

  /** Créer une épreuve (coordonnateur / organisateur). */
  async createEpreuve(tenantId: string, userId: string, dto: CreateEpreuveDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);

    const year = await this.getActiveYear(patronat.tenantId);
    if (!year) {
      throw new BadRequestException(
        'Aucune année scolaire active — générez une année depuis les Paramètres.',
      );
    }

    const paper = await this.prisma.federisExamPaper.create({
      data: {
        tenantId: patronat.tenantId,
        patronatId: patronat.id,
        academicYearId: year.id,
        examCategory: dto.examCategory,
        subject: dto.subject?.trim() || null,
        title: dto.title.trim(),
        sessionLabel: dto.sessionLabel?.trim() || null,
        durationLabel: dto.durationLabel?.trim() || null,
        maxScoreLabel: dto.maxScoreLabel?.trim() || null,
        coefficient: dto.coefficient?.trim() || null,
        showIdentityFields: dto.showIdentityFields !== false,
        customHeader: dto.customHeader || null,
        situation: dto.situation || null,
        tache: dto.tache || null,
        sections: (this.sanitizeSections(dto.sections) ?? undefined) as any,
        cleCorrection: dto.cleCorrection || null,
        grilleCorrection: dto.grilleCorrection || null,
        footerText: dto.footerText?.trim() || null,
        status: 'DRAFT',
        createdBy: userId,
      },
    });

    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_EPREUVE_CREATE', paper.id, {
      title: paper.title,
      examCategory: paper.examCategory,
    });

    return this.serializeEpreuve(paper, year.label);
  }

  /** Détail d'une épreuve (édition) — scopé au patronat connecté. */
  async getEpreuve(tenantId: string, userId: string | undefined, id: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    const yearLabels = await this.yearLabelMap(patronat.tenantId);
    const paper = await this.getOwnedEpreuve(patronat.id, id);
    return {
      ...this.serializeEpreuve(paper, yearLabels.get(paper.academicYearId) ?? null),
      canManage: WRITE_EXAM_ORG.includes(fn),
    };
  }

  /**
   * Mise à jour (autosave toutes les 10 s côté frontend — pattern fiches
   * Helm). Une épreuve VERROUILLÉE est immuable (déverrouillage interdit —
   * sécurité des sujets avant impression, pattern banque d'épreuves).
   */
  async updateEpreuve(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateEpreuveDto,
  ) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);
    const paper = await this.getOwnedEpreuve(patronat.id, id);

    if (paper.status === 'LOCKED') {
      throw new ForbiddenException(
        'Épreuve verrouillée — immuable (sécurité des sujets avant impression).',
      );
    }

    // Transition de statut contrôlée : DRAFT → VALIDATED → LOCKED (jamais
    // en arrière — déverrouiller casserait la traçabilité des sujets).
    if (dto.status && dto.status !== paper.status) {
      const order: Record<string, number> = { DRAFT: 0, VALIDATED: 1, LOCKED: 2 };
      if (order[dto.status] < order[paper.status]) {
        throw new BadRequestException(
          'Transition de statut interdite (une épreuve validée/verrouillée ne revient pas en arrière).',
        );
      }
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.examCategory !== undefined) data.examCategory = dto.examCategory;
    if (dto.subject !== undefined) data.subject = dto.subject?.trim() || null;
    if (dto.sessionLabel !== undefined) data.sessionLabel = dto.sessionLabel?.trim() || null;
    if (dto.durationLabel !== undefined) data.durationLabel = dto.durationLabel?.trim() || null;
    if (dto.maxScoreLabel !== undefined) data.maxScoreLabel = dto.maxScoreLabel?.trim() || null;
    if (dto.coefficient !== undefined) data.coefficient = dto.coefficient?.trim() || null;
    if (dto.showIdentityFields !== undefined) data.showIdentityFields = dto.showIdentityFields;
    if (dto.customHeader !== undefined) data.customHeader = dto.customHeader || null;
    if (dto.situation !== undefined) data.situation = dto.situation || null;
    if (dto.tache !== undefined) data.tache = dto.tache || null;
    if (dto.sections !== undefined) {
      data.sections = (this.sanitizeSections(dto.sections) ?? undefined) as any;
    }
    if (dto.cleCorrection !== undefined) data.cleCorrection = dto.cleCorrection || null;
    if (dto.grilleCorrection !== undefined) data.grilleCorrection = dto.grilleCorrection || null;
    if (dto.footerText !== undefined) data.footerText = dto.footerText?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.federisExamPaper.update({
      where: { id: paper.id },
      data,
    });

    if (dto.status && dto.status !== paper.status) {
      await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_EPREUVE_STATUS', paper.id, {
        from: paper.status,
        to: dto.status,
      });
    }

    const yearLabels = await this.yearLabelMap(patronat.tenantId);
    return this.serializeEpreuve(updated, yearLabels.get(updated.academicYearId) ?? null);
  }

  /** Supprimer une épreuve (jamais une épreuve verrouillée). */
  async deleteEpreuve(tenantId: string, userId: string, id: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);
    const paper = await this.getOwnedEpreuve(patronat.id, id);

    if (paper.status === 'LOCKED') {
      throw new ForbiddenException('Épreuve verrouillée — suppression impossible.');
    }

    await this.prisma.federisExamPaper.delete({ where: { id: paper.id } });
    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_EPREUVE_DELETE', paper.id, {
      title: paper.title,
      examCategory: paper.examCategory,
    });
    return { success: true };
  }

  // ── Onglet « Catalogue » : arborescence année → examen → épreuves ────────

  /**
   * Arborescence du catalogue : pour chaque année scolaire ayant des
   * épreuves, un dossier par examen (CEP / BEPC / Baccalauréat / CAP) avec
   * le nombre d'épreuves. Le patronat NATIONAL reçoit en plus une vue
   * d'ensemble de son réseau (patronats territoriaux enfants + volumes) —
   * les patronats territoriaux ne voient QUE leur propre contenu
   * (isolation territoriale stricte).
   */
  async catalogue(tenantId: string, userId?: string) {
    await this.ensureSchema();
    const { patronat } = await this.resolveContext(tenantId, userId);

    const papers = await this.prisma.federisExamPaper.findMany({
      where: { patronatId: patronat.id },
      select: { id: true, academicYearId: true, examCategory: true, status: true },
      take: 1000,
    });

    const years = await this.prisma.academicYear.findMany({
      where: { tenantId: patronat.tenantId },
      select: { id: true, label: true, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    const yearById = new Map(years.map((y) => [y.id, y]));

    // Regroupement année → catégorie
    const byYear = new Map<string, Map<string, number>>();
    for (const p of papers) {
      if (!byYear.has(p.academicYearId)) byYear.set(p.academicYearId, new Map());
      const cats = byYear.get(p.academicYearId)!;
      cats.set(p.examCategory, (cats.get(p.examCategory) ?? 0) + 1);
    }

    const tree = [...byYear.entries()]
      .map(([yearId, cats]) => ({
        academicYearId: yearId,
        label: yearById.get(yearId)?.label ?? yearId,
        isActive: yearById.get(yearId)?.isActive ?? false,
        total: [...cats.values()].reduce((a, b) => a + b, 0),
        categories: EPREUVE_CATEGORIES.map((c) => ({
          code: c,
          label: CATEGORY_SHORT_LABELS[c],
          count: cats.get(c) ?? 0,
        })).filter((c) => c.count > 0),
      }))
      .sort((a, b) => b.label.localeCompare(a.label, 'fr'));

    // Vue réseau — RÉSERVÉE au patronat national (vue globale des
    // départements). Un patronat territorial ne reçoit JAMAIS les données
    // d'un autre patronat (isolation).
    let network: {
      patronatId: string;
      name: string;
      territory: string | null;
      totalEpreuves: number;
    }[] | null = null;

    if (patronat.orgLevel === 'NATIONAL') {
      const children = await this.prisma.patronat.findMany({
        where: { parentPatronatId: patronat.id },
        select: { id: true, name: true, territoryName: true },
        orderBy: { name: 'asc' },
      });
      network = [];
      for (const child of children) {
        const count = await this.prisma.federisExamPaper.count({
          where: { patronatId: child.id },
        });
        network.push({
          patronatId: child.id,
          name: child.name,
          territory: child.territoryName,
          totalEpreuves: count,
        });
      }
    }

    return {
      categories: EPREUVE_CATEGORIES.map((c) => ({
        code: c,
        label: CATEGORY_SHORT_LABELS[c],
        fullLabel: CATEGORY_LABELS[c],
      })),
      years: tree,
      network,
      orgLevel: patronat.orgLevel,
    };
  }

  // ── En-tête réutilisable du patronat ─────────────────────────────────────

  async getHeader(tenantId: string, userId?: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    return {
      header: patronat.epreuveHeader ?? '',
      canManage: WRITE_EXAM_ORG.includes(fn),
    };
  }

  async updateHeader(tenantId: string, userId: string, dto: UpdateEpreuveHeaderDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertCanWrite(fn);

    await this.prisma.patronat.update({
      where: { id: patronat.id },
      data: { epreuveHeader: dto.header || null },
    });

    await this.writeAudit(
      patronat.tenantId,
      userId,
      'FEDERIS_EPREUVE_HEADER_UPDATE',
      patronat.id,
      { length: dto.header?.length ?? 0 },
    );

    return { header: dto.header ?? '' };
  }

  // ── Génération PDF (100 % backend — pattern Helm Puppeteer) ──────────────

  async exportPdf(tenantId: string, userId: string, id: string) {
    await this.ensureSchema();
    const { patronat } = await this.resolveContext(tenantId, userId);
    const paper = await this.getOwnedEpreuve(patronat.id, id);
    const yearLabels = await this.yearLabelMap(patronat.tenantId);

    const buffer = await this.renderEpreuvePdf(paper, {
      patronatName: patronat.legalName || patronat.name,
      patronatShortName: patronat.name,
      abbreviation: patronat.abbreviation,
      country: patronat.country?.name ?? null,
      logo: patronat.logo ?? null,
      reusableHeader: patronat.epreuveHeader ?? null,
      academicYearLabel: yearLabels.get(paper.academicYearId) ?? null,
    });

    const filename = `Epreuve_${paper.examCategory}_${(paper.subject || paper.title)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .slice(0, 60)}.pdf`;

    await this.writeAudit(patronat.tenantId, userId, 'FEDERIS_EPREUVE_PDF', paper.id, {
      title: paper.title,
      examCategory: paper.examCategory,
    });

    return { buffer, filename };
  }

  private async renderEpreuvePdf(
    paper: any,
    ctx: {
      patronatName: string;
      patronatShortName: string;
      abbreviation: string | null;
      country: string | null;
      logo: string | null;
      reusableHeader: string | null;
      academicYearLabel: string | null;
    },
  ): Promise<Buffer> {
    const html = this.buildEpreuvePdfHtml(paper, ctx);
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 500));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '14mm', left: '10mm', right: '10mm' },
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size:8px; width:100%; text-align:center; color:#475569;
                      font-family: Arial, sans-serif; padding: 0 10mm;">
            ${esc(ctx.patronatShortName)} · Academia Federis —
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>`,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Template PDF d'une épreuve — structure professionnelle conforme aux
   * modèles officiels (pattern buildEpreuvesPdfHtml Helm) :
   *
   *   EN-TÊTE   : en-tête personnalisé du patronat (HTML riche assaini) ou
   *               en-tête par défaut (logo + nom + pays + année + session),
   *               titre de l'épreuve, badge examen, champs Nom/Prénoms.
   *   CORPS     : Situation d'évaluation → Tâche → sections libres
   *               (Problème 1/2/3, Exercices…) — HTML riche assaini
   *               (figures SVG, maths, tableaux, calligraphie, images).
   *   PIED      : barème / coefficient + pied de page personnalisé +
   *               folio (numéro de page) sur chaque page.
   *
   * Clé et grille de correction : PAGES SÉPARÉES avec bandeau « document
   * organisateur » (jamais mêlées au sujet distribué aux candidats).
   */
  private buildEpreuvePdfHtml(
    paper: any,
    ctx: {
      patronatName: string;
      patronatShortName: string;
      abbreviation: string | null;
      country: string | null;
      logo: string | null;
      reusableHeader: string | null;
      academicYearLabel: string | null;
    },
  ): string {
    const situation = this.sanitizeRichHtml(paper.situation || '');
    const tache = this.sanitizeRichHtml(paper.tache || '');
    const cle = this.sanitizeRichHtml(paper.cleCorrection || '');
    const grille = this.sanitizeRichHtml(paper.grilleCorrection || '');
    const customHeader = this.sanitizeRichHtml(paper.customHeader || '');
    const reusableHeader = this.sanitizeRichHtml(ctx.reusableHeader || '');

    const categoryLabel =
      CATEGORY_LABELS[paper.examCategory as EpreuveCategory] ?? paper.examCategory;
    const categoryShort =
      CATEGORY_SHORT_LABELS[paper.examCategory as EpreuveCategory] ?? paper.examCategory;

    const sections: EpreuveSection[] = Array.isArray(paper.sections)
      ? (paper.sections as EpreuveSection[])
      : [];

    // ── EN-TÊTE : personnalisé (ponctuel > réutilisable) ou par défaut ──
    const headerHtml = customHeader
      ? `<div class="custom-header">${customHeader}</div>`
      : reusableHeader
        ? `<div class="custom-header">${reusableHeader}</div>`
        : `
        <div class="header">
          <div class="school-line">
            ${ctx.logo ? `<img src="${esc(ctx.logo)}" class="logo" />` : ''}
            <div class="school-name">${esc(ctx.patronatName).toUpperCase()}</div>
          </div>
          ${ctx.abbreviation || ctx.country
            ? `<div class="sub-line">${[ctx.abbreviation, ctx.country].filter(Boolean).map(esc).join(' · ')}</div>`
            : ''}
          <div class="meta-row">
            <div class="meta-left">${ctx.academicYearLabel ? `Année scolaire : ${esc(ctx.academicYearLabel)}` : ''}</div>
            <div class="meta-center">${paper.sessionLabel ? esc(paper.sessionLabel) : ''}</div>
            <div class="meta-right">${esc(categoryShort)}</div>
          </div>
        </div>`;

    const identityBlock =
      paper.showIdentityFields !== false
        ? `
        <div class="identity">
          <div class="id-field"><span>Nom :</span><span class="dots"></span></div>
          <div class="id-field"><span>Prénoms :</span><span class="dots"></span></div>
        </div>`
        : '';

    const sectionsHtml = sections
      .map((s) => {
        const content = this.sanitizeRichHtml(s.content || '');
        if (!content && !s.title) return '';
        return `
        <div class="section">
          ${s.title ? `<div class="section-label">${esc(s.title)}</div>` : ''}
          <div class="section-body">${content}</div>
        </div>`;
      })
      .join('\n');

    const pages: string[] = [];

    // Page principale du sujet (distribuée aux candidats)
    pages.push(`
      <div class="epreuve-page">
        ${headerHtml}
        <div class="eval-title">${esc(paper.title || 'ÉPREUVE').toUpperCase()}</div>
        ${paper.subject ? `<div class="epreuve-title">ÉPREUVE : ${esc(paper.subject).toUpperCase()}</div>` : ''}
        ${paper.durationLabel ? `<div class="duration">Durée : ${esc(paper.durationLabel)}</div>` : ''}
        ${identityBlock}

        ${situation
          ? `
        <div class="section">
          <div class="section-label">Situation d'évaluation</div>
          <div class="section-body">${situation}</div>
        </div>`
          : ''}

        ${tache
          ? `
        <div class="section">
          <div class="section-label">Tâche</div>
          <div class="section-body">${tache}</div>
        </div>`
          : ''}

        ${sectionsHtml}

        ${paper.maxScoreLabel || paper.coefficient
          ? `
        <div class="score-line">
          ${paper.maxScoreLabel ? `<span>Barème : ${esc(paper.maxScoreLabel)}${String(paper.maxScoreLabel).includes('pt') ? '' : ' pts'}</span>` : ''}
          ${paper.coefficient ? `<span>Coefficient : ${esc(paper.coefficient)}</span>` : ''}
        </div>`
          : ''}

        ${paper.footerText ? `<div class="custom-footer">${this.sanitizeRichHtml(paper.footerText)}</div>` : ''}
      </div>`);

    // Clé de correction — page séparée (document organisateur)
    if (cle) {
      pages.push(`
      <div class="epreuve-page correction">
        <div class="correction-banner">CLÉ DE CORRECTION — ${esc(paper.subject || paper.title).toUpperCase()} <span>(document organisateur — ${esc(categoryShort)})</span></div>
        <div class="section-body">${cle}</div>
      </div>`);
    }
    // Grille de correction — page séparée
    if (grille) {
      pages.push(`
      <div class="epreuve-page correction">
        <div class="correction-banner">GRILLE DE CORRECTION — ${esc(paper.subject || paper.title).toUpperCase()} <span>(document organisateur — ${esc(categoryShort)})</span></div>
        <div class="section-body">${grille}</div>
      </div>`);
    }

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>/* Polices scolaires embarquées (base64 — rendu déterministe sans réseau) */
${SCHOOL_FONTS_CSS}
  @page { size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', 'Noto Serif', serif; color: #111; font-size: 12px; line-height: 1.55; }
  .epreuve-page { page-break-after: always; padding: 4mm 2mm; }
  .epreuve-page:last-child { page-break-after: auto; }

  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
  .school-line { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .logo { height: 52px; max-width: 130px; object-fit: contain; }
  .school-name { font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4px; }
  .sub-line { font-size: 10.5px; margin-top: 2px; color: #333; }
  .meta-row { display: flex; justify-content: space-between; font-size: 10.5px; margin-top: 4px; gap: 8px; }
  .eval-title { font-size: 14px; font-weight: bold; margin-top: 10px; text-decoration: underline; text-align: center; }
  .epreuve-title { font-size: 13px; font-weight: bold; margin-top: 12px; padding: 4px 10px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 3px; display: inline-block; }
  .duration { font-size: 11px; margin-top: 6px; font-weight: bold; text-align: center; }

  .identity { display: flex; gap: 24px; margin-top: 12px; font-size: 11.5px; }
  .id-field { flex: 1; display: flex; align-items: flex-end; gap: 4px; }
  .id-field .dots { flex: 1; border-bottom: 1px dotted #444; height: 14px; }

  .section { margin-top: 14px; }
  .section-label { font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #1e3a8a; }
  .section-body { font-size: 12px; }
  .section-body img { max-width: 100%; height: auto; }
  .section-body table { border-collapse: collapse; width: 100%; margin: 6px 0; }
  .section-body td, .section-body th { border: 1px solid #444; padding: 4px 6px; vertical-align: top; }
  .section-body svg { max-width: 100%; height: auto; }

  /* En-tête personnalisé du patronat (HTML riche) */
  .custom-header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
  .custom-header img { max-width: 100%; height: auto; }
  .custom-header table { border-collapse: collapse; width: 100%; }

  /* Lignes calligraphiques insérées par l'éditeur (classes dédiées) */
  .calli-lines { border: none !important; background: none !important; }
  .calli-line { height: 26px; border-bottom: 1px solid #999; position: relative; }
  .calli-line.dotted-mid::after { content: ''; position: absolute; left: 0; right: 0; top: 13px; border-bottom: 1px dotted #bbb; }
  .calli-model { font-size: 20px; color: #9aa4b2; letter-spacing: 2px; line-height: 26px; }
  .calli-model.cursive { font-family: 'Segoe Script', 'Brush Script MT', cursive; }
  .calli-model.script { font-family: 'Comic Sans MS', 'Calibri', sans-serif; }

  .score-line { display: flex; justify-content: flex-end; gap: 18px; font-size: 11px; margin-top: 10px; font-weight: bold; }
  .custom-footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #999; font-size: 10.5px; color: #333; text-align: center; }

  .correction-banner { background: #111; color: #fff; padding: 8px 12px; font-weight: bold; font-size: 13px; margin-bottom: 12px; }
  .correction-banner span { font-weight: normal; font-size: 10px; font-style: italic; }
  .correction .section-body { font-size: 11.5px; }
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
  }

  // ── Helpers internes ─────────────────────────────────────────────────────

  /** Épreuve scopée au patronat connecté (isolation territoriale). */
  private async getOwnedEpreuve(patronatId: string, id: string) {
    const paper = await this.prisma.federisExamPaper.findFirst({
      where: { id, patronatId },
    });
    if (!paper) {
      throw new NotFoundException('Épreuve introuvable dans votre périmètre.');
    }
    return paper;
  }

  /** Map academicYearId → label (du patronat connecté uniquement). */
  private async yearLabelMap(tenantId: string): Promise<Map<string, string>> {
    const years = await this.prisma.academicYear.findMany({
      where: { tenantId },
      select: { id: true, label: true },
    });
    return new Map(years.map((y) => [y.id, y.label]));
  }

  /** Sérialisation API d'une épreuve. */
  private serializeEpreuve(paper: any, academicYearLabel: string | null) {
    return {
      id: paper.id,
      academicYearId: paper.academicYearId,
      academicYearLabel,
      examCategory: paper.examCategory,
      examCategoryLabel:
        CATEGORY_SHORT_LABELS[paper.examCategory as EpreuveCategory] ?? paper.examCategory,
      subject: paper.subject,
      title: paper.title,
      sessionLabel: paper.sessionLabel,
      durationLabel: paper.durationLabel,
      maxScoreLabel: paper.maxScoreLabel,
      coefficient: paper.coefficient,
      showIdentityFields: paper.showIdentityFields,
      customHeader: paper.customHeader ?? '',
      situation: paper.situation ?? '',
      tache: paper.tache ?? '',
      sections: Array.isArray(paper.sections) ? paper.sections : [],
      cleCorrection: paper.cleCorrection ?? '',
      grilleCorrection: paper.grilleCorrection ?? '',
      footerText: paper.footerText ?? '',
      status: paper.status,
      statusLabel: STATUS_LABELS[paper.status as EpreuveStatus] ?? paper.status,
      updatedAt: paper.updatedAt,
      createdAt: paper.createdAt,
    };
  }

  /**
   * Assainit le HTML riche (même implémentation que les fiches Helm /
   * épreuves enseignants : conserve img, svg, tableaux, fractions et
   * opérations posées ; supprime script, iframe, attributs on-événement
   * et liens javascript).
   */
  private sanitizeRichHtml(html: string): string {
    if (!html) return '';
    let s = html;
    s = s.replace(
      /<(script|iframe|object|embed|style|link|meta|noscript|template|form|input|button|select|textarea|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      '',
    );
    s = s.replace(
      /<(script|iframe|object|embed|style|link|meta|noscript|template|form|input|button|select|textarea|video|audio)\b[^>]*\/?>/gi,
      '',
    );
    s = s.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(
      /(src|href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+|"vbscript:[^"]*"|'vbscript:[^']*')/gi,
      '$1="#"',
    );
    s = s.replace(/\s+contenteditable\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/style\s*=\s*"[^"]*expression\s*\(/gi, 'style="');
    return s.trim();
  }

  /** Journal d'audit (pattern FederisPdfService). */
  private async writeAudit(
    tenantId: string,
    userId: string,
    action: string,
    resourceId: string,
    newData: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          resource: 'FederisExamPaper',
          resourceId,
          tableName: 'federis_exam_papers',
          recordId: resourceId,
          newData: newData as any,
        },
      });
    } catch (e) {
      this.logger.warn(`AuditLog ${action} non journalisé : ${String(e)}`);
    }
  }
}
