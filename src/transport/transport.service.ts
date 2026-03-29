import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransportRouteDto, AssignStudentTransportDto } from './dto/transport.dto';

@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════
  // ROUTES
  // ═══════════════════════════════════════════════

  async createRoute(data: CreateTransportRouteDto) {
    return this.prisma.transportRoute.create({
      data: {
        routeName: data.routeName,
        routeNo: data.routeNo,
        baseFee: data.baseFee,
        splClassFee: data.splClassFee || 0,
        description: data.description,
        stops:
          data.stops && data.stops.length > 0
            ? { create: data.stops }
            : undefined,
      },
      include: { stops: { orderBy: { stopOrder: 'asc' } } },
    });
  }

  async updateRoute(id: string, data: CreateTransportRouteDto) {
    return this.prisma.transportRoute.update({
      where: { id },
      data: {
        routeName: data.routeName,
        routeNo: data.routeNo,
        baseFee: data.baseFee,
        splClassFee: data.splClassFee || 0,
        description: data.description,
        stops: {
          deleteMany: {},
          create: data.stops || [],
        },
      },
      include: { stops: { orderBy: { stopOrder: 'asc' } } },
    });
  }

  async getAllRoutes() {
    return this.prisma.transportRoute.findMany({
      include: {
        stops: { orderBy: { stopOrder: 'asc' } },
        _count: { select: { students: true } },
      },
      orderBy: { routeName: 'asc' },
    });
  }

  async getRoute(id: string) {
    const route = await this.prisma.transportRoute.findUnique({
      where: { id },
      include: {
        stops: { orderBy: { stopOrder: 'asc' } },
        students: {
          include: {
            student: { select: { id: true, name: true, standard: true } },
            stop: true,
          },
        },
        buses: true,
      },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  async deleteRoute(id: string) {
    return this.prisma.transportRoute.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════
  // STUDENT TRANSPORT ASSIGNMENT
  // ═══════════════════════════════════════════════

  async assignStudent(data: AssignStudentTransportDto) {
    const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const route = await this.prisma.transportRoute.findUnique({ where: { id: data.routeId } });
    if (!route) throw new NotFoundException('Route not found');

    return this.prisma.studentTransport.upsert({
      where: { studentId: data.studentId },
      update: {
        routeId: data.routeId,
        stopId: data.stopId || null,
        academicYear: data.academicYear,
        isSplClass: data.isSplClass || false,
      },
      create: {
        studentId: data.studentId,
        routeId: data.routeId,
        stopId: data.stopId || null,
        academicYear: data.academicYear,
        isSplClass: data.isSplClass || false,
      },
      include: {
        route: true,
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
    });
  }

  async getStudentTransport(studentId: string) {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId },
      include: {
        route: { include: { stops: { orderBy: { stopOrder: 'asc' } } } },
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
    });
    if (!assignment) throw new NotFoundException('No transport assignment found');
    return assignment;
  }

  async removeStudentTransport(studentId: string) {
    return this.prisma.studentTransport.delete({ where: { studentId } });
  }

  async getAllAssignments(academicYear: string) {
    return this.prisma.studentTransport.findMany({
      where: { academicYear },
      include: {
        route: true,
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });
  }

  // Calculate transport fee for a student based on route + spl class
  async getTransportFeeForStudent(studentId: string): Promise<number> {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId },
      include: { route: true, stop: true },
    });
    if (!assignment) return 0;

    const baseFee = assignment.stop?.fee ?? assignment.route.baseFee;
    const splSurcharge = assignment.isSplClass ? assignment.route.splClassFee : 0;
    return baseFee + splSurcharge;
  }

  async getTransportFeeBreakdown(studentId: string) {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId },
      include: { route: true, stop: true },
    });
    if (!assignment) return { baseFee: 0, splClassFee: 0, totalFee: 0 };

    const baseFee = assignment.stop?.fee ?? assignment.route.baseFee;
    const splClassFee = assignment.isSplClass ? assignment.route.splClassFee : 0;
    return { baseFee, splClassFee, totalFee: baseFee + splClassFee };
  }
}
