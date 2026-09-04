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
  // ⭐ Weekly Record of Work — champs Head Teacher + dates de semaines
  documentType?: string;
  headTeacherInitials?: string | null;
  headTeacherDate?: string | null;
  headTeacherSignature?: string | null;
  weekDates?: string | null;
}

@Injectable()
export class MonthlyPlanService {
  private readonly logger = new Logger(MonthlyPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère la planification mensuelle pour une classe + enseignant + mois donné.
   * Si aucune donnée n'existe, retourne un tableau vide (l'UI proposera l'auto-proposition).
   *
   * ⭐ documentType (optionnel) : 'SCHEME_OF_WORK' | 'WEEKLY_RECORD' | 'PLAN'
   *    Permet de séparer le Scheme of Work du Weekly Record of Work (les deux
   *    utilisent month = "First Term"/"Second Term"/"Third Term" en EN track).
   *    Si non fourni → aucun filtre (rétro-compatible avec la planif FR).
   */
  async getMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    options: { teacherId?: string; academicClassId?: string; documentType?: string } = {},
  ): Promise<MonthlyPlanResponse> {
    // ⭐ Construction dynamique des filtres (params positionnels)
    const filters: string[] = ['"tenantId" = $1', '"academicYearId" = $2', '"classLevel" = $3', '"month" = $4'];
    const params: any[] = [tenantId, academicYearId, classLevel, month];
    let pIdx = 5;
    if (options.teacherId) { filters.push(`"teacherId" = $${pIdx++}`); params.push(options.teacherId); }
    if (options.academicClassId) { filters.push(`"academicClassId" = $${pIdx++}`); params.push(options.academicClassId); }
    if (options.documentType) { filters.push(`"documentType" = $${pIdx++}`); params.push(options.documentType); }

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "monthly_plans"
      WHERE ${filters.join(' AND ')}
      ORDER BY "weekNumber" ASC, "domain" ASC, "subDomain" ASC, "activityNumber" ASC NULLS LAST
    `, ...params);

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
      documentType: first.documentType || options.documentType || 'PLAN',
      headTeacherInitials: first.headTeacherInitials || null,
      headTeacherDate: first.headTeacherDate || null,
      headTeacherSignature: first.headTeacherSignature || null,
      weekDates: first.weekDates || null,
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
   *
   * ⭐ options.documentType : 'SCHEME_OF_WORK' | 'WEEKLY_RECORD' — scope le DELETE/INSERT
   *    à ce type de document uniquement (évite d'écraser l'autre document du même terme).
   * ⭐ Weekly Record : headTeacherInitials/headTeacherDate/headTeacherSignature/weekDates
   *    sont stockés (partagés par toutes les lignes du document, comme status).
   */
  async saveMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    cells: MonthlyPlanCell[],
    options: {
      teacherId?: string;
      academicClassId?: string;
      schoolLevelId?: string;
      documentType?: string;
      headTeacherInitials?: string | null;
      headTeacherDate?: string | null;
      headTeacherSignature?: string | null;
      weekDates?: string | null;
    } = {},
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
    // ⭐ Supporte les deux pistes :
    //    - FR: mois français (Septembre → Décembre = T1, Janvier → Mars = T2, Avril → Juin = T3)
    //    - EN: termes anglais (First Term = T1, Second Term = T2, Third Term = T3)
    const TRIMESTER_OF: Record<string, number> = {
      // FR months
      'Septembre': 1, 'Octobre': 1, 'Novembre': 1, 'Décembre': 1,
      'Janvier': 2, 'Février': 2, 'Mars': 2,
      'Avril': 3, 'Mai': 3, 'Juin': 3,
      // EN terms
      'First Term': 1, 'Second Term': 2, 'Third Term': 3,
    };
    const trimester = TRIMESTER_OF[month];
    if (!trimester) {
      throw new BadRequestException(`Mois invalide: ${month}`);
    }

    // ⭐ Filtres de scope du document — params positionnels dynamiques
    //    (scopés par documentType pour ne jamais toucher l'autre document du même terme)
    const scopeFilters: string[] = ['"tenantId" = $1', '"academicYearId" = $2', '"classLevel" = $3', '"month" = $4'];
    const scopeParams: any[] = [tenantId, academicYearId, classLevel, month];
    let sp = 5;
    if (options.teacherId) { scopeFilters.push(`"teacherId" = $${sp++}`); scopeParams.push(options.teacherId); }
    if (options.documentType) { scopeFilters.push(`"documentType" = $${sp++}`); scopeParams.push(options.documentType); }

    // Récupérer les cellules existantes (isCustom=true) pour ne pas les écraser
    // ⭐ FIX ANOMALIE 3 (backend) : map key → row id. Une cellule personnalisée
    //    qui existe déjà doit être MISE À JOUR (UPDATE), pas réinsérée (INSERT) —
    //    sinon chaque sauvegarde duplique les lignes (aucun index unique sur la
    //    clé semaine/domaine/sous-domaine) et le GET renvoie des doublons.
    const existingCustoms = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "id", "weekNumber", "domain", "subDomain" FROM "monthly_plans"
      WHERE ${scopeFilters.join(' AND ')}
        AND "isCustom" = true
    `, ...scopeParams);
    const customRowByKey = new Map<string, string>(
      existingCustoms.map(c => [`${c.weekNumber}|${c.domain}|${c.subDomain || ''}`, c.id])
    );

