/**
 * ============================================================================
 * MONTHLY PLAN SERVICE — Planification pédagogique mensuelle
 * ============================================================================
 *
 * Permet à chaque enseignant de planifier son mois pour sa classe, en se
 * basant sur la planification annuelle officielle (annual_plans) comme source.
 *
 * Terminologie (clarifiée par le client) :
 *   - SA  = Situation d'Apprentissage (ex: SA1, SA2, SA3)
 *   - Séquence = Séquence pédagogique (séq 1, séq 2, séq 3) — séance de classe
 *   - U   = Unité (ex: U1, U2, U3)
 *   - D   = Dossier (ex: D1, D2, D3)
 *
 * Auto-proposition : si l'enseignant n'a pas encore planifié son mois, on
 *   extrait les données depuis annual_plans (qui contient des chaînes comme
 *   "U1 SA1 à SA4 (10ème séance)" ou "D1 SA1 séq 1-5") et on les propose
 *   automatiquement. L'enseignant peut ensuite éditer chaque cellule.
 *
 * Modes selon le niveau :
 *   - MATERNELLE : 5 domaines × sous-domaines × semaines
 *   - CI/CP : 2 feuilles (T1 immersion + T2+T3 systématique)
 *   - CE1-CM2 : 1 feuille standard (5 semaines × domaines/sous-domaines)
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';

export interface MonthlyPlanCell {
  id?: string;
  weekNumber: number;
  domain: string;
  subDomain?: string;
  activityType?: 'SA' | 'SEQUENCE' | 'U' | 'D' | null;
  activityNumber?: number | null;
  sequenceNumber?: number | null;
  content: string;
  isAutoProposed: boolean;
  isCustom: boolean;
  annualPlanId?: string | null;
}

export interface MonthlyPlanResponse {
  cells: MonthlyPlanCell[];
  isAutoProposed: boolean;
  hasExistingCustom: boolean;
  status?: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';
  teacherSignature?: string | null;
  directorSignature?: string | null;
  directorObservation?: string | null;
}

@Injectable()
export class MonthlyPlanService {
  private readonly logger = new Logger(MonthlyPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère la planification mensuelle pour une classe + enseignant + mois donné.
   * Si aucune donnée n'existe, retourne un tableau vide (l'UI proposera l'auto-proposition).
   */
  async getMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    options: { teacherId?: string; academicClassId?: string } = {},
  ): Promise<MonthlyPlanResponse> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4
        ${options.teacherId ? 'AND "teacherId" = $5' : ''}
        ${options.academicClassId ? `AND "academicClassId" = ${options.teacherId ? '$6' : '$5'}` : ''}
      ORDER BY "weekNumber" ASC, "domain" ASC, "subDomain" ASC, "activityNumber" ASC NULLS LAST
    `,
      ...(options.teacherId && options.academicClassId
        ? [tenantId, academicYearId, classLevel, month, options.teacherId, options.academicClassId]
        : options.teacherId
          ? [tenantId, academicYearId, classLevel, month, options.teacherId]
          : options.academicClassId
            ? [tenantId, academicYearId, classLevel, month, options.academicClassId]
            : [tenantId, academicYearId, classLevel, month]),
    );

    const cells: MonthlyPlanCell[] = rows.map(r => ({
      id: r.id,
      weekNumber: r.weekNumber,
      domain: r.domain,
      subDomain: r.subDomain || undefined,
      activityType: r.activityType || undefined,
      activityNumber: r.activityNumber || undefined,
      sequenceNumber: r.sequenceNumber || undefined,
      content: r.content,
      isAutoProposed: r.isAutoProposed,
      isCustom: r.isCustom,
      annualPlanId: r.annualPlanId || undefined,
    }));

    const hasExistingCustom = cells.some(c => c.isCustom);

    // ⭐ Récupérer le statut + signatures depuis la première ligne (toutes les lignes
    //    d'une même planif partagent les mêmes colonnes status/signature/...)
    const first = rows[0] || {};
    return {
      cells,
      isAutoProposed: cells.length > 0 && cells.every(c => c.isAutoProposed && !c.isCustom),
      hasExistingCustom,
      status: first.status || 'DRAFT',
      teacherSignature: first.teacherSignature || null,
      directorSignature: first.directorSignature || null,
      directorObservation: first.directorObservation || null,
    };
  }

  /**
   * ⭐ AUTO-PROPOSITION : extrait les données depuis annual_plans pour ce mois
   *    et les propose comme planification mensuelle. Ne sauvegarde PAS en base.
   *    L'enseignant peut ensuite éditer et sauvegarder.
   *
   * Pour PRIMAIRE (CI-CM2) : pour chaque (trimester, month, domain/subDomain) on extrait
   *   le contenu de annual_plans. On parse la chaîne pour identifier SA/U/D/Séq.
   *   On génère 5 semaines × {domain} avec le contenu de annual_plans étalé.
   *
   * Pour MATERNELLE : pour chaque (domain, subDomain, month, week) on prend le
   *   contenu de annual_plans directement (la semaine est déjà structurée).
   */
  async autoProposeMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
  ): Promise<MonthlyPlanCell[]> {
    // 1. Récupérer la planification annuelle pour ce mois
    const annualPlans: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "annual_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4
      ORDER BY "week" ASC, "domain" ASC, "subDomain" ASC
    `, tenantId, academicYearId, classLevel, month);

    if (annualPlans.length === 0) {
      return [];
    }

    // 2. ⭐ TOUJOURS 5 semaines (conforme au PDF officiel — Première à Cinquième Semaine)
    const numWeeks = 5;

    // 3. Cas MATERNELLE — chaque (domain, subDomain, week) a son propre contenu
    if (classLevel === 'MATERNELLE_GRANDS') {
      const cells: MonthlyPlanCell[] = [];
      for (let weekNum = 1; weekNum <= numWeeks; weekNum++) {
        const WEEK_LABELS = ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine', '5ème semaine'];
        // Pour septembre, les semaines commencent à "3ème semaine"
        const weekLabel = month === 'Septembre'
          ? (weekNum === 1 ? '3ème semaine' : weekNum === 2 ? '4ème semaine' : WEEK_LABELS[weekNum - 1])
          : (month === 'Décembre' && weekNum === 1 ? 'Congés' : WEEK_LABELS[weekNum - 1]);

        for (const plan of annualPlans) {
          if (plan.week !== weekLabel) continue;
          const parsed = this.parseActivityContent(plan.content);
          cells.push({
            weekNumber: weekNum,
            domain: plan.domain,
            subDomain: plan.subDomain || undefined,
            activityType: parsed.type,
            activityNumber: parsed.number,
            sequenceNumber: null,
            content: plan.content,
            isAutoProposed: true,
            isCustom: false,
            annualPlanId: plan.id,
          });
        }
      }
      return cells;
    }

    // 4. ⭐ Cas PRIMAIRE (CI, CP, CE1, CE2, CM1, CM2) — mapping vers la nouvelle
    //    structure des Champs de Formation (FRANÇAIS, MATH, EST, EA, ES, EPS, PETIT_PROJET)
    //
    //    Mapping des matières (annual_plans) → Champ de Formation (PDF officiel) :
    //      - "Français"               → FRANÇAIS (subDomain "Lecture")
    //      - "Mathématiques"          → MATH (subDomain "Arithmétique")
    //      - "EST"                    → EST
    //      - "Chant"                  → EA (subDomain "Chant")
    //      - "Poésie"                 → EA (subDomain "Poésie")
    //      - "Conte"                  → EA (subDomain "Contes")
    //      - "Dessin"                 → EA (subDomain "Dessin")
    //      - "Couture"                → EA (subDomain "Atelier")
    //      - "Morale"                 → ES (subDomain "Morale")
    //      - "Civisme"                → ES (subDomain "Civisme")
    //      - "Histoire"               → ES (subDomain "Compétence 2 (Histoire)")
    //      - "Géographie"             → ES (subDomain "Compétence 3 (Géographie)")
    //      - "EPS"                    → EPS
    const SUBJECT_TO_CHAMP: Record<string, { champ: string; subDomain: string }> = {
      'Français':       { champ: 'FRANÇAIS', subDomain: 'Lecture' },
      'Mathématiques':  { champ: 'MATH', subDomain: 'Arithmétique' },
      'EST':            { champ: 'EST', subDomain: '' },
      'Chant':          { champ: 'EA', subDomain: 'Chant' },
      'Poésie':         { champ: 'EA', subDomain: 'Poésie' },
      'Conte':          { champ: 'EA', subDomain: 'Contes' },
      'Dessin':         { champ: 'EA', subDomain: 'Dessin' },
      'Couture':        { champ: 'EA', subDomain: 'Atelier' },
      'Morale':         { champ: 'ES', subDomain: 'Morale' },
      'Civisme':        { champ: 'ES', subDomain: 'Civisme' },
      'Histoire':       { champ: 'ES', subDomain: 'Compétence 2 (Histoire)' },
      'Géographie':     { champ: 'ES', subDomain: 'Compétence 3 (Géographie)' },
      'EPS':            { champ: 'EPS', subDomain: '' },
    };

    const cells: MonthlyPlanCell[] = [];
    // Grouper les plans par matière (annual_plans a 1 entrée par matière par mois)
    const plansBySubject = new Map<string, any>();
    for (const plan of annualPlans) {
      // Pour le primaire, annual_plans stocke "Toutes" comme week — on l'utilise
      if (!plansBySubject.has(plan.domain)) {
        plansBySubject.set(plan.domain, plan);
      }
    }

    // Pour chaque semaine (1 à 5), on propose le contenu de annual_plans
    for (let weekNum = 1; weekNum <= numWeeks; weekNum++) {
      for (const [subject, plan] of plansBySubject.entries()) {
        const mapping = SUBJECT_TO_CHAMP[subject];
        if (!mapping) continue;  // Skip unknown subjects
        const parsed = this.parseActivityContent(plan.content);
        cells.push({
          weekNumber: weekNum,
          domain: mapping.champ,
          subDomain: mapping.subDomain || undefined,
          activityType: parsed.type,
          activityNumber: parsed.number,
          sequenceNumber: null,
          content: plan.content,
          isAutoProposed: true,
          isCustom: false,
          annualPlanId: plan.id,
        });
      }
    }

    return cells;
  }

  /**
   * ⭐ PARSAGE — extrait le type d'activité (SA, U, D, Séquence) et son numéro
   *    depuis une chaîne de contenu pédagogique.
   *
   *    Exemples :
   *      "U1:1ère semaine — U1 SA1 à SA4 (10ème séance)" → type=U, number=1
   *      "D1 SA1 séq 1-5"                                → type=D, number=1
   *      "SA1 P94 à 96"                                  → type=SA, number=1
   *      "Évaluation diagnostique"                      → type=null, number=null
   *      "SA2 Séq 2 à SA3 Séq2"                         → type=SA, number=2
   */
  private parseActivityContent(content: string): { type: 'SA' | 'U' | 'D' | 'SEQUENCE' | null; number: number | null } {
    if (!content) return { type: null, number: null };

    // Ordre de priorité : D (Dossier) > U (Unité) > SA (Situation d'Apprentissage)
    // Raison : un contenu peut mentionner plusieurs (ex: "U1 SA1") — l'unité est le
    // conteneur principal, donc on la prend en priorité.
    // Mais en pratique, on veut la référence SA car c'est ce qui rythme les semaines.
    // Choix : prioriser SA (situation d'apprentissage) car c'est ce que l'enseignant
    // suit au quotidien. Si pas de SA, prendre U. Si pas de U, prendre D.

    // Match SA + numéro
    const saMatch = content.match(/\bSA\s*(\d+)/i);
    if (saMatch) {
      return { type: 'SA', number: parseInt(saMatch[1], 10) };
    }

    // Match U + numéro
    const uMatch = content.match(/\bU\s*(\d+)/i);
    if (uMatch) {
      return { type: 'U', number: parseInt(uMatch[1], 10) };
    }

    // Match D + numéro
    const dMatch = content.match(/\bD\s*(\d+)/i);
    if (dMatch) {
      return { type: 'D', number: parseInt(dMatch[1], 10) };
    }

    // Match Séquence / Séq + numéro
    const seqMatch = content.match(/\bS[eé]q(?:uence)?\s*(\d+)/i);
    if (seqMatch) {
      return { type: 'SEQUENCE', number: parseInt(seqMatch[1], 10) };
    }

    return { type: null, number: null };
  }

  /**
   * SAUVEGARDE — insère ou met à jour la planification mensuelle d'un enseignant.
   * Si isCustom=true pour une cellule existante → on ne l'écrase pas (l'auto-proposition
   *   ne touche que les cellules non-modifiées).
   */
  async saveMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    cells: MonthlyPlanCell[],
    options: { teacherId?: string; academicClassId?: string; schoolLevelId?: string } = {},
  ): Promise<{ saved: number; updated: number; skipped: number }> {
    if (!academicYearId || !classLevel || !month) {
      throw new BadRequestException('academicYearId, classLevel, month requis');
    }

    // Résoudre schoolLevelId
    let schoolLevelId = options.schoolLevelId;
    if (!schoolLevelId) {
      const sl = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "id" FROM "school_levels" WHERE "tenantId" = $1 LIMIT 1
      `, tenantId);
      schoolLevelId = sl[0]?.id;
    }
    if (!schoolLevelId) {
      throw new BadRequestException('Aucun schoolLevelId trouvé pour ce tenant.');
    }

    // Récupérer le trimestre du mois
    const TRIMESTER_OF: Record<string, number> = {
      'Septembre': 1, 'Octobre': 1, 'Novembre': 1, 'Décembre': 1,
      'Janvier': 2, 'Février': 2, 'Mars': 2,
      'Avril': 3, 'Mai': 3, 'Juin': 3,
    };
    const trimester = TRIMESTER_OF[month];
    if (!trimester) {
      throw new BadRequestException(`Mois invalide: ${month}`);
    }

    // Récupérer les cellules existantes (isCustom=true) pour ne pas les écraser
    const existingCustoms = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "weekNumber", "domain", "subDomain" FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4
        ${options.teacherId ? 'AND "teacherId" = $5' : ''}
        AND "isCustom" = true
    `,
      ...(options.teacherId
        ? [tenantId, academicYearId, classLevel, month, options.teacherId]
        : [tenantId, academicYearId, classLevel, month]),
    );
    const customKeys: Set<string> = new Set(
      existingCustoms.map(c => `${c.weekNumber}|${c.domain}|${c.subDomain || ''}`)
    );

    // Supprimer les anciennes cellules non-custom pour réinsérer
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4
        ${options.teacherId ? 'AND "teacherId" = $5' : ''}
        AND "isCustom" = false
    `,
      ...(options.teacherId
        ? [tenantId, academicYearId, classLevel, month, options.teacherId]
        : [tenantId, academicYearId, classLevel, month]),
    );

    // Insérer les nouvelles cellules (sauf celles qui sont isCustom=true existantes)
    let saved = 0;
    let updated = 0;
    let skipped = 0;
    for (const cell of cells) {
      const key = `${cell.weekNumber}|${cell.domain}|${cell.subDomain || ''}`;
      if (customKeys.has(key) && !cell.isCustom) {
        // Ne pas écraser une cellule personnalisée
        skipped++;
        continue;
      }

      const planId = randomUUID();
      try {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "monthly_plans" (
            "id", "tenantId", "academicYearId", "schoolLevelId", "classLevel",
            "teacherId", "academicClassId", "trimester", "month", "weekNumber",
            "domain", "subDomain", "activityType", "activityNumber", "sequenceNumber",
            "content", "isAutoProposed", "isCustom", "annualPlanId",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19,
            NOW(), NOW()
          )
          ON CONFLICT ("id") DO NOTHING
        `,
          planId,
          tenantId, academicYearId, schoolLevelId, classLevel,
          options.teacherId || null, options.academicClassId || null,
          trimester, month, cell.weekNumber,
          cell.domain, cell.subDomain || null,
          cell.activityType || null, cell.activityNumber || null, cell.sequenceNumber || null,
          cell.content, cell.isAutoProposed, cell.isCustom,
          cell.annualPlanId || null,
        );
        saved++;
      } catch (e: any) {
        this.logger.error(`Failed to insert monthly plan cell: ${e.message}`);
      }
    }

    this.logger.log(`Saved monthly plan: ${saved} new, ${updated} updated, ${skipped} custom preserved`);
    return { saved, updated, skipped };
  }

  /**
   * Met à jour une cellule individuelle (édition par l'enseignant).
   */
  async updateCell(
    id: string,
    tenantId: string,
    updates: { content?: string; activityType?: string | null; activityNumber?: number | null; sequenceNumber?: number | null },
  ) {
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "monthly_plans" WHERE "id" = $1 AND "tenantId" = $2
    `, id, tenantId);

    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Cell with ID ${id} not found`);
    }

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.content !== undefined) {
      sets.push(`"content" = $${idx++}`);
      params.push(updates.content);
    }
    if (updates.activityType !== undefined) {
      sets.push(`"activityType" = $${idx++}`);
      params.push(updates.activityType || null);
    }
    if (updates.activityNumber !== undefined) {
      sets.push(`"activityNumber" = $${idx++}`);
      params.push(updates.activityNumber || null);
    }
    if (updates.sequenceNumber !== undefined) {
      sets.push(`"sequenceNumber" = $${idx++}`);
      params.push(updates.sequenceNumber || null);
    }
    sets.push(`"isCustom" = true`);
    sets.push(`"isAutoProposed" = false`);
    sets.push(`"updatedAt" = NOW()`);

    params.push(id);
    params.push(tenantId);

    await this.prisma.$executeRawUnsafe(`
      UPDATE "monthly_plans" SET ${sets.join(', ')}
      WHERE "id" = $${idx++} AND "tenantId" = $${idx++}
    `, ...params);

    const updated = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "monthly_plans" WHERE "id" = $1 AND "tenantId" = $2
    `, id, tenantId);

    return updated[0];
  }

  // ═════════════════════════════════════════════════════════════════
  //  SOUMISSION + VALIDATION (workflow comme Cahier Journal)
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ SOUMETTRE la planification mensuelle au directeur.
   *    - Marque toutes les cellules comme status=SUBMITTED
   *    - Capture la signature du titulaire (data URL)
   *    - Set submittedAt = NOW()
   *    - La planification devient READ-ONLY pour l'enseignant
   *
   * ⭐ Note : à chaque début de mois, le système vérifiera (via une règle côté
   *    Cahier Journal) si la planification mensuelle a été soumise+validée
   *    avant d'autoriser la soumission du 1er cahier journal du mois.
   *    Cette vérification sera implémentée dans le service Cahier Journal.
   */
  async submitMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    teacherId: string,
    teacherSignature: string,
  ): Promise<{ success: boolean; submittedAt: Date }> {
    if (!teacherSignature) {
      throw new BadRequestException('Signature du titulaire requise');
    }

    // Vérifier qu'au moins une cellule existe
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, status FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4 AND "teacherId" = $5
      LIMIT 1
    `, tenantId, academicYearId, classLevel, month, teacherId);

    if (existing.length === 0) {
      throw new BadRequestException('Aucune planification à soumettre. Créez/enregistrez d\'abord le contenu.');
    }

    const currentStatus = existing[0].status;
    if (currentStatus === 'SUBMITTED') {
      throw new BadRequestException('Planification déjà soumise — en attente de validation');
    }
    if (currentStatus === 'VALIDATED') {
      throw new BadRequestException('Planification déjà validée par le directeur');
    }

    // ⭐ Mettre à jour TOUTES les cellules de cette planification
    await this.prisma.$executeRawUnsafe(`
      UPDATE "monthly_plans"
      SET "status" = 'SUBMITTED',
          "teacherSignature" = $6,
          "submittedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4 AND "teacherId" = $5
    `, tenantId, academicYearId, classLevel, month, teacherId, teacherSignature);

    this.logger.log(`Monthly plan submitted: tenant=${tenantId}, class=${classLevel}, month=${month}, teacher=${teacherId}`);

    return { success: true, submittedAt: new Date() };
  }

  /**
   * ⭐ VALIDER ou REJETER une planification mensuelle (côté directeur).
   *    - Si action=VALIDATE : status=VALIDATED, directorSignature capturée
   *    - Si action=REJECT : status=REJECTED, directorObservation stockée
   */
  async validateMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    teacherId: string,
    options: { action: 'VALIDATE' | 'REJECT'; directorSignature?: string; directorObservation?: string },
  ): Promise<{ success: boolean; validatedAt: Date }> {
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, status FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4 AND "teacherId" = $5
      LIMIT 1
    `, tenantId, academicYearId, classLevel, month, teacherId);

    if (existing.length === 0) {
      throw new NotFoundException('Planification introuvable');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException(`Planification non soumise (status=${existing[0].status})`);
    }

    if (options.action === 'VALIDATE') {
      if (!options.directorSignature) {
        throw new BadRequestException('Signature du directeur requise pour valider');
      }
      await this.prisma.$executeRawUnsafe(`
        UPDATE "monthly_plans"
        SET "status" = 'VALIDATED',
            "directorSignature" = $6,
            "validatedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "tenantId" = $1 AND "academicYearId" = $2
          AND "classLevel" = $3 AND "month" = $4 AND "teacherId" = $5
      `, tenantId, academicYearId, classLevel, month, teacherId, options.directorSignature);
      this.logger.log(`Monthly plan VALIDATED: class=${classLevel}, month=${month}, teacher=${teacherId}`);
    } else {
      // REJECT
      await this.prisma.$executeRawUnsafe(`
        UPDATE "monthly_plans"
        SET "status" = 'REJECTED',
            "directorObservation" = $6,
            "validatedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "tenantId" = $1 AND "academicYearId" = $2
          AND "classLevel" = $3 AND "month" = $4 AND "teacherId" = $5
      `, tenantId, academicYearId, classLevel, month, teacherId, options.directorObservation || null);
      this.logger.log(`Monthly plan REJECTED: class=${classLevel}, month=${month}, teacher=${teacherId}`);
    }

    return { success: true, validatedAt: new Date() };
  }

  /**
   * ⭐ Liste les planifications mensuelles en attente de validation (côté directeur).
   *    Utilisé par l'espace "Validation Direction".
   */
  async getPendingMonthlyPlans(tenantId: string, academicYearId: string, status?: string): Promise<any[]> {
    // ⭐ Accept optional status filter (SUBMITTED / VALIDATED / REJECTED)
    //    Default to SUBMITTED if not provided
    const statusFilter = status || 'SUBMITTED';
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        mp."classLevel",
        mp."month",
        mp."teacherId",
        mp."submittedAt",
        mp."teacherSignature",
        mp."directorSignature",
        mp."directorObservation",
        mp."validatedAt",
        COUNT(mp.id) AS "cellCount",
        COUNT(CASE WHEN mp."isCustom" THEN 1 END) AS "customCount",
        u."firstName" AS "teacherFirstName",
        u."lastName" AS "teacherLastName",
        u."role" AS "teacherRole",
        c."name" AS "className"
      FROM "monthly_plans" mp
      LEFT JOIN "users" u ON u.id = mp."teacherId"
      LEFT JOIN "classes" c ON c."officialClassId" = mp."classLevel"
      WHERE mp."tenantId" = $1 AND mp."academicYearId" = $2
        AND mp."status" = $3
      GROUP BY mp."classLevel", mp."month", mp."teacherId", mp."submittedAt", mp."teacherSignature",
               mp."directorSignature", mp."directorObservation", mp."validatedAt",
               u."firstName", u."lastName", u."role", c."name"
      ORDER BY mp."submittedAt" DESC
    `, tenantId, academicYearId, statusFilter);
  }

  // ⭐ Get cells for a specific plan (for PDF export + director detail view)
  async getMonthlyPlanCells(
    tenantId: string, academicYearId: string, classLevel: string, month: string, teacherId: string,
  ): Promise<any[]> {
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4
        ${teacherId ? 'AND "teacherId" = $5' : ''}
      ORDER BY "weekNumber" ASC, "domain" ASC
    `, tenantId, academicYearId, classLevel, month, ...(teacherId ? [teacherId] : []));
  }

  // ⭐ Generate printable HTML for the planification (for PDF export)
  generatePlanHtml(cells: any[], classLevel: string, month: string): string {
    const weeks = ['1ère Semaine', '2ème Semaine', '3ème Semaine', '4ème Semaine', '5ème Semaine'];
    const domains = [...new Set(cells.map(c => c.domain))];

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planification ${classLevel} — ${month}</title>
    <style>
      body { font-family: 'Times New Roman', serif; margin: 20px; }
      h1 { text-align: center; font-size: 16pt; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #000; padding: 4px; font-size: 9pt; vertical-align: top; }
      th { background: #f0f0f0; font-weight: bold; text-align: center; }
      .header { text-align: center; margin-bottom: 10px; }
      .footer { margin-top: 20px; display: flex; justify-content: space-between; }
      .signature { border-top: 1px solid #000; padding-top: 5px; width: 200px; text-align: center; font-size: 10pt; }
    </style></head><body>
    <div class="header">
      <h1>PLANIFICATION MENSUELLE — ${month}</h1>
      <p>Classe: ${classLevel} — Année Scolaire 2026-2027</p>
    </div>
    <table>
      <thead><tr><th>Champ de Formation</th>${weeks.map(w => `<th>${w}</th>`).join('')}</tr></thead>
      <tbody>`;

    for (const domain of domains) {
      const domainCells = cells.filter(c => c.domain === domain);
      html += `<tr><td><strong>${domain}</strong>${domainCells[0]?.subDomain ? '<br/><small>' + domainCells[0].subDomain + '</small>' : ''}</td>`;
      for (let w = 1; w <= 5; w++) {
        const cell = domainCells.find(c => c.weekNumber === w);
        html += `<td>${cell?.content ? cell.content.replace(/<[^>]*>/g, '') : '—'}</td>`;
      }
      html += '</tr>';
    }

    html += `</tbody></table>
    <div class="footer">
      <div class="signature">Le Directeur<br/><br/></div>
      <div class="signature">Le Titulaire<br/><br/></div>
    </div>
    </body></html>`;

    return html;
  }
}
