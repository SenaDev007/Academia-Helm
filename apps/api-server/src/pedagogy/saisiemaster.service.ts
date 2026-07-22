/**
 * ============================================================================
 * SAISIEMASTER — Service dédié (saissiemaster.academiahelm.com)
 * ============================================================================
 *
 * Module séparé pour la saisie des notes avec 4 types d'évaluations
 * normalisés par année et par matière :
 *   - EF1 : Évaluation Formative 1
 *   - ES1 : Évaluation Sommative 1
 *   - ES2 : Évaluation Sommative 2
 *   - ES3 : Évaluation Sommative 3
 *
 * Une entrée = une évaluation pour une classe × matière × type × trimestre
 * Workflow: DRAFT → SUBMITTED → VALIDATED / REJECTED (côté direction)
 *
 * Fonctionnalités :
 *   - CRUD complet des évaluations
 *   - Saisie des notes par élève (initialisation auto depuis student_enrollments)
 *   - Calcul automatique des statistiques (moyenne, médiane, % réussite, G/F)
 *   - Export PDF individuel via Puppeteer
 *   - Export ZIP groupé (4 PDFs pour une classe × matière)
 *   - Validation direction (valider / rejeter avec motif)
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SaisieMasterService {
  private readonly logger = new Logger(SaisieMasterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /// Libellé humain d'un type d'évaluation.
  getEvaluationLabel(evalType: string): string {
    switch (evalType) {
      case 'EF1': return 'Évaluation Formative 1';
      case 'ES1': return 'Évaluation Sommative 1';
      case 'ES2': return 'Évaluation Sommative 2';
      case 'ES3': return 'Évaluation Sommative 3';
      default: return `Évaluation ${evalType}`;
    }
  }

  /// Retourne les métadonnées des 4 types d'évaluations disponibles.
  getEvaluationTypes() {
    return [
      { code: 'EF1', label: 'Évaluation Formative 1', short: 'EF1' },
      { code: 'ES1', label: 'Évaluation Sommative 1', short: 'ES1' },
      { code: 'ES2', label: 'Évaluation Sommative 2', short: 'ES2' },
      { code: 'ES3', label: 'Évaluation Sommative 3', short: 'ES3' },
    ];
  }

  /// Liste les évaluations d'un enseignant (filtre par classe/matière/type/trimestre).
  async getEvaluations(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
    classId?: string,
    evaluationType?: string,
    trimester?: number,
  ) {
    let query = `SELECT e.*, c."name" as "classNameResolved", s."name" as "subjectName", s."code" as "subjectCode"
                 FROM "saisie_master_evaluations" e
                 LEFT JOIN "classes" c ON c."id" = e."classId"
                 LEFT JOIN "subjects" s ON s."id" = e."subjectId"
                 WHERE e."tenantId" = $1 AND e."academicYearId" = $2 AND e."teacherId" = $3`;
    const params: any[] = [tenantId, academicYearId, teacherId];
    let paramIdx = 4;
    if (classId) {
      query += ` AND e."classId" = $${paramIdx++}`;
      params.push(classId);
    }
    if (evaluationType) {
      query += ` AND e."evaluationType" = $${paramIdx++}`;
      params.push(evaluationType);
    }
    if (trimester !== undefined && trimester !== null) {
      query += ` AND e."trimester" = $${paramIdx++}`;
      params.push(trimester);
    }
    query += ` ORDER BY e."evaluationType" ASC, e."testDate" DESC NULLS LAST, e."createdAt" DESC`;
    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  /// Récupère une évaluation par ID (avec jointures).
  async getEvaluation(tenantId: string, evalId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT e.*, c."name" as "classNameResolved", s."name" as "subjectName", s."code" as "subjectCode"
       FROM "saisie_master_evaluations" e
       LEFT JOIN "classes" c ON c."id" = e."classId"
       LEFT JOIN "subjects" s ON s."id" = e."subjectId"
       WHERE e."id" = $1 AND e."tenantId" = $2`,
      evalId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    return result[0];
  }

  /// Récupère toutes les évaluations d'une classe × matière (pour export ZIP).
  async getEvaluationsForClassSubject(
    tenantId: string,
    academicYearId: string,
    classId: string,
    subjectId: string | null,
    trimester?: number,
  ) {
    const query = `
      SELECT e.*, c."name" as "classNameResolved", s."name" as "subjectName",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
      FROM "saisie_master_evaluations" e
      LEFT JOIN "classes" c ON c."id" = e."classId"
      LEFT JOIN "subjects" s ON s."id" = e."subjectId"
      LEFT JOIN "teachers" t ON t."id" = e."teacherId"
      WHERE e."tenantId" = $1 AND e."academicYearId" = $2 AND e."classId" = $3
      AND e."subjectId" IS NOT DISTINCT FROM $4
      ${trimester ? 'AND e."trimester" = $5' : ''}
      ORDER BY e."evaluationType" ASC
    `;
    const params: any[] = [tenantId, academicYearId, classId, subjectId];
    if (trimester) params.push(trimester);
    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  /// Crée ou récupère une évaluation (idempotent sur classe × matière × type × trimestre).
  async getOrCreateEvaluation(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    data: any,
  ) {
    if (!data.classId || !data.evaluationType || !data.testTitle || !data.trimester) {
      throw new BadRequestException('classId, evaluationType, testTitle, trimester sont requis');
    }

    // Vérifier l'existence (unique sur classId × subjectId × trimester × evaluationType)
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "saisie_master_evaluations"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3
       AND "subjectId" IS NOT DISTINCT FROM $4 AND "trimester" = $5 AND "evaluationType" = $6
       LIMIT 1`,
      tenantId, academicYearId, data.classId, data.subjectId || null, data.trimester, data.evaluationType,
    );
    if (existing && existing.length > 0) {
      return this.getEvaluation(tenantId, existing[0].id);
    }

    const id = crypto.randomUUID();
    const evalLabel = data.evaluationLabel || this.getEvaluationLabel(data.evaluationType);

    const fields: string[] = ['"id"', '"tenantId"', '"academicYearId"', '"teacherId"',
                              '"createdAt"', '"updatedAt"',
                              '"classId"', '"evaluationType"', '"evaluationLabel"', '"testTitle"', '"trimester"',
                              '"studentScores"', '"maxScore"', '"passingScore"', '"coefficient"',
                              '"status"'];
    const placeholders: string[] = ['$1', '$2', '$3', '$4', 'NOW()', 'NOW()',
                                    '$5', '$6', '$7', '$8', '$9',
                                    `'[]'::jsonb`, '$10', '$11', '$12',
                                    `'DRAFT'`];
    const params: any[] = [
      id, tenantId, academicYearId, teacherId,
      data.classId, data.evaluationType, evalLabel, data.testTitle, data.trimester,
      data.maxScore ?? 20.0, data.passingScore ?? 10.0, data.coefficient ?? 1.0,
    ];
    let paramIdx = 13;

    const optionalFields: Array<{ key: string; type: 'string' | 'int' | 'float' | 'date' }> = [
      { key: 'subjectId', type: 'string' },
      { key: 'schoolName', type: 'string' },
      { key: 'className', type: 'string' },
      { key: 'academicYearLabel', type: 'string' },
      { key: 'testDate', type: 'date' },
      { key: 'durationMinutes', type: 'int' },
      { key: 'teacherName', type: 'string' },
      { key: 'teacherSignature', type: 'string' },
      { key: 'pedagogicalObservations', type: 'string' },
      { key: 'recommandations', type: 'string' },
    ];

    for (const { key, type } of optionalFields) {
      if (data[key] !== undefined && data[key] !== null) {
        fields.push(`"${key}"`);
        if (type === 'date') {
          placeholders.push(`$${paramIdx++}::date`);
          params.push(data[key]);
        } else if (type === 'int') {
          placeholders.push(`$${paramIdx++}::int`);
          params.push(data[key]);
        } else if (type === 'float') {
          placeholders.push(`$${paramIdx++}::double precision`);
          params.push(data[key]);
        } else {
          placeholders.push(`$${paramIdx++}`);
          params.push(data[key]);
        }
      }
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "saisie_master_evaluations" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      ...params,
    );

    this.logger.log(`✅ Évaluation SaisieMaster créée: ${data.evaluationType} - ${data.testTitle}`);
    return this.getEvaluation(tenantId, id);
  }

  /// Met à jour une évaluation.
  async updateEvaluation(
    tenantId: string,
    evalId: string,
    data: any,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "saisie_master_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields: Record<string, 'string' | 'int' | 'float' | 'jsonb' | 'date'> = {
      subjectId: 'string',
      schoolName: 'string', className: 'string', academicYearLabel: 'string',
      trimester: 'int', evaluationType: 'string', evaluationLabel: 'string', testTitle: 'string',
      testDate: 'date', durationMinutes: 'int', teacherName: 'string',
      maxScore: 'float', passingScore: 'float', coefficient: 'float',
      studentScores: 'jsonb',
      totalStudents: 'int', totalPresent: 'int', totalAbsent: 'int',
      averageScore: 'float', highestScore: 'float', lowestScore: 'float',
      passedCount: 'int', failedCount: 'int', passRate: 'float',
      boysCount: 'int', girlsCount: 'int',
      boysAverage: 'float', girlsAverage: 'float',
      boysPassed: 'int', girlsPassed: 'int',
      pedagogicalObservations: 'string', recommandations: 'string',
      teacherSignature: 'string', directorSignature: 'string',
      status: 'string', submittedAt: 'date', validatedAt: 'date',
      validatedBy: 'string', rejectionReason: 'string',
    };

    for (const [key, type] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        const val = data[key];
        if (type === 'jsonb') {
          updates.push(`"${key}" = $${paramIdx++}::jsonb`);
          params.push(JSON.stringify(val));
        } else if (type === 'date' && val) {
          updates.push(`"${key}" = $${paramIdx++}::date`);
          params.push(val);
        } else if (type === 'int') {
          updates.push(`"${key}" = $${paramIdx++}::int`);
          params.push(val);
        } else if (type === 'float') {
          updates.push(`"${key}" = $${paramIdx++}::double precision`);
          params.push(val);
        } else {
          updates.push(`"${key}" = $${paramIdx++}`);
          params.push(val);
        }
      }
    }

    if (updates.length === 0) return existing[0];

    updates.push(`"updatedAt" = NOW()`);
    params.push(evalId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "saisie_master_evaluations" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    return this.getEvaluation(tenantId, evalId);
  }

  /// Supprime une évaluation.
  async deleteEvaluation(tenantId: string, evalId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "saisie_master_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "saisie_master_evaluations" WHERE "id" = $1`,
      evalId,
    );
    return { success: true };
  }

  /// Soumet une évaluation au directeur.
  async submitEvaluation(tenantId: string, evalId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "saisie_master_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    if (existing[0].status !== 'DRAFT') {
      throw new BadRequestException('Évaluation déjà soumise');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "saisie_master_evaluations"
       SET "status" = 'SUBMITTED', "submittedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1`,
      evalId,
    );
    return this.getEvaluation(tenantId, evalId);
  }

  /// Initialise les scores des élèves depuis student_enrollments (sans écraser l'existant).
  async initStudents(tenantId: string, evalId: string) {
    const evalResult: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "saisie_master_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evalId, tenantId,
    );
    if (!evalResult || evalResult.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    const eval_ = evalResult[0];

    const enrollments: any = await this.prisma.$queryRawUnsafe(
      `SELECT se."studentId", s."firstName", s."lastName", s."gender", s."matricule"
       FROM "student_enrollments" se
       INNER JOIN "students" s ON s."id" = se."studentId"
       WHERE se."tenantId" = $1 AND se."academicYearId" = $2 AND se."classId" = $3
       AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED')
       ORDER BY s."lastName", s."firstName"`,
      tenantId, eval_.academicYearId, eval_.classId,
    );

    const existingScores = typeof eval_.studentScores === 'string'
      ? JSON.parse(eval_.studentScores || '[]')
      : (eval_.studentScores || []);

    const newScores = enrollments.map((enr: any, idx: number) => {
      const existing = existingScores.find((s: any) => s.studentId === enr.studentId);
      return {
        studentId: enr.studentId,
        numero: existing?.numero ?? idx + 1,
        nom: enr.lastName || '',
        prenom: enr.firstName || '',
        sexe: (enr.gender || '').toUpperCase() === 'FEMALE' ? 'F' :
              (enr.gender || '').toUpperCase() === 'MALE' ? 'M' : (enr.gender || 'M'),
        score: existing?.score ?? null,
        appreciation: existing?.appreciation || '',
        absent: existing?.absent ?? false,
      };
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE "saisie_master_evaluations" SET "studentScores" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
      JSON.stringify(newScores), evalId,
    );

    this.logger.log(`✅ ${newScores.length} élèves chargés pour évaluation ${evalId}`);
    return this.getEvaluation(tenantId, evalId);
  }

  // ===========================================================================
  // STATISTIQUES — calcul automatique
  // ===========================================================================

  /// Calcule les statistiques d'une évaluation à partir des scores.
  computeStats(studentScores: any[], maxScore: number, passingScore: number) {
    let total = 0, present = 0, absent = 0;
    let sumScores = 0;
    let highest = -Infinity, lowest = Infinity;
    let passed = 0, failed = 0;
    let totalG = 0, totalF = 0;
    let sumG = 0, sumF = 0;
    let passedG = 0, passedF = 0;

    for (const s of studentScores) {
      total++;
      const sexe = (s.sexe || '').toUpperCase();
      if (sexe === 'M' || sexe === 'G') totalG++;
      else if (sexe === 'F') totalF++;

      if (s.absent) {
        absent++;
        failed++;
        continue;
      }
      if (s.score === null || s.score === undefined || s.score === '') continue;

      present++;
      const score = Number(s.score);
      if (isNaN(score)) continue;
      sumScores += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
      const isPassed = score >= passingScore;
      if (isPassed) {
        passed++;
        if (sexe === 'M' || sexe === 'G') passedG++;
        else if (sexe === 'F') passedF++;
      } else {
        failed++;
      }

      if (sexe === 'M' || sexe === 'G') sumG += score;
      else if (sexe === 'F') sumF += score;
    }

    return {
      totalStudents: total,
      totalPresent: present,
      totalAbsent: absent,
      averageScore: present > 0 ? Math.round((sumScores / present) * 100) / 100 : 0,
      highestScore: highest === -Infinity ? 0 : highest,
      lowestScore: lowest === Infinity ? 0 : lowest,
      passedCount: passed,
      failedCount: failed,
      passRate: present > 0 ? Math.round((passed / present) * 10000) / 100 : 0,
      boysCount: totalG,
      girlsCount: totalF,
      boysAverage: totalG > 0 ? Math.round((sumG / totalG) * 100) / 100 : 0,
      girlsAverage: totalF > 0 ? Math.round((sumF / totalF) * 100) / 100 : 0,
      boysPassed: passedG,
      girlsPassed: passedF,
    };
  }

  // ===========================================================================
  // VALIDATION DIRECTION
  // ===========================================================================

  /// Récupère les évaluations soumises (en attente de validation).
  async getPendingEvaluations(tenantId: string, academicYearId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT e.*, c."name" as "classNameResolved", s."name" as "subjectName",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "saisie_master_evaluations" e
       LEFT JOIN "classes" c ON c."id" = e."classId"
       LEFT JOIN "subjects" s ON s."id" = e."subjectId"
       LEFT JOIN "teachers" t ON t."id" = e."teacherId"
       WHERE e."tenantId" = $1 AND e."academicYearId" = $2 AND e."status" = 'SUBMITTED'
       ORDER BY e."submittedAt" DESC`,
      tenantId, academicYearId,
    );
  }

  /// Valide ou rejette une évaluation.
  async validateEvaluation(
    tenantId: string,
    evalId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "saisie_master_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException('Évaluation pas en attente de validation');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "saisie_master_evaluations"
       SET "status" = $1, "validatedAt" = NOW(), "validatedBy" = $2,
           "rejectionReason" = $3, "updatedAt" = NOW()
       WHERE "id" = $4`,
      action, validatedBy, action === 'REJECTED' ? (rejectionReason || null) : null, evalId,
    );

    if (action === 'VALIDATED') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "saisie_master_evaluations" SET "directorSignature" = 'Validé par la direction' WHERE "id" = $1`,
        evalId,
      );
    }

    this.logger.log(`✅ Évaluation ${evalId} ${action} par ${validatedBy}`);
    return this.getEvaluation(tenantId, evalId);
  }

  /// Récupère le détail d'une évaluation (vue direction).
  async getEvaluationDetail(tenantId: string, evalId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT e.*, c."name" as "classNameResolved", s."name" as "subjectName",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "saisie_master_evaluations" e
       LEFT JOIN "classes" c ON c."id" = e."classId"
       LEFT JOIN "subjects" s ON s."id" = e."subjectId"
       LEFT JOIN "teachers" t ON t."id" = e."teacherId"
       WHERE e."id" = $1 AND e."tenantId" = $2`,
      evalId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    return result[0];
  }

  // ===========================================================================
  // EXPORT PDF / ZIP
  // ===========================================================================

  /// Génère le HTML d'une évaluation pour impression/export PDF.
  buildEvaluationHtml(eval_: any): string {
    const scores = typeof eval_.studentScores === 'string'
      ? JSON.parse(eval_.studentScores || '[]')
      : (eval_.studentScores || []);
    const maxScore = eval_.maxScore ?? 20;
    const passingScore = eval_.passingScore ?? 10;

    const rows = scores.map((s: any, idx: number) => {
      const score = parseFloat(s.score);
      const isPassed = !isNaN(score) && score >= passingScore;
      const scoreDisplay = s.absent ? '<em>Absent</em>' : (isNaN(score) ? '—' : score.toFixed(2));
      const status = s.absent ? '—' : (!isNaN(score) ? (isPassed ? '✓' : '✗') : '—');
      const statusColor = s.absent ? '#999' : (!isNaN(score) ? (isPassed ? '#16a34a' : '#dc2626') : '#999');
      return `
        <tr>
          <td>${s.numero || idx + 1}</td>
          <td style="text-align:left">${s.nom || ''} ${s.prenom || ''}</td>
          <td>${s.sexe || ''}</td>
          <td style="font-weight:bold">${scoreDisplay}</td>
          <td style="color:${statusColor};font-weight:bold">${status}</td>
          <td style="text-align:left;font-size:9pt">${s.appreciation || ''}</td>
        </tr>`;
    }).join('');

    const statsHtml = eval_.averageScore !== null && eval_.averageScore !== undefined ? `
      <div class="stats">
        <div class="stat-card"><div class="stat-val">${eval_.totalStudents ?? scores.length}</div><div class="stat-lbl">Effectif</div></div>
        <div class="stat-card"><div class="stat-val">${eval_.totalPresent ?? '—'}</div><div class="stat-lbl">Présents</div></div>
        <div class="stat-card"><div class="stat-val">${eval_.totalAbsent ?? '—'}</div><div class="stat-lbl">Absents</div></div>
        <div class="stat-card"><div class="stat-val blue">${eval_.averageScore?.toFixed(2) ?? '—'}</div><div class="stat-lbl">Moyenne</div></div>
        <div class="stat-card"><div class="stat-val green">${eval_.passRate?.toFixed(1) ?? '—'}%</div><div class="stat-lbl">% Réussite</div></div>
        <div class="stat-card"><div class="stat-val purple">${eval_.highestScore?.toFixed(2) ?? '—'}</div><div class="stat-lbl">Note max</div></div>
      </div>` : '';

    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>${eval_.testTitle}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; margin: 20px; color: #1e293b; font-size: 11pt; }
  h1 { text-align: center; font-size: 18pt; margin: 0 0 5px 0; }
  h2 { text-align: center; font-size: 13pt; margin: 0 0 15px 0; color: #475569; font-weight: normal; }
  .header { border: 2px solid #1e293b; padding: 15px; margin-bottom: 20px; }
  .header table { width: 100%; border-collapse: collapse; }
  .header td { padding: 4px 8px; vertical-align: top; }
  .header .label { font-size: 9pt; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .header .value { font-size: 11pt; font-weight: bold; }
  .stats { display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap; }
  .stat-card { flex: 1; min-width: 100px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; background: #f8fafc; }
  .stat-val { font-size: 18pt; font-weight: bold; color: #1e293b; }
  .stat-val.blue { color: #2563eb; }
  .stat-val.green { color: #16a34a; }
  .stat-val.purple { color: #9333ea; }
  .stat-lbl { font-size: 9pt; color: #64748b; text-transform: uppercase; margin-top: 4px; }
  table.notes { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.notes th, table.notes td { border: 1px solid #475569; padding: 6px 8px; text-align: center; }
  table.notes th { background: #1e293b; color: white; font-size: 10pt; text-transform: uppercase; }
  table.notes tr:nth-child(even) { background: #f8fafc; }
  table.notes tr:nth-child(odd) { background: white; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; gap: 40px; }
  .sig-block { flex: 1; border-top: 2px solid #475569; padding-top: 8px; }
  .sig-label { font-size: 10pt; color: #64748b; text-transform: uppercase; font-weight: bold; }
  .sig-space { height: 60px; }
  .observations { margin-top: 20px; padding: 10px; background: #fef3c7; border-left: 4px solid #f59e0b; }
  .observations h3 { margin: 0 0 8px 0; font-size: 11pt; color: #92400e; }
  .footer { margin-top: 30px; text-align: center; font-size: 9pt; color: #94a3b8; border-top: 1px solid #cbd5e1; padding-top: 8px; }
</style></head><body>

<h1>SAISIEMASTER — ${eval_.evaluationLabel || eval_.evaluationType}</h1>
<h2>${eval_.testTitle}</h2>

<div class="header">
  <table>
    <tr>
      <td><div class="label">École</div><div class="value">${eval_.schoolName || '—'}</div></td>
      <td><div class="label">Classe</div><div class="value">${eval_.classNameResolved || eval_.className || '—'}</div></td>
      <td><div class="label">Matière</div><div class="value">${eval_.subjectName || '—'}</div></td>
    </tr>
    <tr>
      <td><div class="label">Enseignant</div><div class="value">${eval_.teacherFirstName || ''} ${eval_.teacherLastName || eval_.teacherName || ''}</div></td>
      <td><div class="label">Trimestre</div><div class="value">T${eval_.trimester}</div></td>
      <td><div class="label">Date</div><div class="value">${eval_.testDate ? new Date(eval_.testDate).toLocaleDateString('fr-FR') : '—'}</div></td>
    </tr>
    <tr>
      <td><div class="label">Note maximale</div><div class="value">/${maxScore}</div></td>
      <td><div class="label">Seuil réussite</div><div class="value">${passingScore}</div></td>
      <td><div class="label">Coefficient</div><div class="value">${eval_.coefficient ?? 1}</div></td>
    </tr>
  </table>
</div>

${statsHtml}

<table class="notes">
  <thead>
    <tr>
      <th style="width:50px">N°</th>
      <th style="text-align:left">Nom et prénom</th>
      <th style="width:60px">Sexe</th>
      <th style="width:100px">Note /${maxScore}</th>
      <th style="width:60px">Statut</th>
      <th style="text-align:left">Appréciation</th>
    </tr>
  </thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">Aucune note saisie</td></tr>'}</tbody>
</table>

${eval_.pedagogicalObservations ? `<div class="observations"><h3>Observations pédagogiques</h3><div>${eval_.pedagogicalObservations}</div></div>` : ''}
${eval_.recommandations ? `<div class="observations" style="background:#dbeafe;border-left-color:#3b82f6"><h3 style="color:#1e40af">Recommandations</h3><div>${eval_.recommandations}</div></div>` : ''}

<div class="signatures">
  <div class="sig-block">
    <div class="sig-label">Le Titulaire</div>
    <div class="sig-space"></div>
    <div style="font-size:9pt;color:#94a3b8">${eval_.teacherSignature || 'Signature'}</div>
  </div>
  <div class="sig-block">
    <div class="sig-label">Le Directeur / La Directrice</div>
    <div class="sig-space"></div>
    <div style="font-size:9pt;color:#94a3b8">${eval_.directorSignature || 'Signature et cachet'}</div>
  </div>
</div>

<div class="footer">
  Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
  ${eval_.status === 'VALIDATED' ? '· Statut: VALIDÉ' : eval_.status === 'SUBMITTED' ? '· Statut: En attente de validation' : '· Statut: Brouillon'}
</div>

</body></html>`;
  }

  /// Génère un PDF d'une évaluation via Puppeteer.
  async generateEvaluationPdf(tenantId: string, evalId: string): Promise<Buffer> {
    const eval_ = await this.getEvaluationDetail(tenantId, evalId);
    const html = this.buildEvaluationHtml(eval_);

    let puppeteer: any;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new BadRequestException('Puppeteer non disponible');
    }

    const browser = await puppeteer.launch({
      headless: 'new' as any,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /// Génère un ZIP contenant les PDFs des 4 évaluations (EF1, ES1, ES2, ES3).
  async generateEvaluationsZip(
    tenantId: string,
    academicYearId: string,
    classId: string,
    subjectId: string | null,
    trimester?: number,
  ): Promise<Buffer> {
    const evals = await this.getEvaluationsForClassSubject(
      tenantId, academicYearId, classId, subjectId, trimester,
    ) as any[];

    if (evals.length === 0) {
      throw new NotFoundException('Aucune évaluation trouvée pour cette classe et matière');
    }

    let puppeteer: any;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new BadRequestException('Puppeteer non disponible');
    }

    const browser = await puppeteer.launch({
      headless: 'new' as any,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    const pdfBuffers: Array<{ name: string; buffer: Buffer }> = [];

    try {
      for (const eval_ of evals) {
        const html = this.buildEvaluationHtml(eval_);
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        });
        await page.close();

        const className = (eval_.classNameResolved || 'Classe').replace(/[^a-zA-Z0-9]/g, '_');
        const subjectName = (eval_.subjectName || 'Matiere').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${eval_.evaluationType}_${className}_${subjectName}_T${eval_.trimester || 1}.pdf`;
        pdfBuffers.push({ name: fileName, buffer: Buffer.from(pdf) });
      }
    } finally {
      await browser.close();
    }

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: any) => reject(err));

      for (const { name, buffer } of pdfBuffers) {
        archive.append(buffer, { name });
      }
      archive.finalize();
    });
  }

  /// Dashboard direction : compte des évaluations en attente.
  async getDirectorDashboard(tenantId: string, academicYearId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "saisie_master_evaluations"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'`,
      tenantId, academicYearId,
    );
    return { pendingEvaluations: result[0]?.count || 0 };
  }
}
