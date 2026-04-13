-- CreateEnum
CREATE TYPE "StaffDocumentType" AS ENUM ('EXPERIENCE_CERTIFICATE', 'RELIEVING_LETTER', 'APPOINTMENT_LETTER', 'SALARY_SLIP', 'EDUCATION_CERTIFICATE', 'ID_PROOF', 'ADDRESS_PROOF', 'MEDICAL_CERTIFICATE', 'OTHER');

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" "StaffDocumentType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "description" TEXT,
    "documentNumber" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffDocument_staffId_type_idx" ON "StaffDocument"("staffId", "type");

-- CreateIndex
CREATE INDEX "StaffDocument_uploadedAt_idx" ON "StaffDocument"("uploadedAt");

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
