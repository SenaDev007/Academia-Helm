import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const countries = await prisma.country.findMany({
    select: { id: true, code: true, name: true }
  });
  console.log(JSON.stringify(countries, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
