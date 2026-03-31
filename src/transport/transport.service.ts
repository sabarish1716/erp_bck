import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransportRouteDto, AssignStudentTransportDto } from './dto/transport.dto';

const DEFAULT_ACADEMIC_YEAR = '2026-2027';

function normalizeAcademicYear(academicYear?: string | null) {
  if (!academicYear) return null;
  const match = String(academicYear).trim().match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
  if (!match) return null;

  const startYear = parseInt(match[1], 10);
  let endYear = parseInt(match[2], 10);
  if (endYear < 100) {
    endYear = Math.floor(startYear / 100) * 100 + endYear;
  }

  return `${startYear}-${endYear}`;
}

function getAcademicYearDateRange(academicYear?: string | null) {
  const normalized = normalizeAcademicYear(academicYear);
  if (!normalized) return null;

  const [startYear, endYear] = normalized.split('-').map((value) => parseInt(value, 10));
  return {
    start: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)),
    end: new Date(Date.UTC(endYear, 2, 31, 23, 59, 59)),
  };
}

function ordinal(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}

function formatStandardLabel(standard?: string | null) {
  if (!standard) return null;
  const upper = String(standard).trim().toUpperCase();
  if (upper === 'LKG' || upper === 'UKG') return upper;
  const match = upper.match(/^STD_(\d{1,2})$/);
  if (!match) {
    return String(standard).replace(/_/g, ' ');
  }

  const standardNo = parseInt(match[1], 10);
  return `${ordinal(standardNo)} Standard`;
}

