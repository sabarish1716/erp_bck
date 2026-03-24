-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "aadharFatherPath" TEXT,
ADD COLUMN     "aadharMotherPath" TEXT,
ADD COLUMN     "aadharStudentPath" TEXT,
ADD COLUMN     "birthCertPath" TEXT,
ADD COLUMN     "communityCertPath" TEXT,
ADD COLUMN     "photoPath" TEXT,
ADD COLUMN     "transferCertPath" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;
