/**
 * ============================================================================
 * FEE OVERRIDE IMPORT SERVICE — Import en masse de personnalisations de frais
 * ============================================================================
 *
 * Permet aux établissements d'importer en masse les personnalisations de frais
 * (FeeOverride) pour plusieurs élèves depuis un fichier Excel (.xlsx).
 *
 * Cas d'usage typique : bourses, réduits sociaux, tarifs négociés, exonérations
 * partielles — appliqués à une cohorte d'élèves en une seule opération.
 *
 * Workflow :
 *   1. L'admin télécharge le template (GET /finance/fee-structures/overrides/import/template)
 *   2. L'admin remplit le template (une ligne par élève × type de frais)
 *   3. L'admin upload le fichier → preview (POST /finance/fee-structures/overrides/import/preview)
 *   4. L'admin corrige les erreurs éventuelles et confirme
 *   5. Import réel (POST /finance/fee-structures/overrides/import/run)
 *      → pour chaque ligne valide : crée ou MET À JOUR le FeeOverride
 *        (si un override existe déjà pour (studentId, feeStructureId), on update
 *         le customAmount + reason au lieu de créer un doublon)
 *      → recalcule le compte élève pour appliquer la personnalisation
 *
 * Format Excel (une feuille "Personnalisations") :
 *   Matricule | Nom élève | Type de frais | Montant personnalisé | Motif
 *
 * Règles de validation :
 *   - Matricule OU Nom élève doit être renseigné (résolution par matricule d'abord,
 *     puis par nom normalisé insensible aux accents/casse)
 *   - Type de frais doit être une valeur de l'enum FeeType
 *     (INSCRIPTION, REINSCRIPTION, TUITION, CANTEEN, EXAMEN, OTHER)
 *   - Montant personnalisé doit être > 0
 *   - Motif ne doit pas être vide (trace d'audit obligatoire)
 *   - La FeeStructure correspondante doit exister pour la classe/niveau de l'élève
 *     (priorité : academicClass > physicalClass > level > global)
 * ============================================================================
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StudentAccountService } from './student-account.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { FeeType } from '@prisma/client';

// ─── Types publics ───────────────────────────────────────────────────────────

export interface FeeOverrideImportRow {
  rowIndex: number;
  matricule: string | null;
  studentName: string;
  feeType: string;
  customAmount: number;
  reason: string;
  // Validation
  errors: string[];
  isValid: boolean;
  // Résolution (pour runImport)
  resolvedStudentId?: string;
  resolvedFeeStructureId?: string;
  // Indique si un override existe déjà (pour afficher "sera mis à jour" dans le preview)
  existingOverrideId?: string;
}

export interface FeeOverrideImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: FeeOverrideImportRow[];
  summary: {
    totalCustomAmount: number;
    studentsAffected: number;
    willBeCreated: number;
    willBeUpdated: number;
    byFeeType: Record<string, number>;
  };
}

export interface FeeOverrideImportRunResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  results: Array<{
    rowIndex: number;
    studentName: string;
    feeType: string;
    action: 'CREATED' | 'UPDATED' | 'ERROR';
    error?: string;
  }>;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const FEE_TYPES: FeeType[] = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];

const FEE_TYPE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  REINSCRIPTION: 'Réinscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  EXAMEN: "Frais d'examen",
  OTHER: 'Autre',
};

@Injectable()
export class FeeOverrideImportService {
  private readonly logger = new Logger(FeeOverrideImportService.name);

  private static readonly HEADERS = [
    'Matricule',
    'Nom élève',
    'Type de frais',
    'Montant personnalisé',
    'Motif',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentAccountService: StudentAccountService,
  ) {}

  // ─── Téléchargement du template ────────────────────────────────────────────

  /**
   * Génère et télécharge le template Excel (une feuille "Personnalisations").
   * Contient l'en-tête + 2 lignes d'exemple illustratives.
   */
  async downloadTemplate(
    tenantId: string,
    academicYearId: string,
    res: Response,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Personnalisations');

    // Définir les colonnes avec largeurs
    ws.columns = FeeOverrideImportService.HEADERS.map((header) => ({
      header,
      key: header,
      width: header === 'Motif' ? 38 : header === 'Nom élève' ? 28 : 22,
    }));

    // Style en-tête (ligne 1) — violet (couleur personnalisation finance)
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6D28D9' }, // violet-700
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // 2 lignes d'exemple
    const examples = [
      ['CSPMON-E-25-001', 'ADANDE Aïcha', 'TUITION', 35000, 'Bourse excellence'],
      ['CSPMON-E-25-002', 'BAWA Rahim', 'INSCRIPTION', 3000, 'Cas social'],
    ];
    for (const ex of examples) {
      ws.addRow(ex);
    }
    // Style des lignes d'exemple (italique gris)
    for (let i = 2; i <= 3; i++) {
      const row = ws.getRow(i);
      row.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
      row.alignment = { vertical: 'middle' };
    }

    // Bordures sur les colonnes (en-tête + lignes de données)
    for (let i = 1; i <= 3; i++) {
      const row = ws.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    }

    // Lignes d'instructions en bas de feuille
    ws.addRow([]);
    const instructions = [
      '⚠️ Lignes d\'exemple à supprimer avant import.',
      `📅 Type de frais autorisés : ${FEE_TYPES.join(', ')} (insensible à la casse).`,
      '💰 Montant personnalisé : en FCFA, doit être > 0.',
      '📋 Motif : obligatoire (ex: "Bourse excellence", "Cas social", "Réduction direction").',
      '🧑‍🎓 Matricule : recommandé pour identifier précisément l\'élève. Si absent, résolution par nom.',
      '📝 Nom élève : format "NOM Prénom" ou "Prénom NOM" (résolution insensible aux accents/casse).',
      '🔄 Si une personnalisation existe déjà pour (élève × type de frais), elle sera MISE À JOUR (pas de doublon).',
      `🏫 Année scolaire active : ${academicYearId || '(non spécifiée)'}.`,
    ];
    for (const inst of instructions) {
      ws.addRow([inst]);
    }
    const lastRow = ws.rowCount;
    for (let i = lastRow - instructions.length + 1; i <= lastRow; i++) {
      const row = ws.getRow(i);
      row.font = { italic: true, color: { argb: 'FF6D28D9' }, size: 10 };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template-import-personnalisations-academia-helm.xlsx"',
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Preview (validation sans création) ────────────────────────────────────

  /**
   * Parse et valide le fichier Excel sans créer d'overrides.
   * Pour chaque ligne : résout l'élève + la FeeStructure, et vérifie les règles.
   */
  async previewImport(
    tenantId: string,
    academicYearId: string,
    fileDataUrl: string,
  ): Promise<FeeOverrideImportPreviewResult> {
    const workbook = await this.parseExcelFile(fileDataUrl);

    // Pré-charger les élèves du tenant (avec matricule + nom)
    const students = await this.prisma.student.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        studentCode: true,
      },
    });

    // Pré-charger les FeeStructures actives de l'année
    const feeStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: {
        class: { select: { id: true, name: true } },
        academicClass: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
      },
    });

    // Pré-charger les inscriptions de l'année (pour résoudre classe/level par élève)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, academicYearId },
      select: {
        studentId: true,
        classId: true,
        academicClassId: true,
        class: { select: { id: true, schoolLevelId: true } },
      },
    });
    const enrollmentByStudent = new Map<string, any>();
    for (const e of enrollments) {
      // Garder la première inscription trouvée par élève (en général une seule par année)
      if (!enrollmentByStudent.has(e.studentId)) {
        enrollmentByStudent.set(e.studentId, e);
      }
    }

    // Pré-charger les overrides existants (pour détecter update vs create)
    const existingOverrides = await this.prisma.feeOverride.findMany({
      where: {
        feeStructure: { tenantId, academicYearId },
      },
      select: { id: true, studentId: true, feeStructureId: true, customAmount: true, reason: true },
    });
    const overrideByKey = new Map<string, string>();
    for (const o of existingOverrides) {
      overrideByKey.set(`${o.studentId}|${o.feeStructureId}`, o.id);
    }

    // Index des élèves par matricule (insensible à la casse) + par variante de nom
    const studentByMatricule = new Map<string, any>();
    for (const s of students) {
      if (s.matricule) {
        studentByMatricule.set(s.matricule.toLowerCase().trim(), s);
      }
      if (s.studentCode) {
        studentByMatricule.set(s.studentCode.toLowerCase().trim(), s);
      }
    }
    const studentByNameVariants = new Map<string, any>();
    for (const s of students) {
      for (const v of buildNameVariants(s.firstName, s.lastName)) {
        if (!studentByNameVariants.has(v)) {
          studentByNameVariants.set(v, s);
        }
      }
    }

    const rows: FeeOverrideImportRow[] = [];
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Aucune feuille dans le fichier Excel');
    }

    let isFirstRow = true;
    sheet.eachRow((row, rowNumber) => {
      if (isFirstRow) {
        isFirstRow = false;
        return;
      }
      const firstCell = row.getCell(1).value;
      const secondCell = row.getCell(2).value;
      // Skip lignes vides
      if (
        (!firstCell || (typeof firstCell === 'string' && !firstCell.trim())) &&
        (!secondCell || (typeof secondCell === 'string' && !secondCell.trim()))
      ) {
        return;
      }
      // Skip lignes d'instructions (commencent par emoji)
      const firstStr = typeof firstCell === 'string' ? firstCell.trim() : '';
      if (firstStr && /^[⚠️📅💰📋🧑📝🏫🔄]/.test(firstStr)) {
        return;
      }

      const parsed = this.parseRow(row, rowNumber);
      this.validateRow(
        parsed,
        studentByMatricule,
        studentByNameVariants,
        enrollmentByStudent,
        feeStructures,
        overrideByKey,
      );
      rows.push(parsed);
    });

    const validRows = rows.filter((r) => r.isValid).length;
    const invalidRows = rows.length - validRows;

    // Statistiques
    const summary = {
      totalCustomAmount: rows
        .filter((r) => r.isValid)
        .reduce((sum, r) => sum + r.customAmount, 0),
      studentsAffected: new Set(
        rows.filter((r) => r.isValid).map((r) => r.resolvedStudentId),
      ).size,
      willBeCreated: rows.filter((r) => r.isValid && !r.existingOverrideId).length,
      willBeUpdated: rows.filter((r) => r.isValid && r.existingOverrideId).length,
      byFeeType: {} as Record<string, number>,
    };
    for (const r of rows.filter((r) => r.isValid)) {
      summary.byFeeType[r.feeType] = (summary.byFeeType[r.feeType] || 0) + 1;
    }

    return { totalRows: rows.length, validRows, invalidRows, rows, summary };
  }

  // ─── Run (création / mise à jour effective) ────────────────────────────────

  /**
   * Importe réellement les overrides : crée ou MET À JOUR (upsert sémantique).
   * Pour chaque ligne valide :
   *   - Si un FeeOverride existe déjà pour (studentId, feeStructureId) → UPDATE
   *   - Sinon → CREATE
   *   - Audit log (FEE_OVERRIDE_CREATE / FEE_OVERRIDE_UPDATE)
   *   - Recalcul du compte élève pour appliquer la personnalisation
   */
  async runImport(
    tenantId: string,
    academicYearId: string,
    fileDataUrl: string,
    userId?: string,
  ): Promise<FeeOverrideImportRunResult> {
    const preview = await this.previewImport(tenantId, academicYearId, fileDataUrl);
    const validRows = preview.rows.filter((r) => r.isValid);

    const results: FeeOverrideImportRunResult['results'] = [];
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const row of validRows) {
      try {
        const studentId = row.resolvedStudentId!;
        const feeStructureId = row.resolvedFeeStructureId!;

        const existing = await this.prisma.feeOverride.findFirst({
          where: { studentId, feeStructureId },
        });

        if (existing) {
          // UPDATE — mettre à jour le montant + motif
          const updated_rec = await this.prisma.feeOverride.update({
            where: { id: existing.id },
            data: {
              customAmount: row.customAmount,
              reason: row.reason,
            },
          });
          // Audit log
          await this.auditLog(tenantId, userId, 'FEE_OVERRIDE_UPDATE', 'FeeOverride', existing.id, {
            customAmount: Number(existing.customAmount),
            reason: existing.reason,
          }, {
            customAmount: Number(updated_rec.customAmount),
            reason: updated_rec.reason,
          });
          updated++;
          results.push({
            rowIndex: row.rowIndex,
            studentName: row.studentName,
            feeType: row.feeType,
            action: 'UPDATED',
          });
        } else {
          // CREATE
          const created_rec = await this.prisma.feeOverride.create({
            data: {
              feeStructureId,
              studentId,
              customAmount: row.customAmount,
              reason: row.reason,
              createdById: userId ?? null,
            },
          });
          await this.auditLog(tenantId, userId, 'FEE_OVERRIDE_CREATE', 'FeeOverride', created_rec.id, undefined, {
            feeStructureId,
            studentId,
            customAmount: row.customAmount,
            reason: row.reason,
          });
          created++;
          results.push({
            rowIndex: row.rowIndex,
            studentName: row.studentName,
            feeType: row.feeType,
            action: 'CREATED',
          });
        }

        // Recalculer le compte élève pour appliquer la personnalisation
        try {
          await this.studentAccountService.recalculate(studentId, tenantId, academicYearId);
        } catch (recalcErr: any) {
          // Non bloquant — l'override est créé, mais le compte n'a pas pu être recalculé
          this.logger.warn(
            `Override créé/mis à jour pour ${row.studentName} mais recalcul du compte échoué: ${recalcErr.message}`,
          );
        }
      } catch (e: any) {
        errors++;
        this.logger.error(
          `Import override ligne ${row.rowIndex} (${row.studentName} / ${row.feeType}): ${e.message}`,
        );
        results.push({
          rowIndex: row.rowIndex,
          studentName: row.studentName,
          feeType: row.feeType,
          action: 'ERROR',
          error: e.message,
        });
      }
    }

    return { total: preview.totalRows, created, updated, errors, results };
  }

  // ─── Méthodes privées ──────────────────────────────────────────────────────

  private async parseExcelFile(fileDataUrl: string): Promise<ExcelJS.Workbook> {
    const base64Match = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const base64Data = base64Match ? base64Match[2] : fileDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  }

  /**
   * Parse une ligne Excel en FeeOverrideImportRow.
   */
  private parseRow(row: ExcelJS.Row, rowNumber: number): FeeOverrideImportRow {
    const getCell = (col: number): string => {
      const val = row.getCell(col).value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object' && 'text' in val) return String((val as any).text || '').trim();
      if (typeof val === 'object' && 'result' in val) return String((val as any).result || '').trim();
      return String(val).trim();
    };

    const parseAmount = (s: string): number => {
      const cleaned = s.replace(/[^\d.-]/g, '');
      return cleaned ? Number(cleaned) : 0;
    };

    return {
      rowIndex: rowNumber,
      matricule: getCell(1) || null,
      studentName: getCell(2),
      feeType: getCell(3).toUpperCase(),
      customAmount: parseAmount(getCell(4)),
      reason: getCell(5),
      errors: [],
      isValid: true,
    };
  }

  /**
   * Valide une ligne : résout l'élève + la FeeStructure, vérifie les règles métier.
   */
  private validateRow(
    row: FeeOverrideImportRow,
    studentByMatricule: Map<string, any>,
    studentByNameVariants: Map<string, any>,
    enrollmentByStudent: Map<string, any>,
    feeStructures: any[],
    overrideByKey: Map<string, string>,
  ): void {
    // 1. Vérifier qu'au moins un identifiant élève est fourni
    if (!row.matricule && !row.studentName) {
      row.errors.push('Matricule ou Nom élève doit être renseigné');
    }

    // 2. Résoudre l'élève (par matricule d'abord, puis par nom)
    let resolvedStudent: any = null;
    if (row.matricule) {
      resolvedStudent = studentByMatricule.get(row.matricule.toLowerCase().trim());
      if (!resolvedStudent) {
        row.errors.push(`Matricule "${row.matricule}" introuvable`);
      }
    }
    if (!resolvedStudent && row.studentName) {
      const norm = normalizeName(row.studentName);
      resolvedStudent = studentByNameVariants.get(norm);
      if (!resolvedStudent) {
        // Essayer en permutant les parties du nom (ex: "NOM Prénom" → "Prénom NOM")
        const parts = row.studentName.trim().split(/\s+/);
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          const restName = parts.slice(0, -1).join(' ');
          const reversed = normalizeName(lastPart + ' ' + restName);
          resolvedStudent = studentByNameVariants.get(reversed);
        }
      }
      if (!resolvedStudent) {
        row.errors.push(`Élève "${row.studentName}" introuvable (essayez avec le matricule)`);
      }
    }

    if (resolvedStudent) {
      row.resolvedStudentId = resolvedStudent.id;
      // Compléter le nom affiché si manquant
      if (!row.studentName) {
        row.studentName = `${resolvedStudent.lastName} ${resolvedStudent.firstName}`.trim();
      }
    }

    // 3. Valider le type de frais
    if (!row.feeType) {
      row.errors.push('Type de frais manquant');
    } else if (!FEE_TYPES.includes(row.feeType as FeeType)) {
      row.errors.push(
        `Type de frais "${row.feeType}" invalide. Valeurs autorisées: ${FEE_TYPES.join(', ')}`,
      );
    }

    // 4. Valider le montant personnalisé
    if (row.customAmount <= 0) {
      row.errors.push('Montant personnalisé doit être > 0');
    }

    // 5. Valider le motif
    if (!row.reason) {
      row.errors.push('Motif obligatoire (trace d\'audit)');
    }

    // 6. Résoudre la FeeStructure (si l'élève et le type de frais sont valides)
    if (resolvedStudent && FEE_TYPES.includes(row.feeType as FeeType)) {
      const enrollment = enrollmentByStudent.get(resolvedStudent.id);
      const academicClassId = enrollment?.academicClassId ?? null;
      const classId = enrollment?.classId ?? null;
      const levelId = enrollment?.class?.schoolLevelId ?? null;

      // Priorité : academicClass > physicalClass > level > global (exclusive)
      const matchByPriority = (): any | null => {
        // 1. academicClass
        const byAcademicClass = feeStructures.find(
          (fs) => fs.feeType === row.feeType && fs.academicClassId && fs.academicClassId === academicClassId,
        );
        if (byAcademicClass) return byAcademicClass;

        // 2. physicalClass
        const byPhysicalClass = feeStructures.find(
          (fs) => fs.feeType === row.feeType && !fs.academicClassId && fs.classId && fs.classId === classId,
        );
        if (byPhysicalClass) return byPhysicalClass;

        // 3. level
        const byLevel = feeStructures.find(
          (fs) => fs.feeType === row.feeType && !fs.academicClassId && !fs.classId && fs.levelId && fs.levelId === levelId,
        );
        if (byLevel) return byLevel;

        // 4. global
        const byGlobal = feeStructures.find(
          (fs) => fs.feeType === row.feeType && !fs.academicClassId && !fs.classId && !fs.levelId,
        );
        return byGlobal || null;
      };

      const fs = matchByPriority();
      if (!fs) {
        const classLabel = academicClassId || classId || levelId || 'aucune classe/niveau';
        row.errors.push(
          `Aucune FeeStructure active trouvée pour le type "${row.feeType}" et l'élève (classe: ${classLabel}). Configurez d'abord les frais pour cette classe/niveau.`,
        );
      } else {
        row.resolvedFeeStructureId = fs.id;
        // Vérifier si un override existe déjà → sera une mise à jour
        const existingId = overrideByKey.get(`${resolvedStudent.id}|${fs.id}`);
        if (existingId) {
          row.existingOverrideId = existingId;
        }
      }
    }

    row.isValid = row.errors.length === 0;
  }

  /**
   * Crée un enregistrement d'audit (best-effort, non bloquant).
   */
  private async auditLog(
    tenantId: string,
    userId: string | undefined,
    action: string,
    resource: string,
    resourceId: string,
    oldData?: object,
    newData?: object,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId ?? undefined,
          action,
          resource,
          resourceId,
          tableName: 'fee_overrides',
          recordId: resourceId,
          oldData: oldData ?? undefined,
          newData: newData ?? undefined,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Audit log failed (non-blocking): ${e.message}`);
    }
  }
}

// ─── Utilitaires de normalisation de noms ────────────────────────────────────
// (Replicates the logic from scripts/compare-excel-vs-db.js for fuzzy matching)

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildNameVariants(firstName: string, lastName: string): string[] {
  const variants = new Set<string>();
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  // Format DB : "firstName lastName"
  variants.add(normalizeName(f + ' ' + l));
  // Format inverse : "lastName firstName" (format Excel)
  variants.add(normalizeName(l + ' ' + f));
  // Sans les initiales (ex: "BARANON M." → "BARANON")
  const lNoInit = l.replace(/\s+[A-Z]\.?\s*/g, ' ').trim();
  const fNoInit = f.replace(/\s+[A-Z]\.?\s*/g, ' ').trim();
  if (lNoInit !== l) {
    variants.add(normalizeName(f + ' ' + lNoInit));
    variants.add(normalizeName(lNoInit + ' ' + f));
  }
  if (fNoInit !== f) {
    variants.add(normalizeName(fNoInit + ' ' + l));
    variants.add(normalizeName(l + ' ' + fNoInit));
  }
  if (lNoInit !== l || fNoInit !== f) {
    variants.add(normalizeName(fNoInit + ' ' + lNoInit));
    variants.add(normalizeName(lNoInit + ' ' + fNoInit));
  }
  variants.delete('');
  return Array.from(variants);
}

// Export pour réutilisation dans le service Bilan
export { normalizeName, buildNameVariants, FEE_TYPE_LABELS };
