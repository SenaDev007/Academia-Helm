/**
 * ============================================================================
 * EDUC MASTER IMPORT SERVICE — Remplissage du template Excel du MEMP
 * ============================================================================
 *
 * Service qui prend un fichier Excel template Educ Master (téléchargé depuis
 * emp.educmaster.bj) et le remplit avec les notes des élèves stockées dans
 * notre système.
 *
 * Deux formats supportés :
 *
 * 1. FORMAT SECONDAIRE — une feuille par matière (ex: "ANGLAIS", "MATHS GENE",
 *    "FRANCAIS LECTURE", "Conduite"...). Chaque feuille contient :
 *    Matricule | Nom | Prénoms | Moy. interro | Devoir 1 | Devoir 2
 *    → "Moy. interro" = moyenne de IE1 + IE2 (Interrogations Écrites)
 *    → "Devoir 1" = DS1 (Devoir Surveillé 1)
 *    → "Devoir 2" = DS2 (Devoir Surveillé 2)
 *
 * 2. FORMAT PRIMAIRE — une seule feuille "Notes - {Classe}" avec colonnes
 *    fusionnées par matière (Dictée, Math, Expression écrite, etc.), chaque
 *    matière ayant 2 colonnes : "Note obtenue" et "Note perfectionnement".
 *    → "Note obtenue" = score brut de l'élève pour cette matière sur le
 *      trimestre sélectionné (max 20 pour primaire francophone).
 *    → "Note perfectionnement" = score CP (Contrôle Ponctuel /2) — bonus.
 *
 * Mapping matière Educ Master → Subject de notre système :
 *   - "FRANCAIS LECTURE" → "Lecture" / "Français Lecture"
 *   - "FRANCAIS COM. ECRITE" → "Expression écrite" / "Français Com. Écrite"
 *   - "MATHS GENE" → "Mathématiques" / "Maths"
 *   - "ANGLAIS" → "Anglais"
 *   - "HIST-GEO" → "Histoire-Géographie"
 *   - "PCT" → "PCT" / "Physique-Chimie"
 *   - "SVT" → "SVT" / "Sciences de la Vie et de la Terre"
 *   - "EPS" → "EPS" / "Éducation Physique et Sportive"
 *   - "EA (Oral)" → "EA vivant" / "Éducation Artistique vivant"
 *   - "EA (Dessin/Couture)" → "EA plastique" / "Éducation Artistique plastique"
 *   - "EST" → "EST" / "Éducation Scientifique et Technologique"
 *   - "ES" → "ES" / "Éducation Sociale"
 *
 * ⭐ Tolérance du mapping des noms : algorithme de similarité Levenshtein
 *    (distance d'édition normalisée). Si deux noms sont similaires mais non
 *    identiques (ex: "ABDOULAYE Adjahou" vs "ABDOULAYE Adjahou Mirshadath"),
 *    l'utilisateur peut valider manuellement "oui c'est la même personne".
 *
 * ⭐ Pour les élèves non trouvés dans le fichier Excel (présents dans notre
 *    système mais pas dans le fichier) → on les signale pour que l'école
 *    puisse les ajouter manuellement au template Educ Master.
 *
 * ⭐ Pour les élèves du fichier non trouvés dans notre système → on les
 *    signale aussi (sont-ils désinscrits ? nom mal saisi ?).
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseResult {
  format: 'secondaire' | 'primaire';
  sheets: SheetInfo[];
  students: ExcelStudent[];
  warnings: string[];
}

export interface SheetInfo {
  name: string;
  /** For secondaire: the subject name (e.g. "ANGLAIS"); for primaire: the class name (e.g. "Notes - CI") */
  subject?: string;
  columns: string[];
  rowCount: number;
}

export interface ExcelStudent {
  row: number;
  sheetName: string;  // For secondaire, all sheets have the same students; for primaire, the sheet is the class sheet
  matricule: string;
  nom: string;
  prenoms: string;
}

export interface OurStudent {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** The student's enrollment classId for grade lookup */
  classId: string | null;
  academicClassId: string | null;
}

