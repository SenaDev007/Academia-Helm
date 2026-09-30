import { mkdir, writeFile } from 'node:fs/promises';
import { THEMES } from './themes.js';
import { buildClassPack, closeBrowser, generateDistinctionPdf, generateBoardPdf } from './index.js';
import type { DistinctionCode, DistinctionInput, SchoolInfo } from './types.js';

const school: SchoolInfo & { id: string } = {
  id: 'sch_001', name: 'Complexe Scolaire Le Flambeau', city: 'Parakou',
  directorName: 'M. Oswald ADJOVI', teacherName: 'Mme Grâce TOSSOU',
};
const period = { label: '1er trimestre', schoolYear: '2025-2026', issuedOn: '2025-12-19' };

const SAMPLE: Record<DistinctionCode, Partial<DistinctionInput> & { name: string; cls: string; avg?: number; base: number; rank?: number; prev?: number }> = {
  MAT_OR: { name: 'HOUNKPATIN Esther', cls: 'Grande Section', avg: 18.4, base: 20 },
  MAT_ARGENT: { name: 'AGBODJI Léa', cls: 'Moyenne Section', avg: 16.2, base: 20 },
  MAT_BRONZE: { name: 'SOSSOU Emmanuel', cls: 'Petite Section', avg: 13.2, base: 20 },
  MAT_EXPLO: { name: 'KPADONOU Ariel', cls: 'Petite Section', avg: 10.4, base: 20 },
  MAT_GRAD: { name: 'HOUNKPATIN Esther', cls: 'Grande Section', base: 20, statOverride: undefined },
  PRI_FELIC: { name: 'AKPO Daniel', cls: 'CM2 B', avg: 17.2, base: 20, rank: 1 },
  PRI_ENCOU: { name: 'ZINSOU Ruth', cls: 'CM1 A', avg: 15.1, base: 20, rank: 6 },
  PRI_HONNEUR: { name: 'SANTOS Marie', cls: 'CE2 A', avg: 12.85, base: 20, rank: 14 },
  PRI_COURAGE: { name: 'DEGBE Rachel', cls: 'CE1 B', avg: 10.4, base: 20, rank: 31 },
  PRI_GRAD: { name: 'AKPO Daniel', cls: 'CM2 B', avg: 14.3, base: 20, rank: 4 },
  SEC_FELIC: { name: 'ADJOVI Grâce Emmanuelle', cls: '3e A', avg: 16.8, base: 20, rank: 2 },
  SEC_ENCOU: { name: 'GBEDO Daniel', cls: '4e B', avg: 14.6, base: 20, rank: 7 },
  SEC_HONNEUR: { name: 'BIAOU Josué', cls: '5e A', avg: 12.75, base: 20, rank: 15 },
  SEC_PROGRES: { name: 'KOUDJO Samuel', cls: '2nde C', avg: 14.1, base: 20, prev: 10.9 },
  SEC_ASSIDUITE: { name: 'TOGNON Esther', cls: '1ère D', base: 20, statOverride: 'Aucune absence, aucun retard sur la période' },
  SEC_COMPORTEMENT: { name: 'SEGNON Lydie', cls: '6e B', base: 20, statOverride: 'Conduite : 19/20' },
  SEC_GRAD: { name: 'ADJOVI Grâce Emmanuelle', cls: '3e A', avg: 14.3, base: 20, rank: 2 },
};

async function main() {
  await mkdir('out/certificats', { recursive: true });
  for (const code of Object.keys(THEMES) as DistinctionCode[]) {
    const s = SAMPLE[code];
    const pdf = await generateDistinctionPdf({
      code, school, period: code === 'SEC_PROGRES' ? { ...period, label: '2e trimestre', issuedOn: '2026-03-27' } : period,
      student: { fullName: s.name, className: s.cls },
      results: s.avg != null ? { average: s.avg, base: s.base, rank: s.rank, classSize: 42, previousAverage: s.prev, previousLabel: '1er trimestre' } : undefined,
      verification: { code: 'AH-2025-7F3A-91C2-B04E', url: 'https://academiahelm.com/verifier/AH-2025-7F3A-91C2-B04E' },
      statOverride: s.statOverride,
    });
    await writeFile(`out/certificats/${code}.pdf`, pdf);
    console.log('ok', code);
  }

  // Test du flux dynamique complet sur une classe
  const names = ['ADJOVI Grâce', 'KOUDJO Samuel', 'TOGNON Esther', 'GBEDO Daniel', 'AHOUANDJINOU Ruth', 'FADONOUGBO Marc', 'SEGNON Lydie', 'BIAOU Josué', 'ODJO Nadège', 'DEGBE Rachel', 'AMOUSSOU Luc', 'HOUESSOU Paul', 'ZINSOU Ruth'];
  const avgs = [17.2, 16.35, 16.05, 15.2, 14.9, 14.15, 13.4, 12.75, 12.1, 10.4, 9.2, 13.9, 11.1];
  const pack = await buildClassPack({
    level: 'primaire', school, classId: 'cls_cm2b', className: 'CM2 B', periodId: 'per_t1',
    period, base: 20, secret: 'dev-secret', verifyBaseUrl: 'https://academiahelm.com',
    students: names.map((n, i) => ({ id: `stu_${i}`, fullName: n, average: avgs[i], graduating: i < 2 })),
  });
  await mkdir('out/classe', { recursive: true });
  if (pack.mergedPdf) await writeFile('out/classe/impression_classe.pdf', pack.mergedPdf);
  if (pack.boardPdf) await writeFile('out/classe/tableau_honneur.pdf', pack.boardPdf);
  for (const f of pack.files) await writeFile(`out/classe/${f.fileName}`, f.pdf);
  console.log('pack:', pack.files.length, 'fichiers,', pack.skipped.length, 'sans document');

  // Tableaux collectifs des deux autres niveaux
  for (const level of ['maternel', 'secondaire'] as const) {
    const codes: DistinctionCode[] = level === 'maternel' ? ['MAT_OR', 'MAT_OR', 'MAT_ARGENT', 'MAT_ARGENT', 'MAT_BRONZE', 'MAT_EXPLO'] : ['SEC_FELIC', 'SEC_FELIC', 'SEC_ENCOU', 'SEC_ENCOU', 'SEC_HONNEUR', 'SEC_HONNEUR'];
    const avg = level === 'maternel' ? [18.4, 18, 16.8, 15.6, 13.2, 10.4] : [17.1, 16.4, 15.3, 14.4, 12.9, 12.2];
    const pdf = await generateBoardPdf({
      level, school, className: level === 'maternel' ? 'Grande Section' : '3e A', period, base: 20,
      rows: codes.map((c, i) => ({ rank: i + 1, fullName: names[i], average: avg[i], code: c })),
    });
    await writeFile(`out/tableau_${level}.pdf`, pdf);
  }
  await closeBrowser();
  console.log('terminé');
}

main().catch(async (e) => { console.error(e); await closeBrowser(); process.exit(1); });
