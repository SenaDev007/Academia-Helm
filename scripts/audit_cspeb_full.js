#!/usr/bin/env node
/**
 * Audit CSPEB tenant data — list ALL tables with records for CSPEB.
 */
const { Client } = require('/home/z/node_modules/pg');

const CSPEB_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const AH_ID = '4246cd3c-518a-44bb-a5e0-4109b8eca372';

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
    connectionTimeoutMillis: 15000,
    query_timeout: 30000,
  });

  try {
    await client.connect();
    console.log('CONNECTED');

    // 1. List all tables with tenantId column
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema='public' AND column_name = 'tenantId'
      ORDER BY table_name;
    `);

    console.log('\n=== COUNTS FOR CSPEB tenant ===');
    let cspebCounts = [];
    for (const r of tablesRes.rows) {
      const table = r.table_name;
      try {
        const c = await client.query(`SELECT COUNT(*)::int as n FROM "${table}" WHERE "tenantId" = $1`, [CSPEB_ID]);
        const n = c.rows[0].n;
        if (n > 0) {
          console.log(`  ${table.padEnd(40)} ${n}`);
          cspebCounts.push({ table, count: n });
        }
      } catch (e) {
        // skip
      }
    }

    console.log('\n=== COUNTS FOR Academia Helm tenant ===');
    for (const r of tablesRes.rows) {
      const table = r.table_name;
      try {
        const c = await client.query(`SELECT COUNT(*)::int as n FROM "${table}" WHERE "tenantId" = $1`, [AH_ID]);
        const n = c.rows[0].n;
        if (n > 0) {
          console.log(`  ${table.padEnd(40)} ${n}`);
        }
      } catch (e) {
        // skip
      }
    }

    // ─── Sample fictitious students from AH tenant ────────────────────────
    console.log('\n=== AH tenant — sample students (potential leakage source) ===');
    const sampleStud = await client.query(`
      SELECT "firstName", "lastName", "studentCode", email, status, "createdAt"
      FROM students WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC LIMIT 30;
    `, [AH_ID]);
    for (const s of sampleStud.rows) {
      console.log(`  - ${s.firstName} ${s.lastName} | code=${s.studentCode} | email=${s.email || 'N/A'} | status=${s.status} | created=${s.createdAt?.toISOString?.() || s.createdAt}`);
    }

    console.log('\n=== AH tenant — sample staff ===');
    const sampleStaff = await client.query(`
      SELECT "firstName", "lastName", email, position, "roleType", status, "createdAt"
      FROM staff WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC LIMIT 30;
    `, [AH_ID]);
    for (const s of sampleStaff.rows) {
      console.log(`  - ${s.firstName} ${s.lastName} | email=${s.email} | pos=${s.position} | role=${s.roleType} | status=${s.status} | created=${s.createdAt?.toISOString?.() || s.createdAt}`);
    }

    console.log('\n=== AH tenant — sample subjects ===');
    const sampleSubj = await client.query(`
      SELECT name, code, language, coefficient, "createdAt"
      FROM subjects WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC LIMIT 30;
    `, [AH_ID]);
    for (const s of sampleSubj.rows) {
      console.log(`  - ${s.name} | code=${s.code} | lang=${s.language || 'N/A'} | coef=${s.coefficient} | created=${s.createdAt?.toISOString?.() || s.createdAt}`);
    }

    // ─── Staff contracts for CSPEB (should be preserved per user) ─────────
    console.log('\n=== CSPEB staff_contracts (HR — should be REAL data, preserve) ===');
    try {
      const scRes = await client.query(`
        SELECT sc.id, sc."staffId", st."firstName", st."lastName", sc.type, sc.status, sc."createdAt"
        FROM staff_contracts sc
        LEFT JOIN staff st ON sc."staffId" = st.id
        WHERE sc."tenantId" = $1
        ORDER BY sc."createdAt" DESC LIMIT 30;
      `, [CSPEB_ID]);
      console.log(`  Count: ${scRes.rows.length}`);
      for (const s of scRes.rows) {
        console.log(`    - ${s.firstName || '?'} ${s.lastName || '?'} | type=${s.type} | status=${s.status} | created=${s.createdAt?.toISOString?.() || s.createdAt}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }

    // ─── Admissions (test data) ───────────────────────────────────────────
    console.log('\n=== CSPEB admissions ===');
    try {
      const aRes = await client.query(`
        SELECT id, "candidateName", email, status, "createdAt"
        FROM admissions WHERE "tenantId" = $1
        ORDER BY "createdAt" DESC;
      `, [CSPEB_ID]);
      for (const a of aRes.rows) {
        console.log(`  - ${a.candidateName} | email=${a.email} | status=${a.status} | created=${a.createdAt?.toISOString?.() || a.createdAt}`);
      }
    } catch (e) {
      // Try alternate columns
      try {
        const aRes = await client.query(`SELECT * FROM admissions WHERE "tenantId" = $1 LIMIT 5`, [CSPEB_ID]);
        console.log(`  (${aRes.rows.length} admissions — columns: ${Object.keys(aRes.rows[0] || {}).join(', ')})`);
        for (const a of aRes.rows) {
          console.log(`  - ${JSON.stringify(a).substring(0, 200)}`);
        }
      } catch (e2) {
        console.log(`  Error: ${e2.message}`);
      }
    }

    console.log('\nDONE');
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