export interface MatchResult {
  excel: ExcelStudent;
  our: OurStudent | null;
  /** Confidence score 0-1; 1 = exact match, 0.85 = matricule match, 0.7+ = fuzzy name match */
  confidence: number;
  /** Reason for the match: "matricule" | "exact_name" | "fuzzy_name" | "no_match" */
  reason: string;
  /** Whether the user has manually validated this match */
  manualValidated: boolean;
}

export interface FillOptions {
  tenantId: string;
  academicYearId: string;
  classId: string;
  periodId: string;
  level: 'PRIMAIRE' | 'SECONDAIRE';
  /** Mapping { excelMatricule: ourStudentId } — for validated manual matches */
  studentMapping: Record<string, string>;
}

// ─── Subject mapping (Educ Master sheet/column name → our subject codes) ─

const SUBJECT_MAPPING: Array<{ patterns: string[]; subjectCodes: string[]; subjectNames: string[] }> = [
  // Français (primaire + secondaire)
  {
    patterns: ['francais lecture', 'lecture', 'francais l.', 'fr. lecture'],
    subjectCodes: ['FR_LECT', 'LECTURE', 'FR_LEC'],
    subjectNames: ['Lecture', 'Français Lecture', 'Français - Lecture'],
  },
  {
    patterns: ['francais com. ecrite', 'expression ecrite', 'francais c.e.', 'expression écrite', 'francais com ecrite', 'francais com. e'],
    subjectCodes: ['FR_ECR', 'EXP_ECR', 'FR_CE'],
    subjectNames: ['Expression écrite', 'Français Com. Écrite', 'Français - Com. Écrite', 'Français Com. Ecrite'],
  },
  {
    patterns: ['francais', 'francais c.', 'francais l.'],
    subjectCodes: ['FR', 'FRANCAIS'],
    subjectNames: ['Français', 'Francais'],
  },
  // Mathématiques
  {
    patterns: ['maths gene', 'math', 'mathematiques', 'maths', 'maths générales', 'maths g.'],
    subjectCodes: ['MATH', 'MATHS', 'MATH_GEN', 'MAT'],
    subjectNames: ['Mathématiques', 'Mathematiques', 'Maths', 'Maths Générales', 'Math', 'Maths Gene'],
  },
  // Anglais
  {
    patterns: ['anglais', 'english', 'angl'],
    subjectCodes: ['ANG', 'ANGLAIS', 'EN'],
    subjectNames: ['Anglais', 'English'],
  },
  // Histoire-Géographie
  {
    patterns: ['hist-geo', 'hist geo', 'histoire-geographie', 'hg', 'histoire géographie', 'hist/geo'],
    subjectCodes: ['HG', 'HIST_GEO', 'HIST-GEO'],
    subjectNames: ['Histoire-Géographie', 'Histoire Géographie', 'Hist-Geo', 'Hist Geo', 'HG'],
  },
  // PCT (Physique-Chimie-Technologie)
  {
    patterns: ['pct', 'physique-chimie', 'physique chimie', 'pc'],
    subjectCodes: ['PCT', 'PC', 'PHYS_CHIM'],
    subjectNames: ['PCT', 'Physique-Chimie', 'Physique Chimie', 'PC'],
  },
  // SVT (Sciences de la Vie et de la Terre)
  {
    patterns: ['svt', 'sciences de la vie', 'biologie', 'svt '],
    subjectCodes: ['SVT', 'BIO', 'SCI_VIE'],
    subjectNames: ['SVT', 'Sciences de la Vie et de la Terre', 'Biologie', 'Sciences de la Vie'],
  },
  // EPS (Éducation Physique et Sportive)
  {
    patterns: ['eps', 'education physique', 'sport', 'ed. phys.', 'e.p.s.'],
    subjectCodes: ['EPS', 'ED_PHYS', 'SPORT'],
    subjectNames: ['EPS', 'Éducation Physique et Sportive', 'Education Physique', 'Sport'],
  },
  // EA (Oral) → Éducation Artistique vivant
  {
    patterns: ['ea (oral)', 'ea oral', 'ea vivant', 'education artistique vivant', 'ea vivant', 'e.a. (oral)', 'ea (oral)'],
    subjectCodes: ['EA_VIVANT', 'EA_ORAL', 'ED_ART_VIV'],
    subjectNames: ['EA vivant', 'Éducation Artistique vivant', 'Education Artistique vivant', 'EA (Oral)', 'EA Oral'],
  },
  // EA (Dessin/Couture) → Éducation Artistique plastique
  {
    patterns: ['ea (dessin', 'ea (dessin/couture)', 'ea dessin', 'ea couture', 'ea plastique', 'education artistique plastique', 'e.a. (dessin', 'ea (déssin'],
    subjectCodes: ['EA_PLAST', 'EA_DESSIN', 'ED_ART_PLA'],
    subjectNames: ['EA plastique', 'Éducation Artistique plastique', 'Education Artistique plastique', 'EA (Dessin/Couture)', 'EA Dessin', 'EA Couture'],
  },
  // EST (Éducation Scientifique et Technologique)
  {
    patterns: ['est', 'education scientifique', 'ed. sci. tech', 'e.s.t.'],
    subjectCodes: ['EST', 'ED_SCI_TECH'],
    subjectNames: ['EST', 'Éducation Scientifique et Technologique', 'Education Scientifique'],
  },
  // ES (Éducation Sociale / Éducation à la citoyenneté)
  {
    patterns: [' es', 'education sociale', 'ed. soc', 'e.s.', 'education a la citoyennete'],
    subjectCodes: ['ES', 'ED_SOC'],
    subjectNames: ['ES', 'Éducation Sociale', 'Education Sociale'],
  },
  // Conduite
  {
    patterns: ['conduite', 'conduct'],
    subjectCodes: ['CONDUITE', 'CONDUCT'],
    subjectNames: ['Conduite', 'Conduct'],
  },
  // Dictée (primaire)
  {
    patterns: ['dictée', 'dictee', 'dictation'],
    subjectCodes: ['DICTEE', 'DICT'],
    subjectNames: ['Dictée', 'Dictee', 'Dictation'],
  },
  // Compréhension de l'écrit
  {
    patterns: ['compréhension de l', 'comprehension de l', 'comprehension ecrit', 'compréhension écrit'],
    subjectCodes: ['COMP_ECR', 'COMPR'],
    subjectNames: ['Compréhension de l\'écrit', 'Comprehension de l\'écrit', 'Compréhension Écrit'],
  },
];

