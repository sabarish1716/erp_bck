const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fee = await prisma.studentFee.findFirst({
    where: { student: { name: { contains: 'Ananya Nair' } } },
    include: { terms: { orderBy: { termNumber: 'asc' } } }
  });
  console.log(JSON.stringify(fee, null, 2));
}

main().finally(() => prisma.$disconnect());
