const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const f = await prisma.studentFee.findMany({
    where: { studentId: '0d79ca50-e95a-468c-818a-636170687490' },
    orderBy: { updatedAt: 'desc' },
    include: { terms: true }
  });
  console.log(JSON.stringify(f, null, 2));
}

main().finally(() => prisma.$disconnect());
