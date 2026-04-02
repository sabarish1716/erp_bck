-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "houseId" TEXT;

-- AlterTable
ALTER TABLE "TransportRoute" ADD COLUMN     "conductorName" TEXT,
ADD COLUMN     "conductorPhone" TEXT;

-- CreateTable
CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorCode" TEXT,
    "motto" TEXT,
    "captainId" TEXT,
    "viceCaptainId" TEXT,
    "bandCaptainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "House_name_key" ON "House"("name");

-- CreateIndex
CREATE UNIQUE INDEX "House_captainId_key" ON "House"("captainId");

-- CreateIndex
CREATE UNIQUE INDEX "House_viceCaptainId_key" ON "House"("viceCaptainId");

-- CreateIndex
CREATE UNIQUE INDEX "House_bandCaptainId_key" ON "House"("bandCaptainId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_viceCaptainId_fkey" FOREIGN KEY ("viceCaptainId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_bandCaptainId_fkey" FOREIGN KEY ("bandCaptainId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
