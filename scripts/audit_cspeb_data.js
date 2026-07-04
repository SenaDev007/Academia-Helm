#!/usr/bin/env node
/**
 * Audit CSPEB tenant data — find fictitious data in Élèves, Finance, Pédagogie.
 */

const { Client } = require('/home/z/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon DB\n');

    // ─── 1. Find CSPEB tenant ─────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('1. TENANTS');
    console.log('━'.repeat(70));
    const tenantsRes = await client.query(`
      SELECT id, name, slug, subdomain, status, "subscriptionStatus", "createdAt"
      FROM tenants
      ORDER BY "createdAt";
    `);
    for (const t of tenantsRes.rows) {
      console.log(`  - ${t.name} | slug=${t.slug} | subdomain=${t.subdomain} | id=${t.id}`);
    }

    const cspebRes = await client.query(`
      SELECT id, name, slug, subdomain FROM tenants
      WHERE slug ILIKE '%cspeb%' OR subdomain ILIKE '%cspeb%' OR name ILIKE '%cspeb%' OR name ILIKE '%éveil%afrique%';
    `);
    if (cspebRes.rows.length === 0) {
      console.log('\n❌ CSPEB tenant not found');
      return;
    }
    const cspeb = cspebRes.rows[0];
    console.log(`\n  → CSPEB tenant: ${cspeb.name} (id=${cspeb.id})\n`);

    const cspebId = cspeb.id;

    // ─── 2. ÉLÈVES ────────────────────────────────────────────────────────
    console.log('━'.repeat(70));
    console.log('2. MODULE ÉLÈVES — Students');
    console.log('━'.repeat(70));
    const studentsRes = await client.query(`
      SELECT id, "firstName", "lastName", "studentCode", matricule, gender, status, "createdAt"
      FROM students
      WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 100;
    `, [cspebId]);
    console.log(`  Total students: ${studentsRes.rows.length}`);
    for (const s of studentsRes.rows) {
      console.log(`    - ${s.firstName} ${s.lastName} | code=${s.studentCode || 'N/A'} | matricule=${s.matricule || 'N/A'} | gender=${s.gender} | status=${s.status} | created=${s.createdAt?.toISOString?.() || s.createdAt}`);
    }

    // ─── 3. FINANCE ───────────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('3. MODULE FINANCE');
    console.log('━'.repeat(70));

    const tables = [
      { label: 'Payments', table: 'payments' },
      { label: 'Fee structures', table: 'fee_structures' },
      { label: 'Expenses', table: 'expenses' },
    ];
    for (const { label, table } of tables) {
      const countRes = await client.query(`SELECT COUNT(*) as count FROM ${table} WHERE "tenantId" = $1;`, [cspebId]);
      console.log(`  ${label}: ${countRes.rows[0].count}`);

      if (table === 'payments') {
        const sample = await client.query(`
          SELECT id, amount, "paymentMethod", status, "paymentDate", reference, "createdAt"
          FROM ${table} WHERE "tenantId" = $1
          ORDER BY "createdAt" DESC LIMIT 10;
        `, [cspebId]);
        for (const p of sample.rows) {
          console.log(`    💰 ${p.amount} | method=${p.paymentMethod} | status=${p.status} | date=${p.paymentDate} | ref=${p.reference || 'N/A'} | created=${p.createdAt?.toISOString?.() || p.createdAt}`);
        }
      } else if (table === 'fee_structures') {
        const sample = await client.query(`
          SELECT id, name, "totalAmount", "feeType", "isActive", "createdAt"
          FROM ${table} WHERE "tenantId" = $1
          ORDER BY "createdAt" DESC LIMIT 10;
        `, [cspebId]);
        for (const f of sample.rows) {
          console.log(`    💵 ${f.name} | ${f.totalAmount} | type=${f.feeType} | active=${f.isActive} | created=${f.createdAt?.toISOString?.() || f.createdAt}`);
        }
      } else if (table === 'expenses') {
        const sample = await client.query(`
          SELECT id, description, amount, category, "expenseDate", status, "createdAt"
          FROM ${table} WHERE "tenantId" = $1
          ORDER BY "createdAt" DESC LIMIT 10;
        `, [cspebId]);
        for (const e of sample.rows) {
          console.log(`    💸 ${e.description} | ${e.amount} | cat=${e.category} | date=${e.expenseDate} | status=${e.status} | created=${e.createdAt?.toISOString?.() || e.createdAt}`);
        }
      }
    }

    // ─── 4. PÉDAGOGIE ─────────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('4. MODULE PÉDAGOGIE');
    console.log('━'.repeat(70));

    const staffRes = await client.query(`
      SELECT id, "firstName", "lastName", email, position, "roleType", "department", status, "createdAt"
      FROM staff
      WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 50;
    `, [cspebId]);
    console.log(`  Staff: ${staffRes.rows.length} records`);
    for (const s of staffRes.rows) {
      console.log(`    👤 ${s.firstName} ${s.lastName} | email=${s.email || 'N/A'} | position=${s.position} | role=${s.roleType} | dept=${s.department} | status=${s.status} | created=${s.createdAt?.toISOString?.() || s.createdAt}`);
    }

    const subjectsRes = await client.query(`
      SELECT id, name, code, language, coefficient, "createdAt"
      FROM subjects
      WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC LIMIT 50;
    `, [cspebId]);
    console.log(`\n  Subjects: ${subjectsRes.rows.length} records`);
    for (const s of subjectsRes.rows) {
      console.log(`    📚 ${s.name} | code=${s.code} | language=${s.language || 'N/A'} | coef=${s.coefficient} | created=${s.createdAt?.toISOString?.() || s.createdAt}`);
    }

    const classesRes = await client.query(`
      SELECT id, name, code, language, capacity, "createdAt"
      FROM classes
      WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC LIMIT 50;
    `, [cspebId]);
    console.log(`\n  Classes: ${classesRes.rows.length} records`);
    for (const c of classesRes.rows) {
      console.log(`    🏫 ${c.name} | code=${c.code} | language=${c.language || 'N/A'} | cap=${c.capacity} | created=${c.createdAt?.toISOString?.() || c.createdAt}`);
    }

    // ─── 5. Data leakage check ────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('5. DATA LEAKAGE — Same email across tenants');
    console.log('━'.repeat(70));

    const leakStudentsRes = await client.query(`
      SELECT s1.email, t1.name as t1_name, t2.name as t2_name
      FROM students s1
      JOIN students s2 ON s1.email = s2.email AND s1."tenantId" < s2."tenantId"
      JOIN tenants t1 ON s1."tenantId" = t1.id
      JOIN tenants t2 ON s2."tenantId" = t2.id
      WHERE s1.email IS NOT NULL AND s1.email != ''
      LIMIT 20;
    `);
    console.log(`  Students with same email across tenants: ${leakStudentsRes.rows.length}`);
    for (const l of leakStudentsRes.rows) {
      console.log(`    - email=${l.email} | ${l.t1_name} ↔ ${l.t2_name}`);
    }

    const leakStaffRes = await client.query(`
      SELECT s1.email, t1.name as t1_name, t2.name as t2_name
      FROM staff s1
      JOIN staff s2 ON s1.email = s2.email AND s1."tenantId" < s2."tenantId"
      JOIN tenants t1 ON s1."tenantId" = t1.id
      JOIN tenants t2 ON s2."tenantId" = t2.id
      WHERE s1.email IS NOT NULL AND s1.email != ''
      LIMIT 20;
    `);
    console.log(`  Staff with same email across tenants: ${leakStaffRes.rows.length}`);
    for (const l of leakStaffRes.rows) {
      console.log(`    - email=${l.email} | ${l.t1_name} ↔ ${l.t2_name}`);
    }

    // ─── 6. Summary table ─────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(70));
    console.log('6. SUMMARY — Records by tenant');
    console.log('━'.repeat(70));

    const tablesToCheck = [
      'students', 'staff', 'subjects', 'classes',
      'payments', 'fee_structures', 'expenses',
      'academic_years',
    ];

    console.log('  Table'.padEnd(25) + tenantsRes.rows.map(t => (t.slug || t.name || '').substring(0, 20).padEnd(22)).join(''));
    console.log('  ' + '─'.repeat(24) + ' ' + tenantsRes.rows.map(() => '─'.repeat(21)).join(' '));

    for (const table of tablesToCheck) {
      const counts = await client.query(`
        SELECT "tenantId", COUNT(*) as count
        FROM ${table}
        WHERE "tenantId" IS NOT NULL
        GROUP BY "tenantId";
      `);
      const countMap = new Map(counts.rows.map(r => [r.tenantId, parseInt(r.count)]));
      const line = '  ' + table.padEnd(25) + tenantsRes.rows.map(t => String(countMap.get(t.id) || 0).padEnd(22)).join('');
      console.log(line);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

main();
