import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter: adapter,
});

async function main() {
  // 1. Get IDs
  const tenant = await prisma.tenant.findFirst();
  const academicYear = await prisma.academicYear.findFirst();

  if (!tenant || !academicYear) {
    console.error('Missing tenant or academic year');
    return;
  }

  console.log(`Seeding HR for Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Create Leave Types
  const leaveTypes = [
    { name: 'Congés Payés', isPaid: true },
    { name: 'Congé Maladie', isPaid: true },
    { name: 'Congé Maternité', isPaid: true },
    { name: 'Sans Solde', isPaid: false },
  ];

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: lt.name } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: lt.name,
        isPaid: lt.isPaid,
      }
    });
  }
  const defaultLeaveType = await prisma.leaveType.findFirst({ where: { tenantId: tenant.id } });

  // 3. Create Allowance Types
  const allowanceTypes = [
    { name: 'Indemnité de Logement', taxable: true },
    { name: 'Indemnité de Transport', taxable: false },
    { name: 'Prime de Responsabilité', taxable: true },
  ];

  for (const at of allowanceTypes) {
    await prisma.allowanceType.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: at.name } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: at.name,
        taxable: at.taxable,
      }
    });
  }
  const housingAllowance = await prisma.allowanceType.findFirst({ where: { tenantId: tenant.id, name: 'Indemnité de Logement' } });

  // 4. Define Staff Data
  const staffData = [
    { firstName: 'Koffi', lastName: 'Mensah', category: 'ADMIN', position: 'Directeur Primaire', gender: 'MALE', email: 'k.mensah@school.com', baseSalary: 450000, level: 'PRIMAIRE' },
    { firstName: 'Afi', lastName: 'Aziawonou', category: 'ADMIN', position: 'Comptable', gender: 'FEMALE', email: 'a.afia@school.com', baseSalary: 300000, level: 'ADMIN' },
    { firstName: 'Amévi', lastName: 'Gle', category: 'ADMIN', position: 'Secrétaire Maternelle', gender: 'FEMALE', email: 'a.gle@school.com', baseSalary: 180000, level: 'MATERNELLE' },
    { firstName: 'Kodjo', lastName: 'Atavi', category: 'PEDAGOGICAL', position: 'Professeur Maths', gender: 'MALE', email: 'k.atavi@school.com', baseSalary: 350000, level: 'SECONDAIRE' },
    { firstName: 'Akua', lastName: 'Sika', category: 'PEDAGOGICAL', position: 'Institutrice CM2', gender: 'FEMALE', email: 'a.sika@school.com', baseSalary: 250000, level: 'PRIMAIRE' },
    { firstName: 'Yawo', lastName: 'Dovi', category: 'PEDAGOGICAL', position: 'Maître Maternelle', gender: 'MALE', email: 'y.dovi@school.com', baseSalary: 200000, level: 'MATERNELLE' },
    { firstName: 'Komi', lastName: 'Tossou', category: 'SUPPORT', position: 'Agent de Sécurité', gender: 'MALE', email: 'k.tossou@school.com', baseSalary: 120000, level: 'SUPPORT' },
    { firstName: 'Adjowa', lastName: 'Bessi', category: 'SUPPORT', position: 'Technicienne de surface', gender: 'FEMALE', email: 'a.bessi@school.com', baseSalary: 95000, level: 'SUPPORT' },
  ];

  for (const data of staffData) {
    const staff = await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        firstName: data.firstName,
        lastName: data.lastName,
        category: data.category,
        position: data.position,
        gender: data.gender,
        email: data.email,
        status: 'ACTIVE',
        levelAssigned: data.level,
        staffCode: `STF-${Math.floor(Math.random() * 9000) + 1000}`,
      }
    });

    await prisma.contract.create({
      data: {
        tenantId: tenant.id,
        staffId: staff.id,
        academicYearId: academicYear.id,
        type: 'CDI',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        baseSalary: new Prisma.Decimal(data.baseSalary),
        hourlyRate: new Prisma.Decimal(data.baseSalary / 160),
      }
    });

    if (defaultLeaveType) {
      await prisma.leaveRequest.create({
        data: {
          tenantId: tenant.id,
          academicYearId: academicYear.id,
          staffId: staff.id,
          leaveTypeId: defaultLeaveType.id,
          startDate: new Date('2026-04-10'),
          endDate: new Date('2026-04-12'),
          totalDays: 2,
          status: 'APPROVED',
          justification: 'Repos médical',
        }
      });
    }

    if (housingAllowance) {
      await prisma.staffAllowance.create({
        data: {
          tenantId: tenant.id,
          staffId: staff.id,
          allowanceTypeId: housingAllowance.id,
          amount: new Prisma.Decimal(25000),
          startDate: new Date('2026-01-01'),
          isActive: true,
        }
      });
    }
  }

  await prisma.payrollPeriod.create({
    data: {
      tenantId: tenant.id,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      status: 'OPEN',
    }
  });

  console.log('Seed HR completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
