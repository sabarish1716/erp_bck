-- CreateTable
CREATE TABLE "ElgaNotebookMapping" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElgaNotebookMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElgaNotebookMapping_level_idx" ON "ElgaNotebookMapping"("level");

-- CreateIndex
CREATE UNIQUE INDEX "ElgaNotebookMapping_level_storeItemId_key" ON "ElgaNotebookMapping"("level", "storeItemId");

-- AddForeignKey
ALTER TABLE "ElgaNotebookMapping" ADD CONSTRAINT "ElgaNotebookMapping_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
