-- AlterEnum
ALTER TYPE "ItemCategory" ADD VALUE 'ELGA_BOOKS';

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "hasElgaBooks" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentFee" ADD COLUMN     "hasElgaBooks" BOOLEAN NOT NULL DEFAULT false;
