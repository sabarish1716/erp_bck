-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocRequestType" ADD VALUE 'STAFF_RECOGNITION';
ALTER TYPE "DocRequestType" ADD VALUE 'STAFF_EXPERIENCE';
ALTER TYPE "DocRequestType" ADD VALUE 'STAFF_SALARY';

-- DropForeignKey
ALTER TABLE "DocRequest" DROP CONSTRAINT "DocRequest_studentId_fkey";

-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "applicableHeads" JSONB;

-- AlterTable
ALTER TABLE "DocRequest" ADD COLUMN     "customFields" JSONB,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "templateText" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FeeKitItem" ADD COLUMN     "termNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "applicationFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "kitTag" TEXT;

-- AlterTable
ALTER TABLE "StudentFee" ADD COLUMN     "applicationFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentFeeTerm" ADD COLUMN     "applicationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentKitIssue" ADD COLUMN     "issuerName" TEXT;

-- CreateIndex
CREATE INDEX "DocRequest_staffId_idx" ON "DocRequest"("staffId");

-- AddForeignKey
ALTER TABLE "DocRequest" ADD CONSTRAINT "DocRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocRequest" ADD CONSTRAINT "DocRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
