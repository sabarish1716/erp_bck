
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTransportRouteDto,
  AssignStudentTransportDto,
  CreateDriverDto,
  UpdateDriverDto,
  CreateBusDto,
  UpdateBusDto,
} from './dto/transport.dto';
import { UpdateSplClassDatesDto } from './dto/spl-class.dto';

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
          conductorName: data.conductorName,
          conductorPhone: data.conductorPhone,
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
          conductorName: data.conductorName,
          conductorPhone: data.conductorPhone,
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
              splClassStartDate: data.isSplClass ? new Date() : null,
              splClassEndDate: null,
              splClassDaysUsed: null,
              totalWorkingDays: null,
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
              splClassStartDate: data.isSplClass ? new Date() : null,
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
        student: { select: { id: true, name: true, standard: true, section: true, siblingGroupId: true, address: { select: { line1: true, line2: true, line3: true, pin: true } }, family: { select: { fatherName: true } } } },
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
    if (!assignment) return { baseFee: 0, splClassFee: 0, totalFee: 0, proRataSplClassFee: 0 };

    const baseFee = assignment.stop?.fee ?? assignment.route.baseFee;
    const fullSplClassFee = assignment.isSplClass ? assignment.route.splClassFee : 0;

    // Pro-rata calculation for special class fee
    let proRataSplClassFee = fullSplClassFee;
    if (assignment.isSplClass && assignment.splClassDaysUsed != null && assignment.totalWorkingDays != null && assignment.totalWorkingDays > 0) {
      proRataSplClassFee = Math.round((fullSplClassFee * assignment.splClassDaysUsed / assignment.totalWorkingDays) * 100) / 100;
    }

    return {
      baseFee,
      splClassFee: fullSplClassFee,
      proRataSplClassFee,
      totalFee: baseFee + proRataSplClassFee,
      splClassDaysUsed: assignment.splClassDaysUsed,
      totalWorkingDays: assignment.totalWorkingDays,
      splClassStartDate: assignment.splClassStartDate,
      splClassEndDate: assignment.splClassEndDate,
    };
  }

  // Get transport fee with pro-rata special class calculation
  async getTransportFeeForStudentProRata(studentId: string): Promise<number> {
    const breakdown = await this.getTransportFeeBreakdown(studentId);
    return breakdown.totalFee;
  }

  // Update special class date tracking for pro-rata fee calculation
  async updateSplClassDates(data: UpdateSplClassDatesDto) {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId: data.studentId },
    });
    if (!assignment) throw new NotFoundException('No transport assignment found for this student');

    const updateData: any = {};
    if (data.splClassStartDate !== undefined) updateData.splClassStartDate = new Date(data.splClassStartDate);
    if (data.splClassEndDate !== undefined) updateData.splClassEndDate = new Date(data.splClassEndDate);
    if (data.splClassDaysUsed !== undefined) updateData.splClassDaysUsed = data.splClassDaysUsed;
    if (data.totalWorkingDays !== undefined) updateData.totalWorkingDays = data.totalWorkingDays;

    return this.prisma.studentTransport.update({
      where: { studentId: data.studentId },
      data: updateData,
      include: { route: true, stop: true, student: { select: { id: true, name: true, standard: true } } },
    });
  }

  // Stop special class transport for a student (sets end date)
  async stopSplClass(studentId: string, daysUsed: number, totalWorkingDays: number) {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId },
    });
    if (!assignment) throw new NotFoundException('No transport assignment found');
    if (!assignment.isSplClass) throw new BadRequestException('Student is not assigned to special class transport');

    return this.prisma.studentTransport.update({
      where: { studentId },
      data: {
        splClassEndDate: new Date(),
        splClassDaysUsed: daysUsed,
        totalWorkingDays: totalWorkingDays,
      },
      include: { route: true, stop: true, student: { select: { id: true, name: true, standard: true } } },
    });
  }

  // ═══════════════════════════════════════════════
  // DRIVER CRUD
  // ═══════════════════════════════════════════════

  async createDriver(data: CreateDriverDto) {
    // If busId not provided but we have a phone, auto-gen deviceId
    if (!data.deviceId && data.phone) {
      data.deviceId = data.phone;
    }

    try {
      return await this.prisma.driver.create({
        data: {
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          deviceId: data.deviceId || null,
          busId: data.busId || null,
          licenseNo: data.licenseNo || null,
          address: data.address || null,
          bloodGroup: data.bloodGroup || null,
          status: data.status || 'ACTIVE',
        },
        include: { bus: { include: { route: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A driver with this email already exists');
      }
      throw error;
    }
  }

  async updateDriver(id: string, data: UpdateDriverDto) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Driver not found');

    // Auto-set deviceId to phone if phone changed and no explicit deviceId
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) {
      updateData.phone = data.phone || null;
      if (!data.deviceId && data.phone && (!existing.deviceId || existing.deviceId === existing.phone)) {
        updateData.deviceId = data.phone;
      }
    }
    if (data.deviceId !== undefined) updateData.deviceId = data.deviceId || null;
    if (data.busId !== undefined) updateData.busId = data.busId || null;
    if (data.licenseNo !== undefined) updateData.licenseNo = data.licenseNo || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup || null;
    if (data.status !== undefined) updateData.status = data.status;

    try {
      return await this.prisma.driver.update({
        where: { id },
        data: updateData,
        include: { bus: { include: { route: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A driver with this email already exists');
      }
      throw error;
    }
  }

  async getAllDrivers() {
    return this.prisma.driver.findMany({
      include: {
        bus: { include: { route: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDriver(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        bus: { include: { route: true } },
        locations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async deleteDriver(id: string) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Driver not found');

    // Delete associated locations first
    await this.prisma.location.deleteMany({ where: { driverId: id } });
    return this.prisma.driver.delete({ where: { id } });
  }

  /** Get driver live status — includes latest location, distance to school, in/out geofence */
  async getDriverLiveStatus(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        bus: { include: { route: true } },
        locations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const lastLocation = driver.locations[0] || null;
    let distanceToSchool: number | null = null;
    let insideGeofence = false;

    if (lastLocation) {
      const schoolLat = Number(process.env.SCHOOL_GEOFENCE_LAT || 11.4648);
      const schoolLng = Number(process.env.SCHOOL_GEOFENCE_LNG || 77.9264);
      const radiusM = Number(process.env.SCHOOL_GEOFENCE_RADIUS_M || 250);

      const R = 6371000;
      const dLat = ((lastLocation.latitude - schoolLat) * Math.PI) / 180;
      const dLon = ((lastLocation.longitude - schoolLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((schoolLat * Math.PI) / 180) *
          Math.cos((lastLocation.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      distanceToSchool = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      insideGeofence = distanceToSchool <= radiusM;
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline = lastLocation && new Date(lastLocation.createdAt) > fiveMinAgo;

    return {
      ...driver,
      lastLocation,
      distanceToSchoolMeters: distanceToSchool,
      insideGeofence,
      isOnline: !!isOnline,
      trackingStatus: !isOnline ? 'OFFLINE' : insideGeofence ? 'AT_SCHOOL' : 'ON_ROUTE',
    };
  }

  // ═══════════════════════════════════════════════
  // BUS CRUD
  // ═══════════════════════════════════════════════

  async createBus(data: CreateBusDto) {
    return this.prisma.bus.create({
      data: {
        number: data.number,
        routeName: data.routeName || null,
        routeId: data.routeId || null,
        capacity: data.capacity || null,
      },
      include: { route: true, drivers: true },
    });
  }

  async updateBus(id: string, data: UpdateBusDto) {
    const existing = await this.prisma.bus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bus not found');

    return this.prisma.bus.update({
      where: { id },
      data: {
        number: data.number ?? existing.number,
        routeName: data.routeName ?? existing.routeName,
        routeId: data.routeId ?? existing.routeId,
        capacity: data.capacity ?? existing.capacity,
      },
      include: { route: true, drivers: true },
    });
  }

  async getAllBuses() {
    return this.prisma.bus.findMany({
      include: {
        route: true,
        drivers: { select: { id: true, name: true, phone: true, status: true } },
        _count: { select: { locations: true } },
      },
      orderBy: { number: 'asc' },
    });
  }

  async getBus(id: string) {
    const bus = await this.prisma.bus.findUnique({
      where: { id },
      include: {
        route: { include: { stops: { orderBy: { stopOrder: 'asc' } } } },
        drivers: true,
      },
    });
    if (!bus) throw new NotFoundException('Bus not found');
    return bus;
  }

  async deleteBus(id: string) {
    const existing = await this.prisma.bus.findUnique({
      where: { id },
      include: { _count: { select: { drivers: true } } },
    });
    if (!existing) throw new NotFoundException('Bus not found');
    if (existing._count.drivers > 0) {
      throw new BadRequestException('Cannot delete bus — it has assigned drivers. Remove driver assignments first.');
    }

    await this.prisma.location.deleteMany({ where: { busId: id } });
    return this.prisma.bus.delete({ where: { id } });
  }

  /** Assign a driver to a bus */
  async assignDriverToBus(driverId: string, busId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    const bus = await this.prisma.bus.findUnique({ where: { id: busId } });
    if (!bus) throw new NotFoundException('Bus not found');

    return this.prisma.driver.update({
      where: { id: driverId },
      data: { busId },
      include: { bus: { include: { route: true } } },
    });
  }

  /** Unassign a driver from their bus */
  async unassignDriverFromBus(driverId: string) {
    const driver = await this.prisma.driver.findFirst({ where: { phone:driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    return this.prisma.driver.update({
      where: { id: driverId },
      data: { busId: null },
      include: { bus: true },
    });
  }



    // ═══════════════════════════════════════════════
  // VEHICLE-DRIVER MAPPING
  // ═══════════════════════════════════════════════

  /** Get all vehicle-driver assignments */
  async getVehicleDriverMappings() {
    const buses = await this.prisma.bus.findMany({
      include: {
        drivers: { select: { id: true, name: true, phone: true, licenseNo: true, status: true } },
      },
      orderBy: { number: 'asc' },
    });
    
    const mappings: any[] = [];
    for (const bus of buses) {
      if (bus.number && bus.drivers && bus.drivers.length > 0) {
        // Return only active drivers or all assigned drivers
        for (const driver of bus.drivers) {
          mappings.push({
            plateNo: bus.number,
            driverName: driver.name,
            driverPhone: driver.phone,
            licenseNo: driver.licenseNo,
          });
        }
      }
    }
    return mappings;
  }

  /** Assign a driver to a bus (vehicle-driver mapping) */
  async assignVehicleDriver(dto: any) {
    // Accepts: plateNo, driverName, driverPhone, licenseNo
    const { plateNo, driverName, driverPhone, licenseNo } = dto;
    if (!plateNo || !driverName || !driverPhone || !licenseNo) {
      throw new BadRequestException('plateNo, driverName, driverPhone, and licenseNo are required');
    }

    // Find or create Bus
    let bus = await this.prisma.bus.findFirst({ where: { number: plateNo } });
    if (!bus) {
      bus = await this.prisma.bus.create({ data: { number: plateNo } });
    }

    // Find or create Driver
    let driver = await this.prisma.driver.findFirst({
      where: {
        name: driverName,
        phone: driverPhone,
        licenseNo: licenseNo,
      },
    });
    if (!driver) {
      driver = await this.prisma.driver.create({
        data: {
          name: driverName,
          phone: driverPhone,
          licenseNo: licenseNo,
          busId: bus.id,
        },
      });
    } else {
      // Assign driver to bus
      await this.prisma.driver.update({ where: { id: driver.id }, data: { busId: bus.id } });
    }

    // Return updated driver with bus info
    return this.prisma.driver.findUnique({
      where: { id: driver.id },
      include: { bus: true },
    });
  }

  /** Remove driver mapping from a bus (vehicle-driver mapping) */
  async removeVehicleDriver(plateNo: string) {
    const bus = await this.prisma.bus.findFirst({
      where: { number: plateNo },
      include: { drivers: true },
    });
    
    if (bus && bus.drivers.length > 0) {
      // Unassign all drivers from this bus
      const updatePromises = bus.drivers.map(driver => 
        this.prisma.driver.update({
          where: { id: driver.id },
          data: { busId: null }
        })
      );
      await Promise.all(updatePromises);
    }
    return { success: true, message: `Driver mappings removed for bus ${plateNo}` };
  }

  // ═══════════════════════════════════════════════
  // MILEAGE APIs
  // ═══════════════════════════════════════════════


  /** Create a mileage snapshot for a bus/driver */
  async createMileageSnapshot(dto: any) {
    if (dto.snapshots && Array.isArray(dto.snapshots)) {
      const results = [];
      for (const snap of dto.snapshots) {
        if (!snap.plateNo || snap.odometer == null) continue;
        
        // Find bus by plateNo
        const bus = await this.prisma.bus.findFirst({
          where: { number: snap.plateNo },
          include: { drivers: true }
        });
        
        if (!bus || bus.drivers.length === 0) continue; // driverId is required by schema
        const driverId = bus.drivers[0].id; // Use currently assigned driver
        
        // Prevent duplicate odometer spamming
        const existing = await this.prisma.mileage.findFirst({
           where: { busId: bus.id, odometer: Number(snap.odometer) }
        });
        if (existing) continue;
        
        const mileage = await this.prisma.mileage.create({
          data: {
            busId: bus.id,
            driverId: driverId,
            odometer: Number(snap.odometer),
            snapshotTime: new Date()
          }
        });
        results.push(mileage);
      }
      return { success: true, count: results.length };
    }

    // Fallback for single object (legacy)
    const bus = await this.prisma.bus.findFirst({ where: { id: dto.busId } });
    if (!bus) throw new NotFoundException('Bus not found');

    let driverId = dto.driverId;
    if (!driverId) {
      const driver = await this.prisma.driver.findFirst({ where: { phone: dto.driverId || dto.driverId } });
      if (!driver) throw new NotFoundException(`Driver not found for reference: ${dto.driverId || dto.driverId}`);
      driverId = driver.id;
    }
    if (!driverId) throw new BadRequestException('driverId or driverPhone is required');

    if (dto.odometer === undefined || dto.odometer === null || isNaN(Number(dto.odometer))) {
      throw new BadRequestException('odometer is required and must be a number');
    }

    const snapshotTime = dto.snapshotTime ? new Date(dto.snapshotTime) : new Date();
    const mileage = await this.prisma.mileage.create({
      data: {
        busId: dto.busId,
        driverId: driverId,
        odometer: Number(dto.odometer),
        snapshotTime,
      },
    });
    return mileage;
  }

  /** Get daily mileage for a bus */
  async getDailyMileage(busId: string, date?: string) {
    // Default to today if no date provided
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    // Get all mileage snapshots for the bus on the given day, ordered by time
    const snapshots = await this.prisma.mileage.findMany({
      where: {
        busId,
        snapshotTime: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { snapshotTime: 'asc' },
    });

    if (snapshots.length === 0) {
      return { busId, date: start.toISOString().slice(0, 10), mileage: 0, snapshots: [] };
    }

    // Calculate mileage as the difference between last and first odometer readings
    const mileage = snapshots[snapshots.length - 1].odometer - snapshots[0].odometer;
    return {
      busId,
      date: start.toISOString().slice(0, 10),
      mileage,
      startOdometer: snapshots[0].odometer,
      endOdometer: snapshots[snapshots.length - 1].odometer,
      snapshots,
    };
  }
}
