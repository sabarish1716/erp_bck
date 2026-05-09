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
ALTER TYPE "Gender" ADD VALUE 'OTHERS';

-- DropForeignKey
ALTER TABLE "BusCertificate" DROP CONSTRAINT "BusCertificate_busId_fkey";

-- AlterTable
ALTER TABLE "AcademicDetail" DROP COLUMN "stream",
ADD COLUMN     "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "Bus" DROP COLUMN "name";

-- AlterTable
ALTER TABLE "ExamRollNumber" DROP COLUMN "stream",
ADD COLUMN     "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "ExamSchedule" DROP COLUMN "stream",
ADD COLUMN     "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "ExamSubject" DROP COLUMN "stream",
ADD COLUMN     "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "specialClassFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "specialClassMonths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "specialClassTransportFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "specialClassTransportMonths" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "academicStream",
ADD COLUMN     "academicStreamId" TEXT;

-- AlterTable
ALTER TABLE "StudentFee" ADD COLUMN     "specialClassFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "specialClassMonths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "specialClassTransportFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "specialClassTransportMonths" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentFeeTerm" ADD COLUMN     "specialClassAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "specialClassTransportAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TransportRoute" ADD COLUMN     "numberOfTerms" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "BusCertificate";

-- DropEnum
DROP TYPE "AcademicStream";

-- CreateTable
CREATE TABLE "AcademicStream" (
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
CREATE UNIQUE INDEX "AcademicStream_name_key" ON "AcademicStream"("name");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDetail" ADD CONSTRAINT "AcademicDetail_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRollNumber" ADD CONSTRAINT "ExamRollNumber_academicStreamId_fkey" FOREIGN KEY ("academicStreamId") REFERENCES "AcademicStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
