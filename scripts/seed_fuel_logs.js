const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find a driver with a bus assigned
  const driver = await prisma.driver.findFirst({
    where: { busId: { not: null } },
    include: { bus: true },
  });

  let d = driver;
  if (!d) {
    console.log('No driver with bus found. Creating test bus & driver...');
    const bus = await prisma.bus.create({ data: { number: 'TEST-BUS-01' } });
    d = await prisma.driver.create({
      data: { name: 'Test Driver', phone: '9999999990', busId: bus.id },
      include: { bus: true },
    });
  } else {
    console.log(`Using driver: ${d.name} | Bus: ${d.bus?.number}`);
  }

  const now = new Date();
  const logs = [
    {
      driverId: d.id,
      busId: d.busId,
      plateNo: d.bus?.number || null,
      odometer: 12450,
      litres: 40,
      fuelCostPerLitre: 102.5,
      totalCost: 4100,
      note: 'Morning fill-up before school route',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Car_odometer_reading_-_151_miles.jpg/640px-Car_odometer_reading_-_151_miles.jpg',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      paymentMode: 'CASH',
    },
    {
      driverId: d.id,
      busId: d.busId,
      plateNo: d.bus?.number || null,
      odometer: 12600,
      litres: 30,
      fuelCostPerLitre: 103.0,
      totalCost: 3090,
      note: 'Evening refuel',
      imageUrl: null,
      timestamp: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      paymentMode: 'CARD',
    },
    {
      driverId: d.id,
      busId: d.busId,
      plateNo: d.bus?.number || null,
      odometer: 12780,
      litres: 50,
      fuelCostPerLitre: 101.75,
      totalCost: 5087.5,
      note: 'Weekly top-up',
      imageUrl: null,
      timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      paymentMode: null,
    },
  ];

  const { v4: uuidv4 } = require('crypto');
  // use crypto.randomUUID() available in Node 14.17+
  function genId() {
    return require('crypto').randomUUID();
  }

  for (const log of logs) {
    const id = genId();
    const createdAt = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "FuelLog" (id, "driverId", "busId", "plateNo", odometer, litres, "fuelCostPerLitre", "totalCost", note, "imageUrl", timestamp, "paymentMode", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::\"PaymentMode\", $13)`,
      id,
      log.driverId,
      log.busId,
      log.plateNo,
      log.odometer,
      log.litres,
      log.fuelCostPerLitre,
      log.totalCost,
      log.note,
      log.imageUrl,
      log.timestamp,
      log.paymentMode,
      createdAt,
    );
    console.log(`✓ ${log.litres}L @ ₹${log.fuelCostPerLitre}/L = ₹${log.totalCost} | paymentMode: ${log.paymentMode ?? 'null'}`);
  }

  console.log('\n✅ Seed complete! Refresh the Transport Expense Dashboard.');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
