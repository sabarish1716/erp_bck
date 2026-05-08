
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AttendanceStatus, PunchMethod, StaffCategory, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto, BulkMarkAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { CreateLeaveTypeDto, ApplyLeaveDto, ApproveLeaveDto, RejectLeaveDto } from './dto/leave.dto';
import { ApplyPermissionDto, ApprovePermissionDto, RejectPermissionDto } from './dto/permission.dto';
import { UpdateStatutorySettingsDto, UpdateStaffStatutoryDto } from './dto/statutory.dto';
import { CreateDeviceDto, UpdateDeviceDto, MapStaffDeviceDto } from './dto/essl.dto';
import { GeneratePayrollDto, ApprovePayrollDto, UpdatePayrollDto } from './dto/payroll.dto';
import { CreateIncrementDto, ApproveIncrementDto, RejectIncrementDto } from './dto/increment.dto';
import { CreateLoanDto, ApproveLoanDto, RejectLoanDto, SkipLoanEMIDto, ResumeLoanEMIDto, PreCloseLoanDto } from './dto/loan.dto';

type LeavePermissionPolicy = {
  permissionHoursLimit: number;
  leaveEntitlements: Record<string, number>;
};

type RequestUser = {
  sub?: string;
  id?: string;
  role?: Role | string;
  staffId?: string | null;
};

const TEACHING_POLICY: LeavePermissionPolicy = {
  permissionHoursLimit: 4,
  leaveEntitlements: {
    CL: 12,
    SL: 10,
    EL: 15,
    ML: 180,
    PL: 15,
    LOP: 999,
  },
};

