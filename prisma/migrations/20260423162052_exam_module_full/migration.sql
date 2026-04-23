-- CreateEnum
CREATE TYPE "ExamSession" AS ENUM ('FN', 'AN');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubject" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "standard" "Standard" NOT NULL,
    "section" TEXT,
    "stream" "AcademicStream",
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "passMarks" INTEGER NOT NULL DEFAULT 35,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamHall" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamHall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSchedule" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "standard" "Standard" NOT NULL,
    "section" TEXT,
    "stream" "AcademicStream",
    "examDate" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "session" "ExamSession" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamScheduleHall" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamScheduleHall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRollNumber" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "standard" "Standard" NOT NULL,
    "section" TEXT,
    "stream" "AcademicStream",
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamRollNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSeatAllocation" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rollNumberId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_code_key" ON "Exam"("code");

-- CreateIndex
CREATE INDEX "Exam_academicYear_status_idx" ON "Exam"("academicYear", "status");

-- CreateIndex
CREATE INDEX "ExamSubject_examId_standard_section_idx" ON "ExamSubject"("examId", "standard", "section");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubject_examId_code_key" ON "ExamSubject"("examId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ExamHall_name_key" ON "ExamHall"("name");

-- CreateIndex
CREATE INDEX "ExamHall_isActive_idx" ON "ExamHall"("isActive");

-- CreateIndex
CREATE INDEX "ExamSchedule_examDate_startsAt_endsAt_idx" ON "ExamSchedule"("examDate", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ExamSchedule_examId_standard_section_idx" ON "ExamSchedule"("examId", "standard", "section");

-- CreateIndex
CREATE INDEX "ExamScheduleHall_hallId_idx" ON "ExamScheduleHall"("hallId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamScheduleHall_scheduleId_hallId_key" ON "ExamScheduleHall"("scheduleId", "hallId");

-- CreateIndex
CREATE INDEX "ExamRollNumber_examId_standard_section_idx" ON "ExamRollNumber"("examId", "standard", "section");

-- CreateIndex
CREATE UNIQUE INDEX "ExamRollNumber_examId_studentId_key" ON "ExamRollNumber"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamRollNumber_examId_rollNumber_key" ON "ExamRollNumber"("examId", "rollNumber");

-- CreateIndex
CREATE INDEX "ExamSeatAllocation_scheduleId_hallId_idx" ON "ExamSeatAllocation"("scheduleId", "hallId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAllocation_scheduleId_studentId_key" ON "ExamSeatAllocation"("scheduleId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAllocation_scheduleId_hallId_seatNumber_key" ON "ExamSeatAllocation"("scheduleId", "hallId", "seatNumber");

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "ExamSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamScheduleHall" ADD CONSTRAINT "ExamScheduleHall_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamScheduleHall" ADD CONSTRAINT "ExamScheduleHall_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "ExamHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRollNumber" ADD CONSTRAINT "ExamRollNumber_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRollNumber" ADD CONSTRAINT "ExamRollNumber_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "ExamHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_rollNumberId_fkey" FOREIGN KEY ("rollNumberId") REFERENCES "ExamRollNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

