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

  // 2. Create Allowance Types
  const allowanceTypes = [
    { name: 'Indemnité de Logement', code: 'LOG', isTaxable: true, isCnss: false, amount: 25000, isFixed: true },
    { name: 'Indemnité de Transport', code: 'TRN', isTaxable: false, isCnss: false, amount: 15000, isFixed: true },
    { name: 'Prime de Responsabilité', code: 'REP', isTaxable: true, isCnss: false, amount: 50000, isFixed: true },
  ];

  for (const at of allowanceTypes) {
    await prisma.allowanceType.upsert({
      where: { code: at.code },
      update: {},
      create: {
        tenantId: tenant.id,
        name: at.name,
        code: at.code,
        isTaxable: at.isTaxable,
        isCnss: at.isCnss,
        amount: at.amount,
        isFixed: at.isFixed,
        isActive: true,
      }
    });
  }
  const housingAllowance = await prisma.allowanceType.findFirst({ where: { tenantId: tenant.id, code: 'LOG' } });

  // 3. Define Staff Data
  const staffData = [
    { firstName: 'Koffi', lastName: 'Mensah', roleType: 'ADMIN', position: 'Directeur Primaire', gender: 'MALE', email: 'k.mensah@school.com', baseSalary: 450000 },
    { firstName: 'Afi', lastName: 'Aziawonou', roleType: 'ADMIN', position: 'Comptable', gender: 'FEMALE', email: 'a.afia@school.com', baseSalary: 300000 },
    { firstName: 'Amévi', lastName: 'Gle', roleType: 'ADMIN', position: 'Secrétaire Maternelle', gender: 'FEMALE', email: 'a.gle@school.com', baseSalary: 180000 },
    { firstName: 'Kodjo', lastName: 'Atavi', roleType: 'TEACHER', position: 'Professeur Maths', gender: 'MALE', email: 'k.atavi@school.com', baseSalary: 350000 },
    { firstName: 'Akua', lastName: 'Sika', roleType: 'TEACHER', position: 'Institutrice CM2', gender: 'FEMALE', email: 'a.sika@school.com', baseSalary: 250000 },
    { firstName: 'Yawo', lastName: 'Dovi', roleType: 'TEACHER', position: 'Maître Maternelle', gender: 'MALE', email: 'y.dovi@school.com', baseSalary: 200000 },
    { firstName: 'Komi', lastName: 'Tossou', roleType: 'SUPPORT', position: 'Agent de Sécurité', gender: 'MALE', email: 'k.tossou@school.com', baseSalary: 120000 },
    { firstName: 'Adjowa', lastName: 'Bessi', roleType: 'SUPPORT', position: 'Technicienne de surface', gender: 'FEMALE', email: 'a.bessi@school.com', baseSalary: 95000 },
  ];

  for (const data of staffData) {
    const staff = await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        firstName: data.firstName,
        lastName: data.lastName,
        roleType: data.roleType,
        position: data.position,
        gender: data.gender,
        email: data.email,
        status: 'ACTIVE',
        salary: new Prisma.Decimal(data.baseSalary),
        employeeNumber: `STF-${Math.floor(Math.random() * 9000) + 1000}`,
      }
    });

    await prisma.contract.create({
      data: {
        tenantId: tenant.id,
        staffId: staff.id,
        contractType: 'CDI',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        baseSalary: new Prisma.Decimal(data.baseSalary),
      }
    });

    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        staffId: staff.id,
        type: 'CONGE_PAYE',
        startDate: new Date('2026-04-10'),
        endDate: new Date('2026-04-12'),
        status: 'APPROVED',
        reason: 'Repos médical',
      }
    });

    if (housingAllowance) {
      await prisma.staffAllowance.create({
        data: {
          tenantId: tenant.id,
          staffId: staff.id,
          allowanceTypeId: housingAllowance.id,
          amount: new Prisma.Decimal(25000),
          effectiveDate: new Date('2026-01-01'),
          status: 'ACTIVE',
        }
      });
    }
  }

  await prisma.payroll.create({
    data: {
      tenantId: tenant.id,
      academicYearId: academicYear.id,
      month: '2026-05',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      status: 'DRAFT',
      totalAmount: new Prisma.Decimal(0),
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
