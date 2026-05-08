-- CreateEnum
CREATE TYPE "BonafideScenarioType" AS ENUM ('STUDY_PURPOSE', 'PASSPORT_VISA', 'SCHOLARSHIP', 'EDUCATION_LOAN');

-- AlterTable
ALTER TABLE "DocRequest" ADD COLUMN     "bonafideAuthority" TEXT,
ADD COLUMN     "bonafidePurpose" TEXT,
ADD COLUMN     "bonafideScenario" "BonafideScenarioType",
ADD COLUMN     "bonafideTemplateText" TEXT;
