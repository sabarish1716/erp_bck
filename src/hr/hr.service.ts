
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AttendanceStatus, PunchMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto, BulkMarkAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { CreateLeaveTypeDto, ApplyLeaveDto, ApproveLeaveDto, RejectLeaveDto } from './dto/leave.dto';
import { ApplyPermissionDto, ApprovePermissionDto, RejectPermissionDto } from './dto/permission.dto';
import { UpdateStatutorySettingsDto, UpdateStaffStatutoryDto } from './dto/statutory.dto';
import { CreateDeviceDto, UpdateDeviceDto, MapStaffDeviceDto } from './dto/essl.dto';
import { GeneratePayrollDto, ApprovePayrollDto } from './dto/payroll.dto';

const PERMISSION_HOURS_LIMIT = 4;

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  private normalizeEnumKey(value: string) {
    return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  }

  private toAttendanceStatus(status: string): AttendanceStatus {
    const normalized = this.normalizeEnumKey(status);
    if ((Object.values(AttendanceStatus) as string[]).includes(normalized)) {
      return normalized as AttendanceStatus;
    }
    throw new BadRequestException(
      `Invalid attendance status '${status}'. Allowed values: ${Object.values(AttendanceStatus).join(', ')}`,
    );
  }

  private toPunchMethod(method?: string): PunchMethod | undefined {
    if (!method) return undefined;
    const normalized = this.normalizeEnumKey(method);
    if ((Object.values(PunchMethod) as string[]).includes(normalized)) {
      return normalized as PunchMethod;
    }
    throw new BadRequestException(
      `Invalid punch method '${method}'. Allowed values: ${Object.values(PunchMethod).join(', ')}`,
    );
  }

  // ═══════════════════════════════════════════════
  // ─── ATTENDANCE ────────────────────────────────
  // ═══════════════════════════════════════════════

  async getAttendance(query: { date?: string; month?: string; staffId?: string }) {
    const where: any = {};
    if (query.staffId) where.staffId = query.staffId;
    if (query.date) {
      where.date = new Date(query.date);
    } else if (query.month) {
      const [y, m] = query.month.split('-').map(Number);
      where.date = {
        gte: new Date(y, m - 1, 1),
        lt: new Date(y, m, 1),
      };
    }
    return this.prisma.attendance.findMany({
      where,
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true } } },
      orderBy: [{ date: 'desc' }, { staff: { name: 'asc' } }],
    });
  }

  async markAttendance(dto: MarkAttendanceDto) {
    const date = new Date(dto.date);
    const status = this.toAttendanceStatus(dto.status);
    const punchMethod = this.toPunchMethod(dto.punchMethod);
    return this.prisma.attendance.upsert({
      where: { staffId_date: { staffId: dto.staffId, date } },
      update: {
        status,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        punchMethod,
        workingHours: dto.workingHours,
        remarks: dto.remarks,
      },
      create: {
        staffId: dto.staffId,
        date,
        status,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        punchMethod,
        workingHours: dto.workingHours,
        remarks: dto.remarks,
      },
    });
  }

  async bulkMarkAttendance(dto: BulkMarkAttendanceDto) {
    const date = new Date(dto.date);
    const results: any[] = [];
    for (const entry of dto.entries) {
      const status = this.toAttendanceStatus(entry.status);
      const punchMethod = this.toPunchMethod(entry.punchMethod);
      const rec = await this.prisma.attendance.upsert({
        where: { staffId_date: { staffId: entry.staffId, date } },
        update: {
          status,
          checkIn: entry.checkIn,
          checkOut: entry.checkOut,
          punchMethod,
          remarks: entry.remarks,
        },
        create: {
          staffId: entry.staffId,
          date,
          status,
          checkIn: entry.checkIn,
          checkOut: entry.checkOut,
          punchMethod,
          remarks: entry.remarks,
        },
      });
      results.push(rec);
    }
    return { count: results.length, records: results };
  }

  async updateAttendance(id: string, dto: UpdateAttendanceDto) {
    const existing = await this.prisma.attendance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Attendance record not found');
    const status = dto.status !== undefined ? this.toAttendanceStatus(dto.status) : undefined;
    const punchMethod = dto.punchMethod !== undefined ? this.toPunchMethod(dto.punchMethod) : undefined;
    return this.prisma.attendance.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(dto.checkIn !== undefined && { checkIn: dto.checkIn }),
        ...(dto.checkOut !== undefined && { checkOut: dto.checkOut }),
        ...(punchMethod !== undefined && { punchMethod }),
        ...(dto.workingHours !== undefined && { workingHours: dto.workingHours }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
      },
    });
  }

  // getAllStatutoryData
  async getAllStatutoryData() {
    const [settings, staff] = await Promise.all([
      this.getStatutorySettings(),
      this.getStaffStatutoryList(),
    ]);

    return { settings, staff };
  }


  async getMonthlyReport(month: string) {
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    const staff = await this.prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, employeeId: true, department: true },
    });

    const attendances = await this.prisma.attendance.findMany({
      where: { date: { gte: startDate, lt: endDate } },
    });

    const attendanceMap: Record<string, any[]> = {};
    for (const a of attendances) {
      if (!attendanceMap[a.staffId]) attendanceMap[a.staffId] = [];
      attendanceMap[a.staffId].push(a);
    }

    return staff.map((s) => {
      const records = attendanceMap[s.id] || [];
      const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const halfDay = records.filter((r) => r.status === 'HALF_DAY').length;
      const onLeave = records.filter((r) => r.status === 'ON_LEAVE').length;
      return { ...s, present, absent, halfDay, onLeave, totalDays: records.length };
    });
  }

  // ═══════════════════════════════════════════════
  // ─── LEAVE MANAGEMENT ─────────────────────────
  // ═══════════════════════════════════════════════

  async getLeaveTypes() {
    return this.prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createLeaveType(dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: { name: dto.name, code: dto.code, maxPerYear: dto.maxPerYear ?? 12, carryForward: dto.carryForward ?? false },
    });
  }

  async getLeaveApplications(query: { status?: string; staffId?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.staffId) where.staffId = query.staffId;
    return this.prisma.leaveApplication.findMany({
      where,
      include: {
        staff: { select: { id: true, name: true, employeeId: true, department: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyLeave(dto: ApplyLeaveDto) {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.leaveApplication.create({
        data: {
          staffId: dto.staffId,
          leaveTypeId: dto.leaveTypeId,
          fromDate: new Date(dto.fromDate),
          toDate: new Date(dto.toDate),
          days: dto.days,
          halfDay: dto.halfDay ?? false,
          reason: dto.reason,
        },
        include: {
          leaveType: { select: { id: true, name: true, code: true } },
        },
      });
      return application;
    });
  }

  async approveLeave(id: string, dto: ApproveLeaveDto) {
    const application = await this.prisma.leaveApplication.findUnique({
      where: { id },
      include: { leaveType: true },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.status !== 'PENDING') throw new BadRequestException('Only pending applications can be approved');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveApplication.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: dto.approvedBy },
      });

      // Deduct from balance
      const year = this.getAcademicYear(application.fromDate);
      await tx.leaveBalance.upsert({
        where: { staffId_leaveTypeId_year: { staffId: application.staffId, leaveTypeId: application.leaveTypeId, year } },
        update: { used: { increment: application.days }, remaining: { decrement: application.days } },
        create: {
          staffId: application.staffId,
          leaveTypeId: application.leaveTypeId,
          year,
          total: application.leaveType.maxPerYear,
          used: application.days,
          remaining: application.leaveType.maxPerYear - application.days,
        },
      });

      return updated;
    });
  }

  async rejectLeave(id: string, dto: RejectLeaveDto) {
    const application = await this.prisma.leaveApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.status !== 'PENDING') throw new BadRequestException('Only pending applications can be rejected');
    return this.prisma.leaveApplication.update({
      where: { id },
      data: { status: 'REJECTED', rejectedBy: dto.rejectedBy, rejectionNote: dto.rejectionNote },
    });
  }

  async cancelLeave(id: string) {
    const application = await this.prisma.leaveApplication.findUnique({
      where: { id },
      include: { leaveType: true },
    });
    if (!application) throw new NotFoundException('Leave application not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveApplication.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Restore balance if was approved
      if (application.status === 'APPROVED') {
        const year = this.getAcademicYear(application.fromDate);
        await tx.leaveBalance.updateMany({
          where: { staffId: application.staffId, leaveTypeId: application.leaveTypeId, year },
          data: { used: { decrement: application.days }, remaining: { increment: application.days } },
        });
      }

      return updated;
    });
  }

  async getLeaveBalances(query: { staffId?: string; year?: string }) {
    const where: any = {};
    if (query.staffId) where.staffId = query.staffId;
    if (query.year) where.year = query.year;
    return this.prisma.leaveBalance.findMany({
      where,
      include: { leaveType: { select: { id: true, name: true, code: true } } },
    });
  }

  async initLeaveBalances(staffId: string, year: string) {
    const leaveTypes = await this.prisma.leaveType.findMany({ where: { isActive: true } });
    const balances: any[] = [];
    for (const lt of leaveTypes) {
      const bal = await this.prisma.leaveBalance.upsert({
        where: { staffId_leaveTypeId_year: { staffId, leaveTypeId: lt.id, year } },
        update: {},
        create: { staffId, leaveTypeId: lt.id, year, total: lt.maxPerYear, used: 0, remaining: lt.maxPerYear },
      });
      balances.push(bal);
    }
    return balances;
  }

  // ═══════════════════════════════════════════════
  // ─── PERMISSION (SHORT LEAVE) ─────────────────
  // ═══════════════════════════════════════════════

  async getPermissions(query: { staffId?: string; month?: string; status?: string }) {
    const where: any = {};
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status;
    if (query.month) {
      const [y, m] = query.month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    return this.prisma.permissionRequest.findMany({
      where,
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyPermission(dto: ApplyPermissionDto) {
    return this.prisma.permissionRequest.create({
      data: {
        staffId: dto.staffId,
        date: new Date(dto.date),
        fromTime: dto.fromTime,
        toTime: dto.toTime,
        hours: dto.hours,
        reason: dto.reason,
      },
    });
  }

  async approvePermission(id: string, dto: ApprovePermissionDto) {
    const req = await this.prisma.permissionRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Permission request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('Only pending requests can be approved');
    return this.prisma.permissionRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: dto.approvedBy },
    });
  }

  async rejectPermission(id: string, dto: RejectPermissionDto) {
    const req = await this.prisma.permissionRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Permission request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('Only pending requests can be rejected');
    return this.prisma.permissionRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectedBy: dto.rejectedBy, rejectionNote: dto.rejectionNote },
    });
  }

  async getPermissionSummary(month: string) {
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    const staff = await this.prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, employeeId: true, department: true },
    });

    const approved = await this.prisma.permissionRequest.findMany({
      where: { status: 'APPROVED', date: { gte: startDate, lt: endDate } },
    });

    const usageMap: Record<string, number> = {};
    for (const p of approved) {
      usageMap[p.staffId] = (usageMap[p.staffId] || 0) + p.hours;
    }

    return staff.map((s) => {
      const used = usageMap[s.id] || 0;
      const excess = Math.max(0, used - PERMISSION_HOURS_LIMIT);
      const lopDays = excess > 0 ? Math.ceil(excess / 8 * 2) / 2 : 0; // half-day increments
      return { ...s, usedHours: used, limit: PERMISSION_HOURS_LIMIT, excessHours: excess, lopDays };
    });
  }

  // ═══════════════════════════════════════════════
  // ─── STATUTORY (PF / ESI) ─────────────────────
  // ═══════════════════════════════════════════════

  async getStatutorySettings() {
    let settings = await this.prisma.statutorySettings.findFirst();
    if (!settings) {
      settings = await this.prisma.statutorySettings.create({ data: {} });
    }
    return settings;
  }

  async updateStatutorySettings(dto: UpdateStatutorySettingsDto) {
    const existing = await this.prisma.statutorySettings.findFirst();
    if (existing) {
      return this.prisma.statutorySettings.update({ where: { id: existing.id }, data: dto });
    }
    return this.prisma.statutorySettings.create({ data: dto as any });
  }

  async getStaffStatutoryList() {
    return this.prisma.staffStatutory.findMany({
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true, salary: true } } },
    });
  }

  async updateStaffStatutory(staffId: string, dto: UpdateStaffStatutoryDto) {
    return this.prisma.staffStatutory.upsert({
      where: { staffId },
      update: dto,
      create: { staffId, ...dto },
    });
  }

  async getMonthlyStatutoryReport(month: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { month },
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true } } },
    });
    return payrolls.map((p) => ({
      staff: p.staff,
      month: p.month,
      pfDeduction: p.pfDeduction,
      esiDeduction: p.esiDeduction,
      ptDeduction: p.ptDeduction,
      grossSalary: p.grossSalary,
    }));
  }

  // ═══════════════════════════════════════════════
  // ─── ESSL BIOMETRIC ───────────────────────────
  // ═══════════════════════════════════════════════

  async getDevices() {
    return this.prisma.eSSLDevice.findMany({
      include: { _count: { select: { staffMappings: true, punchLogs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDevice(dto: CreateDeviceDto) {
    return this.prisma.eSSLDevice.create({ data: dto });
  }

  async updateDevice(id: string, dto: UpdateDeviceDto) {
    return this.prisma.eSSLDevice.update({ where: { id }, data: dto });
  }

  async deleteDevice(id: string) {
    return this.prisma.eSSLDevice.delete({ where: { id } });
  }

  async getPunchLogs(query: { deviceId?: string; date?: string; staffId?: string }) {
    const where: any = {};
    if (query.deviceId) where.deviceId = query.deviceId;
    if (query.staffId) where.staffId = query.staffId;
    if (query.date) {
      const d = new Date(query.date);
      where.punchTime = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
    return this.prisma.eSSLPunchLog.findMany({
      where,
      include: { device: { select: { id: true, name: true } } },
      orderBy: { punchTime: 'desc' },
      take: 500,
    });
  }

  async getStaffMappings() {
    return this.prisma.eSSLStaffMapping.findMany({
      include: {
        staff: { select: { id: true, name: true, employeeId: true } },
        device: { select: { id: true, name: true } },
      },
    });
  }

  async mapStaffDevice(dto: MapStaffDeviceDto) {
    return this.prisma.eSSLStaffMapping.upsert({
      where: { staffId: dto.staffId },
      update: { deviceId: dto.deviceId, deviceUserId: dto.deviceUserId },
      create: dto,
    });
  }

  async removeStaffMapping(staffId: string) {
    return this.prisma.eSSLStaffMapping.delete({ where: { staffId } });
  }

  async syncDevice(deviceId: string) {
    // In a real implementation, this would connect to the ESSL device via SDK/API
    // For now, record a sync attempt
    const device = await this.prisma.eSSLDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');

    try {
      // TODO: Implement actual ESSL device communication
      // const punchData = await esslSdk.connect(device.ipAddress, device.port).getPunchLogs();

      await this.prisma.eSSLDevice.update({
        where: { id: deviceId },
        data: { lastSyncAt: new Date(), isOnline: true },
      });

      const history = await this.prisma.eSSLSyncHistory.create({
        data: { deviceId, status: 'success', recordsCount: 0 },
      });

      return { success: true, message: 'Sync completed', history };
    } catch (error) {
      await this.prisma.eSSLSyncHistory.create({
        data: { deviceId, status: 'failed', error: error.message },
      });
      throw new BadRequestException('Sync failed: ' + error.message);
    }
  }

  async syncAllDevices() {
    const devices = await this.prisma.eSSLDevice.findMany();
    const results: any[] = [];
    for (const device of devices) {
      try {
        const result = await this.syncDevice(device.id);
        results.push({ deviceId: device.id, name: device.name, ...result });
      } catch (e) {
        results.push({ deviceId: device.id, name: device.name, success: false, error: e.message });
      }
    }
    return results;
  }

  async getSyncHistory(query: { deviceId?: string }) {
    const where: any = {};
    if (query.deviceId) where.deviceId = query.deviceId;
    return this.prisma.eSSLSyncHistory.findMany({
      where,
      include: { device: { select: { id: true, name: true } } },
      orderBy: { syncedAt: 'desc' },
      take: 100,
    });
  }

  // ═══════════════════════════════════════════════
  // ─── PAYROLL ──────────────────────────────────
  // ═══════════════════════════════════════════════

  async generatePayroll(dto: GeneratePayrollDto) {
    const month = dto.month; // "2026-03"
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    const settings = await this.getStatutorySettings();

    const staffFilter: any = { isActive: true };
    if (dto.staffIds?.length) staffFilter.id = { in: dto.staffIds };
    const staffList = await this.prisma.staff.findMany({
      where: staffFilter,
      include: { staffStatutory: true },
    });

    const results: any[] = [];

    for (const staff of staffList) {
      const statutory = staff.staffStatutory;
      const basicSalary = statutory?.basicSalary || staff.salary || 0;
      const hra = basicSalary * 0.2;
      const da = basicSalary * 0.1;
      const otherAllowances = 0;
      const grossSalary = statutory?.grossSalary || (basicSalary + hra + da + otherAllowances);

      // Count working days & attendance
      const attendances = await this.prisma.attendance.findMany({
        where: { staffId: staff.id, date: { gte: startDate, lt: endDate } },
      });

      const totalWorkingDays = this.getWorkingDaysInMonth(y, m);
      let presentDays = 0;
      let lopDays = 0;

      for (const a of attendances) {
        if (a.status === 'PRESENT' || a.status === 'LATE') presentDays++;
        else if (a.status === 'HALF_DAY') presentDays += 0.5;
        else if (a.status === 'ABSENT') lopDays++;
        else if (a.status === 'ON_LEAVE') {
          // Check if the leave was LOP
          const leaveApp = await this.prisma.leaveApplication.findFirst({
            where: {
              staffId: staff.id,
              fromDate: { lte: a.date },
              toDate: { gte: a.date },
              status: 'APPROVED',
            },
            include: { leaveType: true },
          });
          if (leaveApp?.leaveType?.code === 'LOP') lopDays++;
          else presentDays++;
        }
      }

      // Permission excess → LOP
      const approvedPermissions = await this.prisma.permissionRequest.findMany({
        where: { staffId: staff.id, status: 'APPROVED', date: { gte: startDate, lt: endDate } },
      });
      const permissionHoursUsed = approvedPermissions.reduce((sum, p) => sum + p.hours, 0);
      const excessHours = Math.max(0, permissionHoursUsed - PERMISSION_HOURS_LIMIT);
      const permissionLopDays = excessHours > 0 ? Math.ceil(excessHours / 8 * 2) / 2 : 0;

      const perDaySalary = grossSalary / totalWorkingDays;
      const lopDeduction = lopDays * perDaySalary;
      const permissionLopDeduction = permissionLopDays * perDaySalary;

      // PF calculation
      let pfDeduction = 0;
      if (settings.pfEnabled && (statutory?.pfEnabled !== false)) {
        const pfWage = Math.min(basicSalary, settings.pfWageLimit);
        pfDeduction = Math.round(pfWage * settings.pfEmployeeRate / 100);
      }

      // ESI calculation
      let esiDeduction = 0;
      if (settings.esiEnabled && (statutory?.esiEnabled !== false)) {
        if (grossSalary <= settings.esiWageLimit) {
          esiDeduction = Math.round(grossSalary * settings.esiEmployeeRate / 100);
        }
      }

      // PT calculation
      const ptDeduction = settings.ptEnabled ? settings.ptAmount : 0;

      // Advance deductions — auto-deduct from active advances
      let fixedAdvanceDeduction = 0;
      let salaryAdvanceDeduction = 0;
      let otherAdvanceDeduction = 0;

      const activeAdvances = await this.prisma.staffAdvance.findMany({
        where: { staffId: staff.id, status: { in: ['DISBURSED', 'REPAYING'] }, balanceRemaining: { gt: 0 } },
      });

      for (const adv of activeAdvances) {
        const deduction = Math.min(adv.monthlyDeduction, adv.balanceRemaining);
        if (adv.type === 'FIXED_ADVANCE') fixedAdvanceDeduction += deduction;
        else if (adv.type === 'SALARY_ADVANCE') salaryAdvanceDeduction += deduction;
        else otherAdvanceDeduction += deduction;
      }

      const extraAllowance = 0; // Can be overridden manually later

      const totalDeductions = Math.round(lopDeduction + permissionLopDeduction + pfDeduction + esiDeduction + ptDeduction + fixedAdvanceDeduction + salaryAdvanceDeduction + otherAdvanceDeduction);
      const netSalary = Math.round(grossSalary + extraAllowance - totalDeductions);

      const payroll = await this.prisma.payroll.upsert({
        where: { staffId_month: { staffId: staff.id, month } },
        update: {
          basicSalary, hra, da, otherAllowances, grossSalary,
          totalWorkingDays, presentDays, lopDays, lopDeduction: Math.round(lopDeduction),
          permissionHoursUsed, permissionLopDays, permissionLopDeduction: Math.round(permissionLopDeduction),
          pfDeduction, esiDeduction, ptDeduction,
          fixedAdvanceDeduction, salaryAdvanceDeduction, otherAdvanceDeduction, extraAllowance,
          totalDeductions, netSalary,
          status: 'generated',
        },
        create: {
          staffId: staff.id, month,
          basicSalary, hra, da, otherAllowances, grossSalary,
          totalWorkingDays, presentDays, lopDays, lopDeduction: Math.round(lopDeduction),
          permissionHoursUsed, permissionLopDays, permissionLopDeduction: Math.round(permissionLopDeduction),
          pfDeduction, esiDeduction, ptDeduction,
          fixedAdvanceDeduction, salaryAdvanceDeduction, otherAdvanceDeduction, extraAllowance,
          totalDeductions, netSalary,
        },
      });

      // Update advance repaid balances
      for (const adv of activeAdvances) {
        const deduction = Math.min(adv.monthlyDeduction, adv.balanceRemaining);
        const newRepaid = adv.totalRepaid + deduction;
        const newBalance = adv.amount - newRepaid;
        await this.prisma.staffAdvance.update({
          where: { id: adv.id },
          data: {
            totalRepaid: newRepaid,
            balanceRemaining: Math.max(0, newBalance),
            status: newBalance <= 0 ? 'CLOSED' : 'REPAYING',
            closedAt: newBalance <= 0 ? new Date() : undefined,
          },
        });
      }

      results.push(payroll);
    }

    return { count: results.length, records: results };
  }

  async getPayrolls(query: { month?: string; staffId?: string; status?: string }) {
    const where: any = {};
    if (query.month) where.month = query.month;
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status;
    return this.prisma.payroll.findMany({
      where,
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true, designation: true, category: true, paymentMode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayroll(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true, designation: true, category: true, paymentMode: true } } },
    });
    if (!payroll) throw new NotFoundException('Payroll record not found');
    return payroll;
  }

  async approvePayrolls(dto: ApprovePayrollDto) {
    return this.prisma.payroll.updateMany({
      where: { id: { in: dto.ids } },
      data: { status: 'approved' },
    });
  }

  async getLOPReport(month: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { month },
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true } } },
    });
    return payrolls
      .filter((p) => p.lopDays > 0 || p.permissionLopDays > 0)
      .map((p) => ({
        staff: p.staff,
        month: p.month,
        lopDays: p.lopDays,
        lopDeduction: p.lopDeduction,
        permissionHoursUsed: p.permissionHoursUsed,
        permissionLopDays: p.permissionLopDays,
        permissionLopDeduction: p.permissionLopDeduction,
        totalLopDays: p.lopDays + p.permissionLopDays,
        totalLopDeduction: p.lopDeduction + p.permissionLopDeduction,
      }));
  }

  // ═══════════════════════════════════════════════
  // ─── DASHBOARD ────────────────────────────────
  // ═══════════════════════════════════════════════

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalStaff,
      todayAttendance,
      pendingLeaves,
      pendingPermissions,
    ] = await Promise.all([
      this.prisma.staff.count({ where: { isActive: true } }),
      this.prisma.attendance.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
      this.prisma.leaveApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.permissionRequest.count({ where: { status: 'PENDING' } }),
    ]);

    const present = todayAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const absent = todayAttendance.filter((a) => a.status === 'ABSENT').length;
    const onLeave = todayAttendance.filter((a) => a.status === 'ON_LEAVE').length;

    return {
      totalStaff,
      todayAttendance: { present, absent, onLeave, total: todayAttendance.length },
      pendingLeaves,
      pendingPermissions,
    };
  }

  // ═══════════════════════════════════════════════
  // ─── ADVANCE / LOAN TICKET SYSTEM ─────────────
  // ═══════════════════════════════════════════════

  private async getNextAdvanceTicketNo(): Promise<string> {
    const year = new Date().getFullYear();
    const lastTicket = await this.prisma.staffAdvance.findFirst({
      where: { ticketNo: { startsWith: `ADV-${year}` } },
      orderBy: { ticketNo: 'desc' },
    });
    const seq = lastTicket ? parseInt(lastTicket.ticketNo.split('-')[2]) + 1 : 1;
    return `ADV-${year}-${String(seq).padStart(5, '0')}`;
  }

  async createAdvanceRequest(data: { staffId: string; type: string; amount: number; reason?: string; monthlyDeduction?: number }) {
    const staff = await this.prisma.staff.findUnique({ where: { id: data.staffId } });
    if (!staff) throw new NotFoundException('Staff not found');
    const ticketNo = await this.getNextAdvanceTicketNo();
    const monthly = data.monthlyDeduction || data.amount; // default: full repay in one month
    return this.prisma.staffAdvance.create({
      data: {
        ticketNo,
        staffId: data.staffId,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        monthlyDeduction: monthly,
        balanceRemaining: data.amount,
        status: 'REQUESTED',
      },
    });
  }

  async getAdvanceRequests(query: { staffId?: string; status?: string; type?: string }) {
    const where: any = {};
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    return this.prisma.staffAdvance.findMany({
      where,
      include: { staff: { select: { id: true, name: true, employeeId: true, designation: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdvanceRequest(id: string) {
    const adv = await this.prisma.staffAdvance.findUnique({
      where: { id },
      include: { staff: { select: { id: true, name: true, employeeId: true, designation: true, category: true } } },
    });
    if (!adv) throw new NotFoundException('Advance request not found');
    return adv;
  }

  async approveAdvance(id: string, email: string) {
    const adv = await this.prisma.staffAdvance.findUnique({ where: { id } });
    if (!adv) throw new NotFoundException('Advance request not found');
    if (adv.status !== 'REQUESTED') throw new BadRequestException('Can only approve REQUESTED advances');
    return this.prisma.staffAdvance.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedByEmail: email },
    });
  }

  async rejectAdvance(id: string, email: string, reason?: string) {
    const adv = await this.prisma.staffAdvance.findUnique({ where: { id } });
    if (!adv) throw new NotFoundException('Advance request not found');
    if (adv.status !== 'REQUESTED') throw new BadRequestException('Can only reject REQUESTED advances');
    return this.prisma.staffAdvance.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedByEmail: email, rejectionReason: reason },
    });
  }

  async disburseAdvance(id: string) {
    const adv = await this.prisma.staffAdvance.findUnique({ where: { id } });
    if (!adv) throw new NotFoundException('Advance request not found');
    if (adv.status !== 'APPROVED') throw new BadRequestException('Can only disburse APPROVED advances');
    return this.prisma.staffAdvance.update({
      where: { id },
      data: { status: 'DISBURSED', disbursedAt: new Date() },
    });
  }

  // ═══════════════════════════════════════════════
  // ─── SALARY ABSTRACT REPORT ───────────────────
  // ═══════════════════════════════════════════════

  async getSalaryAbstract(month: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { month },
      include: { staff: { include: { staffStatutory: { select: { pfNumber: true, esiNumber: true, pfEnabled: true, esiEnabled: true } } } } },
    });

    const categories = ['TEACHING_REGULAR', 'TEACHING_TRAINEE', 'NON_TEACHING_REGULAR', 'NON_TEACHING_TRAINEE'];
    const rows = categories.map((cat) => {
      const catPayrolls = payrolls.filter((p) => (p.staff as any).category === cat);
      return {
        category: cat,
        staffCount: catPayrolls.length,
        grossSalary: catPayrolls.reduce((s, p) => s + p.grossSalary, 0),
        extraAllowance: catPayrolls.reduce((s, p) => s + p.extraAllowance, 0),
        totalGross: catPayrolls.reduce((s, p) => s + p.grossSalary + p.extraAllowance, 0),
        basicSalary: catPayrolls.reduce((s, p) => s + p.basicSalary, 0),
        pfDeduction: catPayrolls.reduce((s, p) => s + p.pfDeduction, 0),
        esiDeduction: catPayrolls.reduce((s, p) => s + p.esiDeduction, 0),
        fixedAdvance: catPayrolls.reduce((s, p) => s + p.fixedAdvanceDeduction, 0),
        salaryAdvance: catPayrolls.reduce((s, p) => s + p.salaryAdvanceDeduction, 0),
        otherAdvance: catPayrolls.reduce((s, p) => s + p.otherAdvanceDeduction, 0),
        totalDeductions: catPayrolls.reduce((s, p) => s + p.totalDeductions, 0),
        netSalary: catPayrolls.reduce((s, p) => s + p.netSalary, 0),
      };
    });

    const grandTotal = {
      category: 'TOTAL',
      staffCount: rows.reduce((s, r) => s + r.staffCount, 0),
      grossSalary: rows.reduce((s, r) => s + r.grossSalary, 0),
      extraAllowance: rows.reduce((s, r) => s + r.extraAllowance, 0),
      totalGross: rows.reduce((s, r) => s + r.totalGross, 0),
      basicSalary: rows.reduce((s, r) => s + r.basicSalary, 0),
      pfDeduction: rows.reduce((s, r) => s + r.pfDeduction, 0),
      esiDeduction: rows.reduce((s, r) => s + r.esiDeduction, 0),
      fixedAdvance: rows.reduce((s, r) => s + r.fixedAdvance, 0),
      salaryAdvance: rows.reduce((s, r) => s + r.salaryAdvance, 0),
      otherAdvance: rows.reduce((s, r) => s + r.otherAdvance, 0),
      totalDeductions: rows.reduce((s, r) => s + r.totalDeductions, 0),
      netSalary: rows.reduce((s, r) => s + r.netSalary, 0),
    };

    return { rows, grandTotal, payrolls };
  }

  // ═══════════════════════════════════════════════
  // ─── HELPERS ──────────────────────────────────
  // ═══════════════════════════════════════════════

  private getAcademicYear(date: Date): string {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month >= 5) return `${year}-${year + 1}`; // June onwards
    return `${year - 1}-${year}`;
  }

    async approvePayroll(id: string) {
    const payroll = await this.prisma.payroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll record not found');
    return this.prisma.payroll.update({ where: { id }, data: { status: 'approved' } });
  }
  private getWorkingDaysInMonth(year: number, month: number): number {
    let count = 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0) count++; // Exclude Sundays
    }
    return count;
  }
}
