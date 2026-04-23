import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
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