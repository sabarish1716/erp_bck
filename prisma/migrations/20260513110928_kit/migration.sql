/*
  Warnings:

  - You are about to drop the column `categoryId` on the `StoreItem` table. All the data in the column will be lost.
  - You are about to drop the `ItemCategoryModel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "StoreItem" DROP CONSTRAINT "StoreItem_categoryId_fkey";

-- AlterTable
ALTER TABLE "StoreItem" DROP COLUMN "categoryId";

-- DropTable
DROP TABLE "ItemCategoryModel";
