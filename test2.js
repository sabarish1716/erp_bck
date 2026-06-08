const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fees = await prisma.studentFeeTerm.findMany({
    where: { OR: [ { termName: 'Application Fee' }, { termName: 'Transport 3' }, { termNumber: 3 } ] },
    include: { studentFee: { include: { student: true } } },
    take: 10
  });
  console.log(JSON.stringify(fees, null, 2));
}

main().finally(() => prisma.$disconnect());
