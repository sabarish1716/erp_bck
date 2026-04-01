const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deletedCount = await prisma.location.deleteMany({
    where: {
      createdAt: {
        gt: new Date('2026-05-01') // Delete anything in the future (August seed data)
      }
    }
  });
  console.log(`Deleted ${deletedCount.count} future-dated records.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
