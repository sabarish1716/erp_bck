-- CreateTable
CREATE TABLE "FuelLog" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "busId" TEXT,
    "plateNo" TEXT,
    "odometer" DOUBLE PRECISION NOT NULL,
    "litres" DOUBLE PRECISION NOT NULL,
    "fuelCostPerLitre" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "note" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuelLog_driverId_idx" ON "FuelLog"("driverId");

-- CreateIndex
CREATE INDEX "FuelLog_busId_idx" ON "FuelLog"("busId");

-- CreateIndex
CREATE INDEX "FuelLog_plateNo_timestamp_idx" ON "FuelLog"("plateNo", "timestamp");

-- AddForeignKey
ALTER TABLE "FuelLog" ADD CONSTRAINT "FuelLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelLog" ADD CONSTRAINT "FuelLog_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
