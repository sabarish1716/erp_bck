/*
  Warnings:

  - Changed the type of `type` on the `Discount` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FLAT', 'PERCENTAGE', 'TEACHER_DISCOUNT', 'SIBLING_DISCOUNT', 'RTE_COMMUNITY');

-- DropIndex
DROP INDEX "AcademicDetail_studentId_key";

-- DropIndex
DROP INDEX "Document_studentId_key";

-- AlterTable: Convert existing string type to enum safely
-- First add a temp column, copy data, drop old, rename
ALTER TABLE "Discount" ADD COLUMN "type_new" "DiscountType";
UPDATE "Discount" SET "type_new" = CASE
  WHEN "type" = 'FLAT' THEN 'FLAT'::"DiscountType"
  WHEN "type" = 'PERCENTAGE' THEN 'PERCENTAGE'::"DiscountType"
  ELSE 'FLAT'::"DiscountType"
END;
ALTER TABLE "Discount" DROP COLUMN "type";
ALTER TABLE "Discount" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "Discount" ALTER COLUMN "type" SET NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "siblingGroupId" TEXT,
ADD COLUMN     "staffParentId" TEXT;

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT NOT NULL,
    "department" TEXT,
    "qualification" TEXT,
    "joiningDate" TIMESTAMP(3),
    "salary" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_employeeId_key" ON "Staff"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_staffParentId_fkey" FOREIGN KEY ("staffParentId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