// ─── Service ────────────────────────────────────────────────────────────

@Injectable()
export class EducMasterService {
  private readonly logger = new Logger(EducMasterService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── PARSE: read uploaded Excel and extract student list + sheet info ──

  async parseExcel(buffer: Buffer): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheetNames = workbook.worksheets.map(ws => ws.name);
    const warnings: string[] = [];

    // Detect format
    let format: 'secondaire' | 'primaire';
    if (sheetNames.length > 1 && sheetNames.some(n => n.toLowerCase() !== 'conduite')) {
      // Multiple subject sheets → secondaire format
      format = 'secondaire';
    } else if (sheetNames.length === 1 && sheetNames[0].toLowerCase().startsWith('notes -')) {
      // Single "Notes - {Classe}" sheet → primaire format
      format = 'primaire';
    } else if (sheetNames.length === 1) {
      // Single sheet of unknown name → guess primaire
      format = 'primaire';
      warnings.push(`Format incertain — feuille unique "${sheetNames[0]}" détectée, supposé format primaire.`);
    } else {
      throw new BadRequestException(
        `Format non reconnu : ${sheetNames.length} feuilles, première = "${sheetNames[0]}". ` +
        `Formats supportés : (1) plusieurs feuilles par matière (secondaire) ou (2) une feuille "Notes - {Classe}" (primaire).`
      );
    }

    const sheets: SheetInfo[] = [];
    const studentsMap = new Map<string, ExcelStudent>();  // dedup by matricule

    for (const ws of workbook.worksheets) {
      const sheetName = ws.name;
      const columns: string[] = [];
      // Read header row 1
      for (let col = 1; col <= ws.columnCount; col++) {
        const cell = ws.getCell(1, col);
        const val = cell.value;
        if (val !== null && val !== undefined) {
          columns.push(String(val).trim());
        } else {
          columns.push('');
        }
      }

      // For secondaire: subject is the sheet name (excluding "Conduite")
      // For primaire: subject is in the column header (merged cells)
      let subject: string | undefined;
      if (format === 'secondaire' && sheetName.toLowerCase() !== 'conduite') {
        subject = sheetName;
      } else if (format === 'secondaire' && sheetName.toLowerCase() === 'conduite') {
        subject = 'Conduite';
      }

      sheets.push({
        name: sheetName,
        subject,
        columns: columns.filter(c => c),
        rowCount: ws.rowCount,
      });

      // Extract students from rows 2..N
      for (let row = 2; row <= ws.rowCount; row++) {
        const matriculeCell = ws.getCell(row, 1);
        const nomCell = ws.getCell(row, 2);
        const prenomsCell = ws.getCell(row, 3);
        const matricule = String(matriculeCell.value || '').trim();
        const nom = String(nomCell.value || '').trim();
        const prenoms = String(prenomsCell.value || '').trim();
        if (!matricule && !nom) continue;  // skip empty rows
        const key = matricule || `${nom}|${prenoms}`;
        if (!studentsMap.has(key)) {
          studentsMap.set(key, { row, sheetName, matricule, nom, prenoms });
        }
      }
    }

    const students = Array.from(studentsMap.values());

    return { format, sheets, students, warnings };
  }

