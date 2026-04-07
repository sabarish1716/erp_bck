const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const logs = await p.fuelLog.findMany({ orderBy: { timestamp: "desc" }, take: 10, select: { id: true, plateNo: true, busId: true, timestamp: true, driverId: true, litres: true, odometer: true, imageUrl: true } });
  console.log(JSON.stringify(logs, null, 2));
  await p.$disconnect();
})();