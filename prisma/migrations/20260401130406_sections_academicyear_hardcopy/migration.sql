-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "aadharFatherHardCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aadharMotherHardCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aadharStudentHardCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "birthCertHardCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "communityCertHardCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoHardCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transferCertHardCopy" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "academicYear" TEXT,
ADD COLUMN     "section" TEXT;
