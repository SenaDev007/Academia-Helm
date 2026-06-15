import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const deleted = await prisma.tenant.deleteMany({
      where: {
        slug: 'yehi-or-tech',
      },
    });
    console.log(`Deleted ${deleted.count} tenants named yehi-or-tech`);
  } catch (error) {
    console.error('Error deleting tenant:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
