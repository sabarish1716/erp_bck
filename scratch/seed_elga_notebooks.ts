import { PrismaClient, ItemCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding ELGA Notebooks to catalogue...');

  const masterStore = await prisma.store.findFirst({ where: { isMaster: true } });
  if (!masterStore) {
    console.error('❌ Master store not found. Please create a store first.');
    return;
  }

  const notebooks = [
    { name: '80 pages S/S Ruled', sku: 'ELGA-NB-80SS', sellingPrice: 35 },
    { name: '80 pages S/B 4 ruled', sku: 'ELGA-NB-80SB4', sellingPrice: 35 },
    { name: '120 pages S/S Ruled', sku: 'ELGA-NB-120SS', sellingPrice: 50 },
    { name: '120 pages L/S Ruled', sku: 'ELGA-NB-120LS', sellingPrice: 50 },
    { name: '160 pages L/S Ruled', sku: 'ELGA-NB-160LS', sellingPrice: 65 },
  ];

  for (const nb of notebooks) {
    // 1. Upsert StoreItem
    const item = await prisma.storeItem.upsert({
      where: { sku: nb.sku },
      update: {
        name: nb.name,
        category: ItemCategory.ELGA_BOOKS,
        sellingPrice: nb.sellingPrice,
        isActive: true,
      },
      create: {
        name: nb.name,
        sku: nb.sku,
        category: ItemCategory.ELGA_BOOKS,
        sellingPrice: nb.sellingPrice,
        costPrice: nb.sellingPrice * 0.6,
        unit: 'pcs',
        isActive: true,
      },
    });

    // 2. Add Stock to Master Store if not exists
    await prisma.storeStock.upsert({
      where: {
        storeId_itemId: {
          storeId: masterStore.id,
          itemId: item.id,
        },
      },
      update: {
        quantity: { increment: 100 }, // Add more stock for testing
      },
      create: {
        storeId: masterStore.id,
        itemId: item.id,
        quantity: 100,
      },
    });

    console.log(`✅ Added/Updated: ${nb.name} (Stock: 100)`);
  }

  console.log('✨ ELGA Notebooks are now available in the catalogue!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding ELGA notebooks:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