    // Supprimer les anciennes cellules non-custom pour réinsérer
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "monthly_plans"
      WHERE ${scopeFilters.join(' AND ')}
        AND "isCustom" = false
    `, ...scopeParams);

    // ⭐ Weekly Record : mettre à jour les méta-champs Head Teacher + dates de semaines
    //    sur TOUTES les lignes existantes du document (même pattern que status).
    //    Les nouvelles lignes insérées ci-dessous reçoivent les mêmes valeurs.
    if (options.documentType === 'WEEKLY_RECORD') {
      const setClauses: string[] = [];
      const updateParams: any[] = [];
      if (options.headTeacherInitials !== undefined) { setClauses.push(`"headTeacherInitials" = $${updateParams.length + 1}`); updateParams.push(options.headTeacherInitials ?? null); }
      if (options.headTeacherDate !== undefined) { setClauses.push(`"headTeacherDate" = $${updateParams.length + 1}`); updateParams.push(options.headTeacherDate ?? null); }
      if (options.headTeacherSignature !== undefined) { setClauses.push(`"headTeacherSignature" = $${updateParams.length + 1}`); updateParams.push(options.headTeacherSignature ?? null); }
      if (options.weekDates !== undefined) { setClauses.push(`"weekDates" = $${updateParams.length + 1}`); updateParams.push(options.weekDates ?? null); }
      if (setClauses.length > 0) {
        setClauses.push(`"updatedAt" = NOW()`);
        const whereClauses: string[] = [];
        whereClauses.push(`"tenantId" = $${updateParams.length + 1}`); updateParams.push(tenantId);
        whereClauses.push(`"academicYearId" = $${updateParams.length + 1}`); updateParams.push(academicYearId);
        whereClauses.push(`"classLevel" = $${updateParams.length + 1}`); updateParams.push(classLevel);
        whereClauses.push(`"month" = $${updateParams.length + 1}`); updateParams.push(month);
        if (options.teacherId) { whereClauses.push(`"teacherId" = $${updateParams.length + 1}`); updateParams.push(options.teacherId); }
        whereClauses.push(`"documentType" = $${updateParams.length + 1}`); updateParams.push(options.documentType);
        await this.prisma.$executeRawUnsafe(
          `UPDATE "monthly_plans" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`,
          ...updateParams,
        );
      }
    }

    // Insérer les nouvelles cellules (sauf celles qui sont isCustom=true existantes)
    let saved = 0;
    let updated = 0;
    let skipped = 0;
    for (const cell of cells) {
      const key = `${cell.weekNumber}|${cell.domain}|${cell.subDomain || ''}`;
      if (customRowByKey.has(key) && !cell.isCustom) {
        // Ne pas écraser une cellule personnalisée
        skipped++;
        continue;
      }

      // ⭐ FIX ANOMALIE 3 (backend) : cellule personnalisée existante → UPDATE
      //    de la ligne en base (contenu + type d'activité) au lieu d'un INSERT
      //    qui créerait un doublon de la même clé.
      const existingCustomId = customRowByKey.get(key);
      if (existingCustomId && cell.isCustom) {
        try {
          await this.prisma.$executeRawUnsafe(`
            UPDATE "monthly_plans"
            SET "content" = $1, "activityType" = $2, "activityNumber" = $3,
                "sequenceNumber" = $4, "isAutoProposed" = false, "annualPlanId" = $5,
                "updatedAt" = NOW()
            WHERE "id" = $6 AND "tenantId" = $7
          `,
            cell.content, cell.activityType || null, cell.activityNumber || null,
            cell.sequenceNumber || null, cell.annualPlanId || null,
            existingCustomId, tenantId,
          );
          updated++;
        } catch (e: any) {
          this.logger.error(`Failed to update monthly plan cell: ${e.message}`);
        }
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
            "documentType", "headTeacherInitials", "headTeacherDate",
            "headTeacherSignature", "weekDates",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24,
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
          options.documentType || 'PLAN',
          options.headTeacherInitials || null,
          options.headTeacherDate || null,
          options.headTeacherSignature || null,
          options.weekDates || null,
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
   * ⭐ documentType (optionnel) : scope la soumission à un type de document
   *    (SCHEME_OF_WORK / WEEKLY_RECORD) — évite de marquer l'autre document
   *    du même terme comme soumis.
   * ⭐ Weekly Record : les champs Head Teacher (initiales/date/signature) sont
   *    également persistés à la soumission.
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
    options: {
      documentType?: string;
      headTeacherInitials?: string | null;
      headTeacherDate?: string | null;
      headTeacherSignature?: string | null;
    } = {},
  ): Promise<{ success: boolean; submittedAt: Date }> {
    if (!teacherSignature) {
      throw new BadRequestException('Signature du titulaire requise');
    }

    // ⭐ Scope du document (params dynamiques)
    const scopeFilters: string[] = ['"tenantId" = $1', '"academicYearId" = $2', '"classLevel" = $3', '"month" = $4', '"teacherId" = $5'];
    const scopeParams: any[] = [tenantId, academicYearId, classLevel, month, teacherId];
    if (options.documentType) { scopeFilters.push(`"documentType" = $${scopeParams.length + 1}`); scopeParams.push(options.documentType); }

    // Vérifier qu'au moins une cellule existe
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, status FROM "monthly_plans"
      WHERE ${scopeFilters.join(' AND ')}
      LIMIT 1
    `, ...scopeParams);

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
    //    (+ champs Head Teacher pour le Weekly Record)
    //    Construction avec indices positionnels CORRECTS : SET d'abord, WHERE ensuite.
    const isWeeklyRecord = options.documentType === 'WEEKLY_RECORD';
    const sets: string[] = [`"status" = 'SUBMITTED'`, `"submittedAt" = NOW()`, `"updatedAt" = NOW()`];
    const params: any[] = [teacherSignature];
    sets.push(`"teacherSignature" = $1`);
    let pIdx = 2;
    if (isWeeklyRecord) {
      if (options.headTeacherInitials !== undefined) { sets.push(`"headTeacherInitials" = $${pIdx++}`); params.push(options.headTeacherInitials); }
      if (options.headTeacherDate !== undefined) { sets.push(`"headTeacherDate" = $${pIdx++}`); params.push(options.headTeacherDate); }
      if (options.headTeacherSignature !== undefined) { sets.push(`"headTeacherSignature" = $${pIdx++}`); params.push(options.headTeacherSignature); }
    }
    const whereClauses: string[] = [];
    whereClauses.push(`"tenantId" = $${pIdx++}`); params.push(tenantId);
    whereClauses.push(`"academicYearId" = $${pIdx++}`); params.push(academicYearId);
    whereClauses.push(`"classLevel" = $${pIdx++}`); params.push(classLevel);
    whereClauses.push(`"month" = $${pIdx++}`); params.push(month);
    whereClauses.push(`"teacherId" = $${pIdx++}`); params.push(teacherId);
    if (options.documentType) { whereClauses.push(`"documentType" = $${pIdx++}`); params.push(options.documentType); }
    await this.prisma.$executeRawUnsafe(`
      UPDATE "monthly_plans"
      SET ${sets.join(', ')}
      WHERE ${whereClauses.join(' AND ')}
    `, ...params);

    this.logger.log(`Monthly plan submitted: tenant=${tenantId}, class=${classLevel}, month=${month}, teacher=${teacherId}, doc=${options.documentType || 'PLAN'}`);

    return { success: true, submittedAt: new Date() };
  }

  /**
   * ⭐ VALIDER ou REJETER une planification mensuelle (côté directeur).
   *    - Si action=VALIDATE : status=VALIDATED, directorSignature capturée
   *    - Si action=REJECT : status=REJECTED, directorObservation stockée
   * ⭐ documentType (optionnel) : scope la validation à un type de document
   *    (SCHEME_OF_WORK / WEEKLY_RECORD).
   */
  async validateMonthlyPlan(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    teacherId: string,
    options: { action: 'VALIDATE' | 'REJECT'; directorSignature?: string; directorObservation?: string; documentType?: string },
  ): Promise<{ success: boolean; validatedAt: Date }> {
    const scopeFilters: string[] = ['"tenantId" = $1', '"academicYearId" = $2', '"classLevel" = $3', '"month" = $4', '"teacherId" = $5'];
    const scopeParams: any[] = [tenantId, academicYearId, classLevel, month, teacherId];
    if (options.documentType) { scopeFilters.push(`"documentType" = $${scopeParams.length + 1}`); scopeParams.push(options.documentType); }

    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, status FROM "monthly_plans"
      WHERE ${scopeFilters.join(' AND ')}
      LIMIT 1
    `, ...scopeParams);

    if (existing.length === 0) {
      throw new NotFoundException('Planification introuvable');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException(`Planification non soumise (status=${existing[0].status})`);
    }

    // ⭐ Construction SET-then-WHERE avec indices positionnels corrects
    const sets: string[] = [];
    const params: any[] = [];
    let pIdx = 1;
    if (options.action === 'VALIDATE') {
      if (!options.directorSignature) {
        throw new BadRequestException('Signature du directeur requise pour valider');
      }
      sets.push(`"status" = 'VALIDATED'`);
      sets.push(`"directorSignature" = $${pIdx++}`); params.push(options.directorSignature);
      sets.push(`"validatedAt" = NOW()`);
      sets.push(`"updatedAt" = NOW()`);
      // ⭐ Weekly Record : on préserve l'observation générale du directeur
      if (options.directorObservation !== undefined) {
        sets.push(`"directorObservation" = $${pIdx++}`); params.push(options.directorObservation);
      }
      this.logger.log(`Monthly plan VALIDATED: class=${classLevel}, month=${month}, teacher=${teacherId}, doc=${options.documentType || 'PLAN'}`);
    } else {
      // REJECT
      sets.push(`"status" = 'REJECTED'`);
      sets.push(`"directorObservation" = $${pIdx++}`); params.push(options.directorObservation || null);
      sets.push(`"validatedAt" = NOW()`);
      sets.push(`"updatedAt" = NOW()`);
      this.logger.log(`Monthly plan REJECTED: class=${classLevel}, month=${month}, teacher=${teacherId}, doc=${options.documentType || 'PLAN'}`);
    }
    const whereClauses: string[] = [];
    whereClauses.push(`"tenantId" = $${pIdx++}`); params.push(tenantId);
    whereClauses.push(`"academicYearId" = $${pIdx++}`); params.push(academicYearId);
    whereClauses.push(`"classLevel" = $${pIdx++}`); params.push(classLevel);
    whereClauses.push(`"month" = $${pIdx++}`); params.push(month);
    whereClauses.push(`"teacherId" = $${pIdx++}`); params.push(teacherId);
    if (options.documentType) { whereClauses.push(`"documentType" = $${pIdx++}`); params.push(options.documentType); }

    await this.prisma.$executeRawUnsafe(`
      UPDATE "monthly_plans"
      SET ${sets.join(', ')}
      WHERE ${whereClauses.join(' AND ')}
    `, ...params);

    return { success: true, validatedAt: new Date() };
  }

  /**
   * ⭐ Liste les planifications mensuelles en attente de validation (côté directeur).
   *    Utilisé par l'espace "Validation Direction".
   * ⭐ documentType (optionnel) : filtre par type de document
   *    (SCHEME_OF_WORK / WEEKLY_RECORD / PLAN). Ajouté au SELECT + GROUP BY pour
   *    que le Scheme of Work et le Weekly Record d'un même terme apparaissent
   *    comme 2 entrées distinctes.
   */
  async getPendingMonthlyPlans(tenantId: string, academicYearId: string, status?: string, documentType?: string): Promise<any[]> {
    // ⭐ Accept optional status filter (SUBMITTED / VALIDATED / REJECTED)
    //    Default to SUBMITTED if not provided
    const statusFilter = status || 'SUBMITTED';
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        mp."classLevel",
        mp."month",
        mp."teacherId",
        mp."documentType",
        mp."headTeacherInitials",
        mp."headTeacherDate",
        mp."weekDates",
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
        ${documentType ? 'AND mp."documentType" = $4' : ''}
      GROUP BY mp."classLevel", mp."month", mp."teacherId", mp."documentType",
               mp."headTeacherInitials", mp."headTeacherDate", mp."weekDates",
               mp."submittedAt", mp."teacherSignature",
               mp."directorSignature", mp."directorObservation", mp."validatedAt",
               u."firstName", u."lastName", u."role", c."name"
      ORDER BY mp."submittedAt" DESC
    `, tenantId, academicYearId, statusFilter, ...(documentType ? [documentType] : []));
  }

  // ⭐ Get cells for a specific plan (for PDF export + director detail view)
  async getMonthlyPlanCells(
    tenantId: string, academicYearId: string, classLevel: string, month: string, teacherId: string, documentType?: string,
  ): Promise<any[]> {
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4
        ${teacherId ? 'AND "teacherId" = $5' : ''}
        ${documentType ? `AND "documentType" = $${teacherId ? 6 : 5}` : ''}
      ORDER BY "weekNumber" ASC, "domain" ASC
    `, tenantId, academicYearId, classLevel, month, ...(teacherId ? [teacherId] : []), ...(documentType ? [documentType] : []));
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ WEEKLY RECORD OF WORK — Observations directeur + Duplication
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ Sauvegarde les observations du directeur sur un Weekly Record of Work.
   *
   * Deux niveaux d'observations (per request utilisateur) :
   *   1. Par matière — une colonne "Observations" par ligne (par subject)
   *      → stockée comme lignes monthly_plans avec subDomain = 'DIRECTOR_OBS',
   *         weekNumber = 0, domain = nom de la matière, isCustom = true
   *   2. Observations générales — une section pour tout le document
   *      → stockée dans la colonne directorObservation (partagée par toutes
   *         les lignes du document, même pattern que status)
   */
  async saveDirectorWeeklyObservations(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    month: string,
    teacherId: string,
    payload: {
      observations?: Array<{ subject: string; content: string }>;
      generalObservation?: string;
    },
  ): Promise<{ saved: number; generalUpdated: boolean }> {
    const scopeFilters: string[] = ['"tenantId" = $1', '"academicYearId" = $2', '"classLevel" = $3', '"month" = $4', '"teacherId" = $5', '"documentType" = $6'];
    const scopeParams: any[] = [tenantId, academicYearId, classLevel, month, teacherId, 'WEEKLY_RECORD'];

    // 1. Supprimer les anciennes observations par matière
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "monthly_plans"
      WHERE ${scopeFilters.join(' AND ')} AND "subDomain" = 'DIRECTOR_OBS'
    `, ...scopeParams);

    // 2. Insérer les nouvelles observations par matière
    let saved = 0;
    const TRIMESTER_OF: Record<string, number> = {
      'First Term': 1, 'Second Term': 2, 'Third Term': 3,
    };
    const trimester = TRIMESTER_OF[month] || 1;
    let schoolLevelId: string | undefined;
    const sl = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "id" FROM "school_levels" WHERE "tenantId" = $1 LIMIT 1
    `, tenantId);
    schoolLevelId = sl[0]?.id;

    for (const obs of payload.observations || []) {
      if (!obs.subject || !obs.content) continue;
      try {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "monthly_plans" (
            "id", "tenantId", "academicYearId", "schoolLevelId", "classLevel",
            "teacherId", "trimester", "month", "weekNumber",
            "domain", "subDomain", "content", "isAutoProposed", "isCustom",
            "documentType",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, 0,
            $9, 'DIRECTOR_OBS', $10, false, true,
            'WEEKLY_RECORD',
            NOW(), NOW()
          )
          ON CONFLICT ("id") DO NOTHING
        `,
          randomUUID(), tenantId, academicYearId, schoolLevelId || null, classLevel,
          teacherId, trimester, month,
          obs.subject, obs.content,
        );
        saved++;
      } catch (e: any) {
        this.logger.error(`Failed to insert director observation: ${e.message}`);
      }
    }

    // 3. Mettre à jour l'observation générale (colonne directorObservation)
    let generalUpdated = false;
    if (payload.generalObservation !== undefined) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "monthly_plans"
        SET "directorObservation" = $7, "updatedAt" = NOW()
        WHERE ${scopeFilters.join(' AND ')}
      `, ...scopeParams, payload.generalObservation);
      generalUpdated = true;
    }

    this.logger.log(`Director observations saved: class=${classLevel}, month=${month}, teacher=${teacherId}, perSubject=${saved}, general=${generalUpdated}`);
    return { saved, generalUpdated };
  }

  /**
   * ⭐ Duplique un Weekly Record of Work vers une autre année scolaire
   *    (bouton "Réutiliser" du Catalogue — pattern identique au cahier journal).
   *
   *    - Copie toutes les cellules (contenu des 12 semaines par matière)
   *    - Statut → DRAFT, signatures effacées, dates de soumission effacées
   *    - Les dates de semaines (weekDates) NE sont PAS copiées (recalculées
   *      par l'enseignant pour la nouvelle année)
   *    - Les observations du directeur ne sont PAS copiées
   */
  async duplicateWeeklyRecordToYear(
    tenantId: string,
    sourceAcademicYearId: string,
    classLevel: string,
    month: string,
    sourceTeacherId: string,
    targetAcademicYearId: string,
    targetTeacherId?: string,
  ): Promise<{ success: boolean; copied: number }> {
    if (!targetAcademicYearId) {
      throw new BadRequestException('targetAcademicYearId requis');
    }
    if (sourceAcademicYearId === targetAcademicYearId) {
      throw new BadRequestException('La source et la cible sont la même année scolaire');
    }

    // 1. Récupérer les cellules source (hors observations directeur)
    const sourceCells = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4 AND "teacherId" = $5
        AND "documentType" = 'WEEKLY_RECORD'
        AND "subDomain" != 'DIRECTOR_OBS'
      ORDER BY "domain" ASC, "subDomain" ASC
    `, tenantId, sourceAcademicYearId, classLevel, month, sourceTeacherId);

    if (sourceCells.length === 0) {
      throw new NotFoundException('Aucun Weekly Record à dupliquer pour ces paramètres');
    }

    // 2. Supprimer un éventuel document cible existant (même class + term + teacher)
    const finalTeacherId = targetTeacherId || sourceTeacherId;
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "monthly_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
        AND "classLevel" = $3 AND "month" = $4 AND "teacherId" = $5
        AND "documentType" = 'WEEKLY_RECORD'
    `, tenantId, targetAcademicYearId, classLevel, month, finalTeacherId);

    // 3. Insérer les copies en DRAFT (signatures/dates effacées)
    let copied = 0;
    for (const cell of sourceCells) {
      try {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "monthly_plans" (
            "id", "tenantId", "academicYearId", "schoolLevelId", "classLevel",
            "teacherId", "academicClassId", "trimester", "month", "weekNumber",
            "domain", "subDomain", "activityType", "activityNumber", "sequenceNumber",
            "content", "isAutoProposed", "isCustom", "annualPlanId",
            "documentType",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19,
            'WEEKLY_RECORD',
            NOW(), NOW()
          )
          ON CONFLICT ("id") DO NOTHING
        `,
          randomUUID(), tenantId, targetAcademicYearId, cell.schoolLevelId, classLevel,
          finalTeacherId, cell.academicClassId, cell.trimester, month, cell.weekNumber,
          cell.domain, cell.subDomain, cell.activityType, cell.activityNumber, cell.sequenceNumber,
          cell.content, false, cell.isCustom, cell.annualPlanId,
        );
        copied++;
      } catch (e: any) {
        this.logger.error(`Failed to duplicate weekly record cell: ${e.message}`);
      }
    }

    this.logger.log(`Weekly record duplicated: class=${classLevel}, month=${month}, ${sourceAcademicYearId} → ${targetAcademicYearId}, ${copied} cells`);
    return { success: true, copied };
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
