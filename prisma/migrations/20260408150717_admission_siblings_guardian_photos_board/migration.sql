-- AlterTable
ALTER TABLE "AcademicDetail" ADD COLUMN     "boardName" TEXT DEFAULT 'State Board';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "photosReceived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "guardianAadhar" TEXT,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianOccupation" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "guardianRelation" TEXT,
ADD COLUMN     "guardianWhatsapp" TEXT,
ADD COLUMN     "isSingleParent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sibling1Name" TEXT,
ADD COLUMN     "sibling1School" TEXT,
ADD COLUMN     "sibling1Standard" TEXT,
ADD COLUMN     "sibling2Name" TEXT,
ADD COLUMN     "sibling2School" TEXT,
ADD COLUMN     "sibling2Standard" TEXT;
