-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByEmail" TEXT,
ADD COLUMN     "approvedByRole" "Role";
