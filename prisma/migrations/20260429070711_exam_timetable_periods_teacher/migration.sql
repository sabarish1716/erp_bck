-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('REVISION', 'EXAMINATION');

-- AlterTable
ALTER TABLE "ExamSchedule" ADD COLUMN     "periodEnd" INTEGER,
ADD COLUMN     "periodStart" INTEGER,
ADD COLUMN     "periodType" "PeriodType";

-- AlterTable
ALTER TABLE "ExamSubject" ADD COLUMN     "teacherId" TEXT;

-- CreateIndex
CREATE INDEX "ExamSchedule_examDate_periodStart_periodEnd_idx" ON "ExamSchedule"("examDate", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ExamSubject_teacherId_idx" ON "ExamSubject"("teacherId");

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
