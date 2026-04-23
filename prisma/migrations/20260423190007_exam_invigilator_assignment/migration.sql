-- CreateTable
CREATE TABLE "ExamInvigilatorAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamInvigilatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamInvigilatorAssignment_scheduleId_hallId_key" ON "ExamInvigilatorAssignment"("scheduleId", "hallId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamInvigilatorAssignment_scheduleId_staffId_key" ON "ExamInvigilatorAssignment"("scheduleId", "staffId");

-- CreateIndex
CREATE INDEX "ExamInvigilatorAssignment_staffId_idx" ON "ExamInvigilatorAssignment"("staffId");

-- AddForeignKey
ALTER TABLE "ExamInvigilatorAssignment" ADD CONSTRAINT "ExamInvigilatorAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamInvigilatorAssignment" ADD CONSTRAINT "ExamInvigilatorAssignment_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "ExamHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamInvigilatorAssignment" ADD CONSTRAINT "ExamInvigilatorAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
