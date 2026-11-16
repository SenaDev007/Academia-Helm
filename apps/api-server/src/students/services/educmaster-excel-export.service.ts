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
 * - Maternelle : feuilles "Maternelle 1" et "Maternelle 2" (une feuille par classe officielle).
 * - Primaire : feuilles CI, CP, CE1, CE2, CM1, CM2 (une feuille par classe officielle).
 * - Colonnes Excel : NPI (identification personnelle Bénin) ; le numéro Educmaster est un identifiant distinct attribué par la plateforme MEMP.
 * - Nom du fichier : NiveauScolaire_NomEcole_AnnéeScolaire.xlsx
 *   Ex. : Maternelle_École_Sainte_Marie_2024-2025.xlsx
 *
 * ⭐ Résolution du SchoolLevel :
 *   - Le frontend envoie `code` (MATERNELLE/PRIMAIRE/SECONDAIRE) — méthode fiable
 *     qui évite toute ambiguïté entre education_levels.id et school_levels.id.
 *   - En fallback, `schoolLevelId` est accepté (UUID de school_levels).
 *
 * ⭐ Récupération des élèves :
 *   - On interroge StudentEnrollment par (tenantId, academicYearId, schoolLevelId).
 *     C'est la source de vérité : l'inscription porte le niveau scolaire ET la
 *     classe officielle (academicClassId).
 *   - On groupe ensuite par AcademicClass (une feuille Excel par classe officielle).
 *   - Les élèves sans academicClassId vont dans une feuille « Non classés ».
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import {
  officialEnrollmentStatusFilter,
} from '../../common/constants/official-list-statuses';

/** Définition d'une colonne du fichier Educmaster (ordre et libellé exact pour emp.educmaster.bj) */
export interface EducmasterColumn {
  key: string;
  label: string;
}

/**
 * Colonnes officielles du modèle Excel Educmaster (emp.educmaster.bj) — exactement dans cet ordre.
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
  /** UUID de school_levels (fallback, si code absent). */
  schoolLevelId?: string;
  /** Code du niveau (MATERNELLE / PRIMAIRE / SECONDAIRE) — méthode recommandée. */
  code?: string;
  /** Colonnes personnalisées (optionnel, sinon EDUCMASTER_EXCEL_COLUMNS) */
  columns?: EducmasterColumn[];
}

export interface EducmasterExcelExportResult {
  buffer: Buffer;
  filename: string;
  sheetNames: string[];
}

interface StudentRow {
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
}

