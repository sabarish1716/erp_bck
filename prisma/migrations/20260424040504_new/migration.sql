-- AlterEnum
ALTER TYPE "StaffCategory" ADD VALUE 'NON_TEACHING_ACTING_DRIVER';

-- AlterTable
ALTER TABLE "TransportExpense" ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "unitCost" DOUBLE PRECISION;
