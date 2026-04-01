const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const drivers = await prisma.driver.findMany({
    include: { bus: true }
  });
  console.log('--- CURRENT DRIVERS ---');
  console.log(JSON.stringify(drivers, null, 2));
  
  const buses = await prisma.bus.findMany();
  console.log('--- AVAILABLE BUSES ---');
  console.log(JSON.stringify(buses, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
