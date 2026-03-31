/**
 * ============================================================================
 * EDUCMASTER EXCEL EXPORT SERVICE
 * ============================================================================
 * Export pour la plateforme gouvernementale Bénin (MEMP / emp.educmaster.bj —
 * ministère de l'enseignement). Trois identifiants distincts :
 * - Matricule Academia Helm = identifiant interne de l'établissement (par école).
 * - NPI = Numéro d'Identification Personnel (citoyens béninois).
 * - Numéro Educmaster = identifiant attribué par la plateforme MEMP (ni le NPI ni le matricule établissement).
 *
 * Règles :
 * - Un fichier par niveau : Maternelle (un fichier) et Primaire (un fichier).
 * - Maternelle : feuilles "Maternelle 1" et "Maternelle 2" (une feuille par classe).
 * - Primaire : feuilles CI, CP, CE1, CE2, CM1, CM2 (une feuille par classe).
 * - Colonnes Excel : NPI (identification personnelle Bénin) ; le numéro Educmaster est un identifiant distinct attribué par la plateforme MEMP.
 * - Nom du fichier : NiveauScolaire_NomEcole_AnnéeScolaire.xlsx
 *   Ex. : Maternelle_École_Sainte_Marie_2024-2025.xlsx
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';

/** Définition d'une colonne du fichier EDUCMASTER (ordre et libellé exact pour emp.educmaster.bj) */
export interface EducmasterColumn {
  key: string;
  label: string;
}

/**
 * Colonnes officielles du modèle Excel EDUCMASTER (emp.educmaster.bj) — exactement dans cet ordre.
 */
export const EDUCMASTER_EXCEL_COLUMNS: EducmasterColumn[] = [
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom (s)' },
  { key: 'sexe', label: 'Sexe' },
  { key: 'dateNaissance', label: 'Date de naissance' },
  { key: 'lieuNaissance', label: 'Lieu de naissance' },
  { key: 'telephoneParents', label: 'Téléphone de parents' },
  { key: 'nationalite', label: 'Nationalité' },
  { key: 'npi', label: 'NPI' },
];

export interface EducmasterExcelExportOptions {
  tenantId: string;
  academicYearId: string;
  schoolLevelId: string;
  /** Colonnes personnalisées (optionnel, sinon EDUCMASTER_EXCEL_COLUMNS) */
  columns?: EducmasterColumn[];
}

export interface EducmasterExcelExportResult {
  buffer: Buffer;
  filename: string;
  sheetNames: string[];
}

