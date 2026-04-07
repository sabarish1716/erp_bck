-- CreateTable
CREATE TABLE "VehicleTripLog" (
    "id" TEXT NOT NULL,
    "plateNo" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "driverName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "odometer" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleTripLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleTripLog_plateNo_timestamp_idx" ON "VehicleTripLog"("plateNo", "timestamp");

-- CreateIndex
CREATE INDEX "VehicleTripLog_deviceId_timestamp_idx" ON "VehicleTripLog"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "VehicleTripLog_event_idx" ON "VehicleTripLog"("event");
