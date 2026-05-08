-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "line1" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Bus" ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "BusCertificate" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "certificateNo" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusCertificate_busId_idx" ON "BusCertificate"("busId");

-- CreateIndex
CREATE INDEX "BusCertificate_expiryDate_idx" ON "BusCertificate"("expiryDate");

-- AddForeignKey
ALTER TABLE "BusCertificate" ADD CONSTRAINT "BusCertificate_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
