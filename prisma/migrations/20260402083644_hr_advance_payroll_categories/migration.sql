-- CreateEnum
CREATE TYPE "StaffCategory" AS ENUM ('TEACHING_REGULAR', 'TEACHING_TRAINEE', 'NON_TEACHING_REGULAR', 'NON_TEACHING_TRAINEE');

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "extraAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fixedAdvanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "otherAdvanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "salaryAdvanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "bankAccountNo" TEXT,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "category" "StaffCategory" NOT NULL DEFAULT 'TEACHING_REGULAR',
ADD COLUMN     "paymentMode" TEXT,
ADD COLUMN     "pfJoiningDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StaffAdvance" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "monthlyDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRepaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceRemaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedByEmail" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByEmail" TEXT,
    "rejectionReason" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAdvance_ticketNo_key" ON "StaffAdvance"("ticketNo");

-- CreateIndex
CREATE INDEX "StaffAdvance_staffId_idx" ON "StaffAdvance"("staffId");

-- CreateIndex
CREATE INDEX "StaffAdvance_status_idx" ON "StaffAdvance"("status");

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
