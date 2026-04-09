import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getMasterSummary() {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // 1. Admissions stats
    const totalApplications = await this.prisma.admission.count();
    const approvedAdmissions = await this.prisma.admission.count({
      where: { isApproved: true },
    });
    const conversionRate = totalApplications > 0 ? (approvedAdmissions / totalApplications) * 100 : 0;
    
    // In many school erps, waitlisted might be students not yet in admission
    const waitlisted = await this.prisma.student.count({
      where: { admission: null },
    });

    // 2. Fees & Revenue
    const todayPayments = await this.prisma.payment.aggregate({
      where: {
        paymentDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
        status: 'SUCCESS',
      },
      _sum: { amount: true },
    });

    const totalRevenue = await this.prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    });

    const studentFeesBalance = await this.prisma.studentFee.aggregate({
      _sum: { netFee: true },
    });
    
    const pendingFees = (studentFeesBalance._sum.netFee || 0) - (totalRevenue._sum.amount || 0);

    // 3. Transport
    const totalFleet = await this.prisma.bus.count();
    const activeFleet = await this.prisma.bus.count({
      where: { drivers: { some: {} } },
    });

    // 4. Staff HR
    const totalStaff = await this.prisma.staff.count({ where: { isActive: true } });
    const onLeave = await this.prisma.leaveApplication.count({
      where: {
        status: 'APPROVED',
        fromDate: { lte: today },
        toDate: { gte: today },
      },
    });
    const pendingLeaves = await this.prisma.leaveApplication.count({
      where: { status: 'PENDING' },
    });

    // 5. Shop
    const todaySales = await this.prisma.sale.aggregate({
      where: {
        saleDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _sum: { netAmount: true },
    });

    const lowStockItems = await this.prisma.storeStock.count({
      where: {
        quantity: { lte: 10 }, // Assuming 10 is the universal low threshold for now
      },
    });

    // 6. Documents
    const pendingVerifications = await this.prisma.docRequest.count({
      where: { status: 'REQUESTED' },
    });

    // 7. Houses
    const houses = await this.prisma.house.findMany({
      select: {
        name: true,
        points: true,
      },
      orderBy: { points: 'desc' },
    });

    return {
      admissions: {
        applications: totalApplications,
        approved: approvedAdmissions,
        waitlisted,
        conversionRate,
      },
      fees: {
        todayIntake: todayPayments._sum.amount || 0,
        totalRevenue: totalRevenue._sum.amount || 0,
        pending: pendingFees > 0 ? pendingFees : 0,
      },
      transport: {
        totalFleet,
        activeFleet,
        status: 'Safe & Operational',
      },
      staff: {
        total: totalStaff,
        onLeave,
        vacancies: 4, // Mocked for now, or fetch from a setting
        pendingApprovals: pendingLeaves,
      },
      shop: {
        dailySales: todaySales._sum.netAmount || 0,
        lowStockItems,
      },
      documents: {
        pendingVerifications,
      },
      houses,
    };
  }
}
