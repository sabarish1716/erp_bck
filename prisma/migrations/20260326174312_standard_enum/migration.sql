/*
  Warnings:

  - Changed the type of `standard` on the `Admission` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `standard` on the `FeeStructure` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `standard` on the `Student` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Standard" AS ENUM ('LKG', 'UKG', 'STD_1', 'STD_2', 'STD_3', 'STD_4', 'STD_5', 'STD_6', 'STD_7', 'STD_8', 'STD_9', 'STD_10', 'STD_11', 'STD_12');

-- Drop unique constraint first
DROP INDEX IF EXISTS "FeeStructure_standard_academicYear_key";

-- Student: convert existing data then change column type
ALTER TABLE "Student" ADD COLUMN "standard_new" "Standard";
UPDATE "Student" SET "standard_new" = CASE
  WHEN "standard" = 'LKG' THEN 'LKG'::"Standard"
  WHEN "standard" = 'UKG' THEN 'UKG'::"Standard"
  WHEN "standard" IN ('1', '1st', 'STD_1') THEN 'STD_1'::"Standard"
  WHEN "standard" IN ('2', '2nd', 'STD_2') THEN 'STD_2'::"Standard"
  WHEN "standard" IN ('3', '3rd', 'STD_3') THEN 'STD_3'::"Standard"
  WHEN "standard" IN ('4', '4th', 'STD_4') THEN 'STD_4'::"Standard"
  WHEN "standard" IN ('5', '5th', 'STD_5') THEN 'STD_5'::"Standard"
  WHEN "standard" IN ('6', '6th', 'STD_6') THEN 'STD_6'::"Standard"
  WHEN "standard" IN ('7', '7th', 'STD_7') THEN 'STD_7'::"Standard"
  WHEN "standard" IN ('8', '8th', 'STD_8') THEN 'STD_8'::"Standard"
  WHEN "standard" IN ('9', '9th', 'STD_9') THEN 'STD_9'::"Standard"
  WHEN "standard" IN ('10', '10th', 'STD_10') THEN 'STD_10'::"Standard"
  WHEN "standard" IN ('11', '11th', 'STD_11') THEN 'STD_11'::"Standard"
  WHEN "standard" IN ('12', '12th', 'STD_12') THEN 'STD_12'::"Standard"
  ELSE 'STD_1'::"Standard"
END;
ALTER TABLE "Student" DROP COLUMN "standard";
ALTER TABLE "Student" RENAME COLUMN "standard_new" TO "standard";
ALTER TABLE "Student" ALTER COLUMN "standard" SET NOT NULL;

-- Admission: same conversion
ALTER TABLE "Admission" ADD COLUMN "standard_new" "Standard";
UPDATE "Admission" SET "standard_new" = CASE
  WHEN "standard" = 'LKG' THEN 'LKG'::"Standard"
  WHEN "standard" = 'UKG' THEN 'UKG'::"Standard"
  WHEN "standard" IN ('1', '1st', 'STD_1') THEN 'STD_1'::"Standard"
  WHEN "standard" IN ('2', '2nd', 'STD_2') THEN 'STD_2'::"Standard"
  WHEN "standard" IN ('3', '3rd', 'STD_3') THEN 'STD_3'::"Standard"
  WHEN "standard" IN ('4', '4th', 'STD_4') THEN 'STD_4'::"Standard"
  WHEN "standard" IN ('5', '5th', 'STD_5') THEN 'STD_5'::"Standard"
  WHEN "standard" IN ('6', '6th', 'STD_6') THEN 'STD_6'::"Standard"
  WHEN "standard" IN ('7', '7th', 'STD_7') THEN 'STD_7'::"Standard"
  WHEN "standard" IN ('8', '8th', 'STD_8') THEN 'STD_8'::"Standard"
  WHEN "standard" IN ('9', '9th', 'STD_9') THEN 'STD_9'::"Standard"
  WHEN "standard" IN ('10', '10th', 'STD_10') THEN 'STD_10'::"Standard"
  WHEN "standard" IN ('11', '11th', 'STD_11') THEN 'STD_11'::"Standard"
  WHEN "standard" IN ('12', '12th', 'STD_12') THEN 'STD_12'::"Standard"
  ELSE 'STD_1'::"Standard"
END;
ALTER TABLE "Admission" DROP COLUMN "standard";
ALTER TABLE "Admission" RENAME COLUMN "standard_new" TO "standard";
ALTER TABLE "Admission" ALTER COLUMN "standard" SET NOT NULL;

-- FeeStructure: same conversion
ALTER TABLE "FeeStructure" ADD COLUMN "standard_new" "Standard";
UPDATE "FeeStructure" SET "standard_new" = CASE
  WHEN "standard" = 'LKG' THEN 'LKG'::"Standard"
  WHEN "standard" = 'UKG' THEN 'UKG'::"Standard"
  WHEN "standard" IN ('1', '1st', 'STD_1') THEN 'STD_1'::"Standard"
  WHEN "standard" IN ('2', '2nd', 'STD_2') THEN 'STD_2'::"Standard"
  WHEN "standard" IN ('3', '3rd', 'STD_3') THEN 'STD_3'::"Standard"
  WHEN "standard" IN ('4', '4th', 'STD_4') THEN 'STD_4'::"Standard"
  WHEN "standard" IN ('5', '5th', 'STD_5') THEN 'STD_5'::"Standard"
  WHEN "standard" IN ('6', '6th', 'STD_6') THEN 'STD_6'::"Standard"
  WHEN "standard" IN ('7', '7th', 'STD_7') THEN 'STD_7'::"Standard"
  WHEN "standard" IN ('8', '8th', 'STD_8') THEN 'STD_8'::"Standard"
  WHEN "standard" IN ('9', '9th', 'STD_9') THEN 'STD_9'::"Standard"
  WHEN "standard" IN ('10', '10th', 'STD_10') THEN 'STD_10'::"Standard"
  WHEN "standard" IN ('11', '11th', 'STD_11') THEN 'STD_11'::"Standard"
  WHEN "standard" IN ('12', '12th', 'STD_12') THEN 'STD_12'::"Standard"
  ELSE 'STD_1'::"Standard"
END;
-- Delete duplicate FeeStructure rows (keep the newest per standard+academicYear)
DELETE FROM "FeeStructure" a USING "FeeStructure" b
WHERE a."standard_new" = b."standard_new"
  AND a."academicYear" = b."academicYear"
  AND a."updatedAt" < b."updatedAt";

ALTER TABLE "FeeStructure" DROP COLUMN "standard";
ALTER TABLE "FeeStructure" RENAME COLUMN "standard_new" TO "standard";
ALTER TABLE "FeeStructure" ALTER COLUMN "standard" SET NOT NULL;

-- Recreate unique constraint
CREATE UNIQUE INDEX "FeeStructure_standard_academicYear_key" ON "FeeStructure"("standard", "academicYear");
