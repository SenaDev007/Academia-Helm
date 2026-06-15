import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function check() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const staffCount = await prisma.staff.count();
  const contractCount = await prisma.contract.count();
  const payrollCount = await prisma.payroll.count();
  const leaveTypeCount = await prisma.leaveType.count();

  console.log('--- DB Verification ---');
  console.log('Staff count:', staffCount);
  console.log('Contract count:', contractCount);
  console.log('Payroll count:', payrollCount);
  console.log('LeaveType count:', leaveTypeCount);
  console.log('-----------------------');

  await prisma.$disconnect();
}

check().catch(console.error);
