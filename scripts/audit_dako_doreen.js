/**
 * Audit des montants d'inscription importés depuis les fichiers Excel
 * Mon Avenir Plus — vérifie DAKO Doreen et tous les autres élèves
 */
const XLSX = require('xlsx');
const FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];

console.log('='.repeat(80));
console.log('AUDIT DES MONTANTS INSCRIPTION DANS LES FICHIERS EXCEL');
console.log('='.repeat(80));

for (const f of FILES) {
  console.log('\n📄', f.split('/').pop());
  const wb = XLSX.readFile(f);

  for (const sn of wb.SheetNames) {
    if (sn === 'RECAP') continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true });
    if (rows.length < 5) continue;

    let hr = 3;
    for (let i = 0; i < Math.min(8, rows.length); i++) {
      if (rows[i] && rows[i].some(c => String(c || '').toUpperCase().includes('NOM') && String(c || '').toUpperCase().includes('PRENOM'))) {
        hr = i; break;
      }
    }
    const header = rows[hr] || [];
    let nc = 1, ic = -1;
    for (let j = 0; j < header.length; j++) {
      const h = String(header[j] || '').toUpperCase();
      if (h.includes('NOM')) nc = j;
      if (h.includes('INSCRIPT')) ic = j;
    }
    if (ic === -1) { console.log('  ⚠️', sn, '- no INSCRIPT column'); continue; }

    console.log('\n  📋 Feuille:', sn, '| Colonne INSCRIPT:', ic, '| Colonne NOM:', nc);
    console.log('  ' + '-'.repeat(76));

    let count = 0;
    for (let ri = hr + 2; ri < rows.length; ri++) {
      const row = rows[ri];
      if (!row || !row[nc]) continue;
      const rawName = String(row[nc]).trim();
      if (!rawName || rawName.toUpperCase().includes('TOTAL') || /^\d+$/.test(rawName)) continue;

      const inscriptAmt = Number(row[ic]) || 0;
      if (inscriptAmt > 0) {
        const flag = inscriptAmt === 15000 ? ' ⚠️ 15000!' : (inscriptAmt === 5000 ? ' ✅ 5000' : '');
        console.log(`    ${rawName.padEnd(40)} INSCRIPT: ${inscriptAmt}${flag}`);
        count++;
      }
    }
    console.log('  ' + '-'.repeat(76));
    console.log('  →', count, 'élèves avec montant INSCRIPTION > 0');
  }
}
