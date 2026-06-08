const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Ananya Nair' } },
    include: { studentFees: { include: { terms: true, payments: true } } }
  });
  console.log(JSON.stringify(student.studentFees, null, 2));
}

main().finally(() => prisma.$disconnect());
