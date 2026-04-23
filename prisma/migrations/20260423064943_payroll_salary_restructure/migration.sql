-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffCategory" ADD VALUE 'TEACHING_PART_TIME';
ALTER TYPE "StaffCategory" ADD VALUE 'NON_TEACHING_SECURITY';
ALTER TYPE "StaffCategory" ADD VALUE 'NON_TEACHING_SPORTS';

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "bonusIncentive" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ctc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "employerEsiContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "employerPfContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "esiBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lopCancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pfBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "travelAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StaffStatutory" ADD COLUMN     "dailyRate" DOUBLE PRECISION,
ADD COLUMN     "isStipend" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StatutorySettings" ADD COLUMN     "basicRate" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "clLapseMonths" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "esiDailyWageThreshold" DOUBLE PRECISION NOT NULL DEFAULT 176,
ADD COLUMN     "hraRate" DOUBLE PRECISION NOT NULL DEFAULT 30,
ADD COLUMN     "otherAllowanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "travelAllowanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
