/*
  Warnings:

  - You are about to drop the column `vanId` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the `Van` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[driverId,createdAt]` on the table `Location` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `busId` to the `Location` table without a default value. This is not possible if the table is not empty.
  - Added the required column `driverId` to the `Location` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_vanId_fkey";

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "vanId",
ADD COLUMN     "busId" TEXT NOT NULL,
ADD COLUMN     "driverId" TEXT NOT NULL,
ADD COLUMN     "speed" DOUBLE PRECISION,
ALTER COLUMN "createdAt" DROP DEFAULT;

-- DropTable
DROP TABLE "Van";

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "deviceId" TEXT,
    "busId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "routeName" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_driverId_idx" ON "Location"("driverId");

-- CreateIndex
CREATE INDEX "Location_busId_idx" ON "Location"("busId");

-- CreateIndex
CREATE INDEX "Location_createdAt_idx" ON "Location"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Location_driverId_createdAt_key" ON "Location"("driverId", "createdAt");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