@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService) {}

  private async getConfiguredAcademicYear() {
    const settingsRow = await this.prisma.appSetting.findUnique({
      where: { key: 'admin.settings' },
      select: { value: true },
    });
    const settings = (settingsRow?.value as Record<string, unknown> | undefined) || {};
    return normalizeAcademicYear(String(settings.academicYear || '')) || DEFAULT_ACADEMIC_YEAR;
  }

  private resolveStudentSummary<T extends { standard?: unknown } & Record<string, any>>(student: T) {
    return {
      ...student,
      standardLabel: formatStandardLabel(student.standard == null ? null : String(student.standard)),
    };
  }

  private resolveAssignmentResponse<T extends { student?: Record<string, any> | null } & Record<string, any>>(
    assignment: T,
    message?: string,
  ) {
    return {
      ...assignment,
      ...(assignment.student ? { student: this.resolveStudentSummary(assignment.student) } : {}),
      ...(message ? { message } : {}),
    };
  }

  private sanitizeStops(stops?: Array<Record<string, any>>) {
    return (stops || []).map((stop) => ({
      stopName: String(stop.stopName || '').trim(),
      stopOrder: Number(stop.stopOrder),
      distanceKm: stop.distanceKm == null ? undefined : Number(stop.distanceKm),
      pickupTime: stop.pickupTime || undefined,
      dropTime: stop.dropTime || undefined,
      fee: stop.fee == null ? undefined : Number(stop.fee),
    }));
  }

  private validateStops(stops: Array<{ stopName: string; stopOrder: number }>) {
    const orderSet = new Set<number>();
    const nameSet = new Set<string>();

    for (const stop of stops) {
      if (!stop.stopName) {
        throw new BadRequestException('Stop name is required for every stop');
      }

      if (!Number.isInteger(stop.stopOrder) || stop.stopOrder <= 0) {
        throw new BadRequestException('Stop order must be a positive whole number');
      }

      const normalizedName = stop.stopName.trim().toLowerCase();
      if (nameSet.has(normalizedName)) {
        throw new ConflictException(`Stop ${stop.stopName} already exists in this route`);
      }

      if (orderSet.has(stop.stopOrder)) {
        throw new ConflictException(`Stop order ${stop.stopOrder} already exists in this route`);
      }

      nameSet.add(normalizedName);
      orderSet.add(stop.stopOrder);
    }
  }

  private handleTransportWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta?.target.join(', ')
        : String(error.meta?.target || 'transport record');

      if (target.includes('routeNo')) {
        throw new ConflictException('A transport route with this route number already exists');
      }

      if (target.includes('studentId')) {
        throw new ConflictException('Transport is already assigned to this student');
      }

      throw new ConflictException('A duplicate transport record already exists');
    }

    throw error;
  }

  async getAcademicYears() {
    const [configuredAcademicYear, assignments] = await Promise.all([
      this.getConfiguredAcademicYear(),
      this.prisma.studentTransport.findMany({
        select: { academicYear: true },
        distinct: ['academicYear'],
        orderBy: { academicYear: 'desc' },
      }),
    ]);

    const academicYears = new Set<string>([
      configuredAcademicYear,
      ...assignments.map((assignment) => assignment.academicYear),
    ]);

    return Array.from(academicYears).filter(Boolean).sort().reverse();
  }

  // ═══════════════════════════════════════════════
  // ROUTES
  // ═══════════════════════════════════════════════

  async createRoute(data: CreateTransportRouteDto) {
    const sanitizedStops = this.sanitizeStops(data.stops);
    this.validateStops(sanitizedStops);

    try {
      return await this.prisma.transportRoute.create({
        data: {
          routeName: data.routeName,
          routeNo: data.routeNo,
          baseFee: data.baseFee,
          splClassFee: data.splClassFee || 0,
          description: data.description,
          stops: sanitizedStops.length > 0 ? { create: sanitizedStops } : undefined,
        },
        include: { stops: { orderBy: { stopOrder: 'asc' } } },
      });
    } catch (error) {
      this.handleTransportWriteError(error);
    }
  }

  async updateRoute(id: string, data: CreateTransportRouteDto) {
    const sanitizedStops = this.sanitizeStops(data.stops);
    this.validateStops(sanitizedStops);

    try {
      return await this.prisma.transportRoute.update({
        where: { id },
        data: {
          routeName: data.routeName,
          routeNo: data.routeNo,
          baseFee: data.baseFee,
          splClassFee: data.splClassFee || 0,
          description: data.description,
          stops: {
            deleteMany: {},
            create: sanitizedStops,
          },
        },
        include: { stops: { orderBy: { stopOrder: 'asc' } } },
      });
    } catch (error) {
      this.handleTransportWriteError(error);
    }
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
    return {
      ...route,
      students: route.students.map((assignment) => this.resolveAssignmentResponse(assignment)),
    };
  }

  async deleteRoute(id: string) {
    return this.prisma.transportRoute.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════
  // STUDENT TRANSPORT ASSIGNMENT
  // ═══════════════════════════════════════════════

  async assignStudent(data: AssignStudentTransportDto) {
    const academicYear = normalizeAcademicYear(data.academicYear) || await this.getConfiguredAcademicYear();

    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
      select: { id: true, name: true, standard: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const route = await this.prisma.transportRoute.findUnique({
      where: { id: data.routeId },
      include: { stops: { orderBy: { stopOrder: 'asc' } } },
    });
    if (!route) throw new NotFoundException('Route not found');

    if (data.stopId) {
      const stop = route.stops.find((item) => item.id === data.stopId);
      if (!stop) {
        throw new BadRequestException('Selected stop does not belong to the selected route');
      }
    }

    const existingAssignment = await this.prisma.studentTransport.findUnique({
      where: { studentId: data.studentId },
      include: {
        route: true,
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
    });

    if (
      existingAssignment &&
      existingAssignment.routeId === data.routeId &&
      (existingAssignment.stopId || null) === (data.stopId || null) &&
      existingAssignment.academicYear === academicYear &&
      Boolean(existingAssignment.isSplClass) === Boolean(data.isSplClass)
    ) {
      throw new ConflictException('Transport is already assigned to this student for the selected academic year');
    }

    try {
      const assignment = existingAssignment
        ? await this.prisma.studentTransport.update({
            where: { studentId: data.studentId },
            data: {
              routeId: data.routeId,
              stopId: data.stopId || null,
              academicYear,
              isSplClass: data.isSplClass || false,
            },
            include: {
              route: true,
              stop: true,
              student: { select: { id: true, name: true, standard: true } },
            },
          })
        : await this.prisma.studentTransport.create({
            data: {
              studentId: data.studentId,
              routeId: data.routeId,
              stopId: data.stopId || null,
              academicYear,
              isSplClass: data.isSplClass || false,
            },
            include: {
              route: true,
              stop: true,
              student: { select: { id: true, name: true, standard: true } },
            },
          });

      return this.resolveAssignmentResponse(
        assignment,
        existingAssignment ? 'Transport assignment updated successfully' : 'Transport assignment created successfully',
      );
    } catch (error) {
      this.handleTransportWriteError(error);
    }
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
    return this.resolveAssignmentResponse(assignment);
  }

  async removeStudentTransport(studentId: string) {
    return this.prisma.studentTransport.delete({ where: { studentId } });
  }

  async getPendingTransportStudents(academicYear?: string) {
    const resolvedAcademicYear = normalizeAcademicYear(academicYear) || await this.getConfiguredAcademicYear();
    const dateRange = getAcademicYearDateRange(resolvedAcademicYear);
    const students = await this.prisma.student.findMany({
      where: {
        admission: {
          is: {
            isApproved: true,
            ...(dateRange
              ? { admissionDate: { gte: dateRange.start, lte: dateRange.end } }
              : {}),
          },
        },
      },
      select: {
        id: true,
        name: true,
        standard: true,
        transportMode: true,
        admission: {
          select: {
            admissionNo: true,
            admissionDate: true,
          },
        },
        studentTransport: {
          select: {
            academicYear: true,
            routeId: true,
            stopId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const pendingStudents = students
      .filter((student) => {
        const transportMode = String(student.transportMode || '').trim().toUpperCase();
        const needsTransport = Boolean(transportMode) && !['LOCAL', 'SELF', 'WALKING'].includes(transportMode);
        const isMappedForYear = student.studentTransport?.academicYear === resolvedAcademicYear;
        return needsTransport && !isMappedForYear;
      })
      .map((student) => ({
        ...this.resolveStudentSummary(student),
        admissionNo: student.admission?.admissionNo || null,
        admissionDate: student.admission?.admissionDate || null,
        currentTransportAssignment: student.studentTransport || null,
      }));

    return {
      academicYear: resolvedAcademicYear,
      total: pendingStudents.length,
      students: pendingStudents,
    };
  }

  async getAllAssignments(academicYear?: string) {
    const resolvedAcademicYear = normalizeAcademicYear(academicYear) || await this.getConfiguredAcademicYear();
    const assignments = await this.prisma.studentTransport.findMany({
      where: { academicYear: resolvedAcademicYear },
      include: {
        route: true,
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    return assignments.map((assignment) => this.resolveAssignmentResponse(assignment));
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
