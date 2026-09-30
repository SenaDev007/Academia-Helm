import { makeVerificationCode, verificationUrl } from './security.js';
import { GRADUATION_CODE, resolveDistinction, type Rule } from './rules.js';
import { generateBatch, generateBoardPdf, type BatchFile } from './render.service.js';
import type { BoardRow, DistinctionCode, DistinctionInput, Level, PeriodInfo, SchoolInfo } from './types.js';

export interface PackStudent {
  id: string;
  fullName: string;
  average?: number;
  /** Calculé automatiquement si absent */
  rank?: number;
  photoUrl?: string;
  /** Élève qui quitte le cycle (Grande Section, CM2, 3e, Terminale) */
  graduating?: boolean;
  annualAverage?: number;
  previousAverage?: number;
  /** Prix spéciaux déjà calculés (voir resolveSpecialAwards) */
  awards?: DistinctionCode[];
}

export interface ClassPackInput {
  level: Level;
  school: SchoolInfo & { id: string };
  classId: string;
  className: string;
  periodId: string;
  period: PeriodInfo;
  base: number;
  students: PackStudent[];
  rules?: Rule[];
  previousLabel?: string;
  secret: string;
  verifyBaseUrl: string;
}

export interface ClassPackResult {
  mergedPdf: Buffer | null;
  boardPdf: Buffer | null;
  files: BatchFile[];
  /** À enregistrer dans la table distinctions */
  records: { studentId: string; code: DistinctionCode; verificationCode: string }[];
  /** Élèves sans document (ex : moyenne sous le premier palier) */
  skipped: { studentId: string; fullName: string; reason: string }[];
}

/**
 * Point d'entrée dynamique : à partir des moyennes d'une classe, applique les règles,
 * génère les certificats individuels, le PDF fusionné d'impression et le tableau collectif.
 */
export async function buildClassPack(p: ClassPackInput): Promise<ClassPackResult> {
  const withAvg = p.students.filter((s) => s.average != null);
  const ranked = [...withAvg].sort((a, b) => (b.average as number) - (a.average as number));
  const rankOf = new Map(ranked.map((s, i) => [s.id, s.rank ?? i + 1]));
  const classSize = withAvg.length;

  const inputs: DistinctionInput[] = [];
  const records: ClassPackResult['records'] = [];
  const skipped: ClassPackResult['skipped'] = [];
  const boardRows: BoardRow[] = [];

  const make = (s: PackStudent, code: DistinctionCode, extra: Partial<DistinctionInput> = {}): DistinctionInput => {
    const vcode = makeVerificationCode(p.secret, {
      schoolId: p.school.id, studentId: s.id, periodId: p.periodId, code, schoolYear: p.period.schoolYear,
    });
    records.push({ studentId: s.id, code, verificationCode: vcode });
    return {
      code,
      school: p.school,
      student: { fullName: s.fullName, className: p.className, photoUrl: s.photoUrl },
      period: p.period,
      results: {
        average: s.average, base: p.base, rank: rankOf.get(s.id), classSize,
        previousAverage: s.previousAverage, previousLabel: p.previousLabel,
      },
      verification: { code: vcode, url: verificationUrl(p.verifyBaseUrl, vcode) },
      ...extra,
    };
  };

  for (const s of ranked) {
    const code = resolveDistinction(p.level, s.average as number, p.base, p.rules);
    if (code) {
      inputs.push(make(s, code));
      boardRows.push({ rank: rankOf.get(s.id) as number, fullName: s.fullName, average: s.average as number, code });
    } else {
      skipped.push({ studentId: s.id, fullName: s.fullName, reason: 'Moyenne sous le premier palier' });
    }
  }
  for (const s of p.students) {
    if (s.average == null) skipped.push({ studentId: s.id, fullName: s.fullName, reason: 'Moyenne absente' });
    for (const award of s.awards ?? []) inputs.push(make(s, award));
    if (s.graduating) {
      const avg = s.annualAverage ?? s.average;
      inputs.push(make(s, GRADUATION_CODE[p.level], {
        results: { average: avg, base: p.base, rank: rankOf.get(s.id), classSize },
      }));
    }
  }

  const [batch, boardPdf] = await Promise.all([
    inputs.length ? generateBatch(inputs) : Promise.resolve(null),
    boardRows.length
      ? generateBoardPdf({ level: p.level, school: p.school, className: p.className, period: p.period, base: p.base, rows: boardRows })
      : Promise.resolve(null),
  ]);

  return { mergedPdf: batch?.merged ?? null, boardPdf, files: batch?.files ?? [], records, skipped };
}
