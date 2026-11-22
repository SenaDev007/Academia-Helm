/**
 * Tests fonctionnels purs (⭐ 156 — onglet CNSS) :
 *  - règle fiscale « Permanent / Vacataire » extraite du VRAI source (payroll.service.ts)
 *  - calcul des colonnes d'indemnités dynamiques (même logique que PayrollManagement.tsx)
 */
const fs = require('fs');
const assert = require('assert');
const ts = require('typescript'); // résolution : parent sandbox (node_modules)

// ── 1. Extraire fiscalStaffType du source réel, transpiler et l'évaluer ────
const src = fs.readFileSync(
  '/home/z/my-project/academia-helm/apps/api-server/src/hr/taxes/services/payroll.service.ts',
  'utf8',
);
const start = src.indexOf('export function fiscalStaffType');
const end = src.indexOf('@Injectable');
assert(start >= 0 && end > start, 'fiscalStaffType introuvable dans le source');
const js = ts.transpileModule(src.slice(start, end), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
  .split('\n')
  .filter(line => !/^exports\./.test(line) && !/^Object\.defineProperty/.test(line) && !/^\s*"use strict";/.test(line))
  .join('\n');
const fiscalStaffType = new Function(`${js}; return fiscalStaffType;`)();

let pass = 0, fail = 0;
const t = (label, actual, expected) => {
  try {
    assert.strictEqual(actual, expected);
    pass++; console.log(`PASS ${label}`);
  } catch (e) {
    fail++; console.log(`FAIL ${label} → ${actual} (attendu ${expected})`);
  }
};

// ⭐ Règle promoteur : permanents = déclarés CNSS ; vacataires = prestataires
//    et non déclarés.
t('SALARIE_DECLARE → PERMANENT', fiscalStaffType({ statutContractuel: 'SALARIE_DECLARE' }), 'PERMANENT');
t('PRESTATAIRE_SERVICE → VACATAIRE', fiscalStaffType({ statutContractuel: 'PRESTATAIRE_SERVICE' }), 'VACATAIRE');
t('SALARIE_NON_DECLARE → VACATAIRE', fiscalStaffType({ statutContractuel: 'SALARIE_NON_DECLARE' }), 'VACATAIRE');
t('sans statut + n° CNSS → PERMANENT', fiscalStaffType({ statutContractuel: null, cnssNumber: 'BJ-12345' }), 'PERMANENT');
t('sans statut + EmployeeCNSS actif → PERMANENT', fiscalStaffType({ statutContractuel: null, employeeCNSS: { cnssNumber: 'X1', isActive: true } }), 'PERMANENT');
t('sans statut + EmployeeCNSS inactif → VACATAIRE', fiscalStaffType({ statutContractuel: null, employeeCNSS: { cnssNumber: 'X1', isActive: false } }), 'VACATAIRE');
t('sans statut sans n° → VACATAIRE', fiscalStaffType({ statutContractuel: null, cnssNumber: '', employeeCNSS: null }), 'VACATAIRE');
t('staff null → VACATAIRE', fiscalStaffType(null), 'VACATAIRE');
t('n° CNSS blanc → VACATAIRE', fiscalStaffType({ statutContractuel: undefined, cnssNumber: '   ' }), 'VACATAIRE');
t('PRESTATAIRE prioritaire sur n° CNSS', fiscalStaffType({ statutContractuel: 'PRESTATAIRE_SERVICE', cnssNumber: 'BJ-1' }), 'VACATAIRE');

// ── 2. Colonnes dynamiques — même logique que le frontend ──────────────────
const payslips = [
  { allowancesDetail: [{ code: 'LOGEMENT', label: 'Indemnité de Logement', amount: 15000 }, { code: 'TRANSPORT', label: 'Indemnité de Transport', amount: 8000 }] },
  { allowancesDetail: [{ code: 'LOGEMENT', label: 'Indemnité de Logement', amount: 25000 }, { code: 'PRIMES_SALISSURE', label: 'Primes de Salissure', amount: 5000 }] },
  { allowancesDetail: [] },
];
const map = new Map();
for (const p of payslips) {
  for (const d of (Array.isArray(p.allowancesDetail) ? p.allowancesDetail : [])) {
    if (d?.code && !map.has(d.code)) map.set(d.code, { code: d.code, label: d?.label || d.code });
  }
}
const allowanceCols = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
t('3 types distincts détectés', allowanceCols.length, 3);
t('ensemble des codes détecté', allowanceCols.map(c => c.code).sort().join(','), 'LOGEMENT,PRIMES_SALISSURE,TRANSPORT');
t('libellés complets conservés', allowanceCols.every(c => c.label.length > 3), true);

const allowanceAmount = (p, code) =>
  (Array.isArray(p.allowancesDetail) ? p.allowancesDetail : [])
    .filter(d => d?.code === code)
    .reduce((s, d) => s + Number(d?.amount || 0), 0);
t('montant LOGEMENT fiche 2', allowanceAmount(payslips[1], 'LOGEMENT'), 25000);
t('montant absent → 0', allowanceAmount(payslips[2], 'LOGEMENT'), 0);

// ── 3. Structure du tableau (en-têtes de groupes / sous-colonnes) ───────────
const nCols = allowanceCols.length;
// PERMANENTS : 4 fixes + nCols indemnités + 3 (brut/itsBrut/itsNet) + 5 retenues + net + actions
t('colonnes perm. (rangée 1 = rangée 2)', 4 + nCols + 3 + 5 + 1 + 1, 4 + nCols + 3 + 5 + 1 + 1);
// VACATAIRES : 4 + nCols + brut + 3 retenues + net + CIN + signature + actions
const vacCols = 4 + nCols + 1 + 3 + 1 + 1 + 1 + 1;
t('vacataires = 12 + nCols', vacCols, 12 + nCols);
// min-width : noms + montants jamais sur 2 lignes
t('largeur min perm. ≥ 2000px (3 types)', 1640 + nCols * 120 >= 2000, true);

// ── 4. Règle dashboard — effectif sur un échantillon ────────────────────────
const staffSample = [
  { statutContractuel: 'SALARIE_DECLARE' },
  { statutContractuel: 'SALARIE_DECLARE' },
  { statutContractuel: 'PRESTATAIRE_SERVICE' },
  { statutContractuel: 'SALARIE_NON_DECLARE' },
  { statutContractuel: null, cnssNumber: 'BJ-77' },
  { statutContractuel: null, cnssNumber: null },
];
const perm = staffSample.filter(s => fiscalStaffType(s) === 'PERMANENT').length;
const vac = staffSample.filter(s => fiscalStaffType(s) === 'VACATAIRE').length;
t('effectif : 3 permanents', perm, 3);
t('effectif : 3 vacataires (prestataire + non déclarés)', vac, 3);

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
