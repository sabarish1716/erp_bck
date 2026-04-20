-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'MAINTENANCE', 'PARTS', 'TAX');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CARD');

-- CreateTable
CREATE TABLE "TransportExpense" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fuelStation" TEXT,
    "paymentMode" "PaymentMode",
    "litres" DOUBLE PRECISION,
    "pricePerLitre" DOUBLE PRECISION,
    "workshop" TEXT,
    "description" TEXT,
    "partName" TEXT,
    "isShared" BOOLEAN,
    "taxType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransportExpense_busId_idx" ON "TransportExpense"("busId");

-- CreateIndex
CREATE INDEX "TransportExpense_date_idx" ON "TransportExpense"("date");

-- AddForeignKey
ALTER TABLE "TransportExpense" ADD CONSTRAINT "TransportExpense_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
