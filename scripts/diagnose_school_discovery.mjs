/**
 * Diagnostic — pourquoi CSPEB n'est pas récupérée dans « Écoles de votre territoire »
 * Vérifie : tenant type/status/country, fiche School (city/department), patronats.
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('════ [1] Tous les tenants type école (SCHOOL/MATERNELLE/PRIMAIRE/SECONDAIRE/MIXTE) ════');
const tenants = await client.query(`
  SELECT t.id, t.name, t.type, t.status, t."countryId", t.slug,
         s.city, s.department
  FROM tenants t
  LEFT JOIN schools s ON s."tenantId" = t.id
  WHERE t.type ILIKE ANY(ARRAY['SCHOOL','MATERNELLE','PRIMAIRE','SECONDAIRE','MIXTE'])
  ORDER BY t.name
`);
for (const t of tenants.rows) {
  console.log(
    `  • ${t.name} | type=${t.type} | status=${t.status} | country=${t.countryId ?? 'NULL'} | city=${t.city ?? 'NULL'} | dept=${t.department ?? 'NULL'}`,
  );
}

console.log('\n════ [2] CSPEB spécifiquement (recherche par nom) ════');
const cspeb = await client.query(`
  SELECT t.id, t.name, t.type, t.status, t."countryId", t.slug, t.subdomain,
         s.city, s.department, s.address
  FROM tenants t
  LEFT JOIN schools s ON s."tenantId" = t.id
  WHERE t.name ILIKE '%CSPEB%' OR t.name ILIKE '%C.S.P.E.B%' OR t.slug ILIKE '%cspeb%'
`);
for (const t of cspeb.rows) {
  console.log(
    `  • id=${t.id}\n    name=${t.name} type=${t.type} status=${t.status} country=${t.countryId ?? 'NULL'} slug=${t.slug} subdomain=${t.subdomain}\n    city=${t.city ?? 'NULL'} dept=${t.department ?? 'NULL'} address=${t.address ?? 'NULL'}`,
  );
}

console.log('\n════ [3] Patronats (orgLevel, territoire, pays) ════');
const patronats = await client.query(`
  SELECT p.id, p.name, p."orgLevel", p."territoryName", p."parentId", p."tenantId", p."countryId"
  FROM patronats p
  ORDER BY p."orgLevel", p.name
`);
for (const p of patronats.rows) {
  console.log(
    `  • ${p.name} | orgLevel=${p.orgLevel} | territory=${p.territoryName ?? 'NULL'} | country=${p.countryId ?? 'NULL'} | parent=${p.parentId ?? 'NULL'}`,
  );
}

console.log('\n════ [4] Liens patronat-école existants ════');
const links = await client.query(`
  SELECT ps.id, p.name AS patronat, t.name AS school, ps.status
  FROM patronat_schools ps
  JOIN patronats p ON p.id = ps."patronatId"
  JOIN tenants t ON t.id = ps."schoolTenantId"
  ORDER BY p.name, t.name
`);
for (const l of links.rows) {
  console.log(`  • ${l.patronat} ← ${l.school} [${l.status}]`);
}

console.log('\n════ [5] Types de tenant distincts (tous) ════');
const types = await client.query(`
  SELECT type, count(*) AS n FROM tenants GROUP BY type ORDER BY n DESC
`);
for (const t of types.rows) {
  console.log(`  • ${t.type}: ${t.n}`);
}

await client.end();
