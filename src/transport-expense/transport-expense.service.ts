import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { AttendanceStatus, StaffCategory } from '@prisma/client';

@Injectable()
export class TransportExpenseService {
  constructor(private prisma: PrismaService) {}

  private getMonthWindow(month?: string) {
    const parsed = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    const [year, mon] = parsed.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    return { month: parsed, start, end };
  }

  private readTransportComponent(value: unknown): number {
    if (!value || typeof value !== 'object') return 0;
    const raw = (value as any).transport;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  async getTransportSalaryReport(month?: string) {
    const { month: reportMonth, start, end } = this.getMonthWindow(month);

    const staffRows = await this.prisma.staff.findMany({
      where: {
        isActive: true,
        OR: [
          { category: StaffCategory.NON_TEACHING_ACTING_DRIVER },
          { designation: { contains: 'driver', mode: 'insensitive' } },
          { designation: { contains: 'conductor', mode: 'insensitive' } },
        ],
      },
      include: {
        staffStatutory: {
          select: { dailyRate: true },
        },
        payrollRecords: {
          where: { month: reportMonth },
          select: { netSalary: true, grossSalary: true, totalDeductions: true },
          take: 1,
        },
      },
      orderBy: [{ designation: 'asc' }, { name: 'asc' }],
    });

    const attendanceRows = await this.prisma.attendance.findMany({
      where: {
        date: { gte: start, lt: end },
        staffId: { in: staffRows.map((s) => s.id) },
      },
      select: { staffId: true, status: true },
    });

    const presentMap = new Map<string, number>();
    for (const a of attendanceRows) {
      const prev = presentMap.get(a.staffId) || 0;
      const weight =
        a.status === AttendanceStatus.PRESENT ||
        a.status === AttendanceStatus.LATE ||
        a.status === AttendanceStatus.ON_LEAVE
          ? 1
          : a.status === AttendanceStatus.HALF_DAY
            ? 0.5
            : 0;
      presentMap.set(a.staffId, prev + weight);
    }

    const rows = staffRows.map((s) => {
      const presentDays = Number((presentMap.get(s.id) || 0).toFixed(1));
      const dailyRate = s.staffStatutory?.dailyRate || Number(((s.salary || 0) / 26).toFixed(2));
      const payroll = s.payrollRecords[0];
      const isActingDriver = s.category === StaffCategory.NON_TEACHING_ACTING_DRIVER;

      const computedSalary = isActingDriver
        ? Number((presentDays * dailyRate).toFixed(2))
        : Number(payroll?.netSalary ?? s.salary ?? 0);

      return {
        staffId: s.id,
        employeeId: s.employeeId,
        name: s.name,
        designation: s.designation,
        category: s.category,
        presentDays,
        dailyRate,
        salaryExpense: computedSalary,
        source: isActingDriver ? 'DAY_BASED' : payroll ? 'PAYROLL' : 'STAFF_SALARY',
      };
    });

    const totalSalaryExpense = Number(rows.reduce((sum, r) => sum + r.salaryExpense, 0).toFixed(2));

    return {
      month: reportMonth,
      totalStaff: rows.length,
      totalSalaryExpense,
      rows,
    };
  }

  async getTransportFinanceReport(month?: string) {
    const { month: reportMonth, start, end } = this.getMonthWindow(month);

    const manualExpenses = await this.prisma.transportExpense.findMany({
      where: { date: { gte: start, lt: end } },
      select: { amount: true, category: true },
    });

    const payments = await this.prisma.payment.findMany({
      where: {
        paymentDate: { gte: start, lt: end },
        status: 'SUCCESS',
        studentFee: {
          student: {
            studentTransport: {
              isNot: null,
            },
          },
        },
      },
      include: {
        studentFee: {
          select: {
            transportFee: true,
            netFee: true,
            totalFee: true,
          },
        },
      },
    });

    const salary = await this.getTransportSalaryReport(reportMonth);

    const transportIncome = Number(
      payments
        .reduce((sum, p) => {
          const fromPaid = this.readTransportComponent(p.paidComponents);
          const fromReceipt = this.readTransportComponent(p.receiptComponents);
          if (fromPaid > 0) return sum + fromPaid;
          if (fromReceipt > 0) return sum + fromReceipt;

          const fee = p.studentFee;
          const denom = Number(fee.netFee || fee.totalFee || 0);
          const ratio = denom > 0 ? Number(fee.transportFee || 0) / denom : 0;
          return sum + Number(p.amount || 0) * ratio;
        }, 0)
        .toFixed(2),
    );

    const manualExpenseTotal = Number(manualExpenses.reduce((sum, x) => sum + Number(x.amount || 0), 0).toFixed(2));
    const totalExpense = Number((manualExpenseTotal + salary.totalSalaryExpense).toFixed(2));
    const netTransport = Number((transportIncome - totalExpense).toFixed(2));

    return {
      month: reportMonth,
      income: {
        transportFees: transportIncome,
      },
      expense: {
        salary: salary.totalSalaryExpense,
        manual: manualExpenseTotal,
        total: totalExpense,
      },
      net: netTransport,
      salaryRows: salary.rows,
    };
  }

  create(dto: CreateExpenseDto) {
    return this.prisma.transportExpense.create({
      data: {
        ...dto,
        date: new Date(dto.date),
      },
    });
  }

  findAll() {
    return this.prisma.transportExpense.findMany({
      include: { bus: true },
      orderBy: { date: 'desc' },
    });
  }
}