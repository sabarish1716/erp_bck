-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('LOCATION', 'MILEAGE', 'DRIVER_STATUS', 'FUEL_LOG');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "SupabaseSyncJob" (
    "id" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupabaseSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupabaseSyncJob_dedupeKey_key" ON "SupabaseSyncJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "SupabaseSyncJob_status_availableAt_idx" ON "SupabaseSyncJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "SupabaseSyncJob_type_status_idx" ON "SupabaseSyncJob"("type", "status");
