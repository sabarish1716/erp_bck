import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { AttendanceStatus, StaffCategory } from '@prisma/client';
import * as ExcelJS from 'exceljs';

type ExpenseCategory = 'FUEL' | 'MAINTENANCE' | 'PARTS' | 'TAX';

type ExpenseFilters = {
  category?: ExpenseCategory;
  from?: string;
  to?: string;
  busIds?: string[];
};

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

  private splitAmountEvenly(total: number, count: number): number[] {
    const totalCents = Math.round(total * 100);
    const base = Math.floor(totalCents / count);
    const remainder = totalCents % count;

    return Array.from({ length: count }, (_, idx) => {
      const cents = base + (idx < remainder ? 1 : 0);
      return cents / 100;
    });
  }

  private parseDateBoundary(date: string, endOfDay = false): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    return new Date(`${date}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`);
  }

  private buildCreatePayload(
    dto: CreateExpenseDto,
    busId: string,
    amount: number,
  ) {
    const common = {
      busId,
      date: new Date(dto.date),
      category: dto.category,
      amount,
    };

    switch (dto.category) {
      case 'FUEL':
        return {
          ...common,
          fuelStation: dto.fuelStation,
          paymentMode: dto.paymentMode,
          litres: dto.litres,
          pricePerLitre: dto.pricePerLitre,
          isShared: false,
        };
      case 'MAINTENANCE':
        return {
          ...common,
          workshop: dto.workshop,
          description: dto.description,
          isShared: !!dto.isShared,
        };
      case 'PARTS':
        return {
          ...common,
          partName: dto.partName,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          description: dto.description,
          isShared: !!dto.isShared,
        };
      case 'TAX':
        return {
          ...common,
          taxType: dto.taxType,
          referenceNo: dto.referenceNo,
          isShared: false,
        };
      default:
        return common;
    }
  }

  async create(dto: CreateExpenseDto) {
    const busIds = Array.from(
      new Set((dto.busIds?.length ? dto.busIds : dto.busId ? [dto.busId] : []).filter(Boolean)),
    );

    if (!busIds.length) {
      throw new BadRequestException('Please provide at least one bus');
    }

    if (dto.isShared && !['PARTS', 'MAINTENANCE'].includes(dto.category)) {
      throw new BadRequestException('Shared expenses are allowed only for PARTS or MAINTENANCE');
    }

    if (dto.isShared && ['PARTS', 'MAINTENANCE'].includes(dto.category) && busIds.length > 1) {
      const splitAmounts = this.splitAmountEvenly(dto.amount, busIds.length);
      const created = await this.prisma.$transaction(
        busIds.map((busId, idx) =>
          this.prisma.transportExpense.create({
            data: this.buildCreatePayload(dto, busId, splitAmounts[idx]),
            include: { bus: true },
          }),
        ),
      );

      return {
        isShared: true,
        splitCount: created.length,
        totalAmount: dto.amount,
        entries: created,
      };
    }

    return this.prisma.transportExpense.create({
      data: {
        ...this.buildCreatePayload(dto, busIds[0], dto.amount),
      },
      include: { bus: true },
    });
  }

  findAll(filters: ExpenseFilters = {}) {
    const where: any = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.busIds?.length) {
      where.busId = { in: filters.busIds };
    }

    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) {
        where.date.gte = this.parseDateBoundary(filters.from, false);
      }
      if (filters.to) {
        where.date.lte = this.parseDateBoundary(filters.to, true);
      }
    }

    return this.prisma.transportExpense.findMany({
      where,
      include: { bus: true },
      orderBy: { date: 'desc' },
    });
  }

  async exportExcel(filters: ExpenseFilters = {}) {
    const expenses = await this.findAll(filters);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transport Expense');
    const selectedCategory = filters.category;

    if (selectedCategory === 'FUEL') {
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Bus', key: 'bus', width: 20 },
        { header: 'Amount', key: 'amount', width: 14 },
        { header: 'Fuel Station', key: 'fuelStation', width: 24 },
        { header: 'Payment Mode', key: 'paymentMode', width: 16 },
        { header: 'Litres', key: 'litres', width: 12 },
        { header: 'Price/Litre', key: 'pricePerLitre', width: 14 },
      ];

      sheet.addRows(
        expenses.map((e) => ({
          date: e.date.toISOString().slice(0, 10),
          bus: e.bus?.number ?? '-',
          amount: e.amount,
          fuelStation: e.fuelStation ?? '-',
          paymentMode: e.paymentMode ?? '-',
          litres: e.litres ?? '-',
          pricePerLitre: e.pricePerLitre ?? '-',
        })),
      );
    } else if (selectedCategory === 'MAINTENANCE') {
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Bus', key: 'bus', width: 20 },
        { header: 'Amount', key: 'amount', width: 14 },
        { header: 'Workshop', key: 'workshop', width: 24 },
        { header: 'Description', key: 'description', width: 28 },
        { header: 'Shared', key: 'isShared', width: 10 },
      ];

      sheet.addRows(
        expenses.map((e) => ({
          date: e.date.toISOString().slice(0, 10),
          bus: e.bus?.number ?? '-',
          amount: e.amount,
          workshop: e.workshop ?? '-',
          description: e.description ?? '-',
          isShared: e.isShared ? 'Yes' : 'No',
        })),
      );
    } else if (selectedCategory === 'PARTS') {
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Bus', key: 'bus', width: 20 },
        { header: 'Amount', key: 'amount', width: 14 },
        { header: 'Part Name', key: 'partName', width: 24 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Unit Cost', key: 'unitCost', width: 14 },
        { header: 'Shared', key: 'isShared', width: 10 },
      ];

      sheet.addRows(
        expenses.map((e) => ({
          date: e.date.toISOString().slice(0, 10),
          bus: e.bus?.number ?? '-',
          amount: e.amount,
          partName: e.partName ?? '-',
          quantity: e.quantity ?? '-',
          unitCost: e.unitCost ?? '-',
          isShared: e.isShared ? 'Yes' : 'No',
        })),
      );
    } else if (selectedCategory === 'TAX') {
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Bus', key: 'bus', width: 20 },
        { header: 'Amount', key: 'amount', width: 14 },
        { header: 'Tax Type', key: 'taxType', width: 22 },
        { header: 'Reference No', key: 'referenceNo', width: 22 },
      ];

      sheet.addRows(
        expenses.map((e) => ({
          date: e.date.toISOString().slice(0, 10),
          bus: e.bus?.number ?? '-',
          amount: e.amount,
          taxType: e.taxType ?? '-',
          referenceNo: e.referenceNo ?? '-',
        })),
      );
    } else {
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Bus', key: 'bus', width: 20 },
        { header: 'Category', key: 'category', width: 16 },
        { header: 'Amount', key: 'amount', width: 14 },
      ];

      sheet.addRows(
        expenses.map((e) => ({
          date: e.date.toISOString().slice(0, 10),
          bus: e.bus?.number ?? '-',
          category: e.category,
          amount: e.amount,
        })),
      );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const safeCategory = (selectedCategory ?? 'all').toLowerCase();

    return {
      filename: `transport-expense-${safeCategory}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    };
  }
}