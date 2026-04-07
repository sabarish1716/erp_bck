const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const logs = await p.fuelLog.findMany({ take: 10, orderBy: { timestamp: "desc" }, include: { driver: { select: { name: true } }, bus: { select: { number: true } } } });
  console.log(JSON.stringify(logs, null, 2));
  await p.$disconnect();
})();