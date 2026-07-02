/**
 * Quick diagnostic — count students, enrollments, admissions per tenant
 * before running the destructive cleanup.
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.startsWith('file:')) {
  console.error('❌ DATABASE_URL non définie');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(80));
  console.log('📊 DIAGNOSTIC — état actuel de la DB');
  console.log('='.repeat(80));
  console.log(`Database: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Liste des tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, subdomain: true },
      take: 20,
    });
    console.log(`🏛️  Tenants (${tenants.length}):`);
    for (const t of tenants) {
      console.log(`   - ${t.name} | slug=${t.slug || '—'} | subdomain=${t.subdomain || '—'} | id=${t.id}`);
    }
    console.log('');

    // Compter par tenant
    const studentByTenant = await pool.query(`
      SELECT "tenantId", COUNT(*)::int as count
      FROM "students"
      GROUP BY "tenantId"
      ORDER BY count DESC
    `);
    console.log('👥 Students par tenant:');
    for (const row of studentByTenant.rows) {
      const tenant = tenants.find(t => t.id === row.tenantId);
      console.log(`   - ${tenant?.name || row.tenantId}: ${row.count}`);
    }
    console.log('');

    const enrollByTenant = await pool.query(`
      SELECT "tenantId", COUNT(*)::int as count
      FROM "student_enrollments"
      GROUP BY "tenantId"
      ORDER BY count DESC
    `);
    console.log('📋 Enrollments par tenant:');
    for (const row of enrollByTenant.rows) {
      const tenant = tenants.find(t => t.id === row.tenantId);
      console.log(`   - ${tenant?.name || row.tenantId}: ${row.count}`);
    }
    console.log('');

    const admByTenant = await pool.query(`
      SELECT "tenantId", COUNT(*)::int as count
      FROM "admissions"
      GROUP BY "tenantId"
      ORDER BY count DESC
    `);
    console.log('📝 Admissions par tenant:');
    for (const row of admByTenant.rows) {
      const tenant = tenants.find(t => t.id === row.tenantId);
      console.log(`   - ${tenant?.name || row.tenantId}: ${row.count}`);
    }
    console.log('');

    // Détail des élèves (nom + tenant)
    const students = await pool.query(`
      SELECT s.id, s."firstName", s."lastName", s."matricule", s.status, t.name as tenant_name
      FROM "students" s
      LEFT JOIN "tenants" t ON t.id = s."tenantId"
      ORDER BY s."createdAt" DESC
      LIMIT 20
    `);
    console.log(`🎓 Détail des élèves (max 20):`);
    for (const s of students.rows) {
      console.log(`   - ${s.firstName} ${s.lastName} | matricule=${s.matricule || '—'} | status=${s.status} | tenant=${s.tenant_name}`);
    }
    console.log('');

    // Détail des admissions
    const admissions = await pool.query(`
      SELECT a.id, a."admissionNumber", a."firstName", a."lastName", a.status, t.name as tenant_name
      FROM "admissions" a
      LEFT JOIN "tenants" t ON t.id = a."tenantId"
      ORDER BY a."createdAt" DESC
      LIMIT 20
    `);
    console.log(`📝 Détail des admissions (max 20):`);
    for (const a of admissions.rows) {
      console.log(`   - ${a.admissionNumber} | ${a.firstName} ${a.lastName} | status=${a.status} | tenant=${a.tenant_name}`);
    }
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ Diagnostic terminé');
    console.log('='.repeat(80));

  } catch (err: any) {
    console.error('❌ Erreur :', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