const NON_TEACHING_POLICY: LeavePermissionPolicy = {
  permissionHoursLimit: 4,
  leaveEntitlements: {
    CL: 12,
    SL: 10,
    EL: 15,
    ML: 180,
    PL: 15,
    LOP: 999,
  },
};

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  async getStaffList() {
    return this.prisma.staff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        employeeId: true,
        name: true,
        department: true,
        designation: true,
        category: true,
        salary: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  private isSelfServiceRole(role?: string | Role | null) {
    return role === Role.STAFF || role === Role.TEACHER;
  }

  private ensureOwnStaffId(staffId: string | undefined, requester?: RequestUser) {
    if (!requester || !this.isSelfServiceRole(requester.role)) return staffId;
    if (!requester.staffId) {
      throw new BadRequestException('Staff account is not linked to a staff profile');
    }
    if (staffId && staffId !== requester.staffId) {
      throw new BadRequestException('You can only access your own HR records');
    }
    return requester.staffId;
  }

  private getPolicyForCategory(category?: StaffCategory | null): LeavePermissionPolicy {
    if (category && String(category).startsWith('NON_TEACHING')) {
      return NON_TEACHING_POLICY;
    }
    return TEACHING_POLICY;
  }

  private getLeaveEntitlementForCategory(
    leaveCode: string,
    category: StaffCategory | null | undefined,
    fallback: number,
  ) {
    const policy = this.getPolicyForCategory(category);
    return policy.leaveEntitlements[leaveCode] ?? fallback;
  }

  private getPermissionLimitForCategory(category: StaffCategory | null | undefined) {
    return this.getPolicyForCategory(category).permissionHoursLimit;
  }

  private async getStaffCategory(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { category: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff.category;
  }

  async getLeavePermissionPolicy(staffId?: string, requester?: RequestUser) {
    const effectiveStaffId = this.ensureOwnStaffId(staffId, requester);
    if (effectiveStaffId) {
      const category = await this.getStaffCategory(effectiveStaffId);
      return {
        category,
        effective: this.getPolicyForCategory(category),
        teaching: TEACHING_POLICY,
        nonTeaching: NON_TEACHING_POLICY,
      };
    }

    return {
      category: null,
      effective: null,
      teaching: TEACHING_POLICY,
      nonTeaching: NON_TEACHING_POLICY,
    };
  }

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

  async getAttendance(query: { date?: string; month?: string; staffId?: string }, requester?: RequestUser) {
    const where: any = {};
    const effectiveStaffId = this.ensureOwnStaffId(query.staffId, requester);
    if (effectiveStaffId) where.staffId = effectiveStaffId;
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


  async getMonthlyReport(month: string, requester?: RequestUser) {
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    const effectiveStaffId = this.ensureOwnStaffId(undefined, requester);

    const staff = await this.prisma.staff.findMany({
      where: { isActive: true, ...(effectiveStaffId ? { id: effectiveStaffId } : {}) },
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

  async getLeaveApplications(query: { status?: string; staffId?: string; month?: string }, requester?: RequestUser) {
    const where: any = {};
    if (query.status) where.status = query.status;
    const effectiveStaffId = this.ensureOwnStaffId(query.staffId, requester);
    if (effectiveStaffId) where.staffId = effectiveStaffId;
    if (query.month) {
      const [year, month] = query.month.split('-').map(Number);
      if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        where.fromDate = { gte: start, lt: end };
      }
    }
    return this.prisma.leaveApplication.findMany({
      where,
      include: {
        staff: { select: { id: true, name: true, employeeId: true, department: true, designation: true, category: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyLeave(dto: ApplyLeaveDto, requester?: RequestUser) {
    const effectiveStaffId = this.ensureOwnStaffId(dto.staffId, requester);
    const normalizedDto = { ...dto, staffId: effectiveStaffId || dto.staffId };
    return this.prisma.$transaction(async (tx) => {
      const leaveType = await tx.leaveType.findUnique({
        where: { id: normalizedDto.leaveTypeId },
        select: { id: true, code: true, maxPerYear: true },
      });
      if (!leaveType) throw new NotFoundException('Leave type not found');

      const fromDate = new Date(normalizedDto.fromDate);
      const year = this.getAcademicYear(fromDate);
      const category = await this.getStaffCategory(normalizedDto.staffId);
      const totalEntitlement = this.getLeaveEntitlementForCategory(
        leaveType.code,
        category,
        leaveType.maxPerYear,
      );

      if (leaveType.code !== 'LOP') {
        const balance = await tx.leaveBalance.upsert({
          where: {
            staffId_leaveTypeId_year: {
              staffId: normalizedDto.staffId,
              leaveTypeId: leaveType.id,
              year,
            },
          },
          update: {},
          create: {
            staffId: normalizedDto.staffId,
            leaveTypeId: leaveType.id,
            year,
            total: totalEntitlement,
            used: 0,
            remaining: totalEntitlement,
          },
        });

        if (balance.remaining < normalizedDto.days) {
          throw new BadRequestException(
            `Insufficient leave balance. Remaining: ${balance.remaining}, requested: ${normalizedDto.days}`,
          );
        }
      }

      const application = await tx.leaveApplication.create({
        data: {
          staffId: normalizedDto.staffId,
          leaveTypeId: normalizedDto.leaveTypeId,
          fromDate,
          toDate: new Date(normalizedDto.toDate),
          days: normalizedDto.days,
          halfDay: normalizedDto.halfDay ?? false,
          reason: normalizedDto.reason,
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

    const staffCategory = await this.getStaffCategory(application.staffId);

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
          total: this.getLeaveEntitlementForCategory(
            application.leaveType.code,
            staffCategory,
            application.leaveType.maxPerYear,
          ),
          used: application.days,
          remaining:
            this.getLeaveEntitlementForCategory(
              application.leaveType.code,
              staffCategory,
              application.leaveType.maxPerYear,
            ) - application.days,
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

  async getLeaveBalances(query: { staffId?: string; year?: string }, requester?: RequestUser) {
    const where: any = {};
    const effectiveStaffId = this.ensureOwnStaffId(query.staffId, requester);
    if (effectiveStaffId) where.staffId = effectiveStaffId;
    if (query.year) where.year = query.year;
    return this.prisma.leaveBalance.findMany({
      where,
      include: { leaveType: { select: { id: true, name: true, code: true } } },
    });
  }

  async initLeaveBalances(staffId: string, year: string) {
    const [leaveTypes, category] = await Promise.all([
      this.prisma.leaveType.findMany({ where: { isActive: true } }),
      this.getStaffCategory(staffId),
    ]);
    const balances: any[] = [];
    for (const lt of leaveTypes) {
      const totalEntitlement = this.getLeaveEntitlementForCategory(
        lt.code,
        category,
        lt.maxPerYear,
      );
      const bal = await this.prisma.leaveBalance.upsert({
        where: { staffId_leaveTypeId_year: { staffId, leaveTypeId: lt.id, year } },
        update: {},
        create: {
          staffId,
          leaveTypeId: lt.id,
          year,
          total: totalEntitlement,
          used: 0,
          remaining: totalEntitlement,
        },
      });
      balances.push(bal);
    }
    return balances;
  }

  // ═══════════════════════════════════════════════
  // ─── PERMISSION (SHORT LEAVE) ─────────────────
  // ═══════════════════════════════════════════════

  async getPermissions(query: { staffId?: string; month?: string; status?: string }, requester?: RequestUser) {
    const where: any = {};
    const effectiveStaffId = this.ensureOwnStaffId(query.staffId, requester);
    if (effectiveStaffId) where.staffId = effectiveStaffId;
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

  async applyPermission(dto: ApplyPermissionDto, requester?: RequestUser) {
    const effectiveStaffId = this.ensureOwnStaffId(dto.staffId, requester);
    const normalizedDto = { ...dto, staffId: effectiveStaffId || dto.staffId };

    const category = await this.getStaffCategory(normalizedDto.staffId);
    const permissionLimit = this.getPermissionLimitForCategory(category);

    const reqDate = new Date(normalizedDto.date);
    const monthStart = new Date(reqDate.getFullYear(), reqDate.getMonth(), 1);
    const monthEnd = new Date(reqDate.getFullYear(), reqDate.getMonth() + 1, 1);

    const approvedPermissions = await this.prisma.permissionRequest.findMany({
      where: {
        staffId: normalizedDto.staffId,
        status: 'APPROVED',
        date: { gte: monthStart, lt: monthEnd },
      },
      select: { hours: true },
    });

    const usedHours = approvedPermissions.reduce((sum, row) => sum + Number(row.hours || 0), 0);
    const projected = usedHours + normalizedDto.hours;
    if (projected > permissionLimit) {
      throw new BadRequestException(
        `Permission hour limit exceeded. Allowed: ${permissionLimit}h, approved: ${usedHours}h, requested: ${normalizedDto.hours}h`,
      );
    }

    return this.prisma.permissionRequest.create({
      data: {
        staffId: normalizedDto.staffId,
        date: new Date(normalizedDto.date),
        fromTime: normalizedDto.fromTime,
        toTime: normalizedDto.toTime,
        hours: normalizedDto.hours,
        reason: normalizedDto.reason,
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
      data: {
        status: 'REJECTED',
        rejectedBy: String(dto.rejectedBy),
        rejectionNote: dto.rejectionNote ?? dto.reason ?? null,
      },
    });
  }

  async getPermissionSummary(month: string, requester?: RequestUser) {
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    const effectiveStaffId = this.ensureOwnStaffId(undefined, requester);

    const staff = await this.prisma.staff.findMany({
      where: { isActive: true, ...(effectiveStaffId ? { id: effectiveStaffId } : {}) },
      select: { id: true, name: true, employeeId: true, department: true, category: true },
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
      const limit = this.getPermissionLimitForCategory(s.category);
      const excess = Math.max(0, used - limit);
      const lopDays = excess > 0 ? Math.ceil(excess / 8 * 2) / 2 : 0; // half-day increments
      return { ...s, usedHours: used, limit, excessHours: excess, lopDays };
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
        data: { deviceId, status: 'failed', error: error?.message },
      });
      throw new BadRequestException('Sync failed: ' + (error?.message || 'Unknown error'));
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
        results.push({ deviceId: device.id, name: device.name, success: false, error: e?.message || 'Unknown error' });
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
    const month = dto.month || ''; // "2026-03"
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    const actingDriverDayOverridesRecord = await this.prisma.appSetting.findUnique({
      where: { key: 'hr.actingDriverDayOverrides' },
      select: { value: true },
    });
    const actingDriverDayOverridesStore =
      actingDriverDayOverridesRecord &&
      typeof actingDriverDayOverridesRecord.value === 'object' &&
      !Array.isArray(actingDriverDayOverridesRecord.value)
        ? (actingDriverDayOverridesRecord.value as Record<string, Record<string, number>>)
        : {};
    const monthDayOverrides = actingDriverDayOverridesStore[month] || {};

    const settings = await this.getStatutorySettings();
    // Salary structure percentages from settings (with defaults)
    const basicRate = (settings as any).basicRate ?? 50;
    const hraRate = (settings as any).hraRate ?? 30;
    const travelAllowanceRate = (settings as any).travelAllowanceRate ?? 0;
    const otherAllowanceRate = (settings as any).otherAllowanceRate ?? 0;
    const esiDailyWageThreshold = (settings as any).esiDailyWageThreshold ?? 176;

    const staffFilter: any = { isActive: true };
    if (dto.staffIds?.length) staffFilter.id = { in: dto.staffIds };
    const staffList = await this.prisma.staff.findMany({
      where: staffFilter,
      include: { staffStatutory: true },
    });

    const results: any[] = [];

    for (const staff of staffList) {
      const statutory = staff.staffStatutory;
      const isActingDriver =
        staff.category === StaffCategory.NON_TEACHING_ACTING_DRIVER;
      const isDailyRate =
        staff.category === StaffCategory.NON_TEACHING_SECURITY ||
        staff.category === StaffCategory.NON_TEACHING_SPORTS ||
        isActingDriver;
      const actingDriverOverrideDaysRaw = Number(monthDayOverrides[staff.id]);
      const actingDriverOverrideDays =
        isActingDriver && Number.isFinite(actingDriverOverrideDaysRaw) && actingDriverOverrideDaysRaw >= 0
          ? Number(actingDriverOverrideDaysRaw.toFixed(1))
          : undefined;
      const isPartTime = staff.category === StaffCategory.TEACHING_PART_TIME;

      // ── Gross salary determination ──────────────────────────────────────
      let grossSalary: number;
      let basicSalary: number;
      let hra: number;
      let travelAllowance: number;
      let otherAllowances: number;

      if (isDailyRate) {
        // Daily-rate staff: gross = present days × daily rate
        const defaultDailyRate =
          staff.category === StaffCategory.NON_TEACHING_SECURITY
            ? 400
            : staff.category === StaffCategory.NON_TEACHING_SPORTS
              ? 1500
              : Math.round((staff.salary || 0) / 26);
        const dailyRate = statutory?.dailyRate ?? defaultDailyRate;

        // Count attendance first (needed for gross)
        const attendances = await this.prisma.attendance.findMany({
          where: { staffId: staff.id, date: { gte: startDate, lt: endDate } },
        });
        let presentDaysCount = 0;
        for (const a of attendances) {
          if (a.status === 'PRESENT' || a.status === 'LATE') presentDaysCount++;
          else if (a.status === 'HALF_DAY') presentDaysCount += 0.5;
        }

        const effectiveDays = actingDriverOverrideDays ?? presentDaysCount;

        grossSalary = Math.round(effectiveDays * dailyRate);
        basicSalary = Math.round(grossSalary * basicRate / 100);
        hra = Math.round(grossSalary * hraRate / 100);
        travelAllowance = Math.round(grossSalary * travelAllowanceRate / 100);
        otherAllowances = Math.round(grossSalary * otherAllowanceRate / 100);
      } else {
        // Salaried staff: gross is stored; break it down by structure
        grossSalary = statutory?.grossSalary ?? staff.salary ?? 0;
        basicSalary = Math.round(grossSalary * basicRate / 100);
        hra = Math.round(grossSalary * hraRate / 100);
        travelAllowance = Math.round(grossSalary * travelAllowanceRate / 100);
        otherAllowances = Math.round(grossSalary * otherAllowanceRate / 100);
      }

      // ── Attendance & LOP ────────────────────────────────────────────────
      const attendances = isDailyRate
        ? [] // already fetched above, but re-use the block below for deductions
        : await this.prisma.attendance.findMany({
            where: { staffId: staff.id, date: { gte: startDate, lt: endDate } },
          });

      const allAttendances = isDailyRate
        ? await this.prisma.attendance.findMany({
            where: { staffId: staff.id, date: { gte: startDate, lt: endDate } },
          })
        : attendances;

      const totalWorkingDays = this.getWorkingDaysInMonth(y, m);
      let presentDays = 0;
      let lopDays = 0;

      for (const a of allAttendances) {
        if (a.status === 'PRESENT' || a.status === 'LATE') presentDays++;
        else if (a.status === 'HALF_DAY') presentDays += 0.5;
        else if (a.status === 'ABSENT') {
          if (!isPartTime && !isDailyRate) lopDays++; // No LOP for part-time / daily-rate
        } else if (a.status === 'ON_LEAVE') {
          const leaveApp = await this.prisma.leaveApplication.findFirst({
            where: {
              staffId: staff.id,
              fromDate: { lte: a.date },
              toDate: { gte: a.date },
              status: 'APPROVED',
            },
            include: { leaveType: true },
          });
          if (leaveApp?.leaveType?.code === 'LOP' && !isPartTime && !isDailyRate) {
            lopDays++;
          } else {
            presentDays++;
          }
        }
      }

      if (actingDriverOverrideDays !== undefined) {
        presentDays = actingDriverOverrideDays;
      }

      // Permission excess → LOP (not for part-time / daily-rate)
      let permissionHoursUsed = 0;
      let permissionLopDays = 0;
      if (!isPartTime && !isDailyRate) {
        const approvedPermissions = await this.prisma.permissionRequest.findMany({
          where: { staffId: staff.id, status: 'APPROVED', date: { gte: startDate, lt: endDate } },
        });
        permissionHoursUsed = approvedPermissions.reduce((sum, p) => sum + p.hours, 0);
        const permissionLimit = this.getPermissionLimitForCategory(staff.category);
        const excessHours = Math.max(0, permissionHoursUsed - permissionLimit);
        permissionLopDays = excessHours > 0 ? Math.ceil(excessHours / 8 * 2) / 2 : 0;
      }

      const perDaySalary = isDailyRate ? 0 : grossSalary / totalWorkingDays;
      const lopDeduction = isDailyRate ? 0 : Math.round(lopDays * perDaySalary);
      const permissionLopDeduction = isDailyRate ? 0 : Math.round(permissionLopDays * perDaySalary);

      // ── PF calculation ──────────────────────────────────────────────────
      // PF is on Basic = 50% of gross (pfBase), not on full gross
      const pfBase = basicSalary; // = grossSalary * basicRate / 100
      let pfDeduction = 0;
      let employerPfContribution = 0;
      const isStipend = statutory?.isStipend ?? false;
      const pfEligible =
        !isActingDriver &&
        !isStipend &&
        (statutory ? statutory.pfEnabled !== false : Boolean(staff.pfJoiningDate));
      if (settings.pfEnabled && pfEligible) {
        const pfWage = Math.min(pfBase, settings.pfWageLimit);
        pfDeduction = Math.round(pfWage * settings.pfEmployeeRate / 100);
        employerPfContribution = Math.round(pfWage * settings.pfEmployerRate / 100);
      }

      // ── ESI calculation ─────────────────────────────────────────────────
      // ESI is on esiBase = Basic (50%) + HRA (30%) = 80% of gross
      // But skip if daily wage < esiDailyWageThreshold (default ₹176)
      const esiBase = basicSalary + hra; // = grossSalary * (basicRate + hraRate) / 100 = ~80%
      let esiDeduction = 0;
      let employerEsiContribution = 0;
      const dailyEsiWage = esiBase / 30;
      const esiEligible = !isActingDriver && dailyEsiWage >= esiDailyWageThreshold;
      if (settings.esiEnabled && (statutory?.esiEnabled !== false) && esiEligible) {
        if (esiBase <= settings.esiWageLimit) {
          esiDeduction = Math.round(esiBase * settings.esiEmployeeRate / 100);
          employerEsiContribution = Math.round(esiBase * settings.esiEmployerRate / 100);
        }
      }

      // ── Prof Tax ────────────────────────────────────────────────────────
      const ptDeduction = isActingDriver ? 0 : (settings.ptEnabled ? settings.ptAmount : 0);

      // ── PSF (Professional Services Fund) ────────────────────────────────
      let psfDeduction = 0;
      const psfEligible = !isActingDriver && (statutory?.psfEnabled !== false);
      if ((settings as any).psfEnabled && psfEligible) {
        const psfBase = basicSalary; // PSF typically on basic salary like PF
        const psfWageLimit = (settings as any).psfWageLimit ?? 0;
        if (psfWageLimit > 0 && psfBase <= psfWageLimit) {
          psfDeduction = Math.round(psfBase * ((settings as any).psfEmployeeRate ?? 0) / 100);
        } else if (psfWageLimit === 0) {
          psfDeduction = Math.round(psfBase * ((settings as any).psfEmployeeRate ?? 0) / 100);
        }
      }

      // ── Loan EMI deductions ─────────────────────────────────────────────
      let loanEMIDeduction = 0;
      const staffLoans = isActingDriver
        ? []
        : await this.prisma.staffLoan.findMany({
            where: { staffId: staff.id, status: 'ACTIVE' },
            include: { emiTransactions: true },
          });

      for (const loan of staffLoans) {
        // Check if current month is in skipMonths
        const skipMonths = JSON.parse(loan.skipMonths || '[]');
        const currentMonth = `${y}-${String(m).padStart(2, '0')}`;
        if (!skipMonths.includes(currentMonth)) {
          // Find or create EMI transaction for this month
          let emiTxn = loan.emiTransactions.find((t) => t.month === currentMonth);
          if (!emiTxn) {
            // Create new EMI transaction if not found
            emiTxn = await this.prisma.loanEMITransaction.create({
              data: {
                loanId: loan.id,
                month: currentMonth,
                emiDue: loan.emiAmount,
                status: 'PENDING',
              },
            });
          }
          if (emiTxn.status === 'PENDING') {
            loanEMIDeduction += loan.emiAmount;
          }
        }
      }

      // ── Advance deductions ──────────────────────────────────────────────
      let fixedAdvanceDeduction = 0;
      let salaryAdvanceDeduction = 0;
      let otherAdvanceDeduction = 0;

      const activeAdvances = isActingDriver
        ? []
        : await this.prisma.staffAdvance.findMany({
            where: { staffId: staff.id, status: { in: ['DISBURSED', 'REPAYING'] }, balanceRemaining: { gt: 0 } },
          });

      if (!isActingDriver) {
        for (const adv of activeAdvances) {
          const deduction = Math.min(adv.monthlyDeduction, adv.balanceRemaining);
          if (adv.type === 'FIXED_ADVANCE') fixedAdvanceDeduction += deduction;
          else if (adv.type === 'SALARY_ADVANCE') salaryAdvanceDeduction += deduction;
          else otherAdvanceDeduction += deduction;
        }
      }

      // ── Net / Take-Home & CTC ───────────────────────────────────────────
      // Net = Gross − LOP − Employee PF − Employee ESI − PSF − Loan EMI − Advances
      const totalDeductions = isActingDriver
        ? 0
        : Math.round(
            lopDeduction + permissionLopDeduction +
            pfDeduction + esiDeduction + psfDeduction + ptDeduction +
            loanEMIDeduction +
            fixedAdvanceDeduction + salaryAdvanceDeduction + otherAdvanceDeduction,
          );
      const netSalary = isActingDriver
        ? Math.round(grossSalary)
        : Math.round(grossSalary - totalDeductions);
      // CTC = Gross + Employer PF + Employer ESI
      const ctc = isActingDriver
        ? Math.round(grossSalary)
        : Math.round(grossSalary + employerPfContribution + employerEsiContribution);

      const payroll = await this.prisma.payroll.upsert({
        where: { staffId_month: { staffId: staff.id, month: month || '' } },
        update: {
          basicSalary, hra, travelAllowance, da: 0, otherAllowances, grossSalary,
          totalWorkingDays, presentDays, lopDays, lopDeduction,
          permissionHoursUsed, permissionLopDays, permissionLopDeduction,
          pfBase, esiBase,
          pfDeduction, esiDeduction, psfDeduction, ptDeduction,
          employerPfContribution, employerEsiContribution, ctc,
          loanEMIDeduction,
          fixedAdvanceDeduction, salaryAdvanceDeduction, otherAdvanceDeduction,
          extraAllowance: 0,
          totalDeductions, netSalary,
          status: 'generated',
        },
        create: {
          staffId: staff.id, month: month || '',
          basicSalary, hra, travelAllowance, da: 0, otherAllowances, grossSalary,
          totalWorkingDays, presentDays, lopDays, lopDeduction,
          permissionHoursUsed, permissionLopDays, permissionLopDeduction,
          pfBase, esiBase,
          pfDeduction, esiDeduction, psfDeduction, ptDeduction,
          employerPfContribution, employerEsiContribution, ctc,
          loanEMIDeduction,
          fixedAdvanceDeduction, salaryAdvanceDeduction, otherAdvanceDeduction,
          extraAllowance: 0,
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

  // Manual update: cancel LOP or add bonus/incentive
  async updatePayrollManual(id: string, dto: UpdatePayrollDto) {
    const payroll = await this.prisma.payroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll record not found');

    const updates: any = {};

    if (dto.lopCancelled === true) {
      // Cancel LOP: reset LOP deduction to 0 and recalculate net
      updates.lopCancelled = true;
      updates.lopDays = 0;
      updates.lopDeduction = 0;
      updates.permissionLopDays = 0;
      updates.permissionLopDeduction = 0;
      const newTotalDeductions = Math.max(
        0,
        payroll.totalDeductions - payroll.lopDeduction - payroll.permissionLopDeduction,
      );
      updates.totalDeductions = newTotalDeductions;
      updates.netSalary = Math.round(payroll.grossSalary - newTotalDeductions);
    }

    if (dto.bonusIncentive !== undefined) {
      updates.bonusIncentive = dto.bonusIncentive;
    }

    if (dto.extraAllowance !== undefined) {
      updates.extraAllowance = dto.extraAllowance;
    }

    return this.prisma.payroll.update({ where: { id }, data: updates });
  }

  async getPayrolls(query: { month?: string; staffId?: string; status?: string }, requester?: RequestUser) {
    const where: any = {};
    if (query.month) where.month = query.month;
    const effectiveStaffId = this.ensureOwnStaffId(query.staffId, requester);
    if (effectiveStaffId) where.staffId = effectiveStaffId;
    if (query.status) where.status = query.status;
    return this.prisma.payroll.findMany({
      where,
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true, designation: true, category: true, paymentMode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayroll(id: string, requester?: RequestUser) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true, designation: true, category: true, paymentMode: true } } },
    });
    if (!payroll) throw new NotFoundException('Payroll record not found');
    const effectiveStaffId = this.ensureOwnStaffId(undefined, requester);
    if (effectiveStaffId && payroll.staffId !== effectiveStaffId) {
      throw new BadRequestException('You can only access your own payroll record');
    }
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

  async getDashboard(requester?: RequestUser) {
    const effectiveStaffId = this.ensureOwnStaffId(undefined, requester);
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
      this.prisma.staff.count({ where: { isActive: true, ...(effectiveStaffId ? { id: effectiveStaffId } : {}) } }),
      this.prisma.attendance.findMany({ where: { date: { gte: today, lt: tomorrow }, ...(effectiveStaffId ? { staffId: effectiveStaffId } : {}) } }),
      this.prisma.leaveApplication.count({ where: { status: 'PENDING', ...(effectiveStaffId ? { staffId: effectiveStaffId } : {}) } }),
      this.prisma.permissionRequest.count({ where: { status: 'PENDING', ...(effectiveStaffId ? { staffId: effectiveStaffId } : {}) } }),
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

  async createAdvanceRequest(data: { staffId: string; type: string; amount: number; reason?: string; monthlyDeduction?: number }, requester?: RequestUser) {
    const staffId = this.ensureOwnStaffId(data.staffId, requester) || data.staffId;
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');
    const ticketNo = await this.getNextAdvanceTicketNo();
    const monthly = data.monthlyDeduction || data.amount; // default: full repay in one month
    return this.prisma.staffAdvance.create({
      data: {
        ticketNo,
        staffId,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        monthlyDeduction: monthly,
        balanceRemaining: data.amount,
        status: 'REQUESTED',
      },
    });
  }

  async getAdvanceRequests(query: { staffId?: string; status?: string; type?: string }, requester?: RequestUser) {
    const where: any = {};
    const effectiveStaffId = this.ensureOwnStaffId(query.staffId, requester);
    if (effectiveStaffId) where.staffId = effectiveStaffId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    return this.prisma.staffAdvance.findMany({
      where,
      include: { staff: { select: { id: true, name: true, employeeId: true, designation: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdvanceRequest(id: string, requester?: RequestUser) {
    const adv = await this.prisma.staffAdvance.findUnique({
      where: { id },
      include: { staff: { select: { id: true, name: true, employeeId: true, designation: true, category: true } } },
    });
    if (!adv) throw new NotFoundException('Advance request not found');
    const effectiveStaffId = this.ensureOwnStaffId(undefined, requester);
    if (effectiveStaffId && adv.staffId !== effectiveStaffId) {
      throw new BadRequestException('You can only access your own advance request');
    }
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
  // ─── SALARY INCREMENT ──────────────────────────
  // ═══════════════════════════════════════════════

  async createIncrement(dto: any) {
    const staff = await this.prisma.staff.findUnique({ where: { id: dto.staffId } });
    if (!staff) throw new NotFoundException('Staff not found');
         const toSalary = parseFloat(dto.toSalary);

    return this.prisma.salaryIncrement.create({
      data: {
        staffId: dto.staffId,
        fromSalary: parseFloat(dto.fromSalary),
        toSalary: toSalary,
        // convert this to float 
        incrementAmount: toSalary - parseFloat(dto.fromSalary),
        incrementDate: new Date(dto.incrementDate),
        effectiveDate: new Date(dto.effectiveDate),
        reason: dto.reason,
        status: 'PENDING',
      },
      include: { staff: { select: { id: true, name: true, employeeId: true } } },
    });
  }

  async approveIncrement(id: string, dto: any) {
    const increment = await this.prisma.salaryIncrement.findUnique({ where: { id } });
    if (!increment) throw new NotFoundException('Increment not found');
    if (increment.status !== 'PENDING') throw new BadRequestException('Only pending increments can be approved');

    // Update staff salary to new salary
    const staff = await this.prisma.staff.findUnique({ where: { id: increment.staffId } });
    if (staff) {
      await this.prisma.staff.update({
        where: { id: increment.staffId },
        data: { salary: increment.toSalary },
      });
    }

    return this.prisma.salaryIncrement.update({
      where: { id },
      data: {
        status: 'APPLIED',
        approvedBy: dto.approvedBy,
        approvedAt: new Date(),
      },
      include: { staff: { select: { id: true, name: true, employeeId: true } } },
    });
  }

  async rejectIncrement(id: string, dto: any) {
    const increment = await this.prisma.salaryIncrement.findUnique({ where: { id } });
    if (!increment) throw new NotFoundException('Increment not found');
    if (increment.status !== 'PENDING') throw new BadRequestException('Only pending increments can be rejected');

    return this.prisma.salaryIncrement.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedReason: dto.rejectionReason,
      },
    });
  }

  async getIncrementHistory(staffId: string, status?: string) {
    return this.prisma.salaryIncrement.findMany({
      where: {
        staffId,
        ...(status ? { status } : {}),
      },
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true } } },
      orderBy: { incrementDate: 'desc' },
    });
  }

  async getAllIncrements(status?: string) {
    return this.prisma.salaryIncrement.findMany({
      where: status ? { status } : {},
      include: { staff: { select: { id: true, name: true, employeeId: true, department: true, salary: true } } },
      orderBy: { incrementDate: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════
  // ─── STAFF LOAN MANAGEMENT ─────────────────────
  // ═══════════════════════════════════════════════

  async createLoan(dto: any) {
    const staff = await this.prisma.staff.findUnique({ where: { id: dto.staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    // Calculate number of EMIs
    const [startYear, startMonth] = dto.startMonth.split('-').map(Number);
    const loanAmount = dto.loanAmount;
    const emiAmount = dto.emiAmount;
    const numEMIs = Math.ceil(loanAmount / emiAmount);
    
    // Calculate end month
    let endYear = startYear;
    let endMonth = startMonth + numEMIs - 1;
    if (endMonth > 12) {
      endYear += Math.floor(endMonth / 12);
      endMonth = endMonth % 12 || 12;
    }
    const endMonthStr = `${endYear}-${String(endMonth).padStart(2, '0')}`;

    const loan = await this.prisma.staffLoan.create({
      data: {
        staffId: dto.staffId,
        loanAmount: dto.loanAmount,
        emiAmount: dto.emiAmount,
        emiFrequency: dto.emiFrequency || 'MONTHLY',
        startMonth: dto.startMonth,
        endMonth: endMonthStr,
        balanceRemaining: dto.loanAmount,
        status: 'ACTIVE',
        reason: dto.reason,
      },
      include: { staff: { select: { id: true, name: true, employeeId: true } } },
    });

    // Create EMI transaction records for each month
    for (let i = 0; i < numEMIs; i++) {
      let m = startMonth + i;
      let y = startYear;
      if (m > 12) {
        y += Math.floor(m / 12);
        m = m % 12 || 12;
      }
      const month = `${y}-${String(m).padStart(2, '0')}`;
      await this.prisma.loanEMITransaction.create({
        data: {
          loanId: loan.id,
          month,
          emiDue: emiAmount,
          status: 'PENDING',
        },
      });
    }

    return loan;
  }

  async approveLoan(id: string, dto: any) {
    const loan = await this.prisma.staffLoan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== 'ACTIVE') throw new BadRequestException('Only active loans can be approved');

    return this.prisma.staffLoan.update({
      where: { id },
      data: {
        approvedBy: dto.approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async rejectLoan(id: string, dto: any) {
    const loan = await this.prisma.staffLoan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');

    return this.prisma.staffLoan.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });
  }

  async getLoans(staffId: string, status?: string) {
    return this.prisma.staffLoan.findMany({
      where: {
        staffId,
        ...(status ? { status } : {}),
      },
      include: {
        staff: { select: { id: true, name: true, employeeId: true, department: true } },
        emiTransactions: { orderBy: { month: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLoanDetail(id: string) {
    const loan = await this.prisma.staffLoan.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, name: true, employeeId: true, department: true } },
        emiTransactions: { orderBy: { month: 'asc' } },
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  async skipLoanEMI(loanId: string, dto: any) {
    const loan = await this.prisma.staffLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');

    // Parse skipMonths from JSON
    const skipMonths: string[] = JSON.parse(loan.skipMonths || '[]');
    if (!skipMonths.includes(dto.month)) {
      skipMonths.push(dto.month);
      skipMonths.sort();
    }

    // Update loan record
    const updated = await this.prisma.staffLoan.update({
      where: { id: loanId },
      data: { skipMonths: JSON.stringify(skipMonths) },
    });

    // Update EMI transaction status to SKIPPED
    await this.prisma.loanEMITransaction.updateMany({
      where: { loanId, month: dto.month },
      data: { status: 'SKIPPED' },
    });

    return updated;
  }

  async resumeLoanEMI(loanId: string, dto: any) {
    const loan = await this.prisma.staffLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');

    // Parse skipMonths from JSON
    const skipMonths: string[] = JSON.parse(loan.skipMonths || '[]');
    const index = skipMonths.indexOf(dto.month);
    if (index > -1) {
      skipMonths.splice(index, 1);
    }

    // Update loan record
    const updated = await this.prisma.staffLoan.update({
      where: { id: loanId },
      data: { skipMonths: JSON.stringify(skipMonths) },
    });

    // Update EMI transaction status back to PENDING
    await this.prisma.loanEMITransaction.updateMany({
      where: { loanId, month: dto.month },
      data: { status: 'PENDING' },
    });

    return updated;
  }

  async preCloseLoan(loanId: string, dto: any) {
    const loan = await this.prisma.staffLoan.findUnique({
      where: { id: loanId },
      include: { emiTransactions: true },
    });
    if (!loan) throw new NotFoundException('Loan not found');

    const balanceRemaining = loan.balanceRemaining;
    const preClosureAmount = dto.partialAmount || balanceRemaining;

    if (preClosureAmount > balanceRemaining) {
      throw new BadRequestException('Pre-closure amount cannot exceed remaining balance');
    }

    const newBalance = balanceRemaining - preClosureAmount;
    const status = newBalance <= 0 ? 'PRE_CLOSED' : 'ACTIVE';

    return this.prisma.staffLoan.update({
      where: { id: loanId },
      data: {
        preClosureDate: new Date(),
        preClosureAmount: preClosureAmount,
        preClosureReason: dto.reason,
        balanceRemaining: Math.max(0, newBalance),
        status,
      },
    });
  }

  async getLoansByStatus(status: string) {
    return this.prisma.staffLoan.findMany({
      where: { status },
      include: {
        staff: { select: { id: true, name: true, employeeId: true, department: true } },
        emiTransactions: { orderBy: { month: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════
  // ─── STATUTORY REPORTS ──────────────────────────
  // ═══════════════════════════════════════════════

  async getPFStaffReport(month?: string) {
    const where: any = { staff: { staffStatutory: { pfEnabled: true } } };
    
    if (month) {
      where.month = month;
    }

    const payrolls = await this.prisma.payroll.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
            designation: true,
            staffStatutory: true,
          },
        },
      },
      orderBy: [{ month: 'desc' }, { staff: { department: 'asc' } }],
    });

    return payrolls.map((p) => ({
      staffId: p.staff.id,
      employeeId: p.staff.employeeId,
      name: p.staff.name,
      department: p.staff.department,
      designation: p.staff.designation,
      month: p.month,
      grossSalary: p.grossSalary,
      pfBase: p.pfBase,
      pfDeduction: p.pfDeduction,
      pfNumber: p.staff.staffStatutory?.pfNumber || 'N/A',
      uanNumber: p.staff.staffStatutory?.uanNumber || 'N/A',
    }));
  }

  async getNonPFStaffReport(month?: string) {
    const where: any = {
      OR: [
        { staff: { staffStatutory: { pfEnabled: false } } },
        { staff: { staffStatutory: null } },
      ],
    };

    if (month) {
      where.month = month;
    }

    const payrolls = await this.prisma.payroll.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
            designation: true,
            staffStatutory: true,
          },
        },
      },
      orderBy: [{ month: 'desc' }, { staff: { department: 'asc' } }],
    });

    return payrolls.map((p) => ({
      staffId: p.staff.id,
      employeeId: p.staff.employeeId,
      name: p.staff.name,
      department: p.staff.department,
      designation: p.staff.designation,
      month: p.month,
      grossSalary: p.grossSalary,
      pfBase: p.pfBase,
      reason: p.staff.staffStatutory?.isStipend ? 'Stipend' : 'PSF Disabled',
    }));
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
