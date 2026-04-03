-- AlterTable
ALTER TABLE "StudentFee" ADD COLUMN     "bookBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "kitAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentFeeTerm" ADD COLUMN     "bookAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "hostelAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "otherAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "transportAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tuitionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentTransport" ADD COLUMN     "splClassDaysUsed" INTEGER,
ADD COLUMN     "splClassEndDate" TIMESTAMP(3),
ADD COLUMN     "splClassStartDate" TIMESTAMP(3),
ADD COLUMN     "totalWorkingDays" INTEGER;

-- CreateTable
CREATE TABLE "FeeKitItem" (
    "id" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeKitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentKitIssue" (
    "id" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DOUBLE PRECISION NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentKitIssue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FeeKitItem" ADD CONSTRAINT "FeeKitItem_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeKitItem" ADD CONSTRAINT "FeeKitItem_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentKitIssue" ADD CONSTRAINT "StudentKitIssue_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "StudentFee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentKitIssue" ADD CONSTRAINT "StudentKitIssue_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
