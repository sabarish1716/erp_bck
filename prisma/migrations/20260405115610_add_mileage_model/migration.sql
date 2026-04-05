-- CreateTable
CREATE TABLE "Mileage" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "odometer" DOUBLE PRECISION NOT NULL,
    "snapshotTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mileage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mileage_busId_idx" ON "Mileage"("busId");

-- CreateIndex
CREATE INDEX "Mileage_driverId_idx" ON "Mileage"("driverId");

-- CreateIndex
CREATE INDEX "Mileage_snapshotTime_idx" ON "Mileage"("snapshotTime");

-- AddForeignKey
ALTER TABLE "Mileage" ADD CONSTRAINT "Mileage_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mileage" ADD CONSTRAINT "Mileage_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
