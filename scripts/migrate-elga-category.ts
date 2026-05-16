import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Step 1: Add NOTEBOOKS to the ItemCategory enum...');
  await prisma.$executeRawUnsafe(`ALTER TYPE "ItemCategory" ADD VALUE IF NOT EXISTS 'NOTEBOOKS'`);
  console.log('Done.');

  console.log('Step 2: Migrate existing ELGA_BOOKS rows to NOTEBOOKS...');
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "StoreItem" SET category = 'NOTEBOOKS' WHERE category = 'ELGA_BOOKS'`
  );
  console.log(`Updated ${result} rows.`);

  console.log('Step 3: Done. Now run `npx prisma db push --accept-data-loss` to remove ELGA_BOOKS from the enum.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
