const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const cats = ['STATIONERY', 'UNIFORM', 'BOOKS', 'SANITARY', 'FURNITURE', 'ID_CARD', 'ACCESSORIES', 'NOTEBOOKS', 'OTHER'];
  for (const c of cats) {
    await prisma.itemCategory.upsert({
      where: { name: c },
      update: {},
      create: { name: c }
    });
  }
  console.log('Categories seeded!');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
