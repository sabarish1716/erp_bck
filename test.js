const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const s = await prisma.feeStructure.findMany();
  console.log(JSON.stringify(s, null, 2));
}

main().finally(() => prisma.$disconnect());
