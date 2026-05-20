/*
  Warnings:

  - You are about to drop the column `stream` on the `AcademicDetail` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Bus` table. All the data in the column will be lost.
  - You are about to drop the column `stream` on the `ExamRollNumber` table. All the data in the column will be lost.
  - You are about to drop the column `stream` on the `ExamSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `stream` on the `ExamSubject` table. All the data in the column will be lost.
  - You are about to drop the column `academicStream` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `BusCertificate` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "Gender" ADD VALUE IF NOT EXISTS 'OTHERS';

-- DropForeignKey
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'BusCertificate') THEN
    ALTER TABLE "BusCertificate" DROP CONSTRAINT IF EXISTS "BusCertificate_busId_fkey";
  END IF;
END $$;

-- AlterTable
ALTER TABLE "AcademicDetail"
  DROP COLUMN IF EXISTS "stream",
  ADD COLUMN IF NOT EXISTS "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "Bus" DROP COLUMN IF EXISTS "name";

-- AlterTable
ALTER TABLE "ExamRollNumber"
  DROP COLUMN IF EXISTS "stream",
  ADD COLUMN IF NOT EXISTS "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "ExamSchedule"
  DROP COLUMN IF EXISTS "stream",
  ADD COLUMN IF NOT EXISTS "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "ExamSubject"
  DROP COLUMN IF EXISTS "stream",
  ADD COLUMN IF NOT EXISTS "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "FeeStructure"
  ADD COLUMN IF NOT EXISTS "specialClassFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "specialClassMonths" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "specialClassTransportFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "specialClassTransportMonths" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Student"
  DROP COLUMN IF EXISTS "academicStream",
  ADD COLUMN IF NOT EXISTS "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "StudentFee"
  ADD COLUMN IF NOT EXISTS "specialClassFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "specialClassMonths" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "specialClassTransportFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "specialClassTransportMonths" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentFeeTerm"
  ADD COLUMN IF NOT EXISTS "specialClassAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "specialClassTransportAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TransportRoute"
  ADD COLUMN IF NOT EXISTS "numberOfTerms" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE IF EXISTS "BusCertificate";

-- DropEnum (only if it still exists as an enum type, not a table)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AcademicStream' AND typtype = 'e') THEN
    DROP TYPE "AcademicStream";
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AcademicStream" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicStream_name_key" ON "AcademicStream"("name");

-- AddForeignKey
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_academicStreamId_fkey";
ALTER TABLE "Student" ADD CONSTRAINT "Student_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDetail" DROP CONSTRAINT IF EXISTS "AcademicDetail_academicStreamId_fkey";
ALTER TABLE "AcademicDetail" ADD CONSTRAINT "AcademicDetail_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubject" DROP CONSTRAINT IF EXISTS "ExamSubject_academicStreamId_fkey";
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSchedule" DROP CONSTRAINT IF EXISTS "ExamSchedule_academicStreamId_fkey";
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRollNumber" DROP CONSTRAINT IF EXISTS "ExamRollNumber_academicStreamId_fkey";
ALTER TABLE "ExamRollNumber" ADD CONSTRAINT "ExamRollNumber_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;


