/**
 * Test du parser POINT sur le fichier réel :
 * "point financier CSPEB EAE 2026-2027 Dawese.xlsx"
 * Vérifie : format multi-classes (sections), P1..P8, garde-fou total.
 */
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import {
  detectSheetFormat,
  parsePointSheet,
  canonicalYearLabel,
} from '../src/finance/point-format.parser';

const FILE = process.argv[2] || '/home/z/my-project/upload/point financier CSPEB EAE 2026-2027 Dawese.xlsx';

async function main() {
  const buffer = fs.readFileSync(FILE);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  console.log('Feuilles :', workbook.worksheets.map((w) => w.name).join(', '));
  console.log();

  for (const ws of workbook.worksheets) {
    const sheetName = ws.name;
    if (sheetName === 'RECAP' || sheetName.startsWith('_')) continue;

    const detection = detectSheetFormat(ws);
    console.log(`── Feuille "${sheetName}" → format=${detection.format}`);
    if (detection.format !== 'POINT') {
      console.log('   (ignorée — pas le pattern scolarité + P1..Pn)\n');
      continue;
    }
    console.log(`   headerRow=${detection.headerRow} trancheRow=${detection.trancheRow} dataStart=${detection.dataStartRow}`);
    const cols = detection.columns!;
    console.log(`   tranches: ${cols.tranches.join(',')} (${cols.tranches.length} tranches) | totalPayments=${cols.totalPayments}`);

    const parsed = parsePointSheet(ws, sheetName, detection);
    console.log(`   yearLabel=${parsed.yearLabel} (canonique: ${canonicalYearLabel(parsed.yearLabel || '')}) | classFee=${parsed.classFee}`);
    console.log(`   sections: ${parsed.sections ? parsed.sections.join(' / ') : '(aucune — feuille mono-classe)'}`);
    console.log(`   lignes élèves: ${parsed.rows.length}`);

    // Répartition par section
    const bySection = new Map<string, { n: number; total: number }>();
    for (const r of parsed.rows) {
      const key = r.className || '(sans section)';
      const cur = bySection.get(key) || { n: 0, total: 0 };
      cur.n++;
      cur.total += r.total;
      bySection.set(key, cur);
    }
    console.log('   Répartition par section :');
    for (const [section, { n, total }] of bySection) {
      console.log(`     ${section.padEnd(12)} ${String(n).padStart(3)} élèves — total ${total.toLocaleString('fr-FR')} F`);
    }

    // Échantillon de lignes (3 premières + 2 au hasard)
    console.log('   Échantillon :');
    const sample = [...parsed.rows.slice(0, 2), ...parsed.rows.slice(Math.floor(parsed.rows.length / 2), Math.floor(parsed.rows.length / 2) + 2)];
    for (const r of sample) {
      console.log(
        `     L${String(r.rowIndex).padStart(3)} [${(r.className || '—').padEnd(10)}] ${r.studentName.padEnd(28).substring(0, 28)} ` +
        `inscr=${r.inscription} unif=${r.unif} tranches=[${r.tranches.join(',')}] fraisGen=${r.fraisGeneraux} scolarité=${r.scolaritePayee} total=${r.total}`,
      );
    }

    // Vérification du garde-fou : le total doit être = fraisGen + scolarité (pas la colonne Q brute)
    let anomalies = 0;
    for (const r of parsed.rows) {
      const computed = r.fraisGeneraux + r.scolaritePayee;
      if (r.total !== computed) anomalies++;
    }
    console.log(`   Garde-fou total : ${anomalies} ligne(s) où total ≠ fraisGen+scolarité (0 attendu pour ce fichier)\n`);
  }
}

main().catch((e) => {
  console.error('ERREUR :', e);
  process.exit(1);
});
