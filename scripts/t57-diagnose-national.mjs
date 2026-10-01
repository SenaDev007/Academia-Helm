/**
 * Diagnostic T57 — Pourquoi le patronat NATIONAL est lent / en échec
 * sur TOUS les modules (dashboard, bureau, équipe, écoles rattachées)
 * alors que le territorial fonctionne.
 *
 * Étape 1 : état des lieux en base (patronats, volumes, index).
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function q(label, sql, params = []) {
  const t0 = Date.now();
  const res = await client.query(sql, params);
  const ms = Date.now() - t0;
  console.log(`\n=== ${label} (${ms} ms, ${res.rowCount} lignes) ===`);
  return res.rows;
}

await client.connect();

// 1. Tous les patronats
const patronats = await q(
  'Patronats',
  `SELECT p.id, p.name, p."orgLevel", p."territoryName", p."tenantId", p.status,
          p."parentPatronatId", p."subscriptionPlan", p."subscriptionStatus", p.metadata::text
   FROM patronats p ORDER BY p."orgLevel", p.name`,
);

const national = patronats.filter((p) => p.orgLevel === 'NATIONAL');
const territorial = patronats.filter((p) => p.orgLevel === 'TERRITORIAL');
console.log(
  `NATIONAL=${national.length}, TERRITORIAL=${territorial.length}, total=${patronats.length}`,
);

for (const n of national) {
  console.log(`\n### NATIONAL: ${n.name} (${n.id}) tenant=${n.tenantId} status=${n.status}`);
  const children = patronats.filter((p) => p.parentPatronatId === n.id);
  console.log(`Enfants rattachés: ${children.length}`);
  for (const c of children) {
    console.log(`  - ${c.name} | ${c.territoryName} | status=${c.status} | tenant=${c.tenantId}`);
  }
  // Vérifier les tenantIds des enfants vs patronats existants
  const orphanTenants = children.filter(
    (c) => !patronats.some((pp) => pp.tenantId === c.tenantId && pp.id !== c.id),
  );
  if (orphanTenants.length)
    console.log('  Enfants avec tenant sans patronat propre:', orphanTenants.length);
}

// 2. Volumes par tenant (candidats, examens) pour mesurer l'agrégation
const natWithKids = national.map((n) => {
  const kids = patronats.filter((p) => p.parentPatronatId === n.id);
  return { n, kids };
});

for (const { n, kids } of natWithKids) {
  const tenantIds = [n.tenantId, ...kids.map((k) => k.tenantId)];
  const patronatIds = [n.id, ...kids.map((k) => k.id)];
  console.log(`\n### Volumes pour ${n.name} : ${kids.length} départements`);

  const cand = await q(
    'Candidats tous tenants du périmètre',
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status <> 'CANCELLED')::int AS actifs
     FROM exam_candidates WHERE "tenantId" = ANY($1)`,
    [tenantIds],
  );
  console.log(JSON.stringify(cand));

  const exams = await q(
    'Examens du périmètre',
    `SELECT COUNT(*)::int AS total FROM national_exams WHERE "patronatId" = ANY($1)`,
    [patronatIds],
  );
  console.log(JSON.stringify(exams));

  // Années actives du périmètre
  const years = await q(
    'Années actives du périmètre',
    `SELECT "tenantId", COUNT(*)::int AS actives, string_agg(label, ', ') AS labels
     FROM academic_years WHERE "isActive" = true AND "tenantId" = ANY($1)
     GROUP BY "tenantId"`,
    [tenantIds],
  );
  console.log(JSON.stringify(years, null, 1));
}

// 3. Utilisateurs du patronat national (pour tester login coordinateur)
for (const n of national) {
  const users = await q(
    `Membles du national ${n.name}`,
    `SELECT pu.id, pu.role, pu."isActive", u.email, u.status AS user_status, u.role AS user_role
     FROM patronat_users pu JOIN users u ON u.id = pu."userId"
     WHERE pu."tenantId" = $1 ORDER BY pu."createdAt" ASC`,
    [n.tenantId],
  );
  console.log(JSON.stringify(users, null, 1));
}

// 4. Index sur les tables chaudes
await q(
  'Index exam_candidates',
  `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN
   ('exam_candidates','national_exams','patronat_schools','patronat_users','patronat_bureau_members')
   ORDER BY tablename, indexname`,
).then((rows) => rows.forEach((r) => console.log(r.indexdef)));

// 5. Volumes globaux des tables chaudes
await q('Volumes globaux', `
  SELECT 'exam_candidates' t, COUNT(*)::int n FROM exam_candidates
  UNION ALL SELECT 'national_exams', COUNT(*)::int FROM national_exams
  UNION ALL SELECT 'patronat_schools', COUNT(*)::int FROM patronat_schools
  UNION ALL SELECT 'patronat_manual_schools', COUNT(*)::int FROM patronat_manual_schools
  UNION ALL SELECT 'patronat_users', COUNT(*)::int FROM patronat_users
  UNION ALL SELECT 'patronat_bureau_members', COUNT(*)::int FROM patronat_bureau_members
  UNION ALL SELECT 'exam_incidents', COUNT(*)::int FROM exam_incidents
  UNION ALL SELECT 'academic_years', COUNT(*)::int FROM academic_years
`).then((rows) => console.log(JSON.stringify(rows)));

await client.end();
console.log('\n✓ Diagnostic terminé');
