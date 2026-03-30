-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEK_OFF');

-- CreateEnum
CREATE TYPE "PunchMethod" AS ENUM ('FINGERPRINT', 'FACE', 'CARD', 'PIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "checkIn" TEXT,
    "checkOut" TEXT,
    "punchMethod" "PunchMethod",
    "workingHours" DOUBLE PRECISION,
    "remarks" TEXT,
    "isESSLSync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxPerYear" INTEGER NOT NULL DEFAULT 12,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApplication" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionRequest" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromTime" TEXT NOT NULL,
    "toTime" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutorySettings" (
    "id" TEXT NOT NULL,
    "pfEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pfEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "pfEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "pfWageLimit" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "pfAdminCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "pfEdliCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "esiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "esiEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "esiEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 3.25,
    "esiWageLimit" DOUBLE PRECISION NOT NULL DEFAULT 21000,
    "ptEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ptAmount" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatutorySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffStatutory" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "pfNumber" TEXT,
    "uanNumber" TEXT,
    "esiNumber" TEXT,
    "basicSalary" DOUBLE PRECISION,
    "grossSalary" DOUBLE PRECISION,
    "pfEnabled" BOOLEAN NOT NULL DEFAULT true,
    "esiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffStatutory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESSLDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "serialNumber" TEXT,
    "deviceType" TEXT NOT NULL DEFAULT 'fingerprint',
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ESSLDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESSLPunchLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "employeeId" TEXT,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "punchType" TEXT,
    "punchMethod" "PunchMethod",
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ESSLPunchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESSLStaffMapping" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ESSLStaffMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESSLSyncHistory" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ESSLSyncHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "da" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWorkingDays" INTEGER NOT NULL DEFAULT 0,
    "presentDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lopDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lopDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "permissionHoursUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "permissionLopDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "permissionLopDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pfDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esiDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ptDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_staffId_date_key" ON "Attendance"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_staffId_leaveTypeId_year_key" ON "LeaveBalance"("staffId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "LeaveApplication_staffId_idx" ON "LeaveApplication"("staffId");

-- CreateIndex
CREATE INDEX "LeaveApplication_status_idx" ON "LeaveApplication"("status");

-- CreateIndex
CREATE INDEX "PermissionRequest_staffId_idx" ON "PermissionRequest"("staffId");

-- CreateIndex
CREATE INDEX "PermissionRequest_date_idx" ON "PermissionRequest"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffStatutory_staffId_key" ON "StaffStatutory"("staffId");

-- CreateIndex
CREATE INDEX "ESSLPunchLog_deviceId_idx" ON "ESSLPunchLog"("deviceId");

-- CreateIndex
CREATE INDEX "ESSLPunchLog_punchTime_idx" ON "ESSLPunchLog"("punchTime");

-- CreateIndex
CREATE INDEX "ESSLPunchLog_staffId_idx" ON "ESSLPunchLog"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ESSLStaffMapping_staffId_key" ON "ESSLStaffMapping"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ESSLStaffMapping_deviceId_deviceUserId_key" ON "ESSLStaffMapping"("deviceId", "deviceUserId");

-- CreateIndex
CREATE INDEX "Payroll_month_idx" ON "Payroll"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_staffId_month_key" ON "Payroll"("staffId", "month");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionRequest" ADD CONSTRAINT "PermissionRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStatutory" ADD CONSTRAINT "StaffStatutory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESSLPunchLog" ADD CONSTRAINT "ESSLPunchLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ESSLDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESSLStaffMapping" ADD CONSTRAINT "ESSLStaffMapping_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESSLStaffMapping" ADD CONSTRAINT "ESSLStaffMapping_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ESSLDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESSLSyncHistory" ADD CONSTRAINT "ESSLSyncHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ESSLDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
