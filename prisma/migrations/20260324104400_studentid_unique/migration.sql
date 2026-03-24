/*
  Warnings:

  - A unique constraint covering the columns `[studentId]` on the table `AcademicDetail` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentId]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AcademicDetail_studentId_key" ON "AcademicDetail"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_studentId_key" ON "Document"("studentId");
