-- AlterTable
ALTER TABLE "StaffStatutory" ADD COLUMN     "psfEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StatutorySettings" ADD COLUMN     "psfEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "psfEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "psfWageLimit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SalaryIncrement" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "fromSalary" DOUBLE PRECISION NOT NULL,
    "toSalary" DOUBLE PRECISION NOT NULL,
    "incrementAmount" DOUBLE PRECISION NOT NULL,
    "incrementDate" TIMESTAMP(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryIncrement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLoan" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "loanAmount" DOUBLE PRECISION NOT NULL,
    "emiAmount" DOUBLE PRECISION NOT NULL,
    "emiFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceRemaining" DOUBLE PRECISION NOT NULL,
    "preClosureDate" TIMESTAMP(3),
    "preClosureAmount" DOUBLE PRECISION,
    "preClosureReason" TEXT,
    "skipMonths" TEXT NOT NULL DEFAULT '[]',
    "reason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanEMITransaction" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "emiDue" DOUBLE PRECISION NOT NULL,
    "emiPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "payrollId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanEMITransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryIncrement_staffId_status_idx" ON "SalaryIncrement"("staffId", "status");

-- CreateIndex
CREATE INDEX "SalaryIncrement_effectiveDate_idx" ON "SalaryIncrement"("effectiveDate");

-- CreateIndex
CREATE INDEX "StaffLoan_staffId_status_idx" ON "StaffLoan"("staffId", "status");

-- CreateIndex
CREATE INDEX "StaffLoan_startMonth_idx" ON "StaffLoan"("startMonth");

-- CreateIndex
CREATE INDEX "LoanEMITransaction_loanId_status_idx" ON "LoanEMITransaction"("loanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoanEMITransaction_loanId_month_key" ON "LoanEMITransaction"("loanId", "month");

-- AddForeignKey
ALTER TABLE "SalaryIncrement" ADD CONSTRAINT "SalaryIncrement_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLoan" ADD CONSTRAINT "StaffLoan_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanEMITransaction" ADD CONSTRAINT "LoanEMITransaction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "StaffLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
