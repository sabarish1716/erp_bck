-- Add columns for storing custom school names when "Other School" is selected for siblings
ALTER TABLE "Family" ADD COLUMN "sibling1OtherSchoolName" TEXT;
ALTER TABLE "Family" ADD COLUMN "sibling2OtherSchoolName" TEXT;