  // ─── MATCH: match Excel students against our system students ──────────

  async matchStudents(
    tenantId: string,
    academicYearId: string,
    classId: string,
    excelStudents: ExcelStudent[],
  ): Promise<{ matches: MatchResult[]; ourStudents: OurStudent[]; unmatchedExcel: ExcelStudent[]; unmatchedOur: OurStudent[] }> {
    // Get our students enrolled in the class
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId,
        tenantId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'RE_ENROLLED', 'PROMOTED', 'PRE_REGISTERED'] },
        OR: [
          { classId },
          { academicClassId: classId },
        ],
      },
      select: { studentId: true, classId: true, academicClassId: true },
    }).catch(() => []);

    const studentIds = enrollments.map(e => e.studentId);
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, matricule: true },
    }).catch(() => []);

    const ourStudents: OurStudent[] = students.map(s => {
      const enr = enrollments.find(e => e.studentId === s.id);
      return {
        id: s.id,
        matricule: s.matricule || '',
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        classId: enr?.classId || null,
        academicClassId: enr?.academicClassId || null,
      };
    });

    const matches: MatchResult[] = [];
    const matchedOurIds = new Set<string>();

    for (const ex of excelStudents) {
      // 1. Try exact matricule match (Excel matricule may have leading apostrophe)
      const cleanExcelMat = ex.matricule.replace(/^'+/, '').trim();
      let our: OurStudent | null = null;
      let confidence = 0;
      let reason = 'no_match';

      if (cleanExcelMat) {
        our = ourStudents.find(o => o.matricule === cleanExcelMat || o.matricule.replace(/^'+/, '').trim() === cleanExcelMat) || null;
        if (our) {
          confidence = 1.0;
          reason = 'matricule';
        }
      }

      // 2. Try exact name match (last name + first name)
      if (!our) {
        const exNomLower = ex.nom.toLowerCase().trim();
        const exPrenomsLower = ex.prenoms.toLowerCase().trim();
        our = ourStudents.find(o => {
          const oLast = o.lastName.toLowerCase().trim();
          const oFirst = o.firstName.toLowerCase().trim();
          return oLast === exNomLower && (oFirst === exPrenomsLower || oFirst.startsWith(exPrenomsLower) || exPrenomsLower.startsWith(oFirst));
        }) || null;
        if (our) {
          confidence = 0.95;
          reason = 'exact_name';
        }
      }

      // 3. Fuzzy name match (Levenshtein on full name)
      if (!our) {
        const exFull = `${ex.nom} ${ex.prenoms}`.toLowerCase().trim();
        let bestScore = 0;
        let bestMatch: OurStudent | null = null;
        for (const o of ourStudents) {
          const oFull = o.fullName.toLowerCase();
          const score = this.normalizedSimilarity(exFull, oFull);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = o;
          }
        }
        if (bestMatch && bestScore >= 0.6) {
          our = bestMatch;
          confidence = bestScore;
          reason = bestScore >= 0.9 ? 'fuzzy_name_strong' : 'fuzzy_name_weak';
        }
      }

      matches.push({
        excel: ex,
        our,
        confidence,
        reason,
        manualValidated: false,
      });
      if (our) matchedOurIds.add(our.id);
    }

    const unmatchedExcel = matches.filter(m => !m.our).map(m => m.excel);
    const unmatchedOur = ourStudents.filter(o => !matchedOurIds.has(o.id));

    return { matches, ourStudents, unmatchedExcel, unmatchedOur };
  }

  // ─── FILL: fill the Excel template with grades from our system ──────────

  async fillExcel(
    buffer: Buffer,
    options: FillOptions,
  ): Promise<Buffer> {
    const { tenantId, academicYearId, classId, periodId, level, studentMapping } = options;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Resolve student mapping: { excelMatricule → ourStudentId }
    const matriculeToStudentId = new Map<string, string>();
    for (const [exMat, ourId] of Object.entries(studentMapping)) {
      matriculeToStudentId.set(exMat.replace(/^'+/, '').trim(), ourId);
    }

    // Get our students (enrolled in class)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId, tenantId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'RE_ENROLLED', 'PROMOTED', 'PRE_REGISTERED'] },
        OR: [{ classId }, { academicClassId: classId }],
      },
      select: { studentId: true, classId: true, academicClassId: true },
    }).catch(() => []);
    const studentIds = enrollments.map(e => e.studentId);

    // ⭐ Get ALL evaluations VALIDATED for this class + period
    //    Build the list of relevant classIds (physical Class.id + AcademicClass.id)
    const physicalClassIds = enrollments.map(e => e.classId).filter((id): id is string => id !== null);
    const classIdsForEvaluations = Array.from(new Set([classId, ...physicalClassIds]));

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        tenantId, academicYearId, periodId,
        status: 'VALIDATED',
        classId: { in: classIdsForEvaluations },
      },
      select: {
        id: true, subjectId: true, evaluationTypeId: true,
        evaluationType: { select: { code: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    }).catch(() => []);

    // Get all grades for these evaluations in 1 query
    const evalIds = evaluations.map(e => e.id);
    const grades = await this.prisma.grade.findMany({
      where: { evaluationId: { in: evalIds }, studentId: { in: studentIds } },
      select: { studentId: true, evaluationId: true, score: true, isAbsent: true },
    }).catch(() => []);

    // Build a lookup: { (studentId, evaluationId) → score }
    const gradeMap = new Map<string, number | null>();
    for (const g of grades) {
      if (g.isAbsent) continue;
      const key = `${g.studentId}|${g.evaluationId}`;
      gradeMap.set(key, g.score !== null ? Number(g.score) : null);
    }

    // Build a lookup: { (studentId, subjectId, evaluationTypeCode) → score }
    const subjectGradeMap = new Map<string, number | null>();
    for (const ev of evaluations) {
      const evTypeCode = ev.evaluationType?.code || '';
      for (const g of grades) {
        if (g.evaluationId !== ev.id) continue;
        if (g.isAbsent) continue;
        const key = `${g.studentId}|${ev.subjectId}|${evTypeCode}`;
        subjectGradeMap.set(key, g.score !== null ? Number(g.score) : null);
      }
    }

    // Get our subjects for this tenant (for matching against Educ Master sheet/column names)
    const subjects = await this.prisma.subject.findMany({
      where: { tenantId },
      select: { id: true, name: true, code: true, schoolLevelId: true },
    }).catch(() => []);

    // Map { subjectId → name }
    const subjectIdToName = new Map<string, string>();
    for (const s of subjects) subjectIdToName.set(s.id, s.name);

    // ⭐ FILL EACH SHEET
    for (const ws of workbook.worksheets) {
      const sheetName = ws.name;
      this.logger.log(`[EducMaster] Filling sheet "${sheetName}"`);

      // For each row (student), find the corresponding ourStudentId
      for (let row = 2; row <= ws.rowCount; row++) {
        const matriculeCell = ws.getCell(row, 1);
        const exMat = String(matriculeCell.value || '').replace(/^'+/, '').trim();
        const ourId = matriculeToStudentId.get(exMat);
        if (!ourId) {
          this.logger.warn(`[EducMaster] No mapping for Excel matricule "${exMat}" (row ${row})`);
          continue;
        }

        if (level === 'SECONDAIRE') {
          await this.fillSecondaireRow(ws, row, ourId, sheetName, evaluations, subjectGradeMap, subjects);
        } else {
          await this.fillPrimaireRow(ws, row, ourId, sheetName, evaluations, subjectGradeMap, subjects);
        }
      }
    }

    // Return the modified workbook as buffer
    const outBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(outBuffer);
  }

  // ─── Fill a row in secondaire format (one sheet per subject) ───────────

  private async fillSecondaireRow(
    ws: ExcelJS.Worksheet,
    row: number,
    studentId: string,
    sheetName: string,
    evaluations: any[],
    subjectGradeMap: Map<string, number | null>,
    subjects: any[],
  ): Promise<void> {
    // Find our subject matching this Educ Master sheet name
    const sheetNameLower = sheetName.toLowerCase().trim();
    let ourSubjectId: string | null = null;

    // 1. Try direct match with subject.name
    const directMatch = subjects.find(s => s.name.toLowerCase().trim() === sheetNameLower);
    if (directMatch) ourSubjectId = directMatch.id;

    // 2. Try pattern-based match (SUBJECT_MAPPING)
    if (!ourSubjectId) {
      for (const mapping of SUBJECT_MAPPING) {
        if (mapping.patterns.some(p => sheetNameLower.includes(p) || p.includes(sheetNameLower))) {
          // Find subject by code or name
          const byCode = subjects.find(s => mapping.subjectCodes.includes(s.code?.toUpperCase() || ''));
          if (byCode) { ourSubjectId = byCode.id; break; }
          const byName = subjects.find(s => mapping.subjectNames.some(n => s.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(s.name.toLowerCase())));
          if (byName) { ourSubjectId = byName.id; break; }
        }
      }
    }

    if (!ourSubjectId) {
      this.logger.warn(`[EducMaster] No subject match for sheet "${sheetName}"`);
      return;
    }

    // Filter evaluations for this subject
    const subjectEvaluations = evaluations.filter(e => e.subjectId === ourSubjectId);

    // Get IE1, IE2 scores (Interrogations Écrites)
    const ie1Eval = subjectEvaluations.find(e => ['IE1', 'INTERRO1', 'I1'].includes((e.evaluationType?.code || '').toUpperCase()));
    const ie2Eval = subjectEvaluations.find(e => ['IE2', 'INTERRO2', 'I2'].includes((e.evaluationType?.code || '').toUpperCase()));
    // Get DS1, DS2 scores (Devoirs Surveillés)
    const ds1Eval = subjectEvaluations.find(e => ['DS1', 'DEVOIR1', 'D1', 'DS'].includes((e.evaluationType?.code || '').toUpperCase()));
    const ds2Eval = subjectEvaluations.find(e => ['DS2', 'DEVOIR2', 'D2'].includes((e.evaluationType?.code || '').toUpperCase()));

    // Compute "Moy. interro" = average of IE1 + IE2 (if both exist)
    let moyInterro: number | null = null;
    const ie1Score = ie1Eval ? subjectGradeMap.get(`${studentId}|${ourSubjectId}|${ie1Eval.evaluationType?.code}`) ?? null : null;
    const ie2Score = ie2Eval ? subjectGradeMap.get(`${studentId}|${ourSubjectId}|${ie2Eval.evaluationType?.code}`) ?? null : null;
    if (ie1Score !== null && ie2Score !== null) {
      moyInterro = (ie1Score + ie2Score) / 2;
    } else if (ie1Score !== null) {
      moyInterro = ie1Score;
    } else if (ie2Score !== null) {
      moyInterro = ie2Score;
    }

    const ds1Score = ds1Eval ? subjectGradeMap.get(`${studentId}|${ourSubjectId}|${ds1Eval.evaluationType?.code}`) ?? null : null;
    const ds2Score = ds2Eval ? subjectGradeMap.get(`${studentId}|${ourSubjectId}|${ds2Eval.evaluationType?.code}`) ?? null : null;

    // Write to the row: columns 4 (Moy. interro), 5 (Devoir 1), 6 (Devoir 2)
    if (moyInterro !== null) ws.getCell(row, 4).value = Math.round(moyInterro * 100) / 100;
    if (ds1Score !== null) ws.getCell(row, 5).value = ds1Score;
    if (ds2Score !== null) ws.getCell(row, 6).value = ds2Score;
  }

  // ─── Fill a row in primaire format (one sheet with subject columns) ────

  private async fillPrimaireRow(
    ws: ExcelJS.Worksheet,
    row: number,
    studentId: string,
    sheetName: string,
    evaluations: any[],
    subjectGradeMap: Map<string, number | null>,
    subjects: any[],
  ): Promise<void> {
    // For primaire, columns are grouped by subject with merged headers in row 1
    // We need to detect each subject's column range from row 1 (merged cells)
    // and fill "Note obtenue" (col offset 0) and "Note perfectionnement" (col offset 1)

    // Read row 1 column headers
    const mergedRanges = ws.mergedCellsRanges || [];
    const subjectColumns: Array<{ startCol: number; endCol: number; subjectName: string }> = [];

    for (const range of mergedRanges) {
      // Only consider row 1 ranges
      if (range.top === 1 && range.bottom === 1 && range.left > 3) {  // skip Matricule/Nom/Prénoms
        const headerCell = ws.getCell(1, range.left);
        const subjectName = String(headerCell.value || '').trim();
        if (subjectName) {
          subjectColumns.push({ startCol: range.left, endCol: range.right, subjectName });
        }
      }
    }

    for (const col of subjectColumns) {
      const subjectNameLower = col.subjectName.toLowerCase().trim();
      // Find our subject matching this column header
      let ourSubjectId: string | null = null;

      const directMatch = subjects.find(s => s.name.toLowerCase().trim() === subjectNameLower);
      if (directMatch) ourSubjectId = directMatch.id;

      if (!ourSubjectId) {
        for (const mapping of SUBJECT_MAPPING) {
          if (mapping.patterns.some(p => subjectNameLower.includes(p) || p.includes(subjectNameLower))) {
            const byCode = subjects.find(s => mapping.subjectCodes.includes(s.code?.toUpperCase() || ''));
            if (byCode) { ourSubjectId = byCode.id; break; }
            const byName = subjects.find(s => mapping.subjectNames.some(n => s.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(s.name.toLowerCase())));
            if (byName) { ourSubjectId = byName.id; break; }
          }
        }
      }

      if (!ourSubjectId) continue;

      // Get grades for this subject for this student
      const subjectEvaluations = evaluations.filter(e => e.subjectId === ourSubjectId);
      // For primaire, evaluation types are EM1, EM2, EC
      // "Note obtenue" = average of EM1 + EM2 + EC (the main score, out of 20)
      // "Note perfectionnement" = the EC score (composition, more important)
      // OR alternative: "Note obtenue" = main score, "Note perfectionnement" = bonus

      // Compute total score = average of all evaluations for this subject
      const scores: number[] = [];
      for (const ev of subjectEvaluations) {
        const score = subjectGradeMap.get(`${studentId}|${ourSubjectId}|${ev.evaluationType?.code}`);
        if (score !== null && score !== undefined) scores.push(score);
      }
      const totalScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      // Try to get EC (composition) for "Note perfectionnement"
      const ecEval = subjectEvaluations.find(e => ['EC', 'COMPOSITION', 'COMP'].includes((e.evaluationType?.code || '').toUpperCase()));
      const ecScore = ecEval ? subjectGradeMap.get(`${studentId}|${ourSubjectId}|${ecEval.evaluationType?.code}`) ?? null : null;

      // Write columns: col.startCol = "Note obtenue", col.startCol+1 = "Note perfectionnement"
      if (totalScore !== null) {
        ws.getCell(row, col.startCol).value = Math.round(totalScore * 100) / 100;
      }
      if (ecScore !== null) {
        ws.getCell(row, col.startCol + 1).value = ecScore;
      }
    }
  }

  // ─── Levenshtein-based normalized similarity (0 = totally different, 1 = identical) ──

  private normalizedSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const distance = this.levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen > 0 ? 1 - distance / maxLen : 0;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + cost, // substitution
        );
      }
    }
    return dp[m][n];
  }
}