@Injectable()
export class EducmasterExcelExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un fichier Excel EDUCMASTER avec une feuille par classe du niveau demandé.
   * - Maternelle : feuilles "Maternelle 1" et "Maternelle 2".
   * - Primaire : une feuille par classe (CI, CP, CE1, CE2, CM1, CM2 selon les classes existantes).
   */
  async generateWorkbook(options: EducmasterExcelExportOptions): Promise<EducmasterExcelExportResult> {
    const { tenantId, academicYearId, schoolLevelId } = options;
    const columns = options.columns ?? EDUCMASTER_EXCEL_COLUMNS;

    const [schoolLevel, academicYear, tenant] = await Promise.all([
      this.prisma.schoolLevel.findFirst({
        where: { id: schoolLevelId, tenantId },
      }),
      this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { schools: true },
      }),
    ]);

    if (!schoolLevel) {
      throw new NotFoundException('Niveau scolaire non trouvé');
    }

    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      orderBy: { code: 'asc' },
    });

    if (classes.length === 0) {
      throw new NotFoundException(
        `Aucune classe trouvée pour ce niveau (année ${academicYearId}, niveau ${schoolLevelId})`,
      );
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    const sheetNames: string[] = [];

    for (const cls of classes) {
      const sheetName = this.sanitizeSheetName(cls.name);
      const sheet = workbook.addWorksheet(sheetName, {
        headerFooter: { firstHeader: cls.name, firstFooter: 'Academia Helm - Export EDUCMASTER' },
      });
      sheetNames.push(sheetName);

      const students = await this.getStudentsByClass(tenantId, academicYearId, cls.id);
      this.writeSheet(sheet, columns, students, cls.name);
    }

    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any);
    const niveauScolaire = this.fileNameSegment(
      this.levelNameForFile(schoolLevel.name || schoolLevel.code || 'Niveau'),
    );
    const nomEcole = this.fileNameSegment(
      (tenant?.schools as { name?: string } | null)?.name ?? tenant?.name ?? 'Ecole',
    );
    const anneeScolaire = this.fileNameSegment(
      academicYear?.name || academicYear?.label || new Date().getFullYear().toString(),
    );
    const filename = `${niveauScolaire}_${nomEcole}_${anneeScolaire}.xlsx`;

    return { buffer, filename, sheetNames };
  }

  /** Libellé du niveau pour le nom de fichier (ex. MATERNELLE → Maternelle). */
  private levelNameForFile(codeOrName: string): string {
    const upper = codeOrName.toUpperCase();
    if (upper === 'MATERNELLE') return 'Maternelle';
    if (upper === 'PRIMAIRE') return 'Primaire';
    if (upper === 'SECONDAIRE') return 'Secondaire';
    return codeOrName.trim() || 'Niveau';
  }

  private fileNameSegment(value: string): string {
    return value
      .replace(/[/\\:*?"<>|]/g, ' ')
      .replace(/\s+/g, '_')
      .trim()
      .slice(0, 80) || 'export';
  }

  private sanitizeSheetName(name: string): string {
    const sanitized = name.replace(/[\\/*?:\[\]]/g, ' ').trim();
    return sanitized.slice(0, 31) || 'Feuille';
  }

  private async getStudentsByClass(
    tenantId: string,
    academicYearId: string,
    classId: string,
  ): Promise<
    Array<{
      student: {
        id: string;
        studentCode: string | null;
        firstName: string;
        lastName: string;
        dateOfBirth: Date | null;
        gender: string | null;
        placeOfBirth: string | null;
        nationality: string | null;
        npi: string | null;
      };
      guardians: Array<{
        relationship: string;
        isPrimary: boolean;
        firstName: string;
        lastName: string;
        phone: string | null;
        address: string | null;
      }>;
    }>>
  {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        classId,
        status: { in: ['ADMITTED', 'RE_ENROLLED', 'PENDING'] },
      },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            placeOfBirth: true,
            nationality: true,
            npi: true,
          },
        },
      },
    });

    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    if (studentIds.length === 0) {
      return [];
    }

    const guardiansByStudent = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      include: { guardian: true },
    });

    const grouped = new Map<
      string,
      {
        guardian: { firstName: string; lastName: string; phone: string | null; address: string | null };
        relationship: string;
        isPrimary: boolean;
      }[]
    >();
    for (const sg of guardiansByStudent) {
      const list = grouped.get(sg.studentId) ?? [];
      list.push({
        guardian: sg.guardian,
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
      });
      grouped.set(sg.studentId, list);
    }

    const seen = new Set<string>();
    return enrollments
      .filter((e) => {
        if (seen.has(e.studentId)) return false;
        seen.add(e.studentId);
        return true;
      })
      .map((e) => {
        const guardians = (grouped.get(e.studentId) ?? []).map((g) => ({
          relationship: g.relationship,
          isPrimary: g.isPrimary,
          firstName: g.guardian.firstName,
          lastName: g.guardian.lastName,
          phone: g.guardian.phone,
          address: g.guardian.address,
        }));
        return { student: e.student, guardians };
      });
  }

  private writeSheet(
    sheet: ExcelJS.Worksheet,
    columns: EducmasterColumn[],
    students: Array<{
      student: {
        studentCode: string | null;
        firstName: string;
        lastName: string;
        dateOfBirth: Date | null;
        gender: string | null;
        placeOfBirth: string | null;
        nationality: string | null;
        npi: string | null;
      };
      guardians: Array<{
        relationship: string;
        isPrimary: boolean;
        firstName: string;
        lastName: string;
        phone: string | null;
        address: string | null;
      }>;
    }>,
    _className: string,
  ): void {
    const headers = columns.map((c) => c.label);
    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const { student, guardians } of students) {
      const telParents = guardians.map((g) => g.phone).filter(Boolean).join(' / ') || '';
      const npi = student.npi ?? '';

      const row: Record<string, string | number | null | undefined> = {};
      for (const col of columns) {
        switch (col.key) {
          case 'nom':
            row[col.label] = student.lastName ?? '';
            break;
          case 'prenom':
            row[col.label] = student.firstName ?? '';
            break;
          case 'sexe':
            row[col.label] = student.gender === 'M' ? 'M' : student.gender === 'F' ? 'F' : student.gender ?? '';
            break;
          case 'dateNaissance':
            row[col.label] = student.dateOfBirth
              ? new Date(student.dateOfBirth).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : '';
            break;
          case 'lieuNaissance':
            row[col.label] = student.placeOfBirth ?? '';
            break;
          case 'telephoneParents':
            row[col.label] = telParents;
            break;
          case 'nationalite':
            row[col.label] = student.nationality ?? '';
            break;
          case 'npi':
            row[col.label] = npi;
            break;
          default:
            row[col.label] = '';
        }
      }
      sheet.addRow(columns.map((c) => row[c.label] ?? ''));
    }

    for (let i = 1; i <= columns.length; i++) {
      sheet.getColumn(i).width = 18;
    }
  }
}
