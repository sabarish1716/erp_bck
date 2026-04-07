const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const drivers = await p.driver.findMany({
    where: { phone: { contains: "7305421828" } },
    select: { id: true, name: true, phone: true, busId: true, bus: { select: { number: true } } }
  });
  console.log(JSON.stringify(drivers, null, 2));
  await p.$disconnect();
})();