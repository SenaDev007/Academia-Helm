/**
 * Validation DB production (Neon) — Refonte CDC « étape Contrat » (84b25b4f)
 * Vérifie que le bootstrap Railway a créé tables/colonnes + marqué les
 * dossiers VACATAIRE (§10), SANS credentials de login.
 */
const pg = require('pg');

const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
(async () => {
await c.connect();

const ok = (label, cond, detail = '') =>
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);

let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) pass++; else fail++;
  ok(label, cond, detail);
}

// 1. Tables nouvelles
for (const t of ['hr_contract_settings', 'hr_internships']) {
  const r = await c.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name=$1) AS exists`,
    [t],
  );
  check(`table ${t} créée (bootstrap)`, r.rows[0].exists === true);
}

// 2. Colonnes employment_contracts
const contractCols = (await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='employment_contracts'`,
)).rows.map((r) => r.column_name);
for (const col of ['cddMotif', 'cddRenouvellements', 'cddChainId', 'periodeEssaiMois', 'justificationStatut', 'needsRequalification', 'requalifieDepuis']) {
  check(`employment_contracts.${col}`, contractCols.includes(col));
}

// 3. Colonnes staff
const staffCols = (await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='staff'`,
)).rows.map((r) => r.column_name);
for (const col of ['justificationStatut', 'needsRequalification']) {
  check(`staff.${col}`, staffCols.includes(col));
}

// 4. §10 — dossiers VACATAIRE marqués à requalifier (badge non bloquant)
const vacContracts = await c.query(
  `SELECT COUNT(*)::int n FROM employment_contracts WHERE "contractType"='VACATAIRE'`,
);
const marked = await c.query(
  `SELECT COUNT(*)::int n FROM employment_contracts WHERE "contractType"='VACATAIRE' AND "needsRequalification"=true`,
);
check(
  'dossiers VACATAIRE marqués needsRequalification (§10)',
  vacContracts.rows[0].n === 0 || marked.rows[0].n === vacContracts.rows[0].n,
  `${marked.rows[0].n}/${vacContracts.rows[0].n} contrats marqués`,
);
const markedStaff = await c.query(
  `SELECT COUNT(*)::int n FROM staff WHERE "needsRequalification"=true`,
);
console.log(`  → ${markedStaff.rows[0].n} fiche(s) staff marquée(s) « à requalifier »`);

// 5. Gabarits en base — V2 détectable ? (contrat_travail seedé/migré à la 1re génération)
const tmpl = await c.query(
  `SELECT "contractType", LEFT(template, 60) AS head, (template LIKE '%indemnite_fin_contrat_pct%') AS v2
     FROM contract_templates WHERE "contractType" IN ('CONTRAT_TRAVAIL','CONTRAT_PRESTATION') ORDER BY "createdAt" DESC LIMIT 4`,
);
console.log(`  → gabarits en base : ${tmpl.rows.length}`);
for (const r of tmpl.rows) {
  console.log(`    • ${r.contractType} ${r.v2 === true ? '(V2 — indemnité/renouvellement)' : '(V1 — migrera à la prochaine génération)'}`);
}

// 6. Répartition des types de contrats existants (contexte migration)
const types = await c.query(
  `SELECT "contractType", COUNT(*)::int n FROM employment_contracts GROUP BY "contractType" ORDER BY n DESC`,
);
console.log('  → contrats par type :', types.rows.map((r) => `${r.contractType}=${r.n}`).join(', '));

const statuts = await c.query(
  `SELECT "statutContractuel", COUNT(*)::int n FROM employment_contracts GROUP BY "statutContractuel"`,
);
console.log('  → contrats par statut :', statuts.rows.map((r) => `${r.statutContractuel ?? 'null'}=${r.n}`).join(', '));

await c.end();
console.log(`\nRÉSULTAT : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
})();
