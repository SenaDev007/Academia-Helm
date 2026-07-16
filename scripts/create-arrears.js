/**
 * Crée les fee_arrears pour les élèves qui ont un arriéré dans le fichier Excel.
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

function normalizeName(name) {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.';,/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Création des fee_arrears ===\n');

  // 1. Charger le JSON pour les arriérés
  const jsonData = JSON.parse(fs.readFileSync('/home/z/my-project/scripts/students-data.json', 'utf8'));
  const arrearsMap = {}; // normalizedName → arrears amount
  for (const sheet of jsonData.sheets || []) {
    for (const s of sheet.students || []) {
      if (s.arrears && s.arrears > 0) {
        arrearsMap[s.normalizedName] = s.arrears;
      }
    }
  }
  console.log(`Élèves avec arriéré dans Excel: ${Object.keys(arrearsMap).length}`);

  // 2. Charger les élèves de la DB
  const dbRes = await client.query(`
    SELECT s.id, s."firstName", s."lastName"
    FROM students s
    WHERE s."tenantId" = $1
  `, [TENANT_ID]);

  const dbMap = {};
  for (const r of dbRes.rows) {
    const key = normalizeName(`${r.lastName} ${r.firstName}`);
    if (!dbMap[key]) dbMap[key] = r.id;
  }

  // 3. Créer les fee_arrears
  let created = 0;
  let skipped = 0;
  for (const [normalizedName, arrearsAmount] of Object.entries(arrearsMap)) {
    const studentId = dbMap[normalizedName];
    if (!studentId) {
      console.log(`⚠ Élève non trouvé: ${normalizedName}`);
      skipped++;
      continue;
    }

    // Vérifier si l'arriéré existe déjà
    const existing = await client.query(`
      SELECT id FROM fee_arrears WHERE "tenantId" = $1 AND "studentId" = $2
    `, [TENANT_ID, studentId]);
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    const arrearsLevel = arrearsAmount > 50000 ? 'CRITICAL' : 'WARNING';
    await client.query(`
      INSERT INTO fee_arrears
        (id, "tenantId", "academicYearId", "studentId", "totalDue", "totalPaid", "balanceDue", "arrearsLevel", "status", "notes", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, $4, $5, 'OPEN', 'Arriéré importé depuis fichier Excel point 2025-2026', NOW(), NOW())
    `, [TENANT_ID, ACADEMIC_YEAR_ID, studentId, arrearsAmount, arrearsLevel]);
    created++;
  }

  console.log(`\nArriérés créés: ${created}`);
  console.log(`Skippés (déjà existants ou non trouvés): ${skipped}`);

  // 4. Vérification
  const cnt = await client.query(`SELECT COUNT(*) as n FROM fee_arrears WHERE "tenantId" = $1`, [TENANT_ID]);
  console.log(`Total arriérés en DB: ${cnt.rows[0].n}`);

  // Échantillon
  console.log('\nÉchantillon arriérés:');
  const sample = await client.query(`
    SELECT s."lastName", s."firstName", fa."totalDue", fa."balanceDue", fa."arrearsLevel", fa.status
    FROM fee_arrears fa
    JOIN students s ON s.id = fa."studentId"
    WHERE fa."tenantId" = $1
    ORDER BY fa."totalDue" DESC
    LIMIT 10
  `, [TENANT_ID]);
  sample.rows.forEach(r => console.log(`  ${r.lastName} ${r.firstName} | due=${r.totalDue} bal=${r.balanceDue} | ${r.arrearsLevel} | ${r.status}`));

  await client.end();
  console.log('\n✅ Arriérés créés.');
}

main().catch(e => { console.error(e); process.exit(1); });
