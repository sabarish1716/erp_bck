-- CreateEnum
CREATE TYPE "DocRequestType" AS ENUM ('TRANSFER_CERTIFICATE', 'BONAFIDE_CERTIFICATE', 'CONDUCT_CERTIFICATE', 'STUDY_CERTIFICATE', 'FEE_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocRequestStatus" AS ENUM ('REQUESTED', 'IN_REVIEW', 'APPROVED', 'ISSUED', 'REJECTED');

-- CreateTable
CREATE TABLE "DocRequest" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "DocRequestType" NOT NULL,
    "status" "DocRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "remarks" TEXT,
    "rejectionReason" TEXT,
    "requestedById" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "issuedById" INTEGER,
    "pdfPath" TEXT,
    "tcNo" TEXT,
    "tcDate" TIMESTAMP(3),
    "leavingReason" TEXT,
    "conductRemark" TEXT DEFAULT 'Good',
    "qualifiedForPromotion" BOOLEAN,
    "dateOfLeaving" TIMESTAMP(3),
    "lastAttendedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocRequest_ticketNo_key" ON "DocRequest"("ticketNo");

-- CreateIndex
CREATE INDEX "DocRequest_studentId_idx" ON "DocRequest"("studentId");

-- CreateIndex
CREATE INDEX "DocRequest_status_idx" ON "DocRequest"("status");

-- CreateIndex
CREATE INDEX "DocRequest_type_idx" ON "DocRequest"("type");

-- AddForeignKey
ALTER TABLE "DocRequest" ADD CONSTRAINT "DocRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocRequest" ADD CONSTRAINT "DocRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocRequest" ADD CONSTRAINT "DocRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocRequest" ADD CONSTRAINT "DocRequest_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