@Injectable()
export class EducmasterExcelExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un fichier Excel Educmaster avec une feuille par classe OFFICIELLE (AcademicClass)
   * du niveau demandé. Les élèves sans classe officielle vont dans une feuille « Non classés ».
   *
   * ⭐ IMPORTANT : On regroupe par CLASSE OFFICIELLE (AcademicClass), pas par classe physique (Class).
   * Tous les élèves d'une classe officielle (ex: "CE1") sont regroupés dans la même feuille,
   * quelle que soit leur section physique (CE1-A, CE1-B, etc.).
   */
  async generateWorkbook(options: EducmasterExcelExportOptions): Promise<EducmasterExcelExportResult> {
    const { tenantId, academicYearId, code, schoolLevelId } = options;
    const columns = options.columns ?? EDUCMASTER_EXCEL_COLUMNS;

    // ⭐ 1. Résoudre le SchoolLevel — par code (préféré) ou par id (fallback).
    // Le code est la méthode fiable : élimine l'ambiguïté education_levels.id vs school_levels.id.
    const schoolLevel = await this.resolveSchoolLevel(tenantId, code, schoolLevelId);
    if (!schoolLevel) {
      throw new NotFoundException(
        `Niveau scolaire non trouvé${code ? ` (code=${code})` : ''}${schoolLevelId ? ` (id=${schoolLevelId})` : ''}`,
      );
    }

    const [academicYear, tenant] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { schools: true },
      }),
    ]);

    // ⭐ 2. Récupérer TOUTES les inscriptions pour ce niveau + cette année.
    // StudentEnrollment porte schoolLevelId directement — c'est la source de vérité.
    // ⭐ FIX 2026-11-16 (1.0.15, retour promoteur CSPEB) : la liste officielle
    //    (« templates Educ Master ») n'inclut que les élèves ACTIFS et ADMIS
    //    (ACTIVE/ADMITTED/RE_ENROLLED/PROMOTED/ENROLLED/VALIDATED) — les abandons
    //    (WITHDRAWN), transferts, exclusions, sorties de fin d'année, dossiers
    //    PENDING et pré-inscriptions sont EXCLUS. PENDING était inclus avant.
    //    Double garde : statut d'inscription + statut de l'élève (anti
    //    dé-synchronisation des flux bulk-status/PUT qui ne touchent que Student).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        schoolLevelId: schoolLevel.id,
        ...officialEnrollmentStatusFilter(),
      },
      include: {
        academicClass: true,
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

    if (enrollments.length === 0) {
      throw new NotFoundException(
        `Aucun élève trouvé pour ce niveau (année ${academicYearId}, niveau ${schoolLevel.code}). Vérifiez que des élèves sont inscrits à ce niveau pour cette année scolaire.`,
      );
    }

    // ⭐ 3. Récupérer les responsables de TOUS les élèves en une seule requête.
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const guardianLinks = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      include: { guardian: true },
    });
    const guardiansByStudent = new Map<string, StudentRow['guardians']>();
    for (const sg of guardianLinks) {
      const list = guardiansByStudent.get(sg.studentId) ?? [];
      list.push({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        firstName: sg.guardian.firstName,
        lastName: sg.guardian.lastName,
        phone: sg.guardian.phone,
        address: sg.guardian.address,
      });
      guardiansByStudent.set(sg.studentId, list);
    }

    // ⭐ 4. Grouper par AcademicClass (une feuille Excel par classe officielle).
    // Les élèves sans academicClassId vont dans une feuille « Non classés ».
    // ⭐ FIX 2026-11-16 (1.0.17, retour promoteur CSPEB) : GARDE-FOU ANTI
    //    INTER-NIVEAUX — la feuille « Maternelle 2 » était apparue dans le
    //    fichier PRIMAIRE (et « CI » dans le fichier maternelle) car certaines
    //    inscriptions portaient un schoolLevelId (niveau de la requête) ≠
    //    niveau réel de leur classe officielle. On mappe donc chaque classe
    //    officielle vers le niveau de ses classes physiques (via
    //    Class.officialClassId → SchoolLevel) : une inscription dont la classe
    //    officielle appartient à un AUTRE niveau que celui du fichier part
    //    dans « Non classés » (visible) au lieu de polluter une feuille
    //    inter-niveaux — le fichier d'un niveau ne contient plus QUE les
    //    classes de ce niveau.
    const physicalClasses = await this.prisma.class.findMany({
      where: { tenantId, academicYearId, officialClassId: { not: null } },
      select: {
        officialClassId: true,
        schoolLevel: { select: { code: true } },
      },
    });
    const officialClassLevel = new Map<string, string>();
    for (const c of physicalClasses) {
      if (c.officialClassId && c.schoolLevel?.code && !officialClassLevel.has(c.officialClassId)) {
        officialClassLevel.set(c.officialClassId, c.schoolLevel.code);
      }
    }
    const groups = new Map<string, { academicClass: { id: string; name: string; code: string } | null; students: StudentRow[] }>();
    const seenStudentIds = new Set<string>(); // Évite les doublons si un élève a 2 inscriptions

    for (const e of enrollments) {
      if (seenStudentIds.has(e.studentId)) continue;
      seenStudentIds.add(e.studentId);

      // Niveau réel de la classe officielle — si connu ET différent du niveau
      // du fichier → « Non classés » (l'élève reste visible, la feuille reste
      // homogène par niveau).
      const officialLevelCode = e.academicClassId
        ? officialClassLevel.get(e.academicClassId)
        : undefined;
      const levelMismatch =
        !!officialLevelCode && officialLevelCode.toUpperCase() !== schoolLevel.code.toUpperCase();
      const key = e.academicClassId && !levelMismatch ? e.academicClassId : '__NO_CLASS__';
      if (!groups.has(key)) {
        groups.set(key, {
          academicClass:
            key !== '__NO_CLASS__' && e.academicClass
              ? { id: e.academicClass.id, name: e.academicClass.name, code: e.academicClass.code }
              : null,
          students: [],
        });
      }
      groups.get(key)!.students.push({
        student: e.student,
        guardians: guardiansByStudent.get(e.studentId) ?? [],
      });
    }

    // ⭐ 5. Trier les groupes par nom de classe officielle (les « Non classés » vont en dernier).
    const sortedGroups = [...groups.entries()].sort((a, b) => {
      if (a[0] === '__NO_CLASS__') return 1;
      if (b[0] === '__NO_CLASS__') return -1;
      const nameA = a[1].academicClass?.name || '';
      const nameB = b[1].academicClass?.name || '';
      return nameA.localeCompare(nameB, 'fr');
    });

    // ⭐ 6. Construire le workbook Excel.
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();
    const sheetNames: string[] = [];

    for (const [, group] of sortedGroups) {
      const sheetName = group.academicClass
        ? this.sanitizeSheetName(group.academicClass.name)
        : 'Non classés';
      const sheet = workbook.addWorksheet(sheetName, {
        headerFooter: {
          firstHeader: group.academicClass?.name || 'Non classés',
          firstFooter: 'Academia Helm - Export Educmaster',
        },
      });
      sheetNames.push(sheetName);
      this.writeSheet(sheet, columns, group.students);
    }

    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any);
    // ⭐ Format du nom de fichier : NomEcole_NiveauMaternelleOuPrimaire.xlsx
    // (ex. : EcoleSainteMarie_Maternelle.xlsx, EcoleSainteMarie_Primaire.xlsx)
    // L'utilisateur a demandé ce format — l'export Educmaster produit un fichier par niveau
    // (Maternelle ou Primaire), pas par classe individuelle. Le fichier contient plusieurs
    // feuilles (une par classe officielle : Maternelle 1, Maternelle 2 / CI, CP, CE1...).
    const niveauScolaire = this.fileNameSegment(
      this.levelNameForFile(schoolLevel.name || schoolLevel.code || 'Niveau'),
    );
    const nomEcole = this.fileNameSegment(
      (tenant?.schools as { name?: string } | null)?.name ?? tenant?.name ?? 'Ecole',
    );
    const filename = `${nomEcole}_${niveauScolaire}.xlsx`;

    return { buffer, filename, sheetNames };
  }

  /**
   * ⭐ 2026-10-01 — Génère un fichier Excel Educmaster SECONDAIRE.
   *
   * Format OFFICIEL du MEMP pour le secondaire : une seule feuille "Mes élèves"
   * avec une seule colonne "Matricule EducMaster". Une ligne par élève contenant
   * son matricule Educmaster (13 chiffres attribués par la plateforme MEMP).
   *
   * ⭐ Exigence : par défaut, on exporte uniquement les élèves de 6e (classe
   *    officielle "6e" / "6ème" / "6A" etc.). L'utilisateur peut cependant
   *    choisir une autre classe via le paramètre `classNameFilter`.
   *
   * ⭐ Les élèves SANS matricule Educmaster sont EXCLUS du fichier (le template
   *    ne contient que la colonne Matricule EducMaster — pas de colonne Nom).
   *
   * ⭐ Le matricule Educmaster est renseigné lors de l'inscription de l'élève
   *    (champ `educMasterMatricule` du modèle Student).
   */
  async generateSecondaireWorkbook(options: {
    tenantId: string;
    academicYearId: string;
    /** Filtre optionnel : nom de la classe officielle à inclure (ex: "6e", "6A").
     *  Par défaut, on récupère toutes les classes dont le nom commence par "6" (6e). */
    classNameFilter?: string;
  }): Promise<EducmasterExcelExportResult> {
    const { tenantId, academicYearId, classNameFilter } = options;

    // 1. Récupérer le tenant (pour le nom de fichier)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { schools: true },
    });

    // 2. Récupérer les inscriptions des élèves du niveau SECONDAIRE pour cette année.
    //    On filtre par schoolLevel.code = 'SECONDAIRE'.
    const schoolLevel = await this.prisma.schoolLevel.findFirst({
      where: {
        OR: [
          { code: { equals: 'SECONDAIRE' } },
          { code: { equals: 'SEC' } },
        ],
      },
    }).catch(() => null);

    if (!schoolLevel) {
      throw new NotFoundException(
        `Niveau scolaire SECONDAIRE non trouvé pour ce tenant. Vérifiez que le niveau secondaire est activé.`,
      );
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        schoolLevelId: schoolLevel.id,
        // ⭐ FIX 2026-11-16 (1.0.15) : élèves actifs + admis uniquement (les
        //    abandons/transferts/exclusions/sorties ne figurent plus dans
        //    l'export « Mes élèves » du MEMP).
        ...officialEnrollmentStatusFilter(),
      },
      include: {
        academicClass: { select: { id: true, name: true, code: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            educMasterMatricule: true,
          },
        },
      },
    });

    if (enrollments.length === 0) {
      throw new NotFoundException(
        `Aucun élève du secondaire trouvé pour cette année scolaire.`,
      );
    }

    // 3. Filtrer par nom de classe si demandé (par défaut : "6e" → commence par "6")
    const filter = (classNameFilter || '6').trim().toLowerCase();
    const filterDigits = filter.replace(/\D/g, '');
    const filteredEnrollments = enrollments.filter(e => {
      const className = (e.academicClass?.name || '').toLowerCase();
      // Si l'utilisateur a tapé "6e" ou "6", on accepte les classes qui commencent par "6"
      // (6e A, 6e B, 6ème 1, etc.). Si l'utilisateur a tapé un nom complet, on fait un match exact.
      if (filterDigits && filter.length <= 3) {
        // Court filtre (ex: "6", "6e") → matche le préfixe numérique
        return className.startsWith(filterDigits);
      }
      // Filtre long → match exact ou startsWith
      return className === filter || className.startsWith(filter);
    });

    if (filteredEnrollments.length === 0) {
      const availableClasses = Array.from(new Set(enrollments.map(e => e.academicClass?.name).filter(Boolean)));
      throw new NotFoundException(
        `Aucun élève trouvé pour le filtre "${classNameFilter}". Classes disponibles : ${availableClasses.join(', ')}.`,
      );
    }

    // 4. Garder uniquement les élèves qui ONT un matricule Educmaster.
    //    L'ordre des inscriptions est conservé pour le tri par nom de classe.
    const studentsWithMatricule = filteredEnrollments
      .filter(e => e.student.educMasterMatricule && e.student.educMasterMatricule.trim() !== '')
      .map(e => ({
        educMasterMatricule: e.student.educMasterMatricule!.trim(),
        className: e.academicClass?.name || '',
        studentName: `${e.student.firstName || ''} ${e.student.lastName || ''}`.trim(),
      }));

    // ⭐ Tri : par nom de classe puis par matricule (ordre croissant)
    studentsWithMatricule.sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className, 'fr');
      return a.educMasterMatricule.localeCompare(b.educMasterMatricule);
    });

    if (studentsWithMatricule.length === 0) {
      const totalWithoutMatricule = filteredEnrollments.length;
      throw new NotFoundException(
        `Aucun élève de ${classNameFilter || '6e'} n'a de matricule Educmaster renseigné. ` +
        `${totalWithoutMatricule} élèves trouvés mais aucun avec matricule. ` +
        `Veuillez renseigner le numéro Educmaster de chaque élève lors de son inscription ` +
        `(onglet Inscriptions → Étape 1 : Identité → champ "Numéro Educmaster").`,
      );
    }

    // 5. Construire le workbook avec une seule feuille "Mes élèves"
    //    et une seule colonne "Matricule EducMaster".
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Mes élèves', {
      headerFooter: {
        firstHeader: 'Export Educmaster — Secondaire',
        firstFooter: 'Academia Helm - Export Educmaster',
      },
      // ⭐ Largeur de la colonne A : 25 caractères pour afficher le matricule complet
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // ⭐ Largeur de la colonne A
    sheet.columns = [
      { width: 25 },
    ];

    // En-tête : "Matricule EducMaster" (cellule A1)
    const headerCell = sheet.getCell(1, 1);
    headerCell.value = 'Matricule EducMaster';
    headerCell.font = { bold: true, size: 11 };
    headerCell.alignment = { horizontal: 'left', vertical: 'middle' };
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A2A5E' },  // navy Academia Helm
    };
    headerCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };

    // Données : un matricule par ligne (à partir de la ligne 2)
    for (let i = 0; i < studentsWithMatricule.length; i++) {
      const cell = sheet.getCell(i + 2, 1);
      // ⭐ Important : stocker comme STRING (et non number) car le matricule
      //    peut dépasser la limite des nombres Excel (13 chiffres = OK en number
      //    mais en string c'est plus sûr pour préserver les zéros en tête si
      //    une école utilise des matricules plus courts).
      cell.value = studentsWithMatricule[i].educMasterMatricule;
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      // Format texte pour éviter la conversion automatique en notation scientifique
      cell.numFmt = '@';
    }

    // Bordure autour du tableau
    sheet.getCell(1, 1).border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
    for (let i = 2; i <= studentsWithMatricule.length + 1; i++) {
      sheet.getCell(i, 1).border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    }

    // 6. Générer le buffer
    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any);

    // 7. Nom du fichier : NomEcole_Secondaire_{classe}.xlsx
    const niveauScolaire = this.fileNameSegment('Secondaire');
    const classeSeg = this.fileNameSegment(classNameFilter || '6e');
    const nomEcole = this.fileNameSegment(
      (tenant?.schools as { name?: string } | null)?.name ?? tenant?.name ?? 'Ecole',
    );
    const filename = `${nomEcole}_${niveauScolaire}_${classeSeg}.xlsx`;

    return {
      buffer,
      filename,
      sheetNames: ['Mes élèves'],
    };
  }

  /**
   * ⭐ Génère un fichier Excel GLOBAL avec TOUTES les classes officielles de TOUTES les niveaux.
   * Une feuille par classe officielle, triées par niveau puis par nom de classe.
   * Utilisé par le bouton "Excel global" dans l'onglet Inscriptions.
   */
  async generateGlobalWorkbook(options: {
    tenantId: string;
    academicYearId: string;
  }): Promise<EducmasterExcelExportResult> {
    const { tenantId, academicYearId } = options;
    const columns = EDUCMASTER_EXCEL_COLUMNS;

    // 1. Récupérer TOUTES les classes officielles (AcademicClass) de ce tenant pour cette année
    const academicClasses = await this.prisma.academicClass.findMany({
      where: {
        tenantId,
        academicYearId,
        isActive: true,
      },
      include: {
        level: true,
      },
      orderBy: [
        { level: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    if (academicClasses.length === 0) {
      throw new NotFoundException(
        `Aucune classe officielle trouvée pour cette année scolaire.`,
      );
    }

    // 2. Récupérer le branding et l'année scolaire
    const [tenant, academicYear] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { schools: true },
      }),
      this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      }),
    ]);

    // 3. Récupérer TOUTES les inscriptions pour cette année
    // ⭐ FIX 2026-11-16 (1.0.15) : liste officielle = actifs + admis uniquement
    //    (l'ancien notIn ['WITHDRAWN','TRANSFERRED'] laissait passer EXCLUDED,
    //    COMPLETED, PENDING, PRE_REGISTERED — et ne contrôlait pas Student.status).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        ...officialEnrollmentStatusFilter(),
      },
      include: {
        academicClass: true,
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

    // 4. Récupérer les responsables de TOUS les élèves
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const guardianLinks = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      include: { guardian: true },
    });
    const guardiansByStudent = new Map<string, StudentRow['guardians']>();
    for (const sg of guardianLinks) {
      const list = guardiansByStudent.get(sg.studentId) ?? [];
      list.push({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        firstName: sg.guardian.firstName,
        lastName: sg.guardian.lastName,
        phone: sg.guardian.phone,
        address: sg.guardian.address,
      });
      guardiansByStudent.set(sg.studentId, list);
    }

    // 5. Grouper les élèves par classe officielle
    const studentsByClass = new Map<string, StudentRow[]>();
    const seen = new Set<string>();
    for (const e of enrollments) {
      if (seen.has(e.studentId)) continue;
      seen.add(e.studentId);
      const classId = e.academicClassId || '__NO_CLASS__';
      if (!studentsByClass.has(classId)) studentsByClass.set(classId, []);
      studentsByClass.get(classId)!.push({
        student: {
          id: e.student.id,
          studentCode: e.student.studentCode,
          firstName: e.student.firstName,
          lastName: e.student.lastName,
          dateOfBirth: e.student.dateOfBirth,
          gender: e.student.gender,
          placeOfBirth: e.student.placeOfBirth,
          nationality: e.student.nationality,
          npi: e.student.npi,
        },
        guardians: guardiansByStudent.get(e.studentId) ?? [],
      });
    }

    // 6. Construire le workbook avec une feuille par classe
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();
    const sheetNames: string[] = [];

    for (const ac of academicClasses) {
      const students = studentsByClass.get(ac.id) || [];
      if (students.length === 0) continue; // Skip empty classes
      const sheetName = this.sanitizeSheetName(ac.name);
      const sheet = workbook.addWorksheet(sheetName);
      sheetNames.push(sheetName);
      this.writeSheet(sheet, columns, students);
    }

    // Ajouter une feuille "Non classés" si des élèves n'ont pas de classe officielle
    const unassigned = studentsByClass.get('__NO_CLASS__') || [];
    if (unassigned.length > 0) {
      const sheet = workbook.addWorksheet('Non classés');
      sheetNames.push('Non classés');
      this.writeSheet(sheet, columns, unassigned);
    }

    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any);
    const nomEcole = this.fileNameSegment(
      (tenant?.schools as { name?: string } | null)?.name ?? tenant?.name ?? 'Ecole',
    );
    const anneeScolaire = this.fileNameSegment(
      academicYear?.name || academicYear?.label || new Date().getFullYear().toString(),
    );
    const filename = `${nomEcole}_ToutesClasses_${anneeScolaire}.xlsx`;

    return { buffer, filename, sheetNames };
  }

  /**
   * ⭐ Génère un fichier Excel pour UNE seule classe officielle (AcademicClass).
   * Une seule feuille avec les élèves de cette classe.
   * Utilisé par le bouton Excel à côté de chaque classe dans l'onglet Inscriptions.
   */
  async generateWorkbookForSingleClass(options: {
    tenantId: string;
    academicYearId: string;
    classId: string;
  }): Promise<EducmasterExcelExportResult> {
    const { tenantId, academicYearId, classId } = options;
    const columns = EDUCMASTER_EXCEL_COLUMNS;

    // 1. Récupérer la classe officielle (AcademicClass)
    const ac = await this.prisma.academicClass.findFirst({
      where: { id: classId, tenantId },
      include: {
        level: true,
        academicYear: true,
      },
    });
    if (!ac) {
      throw new NotFoundException('Classe officielle non trouvée');
    }

    // 2. Récupérer les élèves de cette classe officielle
    // ⭐ FIX 2026-11-16 (1.0.15) : liste officielle = actifs + admis uniquement
    //    (+ garde Student.status — cf. official-list-statuses.ts).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicClassId: classId,
        academicYearId,
        ...officialEnrollmentStatusFilter(),
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
      orderBy: { student: { lastName: 'asc' } },
    });

    // 3. Récupérer les responsables
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const guardianLinks = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      include: { guardian: true },
    });
    const guardiansByStudent = new Map<string, StudentRow['guardians']>();
    for (const sg of guardianLinks) {
      const list = guardiansByStudent.get(sg.studentId) ?? [];
      list.push({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        firstName: sg.guardian.firstName,
        lastName: sg.guardian.lastName,
        phone: sg.guardian.phone,
        address: sg.guardian.address,
      });
      guardiansByStudent.set(sg.studentId, list);
    }

    // 4. Construire les StudentRow
    const seen = new Set<string>();
    const students: StudentRow[] = enrollments
      .filter((e) => {
        if (seen.has(e.studentId)) return false;
        seen.add(e.studentId);
        return true;
      })
      .map((e) => ({
        student: {
          id: e.student.id,
          studentCode: e.student.studentCode,
          firstName: e.student.firstName,
          lastName: e.student.lastName,
          dateOfBirth: e.student.dateOfBirth,
          gender: e.student.gender,
          placeOfBirth: e.student.placeOfBirth,
          nationality: e.student.nationality,
          npi: e.student.npi,
        },
        guardians: guardiansByStudent.get(e.studentId) ?? [],
      }));

    if (students.length === 0) {
      throw new NotFoundException(
        `Aucun élève trouvé dans la classe "${ac.name}" pour cette année.`,
      );
    }

    // 5. Récupérer le branding pour le nom de fichier
    const [tenant, academicYear] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { schools: true },
      }),
      this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      }),
    ]);

    // 6. Construire le workbook avec une seule feuille
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();
    const sheetName = this.sanitizeSheetName(ac.name);
    const sheet = workbook.addWorksheet(sheetName);
    this.writeSheet(sheet, columns, students);

    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any);
    const nomEcole = this.fileNameSegment(
      (tenant?.schools as { name?: string } | null)?.name ?? tenant?.name ?? 'Ecole',
    );
    const nomClasse = this.fileNameSegment(ac.name);
    const anneeScolaire = this.fileNameSegment(
      academicYear?.name || academicYear?.label || new Date().getFullYear().toString(),
    );
    const filename = `${nomEcole}_${nomClasse}_${anneeScolaire}.xlsx`;

    return { buffer, filename, sheetNames: [sheetName] };
  }

  /**
   * ⭐ Génère un fichier Excel pour UNE classe PHYSIQUE (Class, section réelle).
   * Une seule feuille avec les élèves de cette section.
   * Utilisé par le bouton Excel à côté de chaque classe dans l'onglet "Liste des Élèves".
   */
  async generateWorkbookForSinglePhysicalClass(options: {
    tenantId: string;
    academicYearId: string;
    classId: string;
  }): Promise<EducmasterExcelExportResult> {
    const { tenantId, academicYearId, classId } = options;
    const columns = EDUCMASTER_EXCEL_COLUMNS;

    // 1. Récupérer la classe physique (Class)
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
        officialClass: true,
      },
    });
    if (!cls) {
      throw new NotFoundException('Classe physique non trouvée');
    }

    // 2. Récupérer les élèves de cette classe physique
    // ⭐ FIX 2026-11-16 (1.0.15) : liste officielle = actifs + admis uniquement
    //    (+ garde Student.status — cf. official-list-statuses.ts).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        classId,
        academicYearId,
        ...officialEnrollmentStatusFilter(),
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
      orderBy: { student: { lastName: 'asc' } },
    });

    // 3. Récupérer les responsables
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const guardianLinks = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      include: { guardian: true },
    });
    const guardiansByStudent = new Map<string, StudentRow['guardians']>();
    for (const sg of guardianLinks) {
      const list = guardiansByStudent.get(sg.studentId) ?? [];
      list.push({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        firstName: sg.guardian.firstName,
        lastName: sg.guardian.lastName,
        phone: sg.guardian.phone,
        address: sg.guardian.address,
      });
      guardiansByStudent.set(sg.studentId, list);
    }

    // 4. Construire les StudentRow
    const seen = new Set<string>();
    const students: StudentRow[] = enrollments
      .filter((e) => {
        if (seen.has(e.studentId)) return false;
        seen.add(e.studentId);
        return true;
      })
      .map((e) => ({
        student: {
          id: e.student.id,
          studentCode: e.student.studentCode,
          firstName: e.student.firstName,
          lastName: e.student.lastName,
          dateOfBirth: e.student.dateOfBirth,
          gender: e.student.gender,
          placeOfBirth: e.student.placeOfBirth,
          nationality: e.student.nationality,
          npi: e.student.npi,
        },
        guardians: guardiansByStudent.get(e.studentId) ?? [],
      }));

    if (students.length === 0) {
      throw new NotFoundException(
        `Aucun élève trouvé dans la section "${cls.name}" pour cette année.`,
      );
    }

    // 5. Récupérer le branding
    const [tenant, academicYear] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { schools: true },
      }),
      this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      }),
    ]);

    // 6. Construire le workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();
    const sheetName = this.sanitizeSheetName(cls.name);
    const sheet = workbook.addWorksheet(sheetName);
    this.writeSheet(sheet, columns, students);

    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any);
    const nomEcole = this.fileNameSegment(
      (tenant?.schools as { name?: string } | null)?.name ?? tenant?.name ?? 'Ecole',
    );
    const nomClasse = this.fileNameSegment(cls.name);
    const anneeScolaire = this.fileNameSegment(
      academicYear?.name || academicYear?.label || new Date().getFullYear().toString(),
    );
    const filename = `${nomEcole}_${nomClasse}_${anneeScolaire}.xlsx`;

    return { buffer, filename, sheetNames: [sheetName] };
  }

  /**
   * ⭐ Génère un fichier Excel GLOBAL avec TOUTES les classes PHYSIQUES (sections).
   * Une feuille par section physique, triées par niveau puis par nom.
   * Utilisé par le bouton "Excel global" dans l'onglet "Liste des Élèves".
   */
  async generateGlobalPhysicalWorkbook(options: {
    tenantId: string;
    academicYearId: string;
  }): Promise<EducmasterExcelExportResult> {
    const { tenantId, academicYearId } = options;
    const columns = EDUCMASTER_EXCEL_COLUMNS;

    // 1. Récupérer TOUTES les classes physiques (Class) de ce tenant pour cette année
    const physicalClasses = await this.prisma.class.findMany({
      where: { tenantId, academicYearId },
      include: {
        schoolLevel: true,
      },
      orderBy: [
        { schoolLevel: { order: 'asc' } },
        { name: 'asc' },
      ],
    });

    if (physicalClasses.length === 0) {
      throw new NotFoundException(
        `Aucune classe physique trouvée pour cette année scolaire.`,
      );
    }

    // 2. Récupérer le branding et l'année
    const [tenant, academicYear] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { schools: true },
      }),
      this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      }),
    ]);

    // 3. Récupérer TOUTES les inscriptions
    // ⭐ FIX 2026-11-16 (1.0.15) : liste officielle = actifs + admis uniquement
    //    (+ garde Student.status — cf. official-list-statuses.ts).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        ...officialEnrollmentStatusFilter(),
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

    // 4. Récupérer les responsables
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const guardianLinks = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      include: { guardian: true },
    });
    const guardiansByStudent = new Map<string, StudentRow['guardians']>();
    for (const sg of guardianLinks) {
      const list = guardiansByStudent.get(sg.studentId) ?? [];
      list.push({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        firstName: sg.guardian.firstName,
        lastName: sg.guardian.lastName,
        phone: sg.guardian.phone,
        address: sg.guardian.address,
      });
      guardiansByStudent.set(sg.studentId, list);
    }

    // 5. Grouper par classe physique (classId)
    const studentsByClass = new Map<string, StudentRow[]>();
    const seen = new Set<string>();
    for (const e of enrollments) {
      if (seen.has(e.studentId)) continue;
      seen.add(e.studentId);
      const classId = e.classId || '__NO_CLASS__';
      if (!studentsByClass.has(classId)) studentsByClass.set(classId, []);
      studentsByClass.get(classId)!.push({
        student: {
          id: e.student.id,
          studentCode: e.student.studentCode,
          firstName: e.student.firstName,
          lastName: e.student.lastName,
          dateOfBirth: e.student.dateOfBirth,
          gender: e.student.gender,
          placeOfBirth: e.student.placeOfBirth,
          nationality: e.student.nationality,
          npi: e.student.npi,
        },
        guardians: guardiansByStudent.get(e.studentId) ?? [],
      });
    }

    // 6. Construire le workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();
    const sheetNames: string[] = [];

    for (const cls of physicalClasses) {
      const students = studentsByClass.get(cls.id) || [];
      if (students.length === 0) continue;
      const sheetName = this.sanitizeSheetName(cls.name);
      const sheet = workbook.addWorksheet(sheetName);
      sheetNames.push(sheetName);
      this.writeSheet(sheet, columns, students);
    }

    const unassigned = studentsByClass.get('__NO_CLASS__') || [];
    if (unassigned.length > 0) {
      const sheet = workbook.addWorksheet('Non affectés');
      sheetNames.push('Non affectés');
      this.writeSheet(sheet, columns, unassigned);
    }

    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any);
    const nomEcole = this.fileNameSegment(
      (tenant?.schools as { name?: string } | null)?.name ?? tenant?.name ?? 'Ecole',
    );
    const anneeScolaire = this.fileNameSegment(
      academicYear?.name || academicYear?.label || new Date().getFullYear().toString(),
    );
    const filename = `${nomEcole}_ToutesSections_${anneeScolaire}.xlsx`;

    return { buffer, filename, sheetNames };
  }

  /**
   * Résout un SchoolLevel par code (préféré) ou par id (fallback).
   * Renvoie null si aucune correspondance.
   */
  private async resolveSchoolLevel(
    tenantId: string,
    code?: string,
    schoolLevelId?: string,
  ) {
    // 1. Par code (ex: MATERNELLE / PRIMAIRE / SECONDAIRE)
    if (code && code.trim()) {
      const upperCode = code.trim().toUpperCase();
      const byCode = await this.prisma.schoolLevel.findFirst({
        where: { tenantId, code: upperCode },
      });
      if (byCode) return byCode;
      // Fallback : peut-être que `code` est en fait le `name` ou `label`
      const byName = await this.prisma.schoolLevel.findFirst({
        where: {
          tenantId,
          OR: [
            { name: { equals: code, mode: 'insensitive' } },
            { label: { equals: code, mode: 'insensitive' } },
          ],
        },
      });
      if (byName) return byName;
    }
    // 2. Par id (UUID de school_levels)
    if (schoolLevelId) {
      const byId = await this.prisma.schoolLevel.findFirst({
        where: { id: schoolLevelId, tenantId },
      });
      if (byId) return byId;
    }
    return null;
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
    return (
      value
        .replace(/[/\\:*?"<>|]/g, ' ')
        .replace(/\s+/g, '_')
        .trim()
        .slice(0, 80) || 'export'
    );
  }

  private sanitizeSheetName(name: string): string {
    const sanitized = name.replace(/[\\/*?:\[\]]/g, ' ').trim();
    return sanitized.slice(0, 31) || 'Feuille';
  }

  private writeSheet(
    sheet: ExcelJS.Worksheet,
    columns: EducmasterColumn[],
    students: StudentRow[],
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
      const telParents =
        guardians
          .slice()
          .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
          .map((g) => g.phone)
          .filter(Boolean)
          .join(' / ') || '';

      const row: Record<string, string | number | null | undefined> = {};
      for (const col of columns) {
        switch (col.key) {
          case 'nom':
            row[col.label] = (student.lastName ?? '').toUpperCase();
            break;
          case 'prenom':
            row[col.label] = student.firstName ?? '';
            break;
          case 'sexe':
            row[col.label] =
              student.gender === 'M' ? 'M' : student.gender === 'F' ? 'F' : (student.gender ?? '');
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
            row[col.label] = student.npi ?? '';
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
