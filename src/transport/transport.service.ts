import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FeesService } from '../fees/fees.service';
import {
  CreateTransportRouteDto,
  AssignStudentTransportDto,
  CreateDriverDto,
  UpdateDriverDto,
  CreateBusDto,
  UpdateBusDto,
} from './dto/transport.dto';
import { UpdateSplClassDatesDto } from './dto/spl-class.dto';
import { BulkAssignTransportDto } from './dto/bulk-assign.dto';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');

const DEFAULT_ACADEMIC_YEAR = '2026-2027';

type ExportFile = {
  filename: string;
  contentType: string;
  content: Buffer;
};

function normalizeAcademicYear(academicYear?: string | null) {
  if (!academicYear) return null;
  const match = String(academicYear)
    .trim()
    .match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
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

  const [startYear, endYear] = normalized
    .split('-')
    .map((value) => parseInt(value, 10));
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

function getReportDateRange(from?: string, to?: string) {
  const endBase = to ? new Date(to) : from ? new Date(from) : new Date();
  const startBase = from ? new Date(from) : new Date(endBase);

  const start = new Date(startBase);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endBase);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatReportDate(value: Date | string | null | undefined) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function formatReportDateTime(value: Date | string | null | undefined) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function formatCurrency(value: number | null | undefined) {
  return value == null ? '-' : `Rs. ${Number(value).toFixed(2)}`;
}

function safeFileToken(value: string | null | undefined) {
  return String(value || 'report')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

type FuelLogWithRelations = {
  id: string;
  busId: string | null;
  odometer: number;
  litres: number;
  totalCost: number | null;
  timestamp: Date;
  note?: string | null;
  driver?: { id: string; name: string; phone: string | null } | null;
  bus?: { id: string; number: string; routeName: string | null } | null;
};

type FuelMileageEntry = FuelLogWithRelations & {
  previousOdometer: number | null;
  distanceSincePreviousFill: number | null;
  kmPerLitre: number | null;
};

@Injectable()
export class TransportService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    @Inject(forwardRef(() => FeesService)) private feesService: FeesService,
  ) {}

  private async buildWorkbookBuffer(workbook: ExcelJS.Workbook) {
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  private async buildPdfBuffer(
    render: (doc: PDFKit.PDFDocument) => void,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      render(doc);
      doc.end();
    });
  }

  private writePdfSummarySection(
    doc: PDFKit.PDFDocument,
    title: string,
    summary: Array<{ label: string; value: string | number | null }>,
  ) {
    doc.fontSize(12).font('Helvetica-Bold').text(title);
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    summary.forEach((item) => {
      doc.text(`${item.label}: ${item.value ?? '-'}`);
    });
    doc.moveDown();
  }

  private addPdfTable(
    doc: PDFKit.PDFDocument,
    title: string,
    headers: string[],
    rows: string[][],
  ) {
    doc.fontSize(12).font('Helvetica-Bold').text(title);
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica-Bold').text(headers.join(' | '));
    doc.moveDown(0.2);
    doc.font('Helvetica');

    rows.forEach((row) => {
      if (doc.y > 760) {
        doc.addPage();
      }
      doc.text(row.join(' | '));
    });

    doc.moveDown();
  }

  private async getBusOrThrow(busId: string) {
    const bus = await this.prisma.bus.findUnique({
      where: { id: busId },
      include: {
        route: true,
        drivers: {
          select: { id: true, name: true, phone: true, status: true },
        },
      },
    });

    if (!bus) {
      throw new NotFoundException('Bus not found');
    }

    return bus;
  }

  private async getConfiguredAcademicYear(): Promise<string> {
    const settingsRow = await this.prisma.appSetting.findUnique({
      where: { key: 'admin.settings' },
      select: { value: true },
    });
    const settings =
      (settingsRow?.value as Record<string, unknown> | undefined) || {};
    return (
      normalizeAcademicYear(String(settings.academicYear || '')) ||
      DEFAULT_ACADEMIC_YEAR
    );
  }

  private async resolveStudentSpecialClassTransportConfig(
    studentId: string,
    academicYear?: string,
    studentStandard?: string | null,
  ): Promise<{
    monthlyFee: number;
    months: number;
    sourceAcademicYear: string | null;
  }> {
    const normalizedYear = normalizeAcademicYear(academicYear);
    const standard =
      studentStandard ??
      (
        await this.prisma.student.findUnique({
          where: { id: studentId },
          select: { standard: true },
        })
      )?.standard ??
      null;

    if (!standard) {
      return { monthlyFee: 0, months: 0, sourceAcademicYear: null };
    }

    const exactFeeStructure = normalizedYear
      ? await this.prisma.feeStructure.findUnique({
          where: {
            standard_academicYear: {
              standard: standard as any,
              academicYear: normalizedYear,
            },
          },
          select: {
            academicYear: true,
            specialClassTransportFee: true,
            specialClassTransportMonths: true,
          },
        })
      : null;

    const exactStudentFee = normalizedYear
      ? await this.prisma.studentFee.findUnique({
          where: {
            studentId_academicYear: { studentId, academicYear: normalizedYear },
          },
          select: {
            academicYear: true,
            specialClassTransportFee: true,
            specialClassTransportMonths: true,
          },
        })
      : null;

    const latestStudentFee = await this.prisma.studentFee.findFirst({
      where: {
        studentId,
        OR: [
          { specialClassTransportFee: { gt: 0 } },
          { specialClassTransportMonths: { gt: 0 } },
        ],
      },
      select: {
        academicYear: true,
        specialClassTransportFee: true,
        specialClassTransportMonths: true,
      },
      orderBy: { academicYear: 'desc' },
    });

    const latestFeeStructure = await this.prisma.feeStructure.findFirst({
      where: {
        standard: standard as any,
        OR: [
          { specialClassTransportFee: { gt: 0 } },
          { specialClassTransportMonths: { gt: 0 } },
        ],
      },
      select: {
        academicYear: true,
        specialClassTransportFee: true,
        specialClassTransportMonths: true,
      },
      orderBy: { academicYear: 'desc' },
    });

    const candidates = [
      exactFeeStructure,
      exactStudentFee,
      latestStudentFee,
      latestFeeStructure,
    ].filter(Boolean);
    const chosen = candidates.find(
      (item) =>
        (item!.specialClassTransportFee ?? 0) > 0 ||
        (item!.specialClassTransportMonths ?? 0) > 0,
    );

    return {
      monthlyFee: chosen?.specialClassTransportFee ?? 0,
      months: chosen?.specialClassTransportMonths ?? 0,
      sourceAcademicYear: chosen?.academicYear ?? null,
    };
  }

  private buildFuelMileageEntries(
    logs: FuelLogWithRelations[],
  ): FuelMileageEntry[] {
    return logs.map((log, index) => {
      const previousLog = index > 0 ? logs[index - 1] : null;
      const distanceSincePreviousFill =
        previousLog && log.odometer > previousLog.odometer
          ? Math.round((log.odometer - previousLog.odometer) * 100) / 100
          : null;
      const kmPerLitre =
        distanceSincePreviousFill != null && log.litres > 0
          ? Math.round((distanceSincePreviousFill / log.litres) * 100) / 100
          : null;

      return {
        ...log,
        previousOdometer: previousLog?.odometer ?? null,
        distanceSincePreviousFill,
        kmPerLitre,
      };
    });
  }

  private buildFuelMileageSummary(entries: FuelMileageEntry[]) {
    const totalDistanceKm =
      Math.round(
        entries.reduce(
          (sum, entry) => sum + (entry.distanceSincePreviousFill || 0),
          0,
        ) * 100,
      ) / 100;
    const totalFuelConsumedLitres =
      Math.round(
        entries.reduce(
          (sum, entry) =>
            sum + (entry.distanceSincePreviousFill != null ? entry.litres : 0),
          0,
        ) * 100,
      ) / 100;
    const averageKmPerLitre =
      totalDistanceKm > 0 && totalFuelConsumedLitres > 0
        ? Math.round((totalDistanceKm / totalFuelConsumedLitres) * 100) / 100
        : null;

    return {
      totalDistanceKm,
      totalFuelConsumedLitres,
      averageKmPerLitre,
      mileageSegments: entries.filter(
        (entry) => entry.distanceSincePreviousFill != null,
      ).length,
      startOdometer: entries[0]?.odometer ?? null,
      endOdometer: entries[entries.length - 1]?.odometer ?? null,
    };
  }

  private resolveStudentSummary<
    T extends { standard?: unknown } & Record<string, any>,
  >(student: T) {
    return {
      ...student,
      standardLabel: formatStandardLabel(
        student.standard == null ? null : String(student.standard),
      ),
    };
  }

  private resolveAssignmentResponse<
    T extends { student?: Record<string, any> | null } & Record<string, any>,
  >(assignment: T, message?: string) {
    return {
      ...assignment,
      ...(assignment.student
        ? { student: this.resolveStudentSummary(assignment.student) }
        : {}),
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
        throw new BadRequestException(
          'Stop order must be a positive whole number',
        );
      }

      const normalizedName = stop.stopName.trim().toLowerCase();
      if (nameSet.has(normalizedName)) {
        throw new ConflictException(
          `Stop ${stop.stopName} already exists in this route`,
        );
      }

      if (orderSet.has(stop.stopOrder)) {
        throw new ConflictException(
          `Stop order ${stop.stopOrder} already exists in this route`,
        );
      }

      nameSet.add(normalizedName);
      orderSet.add(stop.stopOrder);
    }
  }

  private handleTransportWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta?.target.join(', ')
        : String(error.meta?.target || 'transport record');

      if (target.includes('routeNo')) {
        throw new ConflictException(
          'A transport route with this route number already exists',
        );
      }

      if (target.includes('studentId')) {
        throw new ConflictException(
          'Transport is already assigned to this student',
        );
      }

      throw new ConflictException(
        'A duplicate transport record already exists',
      );
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

  async getDashboard(academicYear?: string) {
    const resolvedAcademicYear =
      normalizeAcademicYear(academicYear) ||
      (await this.getConfiguredAcademicYear());
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    const onlineWindowStart = new Date(now.getTime() - 15 * 60 * 1000);

    const [
      pendingStudents,
      totalRoutes,
      totalBuses,
      totalDrivers,
      activeDrivers,
      assignedStudents,
      onlineBusRows,
      fuelSummary,
      tripEventsCount,
      mileageSnapshotsCount,
      routes,
    ] = await Promise.all([
      this.getPendingTransportStudents(resolvedAcademicYear),
      this.prisma.transportRoute.count(),
      this.prisma.bus.count(),
      this.prisma.driver.count(),
      this.prisma.driver.count({ where: { status: 'ACTIVE' } }),
      this.prisma.studentTransport.count({
        where: { academicYear: resolvedAcademicYear },
      }),
      this.prisma.location.findMany({
        where: { createdAt: { gte: onlineWindowStart } },
        distinct: ['busId'],
        select: { busId: true },
      }),
      this.prisma.fuelLog.aggregate({
        where: { timestamp: { gte: startOfDay, lte: endOfDay } },
        _count: { _all: true },
        _sum: { litres: true, totalCost: true },
      }),
      this.prisma.vehicleTripLog.count({
        where: { timestamp: { gte: startOfDay, lte: endOfDay } },
      }),
      this.prisma.mileage.count({
        where: { snapshotTime: { gte: startOfDay, lte: endOfDay } },
      }),
      this.prisma.transportRoute.findMany({
        select: {
          id: true,
          routeName: true,
          routeNo: true,
          _count: {
            select: {
              stops: true,
              buses: true,
              students: true,
            },
          },
        },
        orderBy: { routeName: 'asc' },
      }),
    ]);

    return {
      academicYear: resolvedAcademicYear,
      overview: {
        totalRoutes,
        totalBuses,
        totalDrivers,
        activeDrivers,
        assignedStudents,
        pendingStudents: pendingStudents.total,
        onlineBuses: onlineBusRows.length,
      },
      today: {
        fuelLogs: fuelSummary._count._all,
        fuelLitres: fuelSummary._sum.litres ?? 0,
        fuelCost: fuelSummary._sum.totalCost ?? 0,
        tripEvents: tripEventsCount,
        mileageSnapshots: mileageSnapshotsCount,
      },
      routes: routes.map((route) => ({
        id: route.id,
        routeName: route.routeName,
        routeNo: route.routeNo,
        stopsCount: route._count.stops,
        busesCount: route._count.buses,
        studentsCount: route._count.students,
      })),
    };
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
          numberOfTerms: data.numberOfTerms || 1,
          stops:
            sanitizedStops.length > 0 ? { create: sanitizedStops } : undefined,
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
          numberOfTerms: data.numberOfTerms || 1,
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
        buses: true,
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
      students: route.students.map((assignment) =>
        this.resolveAssignmentResponse(assignment),
      ),
    };
  }

  async deleteRoute(id: string) {
    return this.prisma.transportRoute.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════
  // STUDENT TRANSPORT ASSIGNMENT
  // ═══════════════════════════════════════════════

  async assignStudent(data: AssignStudentTransportDto) {
    const academicYear =
      normalizeAcademicYear(data.academicYear) ||
      (await this.getConfiguredAcademicYear());

    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
      select: { id: true, name: true, standard: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (data.isSplClass) {
      const isEligible =
        student.standard === 'STD_9' ||
        student.standard === 'STD_10' ||
        student.standard === 'STD_11' ||
        student.standard === 'STD_12';
      if (!isEligible) {
        throw new BadRequestException(
          'Special Class transport is only applicable for standards 9, 10, 11, and 12',
        );
      }
    }

    const route = await this.prisma.transportRoute.findUnique({
      where: { id: data.routeId },
      include: { stops: { orderBy: { stopOrder: 'asc' } } },
    });
    if (!route) throw new NotFoundException('Route not found');

    if (data.stopId) {
      const stop = route.stops.find((item) => item.id === data.stopId);
      if (!stop) {
        throw new BadRequestException(
          'Selected stop does not belong to the selected route',
        );
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
      Boolean(existingAssignment.isSplClass) === Boolean(data.isSplClass) &&
      (existingAssignment.busno || null) === (data.busno || null)
    ) {
      return this.resolveAssignmentResponse(
        existingAssignment,
        'No changes made to transport assignment',
      );
    }

    try {
      const assignment = existingAssignment
        ? await this.prisma.studentTransport.update({
            where: { studentId: data.studentId },
            data: {
              routeId: data.routeId,
              stopId: data.stopId || null,
              academicYear,
              busno: data.busno || null,
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
              busno: data.busno || null,
              isSplClass: data.isSplClass || false,
              splClassStartDate: data.isSplClass ? new Date() : null,
            },
            include: {
              route: true,
              stop: true,
              student: { select: { id: true, name: true, standard: true } },
            },
          });

      // Automatically recalculate and sync the student fee if it exists for the current academic year.
      try {
        const studentFee = await this.prisma.studentFee.findUnique({
          where: {
            studentId_academicYear: { studentId: data.studentId, academicYear },
          },
        });
        if (studentFee) {
          const baseFee = assignment.stop?.fee ?? assignment.route.baseFee;
          const splSurcharge = assignment.isSplClass
            ? assignment.route.splClassFee
            : 0;
          const totalNewTransportFee = baseFee + splSurcharge;

          await this.feesService.recalcTransportFee(
            data.studentId,
            academicYear,
            totalNewTransportFee,
          );
        }
      } catch (err) {
        console.error('Failed to sync transport fee with student fee', err);
      }

      return this.resolveAssignmentResponse(
        assignment,
        existingAssignment
          ? 'Transport assignment updated successfully'
          : 'Transport assignment created successfully',
      );
    } catch (error) {
      this.handleTransportWriteError(error);
    }
  }

  async bulkAssignTransport(dto: BulkAssignTransportDto) {
    const academicYear =
      normalizeAcademicYear(dto.academicYear) ||
      (await this.getConfiguredAcademicYear());
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Pre-fetch all routes with stops for matching
    const allRoutes = await this.prisma.transportRoute.findMany({
      include: { stops: true },
    });

    for (const item of dto.items) {
      try {
        // 1. Find Student by Admission No
        const admission = await this.prisma.admission.findFirst({
          where: { admissionNo: item.admissionNo },
          select: { studentId: true },
        });

        if (!admission?.studentId) {
          throw new Error(
            `Student with admission number ${item.admissionNo} not found`,
          );
        }

        // 2. Find Route by Route No
        const route = allRoutes.find((r) => r.routeNo === item.routeNo);
        if (!route) {
          throw new Error(`Route number ${item.routeNo} not found`);
        }

        // 3. Find Stop by Name (Optional)
        let stopId: string | undefined = undefined;
        if (item.stopName) {
          const stop = route.stops.find(
            (s) => s.stopName.toLowerCase() === item.stopName?.toLowerCase(),
          );
          if (stop) {
            stopId = stop.id;
          }
        }

        // 4. Create or Update Assignment
        const assignment = await this.prisma.studentTransport.upsert({
          where: { studentId: admission.studentId },
          update: {
            routeId: route.id,
            stopId: stopId || null,
            busno: item.busNo || null,
            academicYear,
          },
          create: {
            studentId: admission.studentId,
            routeId: route.id,
            stopId: stopId || null,
            busno: item.busNo || null,
            academicYear,
            isSplClass: false,
            splClassStartDate: null,
          },
          include: { route: true, stop: true },
        });

        // 5. Sync with StudentFee if it exists
        try {
          const studentFee = await this.prisma.studentFee.findUnique({
            where: {
              studentId_academicYear: {
                studentId: admission.studentId,
                academicYear,
              },
            },
          });
          if (studentFee) {
            const baseFee = assignment.stop?.fee ?? assignment.route.baseFee;
            const splSurcharge = assignment.isSplClass
              ? assignment.route.splClassFee
              : 0;
            const totalNewTransportFee = baseFee + splSurcharge;
            await this.feesService.recalcTransportFee(
              admission.studentId,
              academicYear,
              totalNewTransportFee,
            );
          }
        } catch (err) {
          console.error('Failed to sync transport fee in bulk', err);
        }

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${item.admissionNo}: ${err.message}`);
      }
    }

    return results;
  }

  async getStudentTransport(studentId: string) {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId },
      include: {
        route: {
          include: { stops: { orderBy: { stopOrder: 'asc' } }, buses: true },
        },
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
    });
    if (!assignment)
      throw new NotFoundException('No transport assignment found');
    return this.resolveAssignmentResponse(assignment);
  }

  async removeStudentTransport(studentId: string) {
    return this.prisma.studentTransport.delete({ where: { studentId } });
  }

  async getPendingTransportStudents(academicYear?: string) {
    const resolvedAcademicYear =
      normalizeAcademicYear(academicYear) ||
      (await this.getConfiguredAcademicYear());
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
        const transportMode = String(student.transportMode || '')
          .trim()
          .toUpperCase();
        const needsTransport =
          Boolean(transportMode) &&
          !['LOCAL', 'SELF', 'WALKING'].includes(transportMode);
        const isMappedForYear =
          student.studentTransport?.academicYear === resolvedAcademicYear;
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
    const resolvedAcademicYear =
      normalizeAcademicYear(academicYear) ||
      (await this.getConfiguredAcademicYear());
    const [assignments, timelines] = await Promise.all([
      this.prisma.studentTransport.findMany({
        where: { academicYear: resolvedAcademicYear },
        include: {
          route: {
            include: {
              buses: {
                include: { route: true },
              },
              stops: { orderBy: { stopOrder: 'asc' } },
            },
          },
          stop: true,
          student: {
            select: {
              id: true,
              name: true,
              standard: true,
              section: true,
              siblingGroupId: true,
              address: {
                select: { line1: true, line2: true, line3: true, pin: true },
              },
              family: {
                select: {
                  fatherName: true,
                  motherName: true,
                  guardianName: true,
                  guardianRelation: true,
                  isSingleParent: true,
                },
              },
            },
          },
        },
        orderBy: { student: { name: 'asc' } },
      }),
      this.prisma.studentTransportTimeline.findMany({
        where: { academicYear: resolvedAcademicYear },
      }),
    ]);

    return assignments.map((assignment) => {
      const studentTimelines = timelines.filter(
        (t) => t.studentId === assignment.studentId,
      );
      return {
        ...this.resolveAssignmentResponse(assignment),
        timelines: studentTimelines,
      };
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
    const splSurcharge = assignment.isSplClass
      ? assignment.route.splClassFee
      : 0;
    return baseFee + splSurcharge;
  }

  async getTransportFeeBreakdown(studentId: string, academicYear?: string) {
    // Resolve academic year — use provided, else fall back to configured default
    const resolvedYear =
      academicYear || (await this.getConfiguredAcademicYear());

    // Filter timelines by academic year to avoid cross-year mixing
    const timelines = await this.prisma.studentTransportTimeline.findMany({
      where: { studentId, academicYear: resolvedYear },
      include: { route: true, stop: true },
      orderBy: { month: 'asc' },
    });

    if (timelines.length > 0) {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { standard: true },
      });
      const sctConfig = await this.resolveStudentSpecialClassTransportConfig(
        studentId,
        resolvedYear,
        student?.standard == null ? null : String(student.standard),
      );
      const splFeeRate = sctConfig.monthlyFee;
      const configuredSplTransportMonths = sctConfig.months;

      let baseFee = 0;
      let splClassMonths = 0;
      let splClassFeeTotal = 0;

      for (const t of timelines) {
        if (t.commuteMode !== 'SUSPENDED') {
          // Stop-wise base fee: use stop fee when assigned, else fall back to route baseFee
          const yearlyBase = t.stop?.fee ?? t.route.baseFee;
          const monthlyBase = Math.round((yearlyBase / 10) * 100) / 100;
          const multiplier =
            t.commuteMode === 'MORNING_ONLY' || t.commuteMode === 'EVENING_ONLY'
              ? 0.5
              : 1.0;

          if (t.isSplClass) {
            const splMultiplier =
              t.commuteMode === 'MORNING_ONLY' ||
              t.commuteMode === 'EVENING_ONLY'
                ? 0.5
                : 1.0;
            splClassMonths += splMultiplier;
            splClassFeeTotal +=
              splFeeRate > 0
                ? Math.round(splFeeRate * splMultiplier * 100) / 100
                : Number(t.feeCharged || 0);
          } else {
            baseFee += monthlyBase * multiplier;
          }
        }
      }

      baseFee = Math.round(baseFee * 100) / 100;
      const billableSplClassMonths =
        configuredSplTransportMonths > 0
          ? configuredSplTransportMonths
          : splClassMonths;
      splClassFeeTotal = Math.round(splClassFeeTotal * 100) / 100;
      const totalFee = Math.round((baseFee + splClassFeeTotal) * 100) / 100;

      return {
        baseFee,
        splClassFee: splClassFeeTotal,
        specialClassTransportTotal: splClassFeeTotal,
        proRataSplClassFee: splClassFeeTotal,
        splClassMonths: billableSplClassMonths,
        splClassFeeRate: splFeeRate,
        totalFee,
        splClassDaysUsed: null,
        totalWorkingDays: null,
        splClassStartDate: null,
        splClassEndDate: null,
        isFromTimeline: true,
        timelineCount: timelines.length,
      };
    }

    // No timeline rows — fall back to the static transport assignment
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId },
      include: { route: true, stop: true },
    });
    if (!assignment)
      return { baseFee: 0, splClassFee: 0, totalFee: 0, proRataSplClassFee: 0 };

    // Stop-wise fee respected in fallback path too
    const baseFee = assignment.stop?.fee ?? assignment.route.baseFee;
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { standard: true },
    });
    const sctConfig = await this.resolveStudentSpecialClassTransportConfig(
      studentId,
      resolvedYear,
      student?.standard == null ? null : String(student.standard),
    );
    const fullSplClassFee = assignment.isSplClass ? sctConfig.monthlyFee : 0;

    let proRataSplClassFee = fullSplClassFee;
    if (
      assignment.isSplClass &&
      assignment.splClassDaysUsed != null &&
      assignment.totalWorkingDays != null &&
      assignment.totalWorkingDays > 0
    ) {
      proRataSplClassFee =
        Math.round(
          ((fullSplClassFee * assignment.splClassDaysUsed) /
            assignment.totalWorkingDays) *
            100,
        ) / 100;
    }

    return {
      baseFee,
      splClassFee: fullSplClassFee,
      specialClassTransportTotal: proRataSplClassFee,
      proRataSplClassFee,
      totalFee: baseFee + proRataSplClassFee,
      splClassDaysUsed: assignment.splClassDaysUsed,
      totalWorkingDays: assignment.totalWorkingDays,
      splClassStartDate: assignment.splClassStartDate,
      splClassEndDate: assignment.splClassEndDate,
      isFromTimeline: false,
    };
  }

  // Get regular (base) transport fee for a student, excluding special class transport.
  // SCT is tracked separately via specialClassTransportFee × specialClassTransportMonths
  // on the StudentFee record to avoid double-counting.
  async getTransportFeeForStudentProRata(
    studentId: string,
    academicYear?: string,
  ): Promise<number> {
    const breakdown = await this.getTransportFeeBreakdown(
      studentId,
      academicYear,
    );
    // Return only the base transport fee — SCT is stored separately in
    // specialClassTransportFee / specialClassTransportMonths on StudentFee.
    return breakdown.baseFee;
  }

  // Update special class date tracking for pro-rata fee calculation
  async updateSplClassDates(data: UpdateSplClassDatesDto) {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId: data.studentId },
    });
    if (!assignment)
      throw new NotFoundException(
        'No transport assignment found for this student',
      );

    const updateData: any = {};
    if (data.splClassStartDate !== undefined)
      updateData.splClassStartDate = new Date(data.splClassStartDate);
    if (data.splClassEndDate !== undefined)
      updateData.splClassEndDate = new Date(data.splClassEndDate);
    if (data.splClassDaysUsed !== undefined)
      updateData.splClassDaysUsed = data.splClassDaysUsed;
    if (data.totalWorkingDays !== undefined)
      updateData.totalWorkingDays = data.totalWorkingDays;

    return this.prisma.studentTransport.update({
      where: { studentId: data.studentId },
      data: updateData,
      include: {
        route: true,
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
    });
  }

  // Stop special class transport for a student (sets end date)
  async stopSplClass(
    studentId: string,
    daysUsed: number,
    totalWorkingDays: number,
  ) {
    const assignment = await this.prisma.studentTransport.findUnique({
      where: { studentId },
    });
    if (!assignment)
      throw new NotFoundException('No transport assignment found');
    if (!assignment.isSplClass)
      throw new BadRequestException(
        'Student is not assigned to special class transport',
      );

    return this.prisma.studentTransport.update({
      where: { studentId },
      data: {
        splClassEndDate: new Date(),
        splClassDaysUsed: daysUsed,
        totalWorkingDays: totalWorkingDays,
      },
      include: {
        route: true,
        stop: true,
        student: { select: { id: true, name: true, standard: true } },
      },
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

    // Resolve bus and route relationships (strictly manual linking)
    const resolvedBusId: string | null = data.busId || null;
    if (resolvedBusId && data.route !== undefined) {
      // Link this bus to the selected route in the DB
      await this.prisma.bus.update({
        where: { id: resolvedBusId },
        data: { routeId: data.route || null },
      });
    }

    try {
      if (resolvedBusId) {
        await this.clearBusAssignments(resolvedBusId);
      }

      return await this.prisma.driver.create({
        data: {
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          deviceId: data.deviceId || null,
          busId: resolvedBusId,
          licenseNo: data.licenseNo || null,
          address: data.address || null,
          bloodGroup: data.bloodGroup || null,
          status: data.status || 'ACTIVE',
        },
        include: { bus: { include: { route: true } } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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
      if (
        !data.deviceId &&
        data.phone &&
        (!existing.deviceId || existing.deviceId === existing.phone)
      ) {
        updateData.deviceId = data.phone;
      }
    }
    if (data.deviceId !== undefined)
      updateData.deviceId = data.deviceId || null;
    if (data.busId !== undefined) updateData.busId = data.busId || null;
    if (data.licenseNo !== undefined)
      updateData.licenseNo = data.licenseNo || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.bloodGroup !== undefined)
      updateData.bloodGroup = data.bloodGroup || null;
    if (data.status !== undefined) updateData.status = data.status;

    // Resolve bus and route relationships during update (strictly manual linking)
    const targetBusId =
      updateData.busId !== undefined ? updateData.busId : existing.busId;
    if (targetBusId && data.route !== undefined) {
      // Link this bus to the selected route (or null if cleared) in the DB
      await this.prisma.bus.update({
        where: { id: targetBusId },
        data: { routeId: data.route || null },
      });
      updateData.busId = targetBusId;
    }

    try {
      if (updateData.busId && updateData.busId !== existing.busId) {
        await this.clearBusAssignments(updateData.busId, id);
      }

      return await this.prisma.driver.update({
        where: { id },
        data: updateData,
        include: { bus: { include: { route: true } } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A driver with this email already exists');
      }
      throw error;
    }
  }

  async getAllDrivers() {
    const drivers = await this.prisma.driver.findMany({
      include: {
        bus: { include: { route: true } },
        _count: { select: { locations: true } },
      },
      orderBy: { name: 'asc' },
    });

    return drivers.map((d) => ({
      ...d,
      assignedBusId: d.bus?.id ?? null,
      assignedBusNumber: d.bus?.number ?? null,
      assignedRouteId: d.bus?.route?.id ?? null,
      assignedRouteName: d.bus?.route?.routeName ?? null,
      assignedRouteNo: d.bus?.route?.routeNo ?? null,
    }));
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
    return {
      ...driver,
      assignedBusId: driver.bus?.id ?? null,
      assignedBusNumber: driver.bus?.number ?? null,
      assignedRouteId: driver.bus?.route?.id ?? null,
      assignedRouteName: driver.bus?.route?.routeName ?? null,
      assignedRouteNo: driver.bus?.route?.routeNo ?? null,
    };
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
      distanceToSchool = Math.round(
        R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
      );
      insideGeofence = distanceToSchool <= radiusM;
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline =
      lastLocation && new Date(lastLocation.createdAt) > fiveMinAgo;

    return {
      ...driver,
      lastLocation,
      distanceToSchoolMeters: distanceToSchool,
      insideGeofence,
      isOnline: !!isOnline,
      trackingStatus: !isOnline
        ? 'OFFLINE'
        : insideGeofence
          ? 'AT_SCHOOL'
          : 'ON_ROUTE',
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
        drivers: {
          select: { id: true, name: true, phone: true, status: true },
        },
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
      throw new BadRequestException(
        'Cannot delete bus — it has assigned drivers. Remove driver assignments first.',
      );
    }

    await this.prisma.location.deleteMany({ where: { busId: id } });
    return this.prisma.bus.delete({ where: { id } });
  }

  private async clearBusAssignments(busId: string, exceptDriverId?: string) {
    await this.prisma.driver.updateMany({
      where: {
        busId,
        ...(exceptDriverId ? { id: { not: exceptDriverId } } : {}),
      },
      data: { busId: null },
    });
  }

  /** Assign a driver to a bus */
  async assignDriverToBus(driverId: string, busId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    const bus = await this.prisma.bus.findUnique({
      where: { id: busId },
      include: { route: true },
    });
    if (!bus) throw new NotFoundException('Bus not found');

    await this.clearBusAssignments(busId, driverId);

    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: { busId },
      include: { bus: { include: { route: true } } },
    });

    // Queue driver status sync for the background worker.
    if (this.supabase) {
      await this.supabase.enqueueDriverStatusSync({
        driverId: driver.id,
        name: driver.name,
        phone: driver.phone || undefined,
        busId,
        status: driver.status,
      });
    }

    return updated;
  }

  /** Assign a driver to a route — auto-assigns the route's bus */
  async assignDriverToRoute(driverId: string, routeId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const route = await this.prisma.transportRoute.findUnique({
      where: { id: routeId },
      include: { buses: true },
    });
    if (!route) throw new NotFoundException('Route not found');

    if (!route.buses || route.buses.length === 0) {
      throw new BadRequestException(
        `Route "${route.routeName}" has no buses assigned. Create a bus for this route first.`,
      );
    }

    // Assign driver to the first available bus on the route
    const targetBus = route.buses[0];

    await this.clearBusAssignments(targetBus.id, driverId);

    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: { busId: targetBus.id },
      include: { bus: { include: { route: true } } },
    });

    // Queue driver status sync for the background worker.
    if (this.supabase) {
      await this.supabase.enqueueDriverStatusSync({
        driverId: driver.id,
        name: driver.name,
        phone: driver.phone || undefined,
        busId: targetBus.id,
        status: driver.status,
      });
    }

    return updated;
  }

  /** Unassign a driver from their bus */
  async unassignDriverFromBus(driverId: string) {
    // Try finding by ID first, then by phone
    let driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) {
      driver = await this.prisma.driver.findFirst({
        where: { phone: driverId },
      });
    }
    if (!driver) throw new NotFoundException('Driver not found');

    const updated = await this.prisma.driver.update({
      where: { id: driver.id },
      data: { busId: null },
      include: { bus: true },
    });

    // Queue driver status sync for the background worker.
    if (this.supabase) {
      await this.supabase.enqueueDriverStatusSync({
        driverId: driver.id,
        name: driver.name,
        phone: driver.phone || undefined,
        busId: undefined,
        status: driver.status,
      });
    }

    return updated;
  }

  // ═══════════════════════════════════════════════
  // VEHICLE-DRIVER MAPPING
  // ═══════════════════════════════════════════════

  /** Get all vehicle-driver assignments */
  async getVehicleDriverMappings() {
    const buses = await this.prisma.bus.findMany({
      include: {
        drivers: {
          select: {
            id: true,
            name: true,
            phone: true,
            licenseNo: true,
            status: true,
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    const mappings: any[] = [];
    for (const bus of buses) {
      if (bus.number && bus.drivers && bus.drivers.length > 0) {
        // Return only active drivers or all assigned drivers
        for (const driver of bus.drivers) {
          mappings.push({
            busId: bus.id,
            driverId: driver.id,
            plateNo: bus.number,
            driverName: driver.name,
            driverPhone: driver.phone,
            licenseNo: driver.licenseNo,
            status: driver.status,
          });
        }
      }
    }
    return mappings;
  }

  /** Assign a driver to a bus (vehicle-driver mapping) */
  async assignVehicleDriver(dto: any) {
    const busId = dto?.busId ? String(dto.busId) : undefined;
    const driverId = dto?.driverId ? String(dto.driverId) : undefined;
    const plateNo = dto?.plateNo ? String(dto.plateNo).trim() : undefined;
    const driverName = dto?.driverName
      ? String(dto.driverName).trim()
      : undefined;
    const driverPhone = dto?.driverPhone
      ? String(dto.driverPhone).trim()
      : undefined;
    const licenseNo = dto?.licenseNo ? String(dto.licenseNo).trim() : undefined;

    let bus = null as any;
    if (busId) {
      bus = await this.prisma.bus.findUnique({ where: { id: busId } });
      if (!bus) throw new NotFoundException('Bus not found');
    } else if (plateNo) {
      bus = await this.prisma.bus.findFirst({ where: { number: plateNo } });
      if (!bus) {
        bus = await this.prisma.bus.create({ data: { number: plateNo } });
      }
    } else {
      throw new BadRequestException('busId or plateNo is required');
    }

    let assignedDriver = null as any;
    if (driverId) {
      assignedDriver = await this.prisma.driver.findUnique({
        where: { id: driverId },
      });
      if (!assignedDriver) throw new NotFoundException('Driver not found');
    } else {
      if (!driverName || !driverPhone) {
        throw new BadRequestException(
          'driverId or driverName and driverPhone are required',
        );
      }

      assignedDriver = await this.prisma.driver.findFirst({
        where: {
          OR: [{ phone: driverPhone }, ...(licenseNo ? [{ licenseNo }] : [])],
        },
      });

      if (!assignedDriver) {
        assignedDriver = await this.prisma.driver.create({
          data: {
            name: driverName,
            phone: driverPhone,
            licenseNo: licenseNo || null,
            busId: bus.id,
          },
          include: { bus: true },
        });
      }
    }

    await this.clearBusAssignments(bus.id, assignedDriver.id);

    const updated = await this.prisma.driver.update({
      where: { id: assignedDriver.id },
      data: { busId: bus.id },
      include: { bus: true },
    });

    if (this.supabase) {
      await this.supabase.enqueueDriverStatusSync({
        driverId: updated.id,
        name: updated.name,
        phone: updated.phone || undefined,
        busId: bus.id,
        status: updated.status,
      });
    }

    return updated;
  }

  /** Remove driver mapping from a bus (vehicle-driver mapping) */
  async removeVehicleDriver(plateNo: string) {
    const bus = await this.prisma.bus.findFirst({
      where: { number: plateNo },
      include: { drivers: true },
    });

    if (bus && bus.drivers.length > 0) {
      // Unassign all drivers from this bus
      const updatePromises = bus.drivers.map((driver) =>
        this.prisma.driver.update({
          where: { id: driver.id },
          data: { busId: null },
        }),
      );
      await Promise.all(updatePromises);
    }
    return {
      success: true,
      message: `Driver mappings removed for bus ${plateNo}`,
    };
  }

  // ═══════════════════════════════════════════════
  // MILEAGE APIs
  // ═══════════════════════════════════════════════

  /** Create a mileage snapshot for a bus/driver */
  async createMileageSnapshot(dto: any) {
    if (dto.snapshots && Array.isArray(dto.snapshots)) {
      const results: any[] = [];
      for (const snap of dto.snapshots) {
        if (!snap.plateNo || snap.odometer == null) continue;

        // Find bus by plateNo
        const bus = await this.prisma.bus.findFirst({
          where: { number: snap.plateNo },
          include: { drivers: true },
        });

        if (!bus || bus.drivers.length === 0) continue; // driverId is required by schema
        const driverId = bus.drivers[0].id; // Use currently assigned driver

        // Prevent duplicate odometer spamming
        const existing = await this.prisma.mileage.findFirst({
          where: { busId: bus.id, odometer: Number(snap.odometer) },
        });
        if (existing) continue;

        const mileage: any = await this.prisma.mileage.create({
          data: {
            busId: bus.id,
            driverId: driverId,
            odometer: Number(snap.odometer),
            snapshotTime: new Date(),
          },
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
      const driver = await this.prisma.driver.findFirst({
        where: { phone: dto.driverId || dto.driverId },
      });
      if (!driver)
        throw new NotFoundException(
          `Driver not found for reference: ${dto.driverId || dto.driverId}`,
        );
      driverId = driver.id;
    }
    if (!driverId)
      throw new BadRequestException('driverId or driverPhone is required');

    if (
      dto.odometer === undefined ||
      dto.odometer === null ||
      isNaN(Number(dto.odometer))
    ) {
      throw new BadRequestException(
        'odometer is required and must be a number',
      );
    }

    const snapshotTime = dto.snapshotTime
      ? new Date(dto.snapshotTime)
      : new Date();
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
      return {
        busId,
        date: start.toISOString().slice(0, 10),
        mileage: 0,
        snapshots: [],
      };
    }

    // Sum only positive deltas between consecutive readings (ignores odometer resets)
    let mileage = 0;
    for (let i = 1; i < snapshots.length; i++) {
      const delta = snapshots[i].odometer - snapshots[i - 1].odometer;
      if (delta > 0) mileage += delta;
    }
    mileage = Math.round(mileage * 100) / 100;
    return {
      busId,
      date: start.toISOString().slice(0, 10),
      mileage,
      startOdometer: snapshots[0].odometer,
      endOdometer: snapshots[snapshots.length - 1].odometer,
      snapshots,
    };
  }

  async getBusMileageReport(busId: string, from?: string, to?: string) {
    const bus = await this.getBusOrThrow(busId);
    const { start, end } = getReportDateRange(from, to);

    const logs = await this.prisma.fuelLog.findMany({
      where: {
        busId,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: 'asc' },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        bus: { select: { id: true, number: true, routeName: true } },
      },
    });

    const entries = this.buildFuelMileageEntries(logs);
    const summaryMetrics = this.buildFuelMileageSummary(entries);
    const dailyBreakdown = new Map<string, number>();
    const dailyFuelBreakdown = new Map<string, number>();

    entries.forEach((entry) => {
      if (entry.distanceSincePreviousFill == null) return;

      const dayKey = entry.timestamp.toISOString().slice(0, 10);
      dailyBreakdown.set(
        dayKey,
        Math.round(
          ((dailyBreakdown.get(dayKey) || 0) +
            entry.distanceSincePreviousFill) *
            100,
        ) / 100,
      );
      dailyFuelBreakdown.set(
        dayKey,
        Math.round(
          ((dailyFuelBreakdown.get(dayKey) || 0) + entry.litres) * 100,
        ) / 100,
      );
    });

    return {
      period: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
      bus: {
        id: bus.id,
        number: bus.number,
        routeName: bus.routeName,
        capacity: bus.capacity,
        route: bus.route
          ? { id: bus.route.id, routeName: bus.route.routeName }
          : null,
        drivers: bus.drivers,
      },
      summary: {
        fuelEntries: entries.length,
        mileageSegments: summaryMetrics.mileageSegments,
        totalDistanceKm: summaryMetrics.totalDistanceKm,
        totalFuelConsumedLitres: summaryMetrics.totalFuelConsumedLitres,
        averageKmPerLitre: summaryMetrics.averageKmPerLitre,
        startOdometer: summaryMetrics.startOdometer,
        endOdometer: summaryMetrics.endOdometer,
      },
      dailyBreakdown: Array.from(dailyBreakdown.entries()).map(
        ([date, distanceKm]) => {
          const litres = dailyFuelBreakdown.get(date) || 0;
          return {
            date,
            distanceKm,
            litres,
            averageKmPerLitre:
              distanceKm > 0 && litres > 0
                ? Math.round((distanceKm / litres) * 100) / 100
                : null,
          };
        },
      ),
      entries,
    };
  }

  // ═══════════════════════════════════════════════
  // TRIP / IGNITION EVENT LOG
  // ═══════════════════════════════════════════════

  async pushTripEvents(events: any[]) {
    if (!events || events.length === 0) return { success: true, count: 0 };

    const data = events.map((e) => ({
      plateNo: e.plateNo || '',
      deviceId: e.deviceId || '',
      event: e.event || 'UNKNOWN',
      driverName: e.driverName || null,
      latitude: e.latitude != null ? Number(e.latitude) : null,
      longitude: e.longitude != null ? Number(e.longitude) : null,
      speed: e.speed != null ? Number(e.speed) : null,
      odometer: e.odometer != null ? Number(e.odometer) : null,
    }));

    const result = await this.prisma.vehicleTripLog.createMany({ data });
    return { success: true, count: result.count };
  }

  async getTripEvents(params: {
    plateNo?: string;
    deviceId?: string;
    event?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (params.plateNo) where.plateNo = params.plateNo;
    if (params.deviceId) where.deviceId = params.deviceId;
    if (params.event) where.event = params.event;
    if (params.from || params.to) {
      where.timestamp = {};
      if (params.from) where.timestamp.gte = new Date(params.from);
      if (params.to) where.timestamp.lte = new Date(params.to);
    }

    return this.prisma.vehicleTripLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: params.limit || 200,
    });
  }

  async getDailyTripSummary(date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(targetDate + 'T00:00:00.000Z');
    const endOfDay = new Date(targetDate + 'T23:59:59.999Z');

    const events = await this.prisma.vehicleTripLog.findMany({
      where: {
        timestamp: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { timestamp: 'asc' },
    });

    const byPlate: Record<string, any[]> = {};
    events.forEach((e) => {
      if (!byPlate[e.plateNo]) byPlate[e.plateNo] = [];
      byPlate[e.plateNo].push(e);
    });

    return Object.entries(byPlate).map(([plateNo, evts]) => {
      const ignOnCount = evts.filter((e) => e.event === 'IGNITION_ON').length;
      const ignOffCount = evts.filter((e) => e.event === 'IGNITION_OFF').length;
      const firstIgnOn = evts.find((e) => e.event === 'IGNITION_ON');
      const lastIgnOff = [...evts]
        .reverse()
        .find((e) => e.event === 'IGNITION_OFF');

      let totalRunningMs = 0;
      let lastOnTime: Date | null = null;
      for (const evt of evts) {
        if (evt.event === 'IGNITION_ON') {
          lastOnTime = evt.timestamp;
        } else if (evt.event === 'IGNITION_OFF' && lastOnTime) {
          totalRunningMs +=
            new Date(evt.timestamp).getTime() - new Date(lastOnTime).getTime();
          lastOnTime = null;
        }
      }

      const startOdometer = firstIgnOn?.odometer ?? null;
      const endOdometer =
        lastIgnOff?.odometer ?? evts[evts.length - 1]?.odometer ?? null;
      const distanceKm =
        startOdometer != null &&
        endOdometer != null &&
        endOdometer >= startOdometer
          ? Math.round((endOdometer - startOdometer) * 100) / 100
          : null;

      return {
        plateNo,
        date: targetDate,
        ignitionOnCount: ignOnCount,
        ignitionOffCount: ignOffCount,
        firstStartTime: firstIgnOn?.timestamp || null,
        lastStopTime: lastIgnOff?.timestamp || null,
        totalRunningMinutes: Math.round(totalRunningMs / 60000),
        distanceKm,
        startOdometer,
        endOdometer,
        driverName: firstIgnOn?.driverName || evts[0]?.driverName || null,
        totalEvents: evts.length,
        events: evts,
      };
    });
  }

  async getBusReport(plateNo: string, date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(targetDate + 'T00:00:00.000Z');
    const endOfDay = new Date(targetDate + 'T23:59:59.999Z');

    // Get trip events for the bus
    const tripEvents = await this.prisma.vehicleTripLog.findMany({
      where: {
        plateNo,
        timestamp: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Get mileage snapshots for the bus
    const bus = await this.prisma.bus.findFirst({
      where: { number: plateNo },
      include: { drivers: true, route: true },
    });

    let mileageData: {
      dailyKm: number;
      startOdometer: number;
      endOdometer: number;
      snapshotCount: number;
    } | null = null;
    if (bus) {
      const snapshots = await this.prisma.mileage.findMany({
        where: {
          busId: bus.id,
          snapshotTime: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { snapshotTime: 'asc' },
      });
      if (snapshots.length > 0) {
        // Sum only positive deltas between consecutive readings (ignores odometer resets)
        let dailyKm = 0;
        for (let i = 1; i < snapshots.length; i++) {
          const delta = snapshots[i].odometer - snapshots[i - 1].odometer;
          if (delta > 0) dailyKm += delta;
        }
        mileageData = {
          dailyKm: Math.round(dailyKm * 100) / 100,
          startOdometer: snapshots[0].odometer,
          endOdometer: snapshots[snapshots.length - 1].odometer,
          snapshotCount: snapshots.length,
        };
      }
    }

    // Compute ignition summary
    const ignOnEvents = tripEvents.filter((e) => e.event === 'IGNITION_ON');
    const ignOffEvents = tripEvents.filter((e) => e.event === 'IGNITION_OFF');

    let totalRunningMs = 0;
    let lastOnTime: Date | null = null;
    for (const evt of tripEvents) {
      if (evt.event === 'IGNITION_ON') lastOnTime = evt.timestamp;
      else if (evt.event === 'IGNITION_OFF' && lastOnTime) {
        totalRunningMs +=
          new Date(evt.timestamp).getTime() - new Date(lastOnTime).getTime();
        lastOnTime = null;
      }
    }

    // Driver location history for the selected date
    let driverLocationHistory: any[] = [];
    const assignedDriver = bus?.drivers?.[0];
    if (assignedDriver) {
      const driverLocations = await this.prisma.location.findMany({
        where: {
          driverId: assignedDriver.id,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          createdAt: true,
        },
      });
      driverLocationHistory = driverLocations;
    }

    return {
      plateNo,
      date: targetDate,
      bus: bus
        ? {
            id: bus.id,
            number: bus.number,
            routeName: bus.routeName,
            capacity: bus.capacity,
          }
        : null,
      driver: assignedDriver
        ? {
            id: assignedDriver.id,
            name: assignedDriver.name,
            phone: assignedDriver.phone,
          }
        : null,
      route: bus?.route
        ? { id: bus.route.id, routeName: bus.route.routeName }
        : null,
      mileage: mileageData,
      ignitionSummary: {
        onCount: ignOnEvents.length,
        offCount: ignOffEvents.length,
        firstStart: ignOnEvents[0]?.timestamp || null,
        lastStop: ignOffEvents[ignOffEvents.length - 1]?.timestamp || null,
        totalRunningMinutes: Math.round(totalRunningMs / 60000),
      },
      tripEvents,
      driverLocationHistory,
    };
  }

  // ═══════════════════════════════════════════════
  // FUEL LOG APIs
  // ═══════════════════════════════════════════════

  /** Create fuel log from ERP dashboard (authenticated) */
  async createFuelLog(dto: any) {
    if (!dto.driverId) throw new BadRequestException('driverId is required');
    if (dto.odometer == null || isNaN(Number(dto.odometer)))
      throw new BadRequestException('odometer is required');
    if (dto.litres == null || isNaN(Number(dto.litres)))
      throw new BadRequestException('litres is required');

    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
      include: { bus: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const fuelLog = await this.prisma.fuelLog.create({
      data: {
        driverId: driver.id,
        busId: driver.busId || dto.busId || null,
        plateNo: driver.bus?.number || dto.plateNo || null,
        odometer: Number(dto.odometer),
        litres: Number(dto.litres),
        fuelCostPerLitre:
          dto.fuelCostPerLitre != null ? Number(dto.fuelCostPerLitre) : null,
        totalCost: dto.totalCost != null ? Number(dto.totalCost) : null,
        note: dto.note || null,
        imageUrl: dto.imageUrl || null,
      },
    });

    await this.supabase.enqueueFuelLogSync({
      fuelLogId: fuelLog.id,
      driverId: driver.id,
      busId: fuelLog.busId || undefined,
      plateNo: fuelLog.plateNo || undefined,
      odometer: fuelLog.odometer,
      litres: fuelLog.litres,
      fuelCostPerLitre: fuelLog.fuelCostPerLitre ?? undefined,
      totalCost: fuelLog.totalCost ?? undefined,
      note: fuelLog.note || undefined,
      imageUrl: fuelLog.imageUrl || undefined,
      timestamp: fuelLog.timestamp.toISOString(),
    });

    return fuelLog;
  }

  /** Create fuel log from Flutter driver app (public, resolves driver by phone) */
  async createFuelLogFromDriver(dto: any) {
    const driverRef = String(
      dto.driverId ??
        dto.driver_id ??
        dto.driverPhone ??
        dto.phone ??
        dto.phoneNumber ??
        dto.deviceId ??
        '',
    ).trim();
    if (!driverRef)
      throw new BadRequestException('driverId or driverPhone is required');

    const odometerValue =
      dto.odometer ?? dto.distance ?? dto.distanceKm ?? dto.km;
    const litresValue = dto.litres ?? dto.liters ?? dto.fuelLitres;

    if (odometerValue == null || isNaN(Number(odometerValue))) {
      throw new BadRequestException('odometer is required');
    }
    if (litresValue == null || isNaN(Number(litresValue))) {
      throw new BadRequestException('litres is required');
    }

    // Find all matching drivers and prefer the one with a bus assigned
    const candidates = await this.prisma.driver.findMany({
      where: {
        OR: [{ id: driverRef }, { phone: driverRef }, { deviceId: driverRef }],
      },
      include: { bus: true },
    });
    let driver = candidates.find((d) => d.busId) || candidates[0] || null;

    if (!driver) {
      const refDigits = driverRef.replace(/\D/g, '');
      if (refDigits.length >= 10) {
        const allDrivers = await this.prisma.driver.findMany({
          where: { phone: { not: null } },
          include: { bus: true },
        });
        const target = refDigits.slice(-10);
        const phoneMatches = allDrivers.filter(
          (d) => (d.phone || '').replace(/\D/g, '').slice(-10) === target,
        );
        driver = phoneMatches.find((d) => d.busId) || phoneMatches[0] || null;
      }
    }

    if (!driver)
      throw new NotFoundException(`Driver not found for: ${driverRef}`);

    let resolvedBusId = driver.busId || dto.busId || null;
    let resolvedPlateNo = driver.bus?.number || dto.plateNo || null;

    if (!resolvedBusId && resolvedPlateNo) {
      const matchedBus = await this.prisma.bus.findFirst({
        where: { number: resolvedPlateNo },
        select: { id: true, number: true },
      });
      if (matchedBus) {
        resolvedBusId = matchedBus.id;
        resolvedPlateNo = matchedBus.number;
      }
    }

    const fuelLog = await this.prisma.fuelLog.create({
      data: {
        driverId: driver.id,
        busId: resolvedBusId,
        plateNo: resolvedPlateNo,
        odometer: Number(odometerValue),
        litres: Number(litresValue),
        fuelCostPerLitre:
          dto.fuelCostPerLitre != null
            ? Number(dto.fuelCostPerLitre)
            : dto.fuel_cost_per_litre != null
              ? Number(dto.fuel_cost_per_litre)
              : dto.rate != null
                ? Number(dto.rate)
                : null,
        totalCost:
          dto.totalCost != null
            ? Number(dto.totalCost)
            : dto.total_cost != null
              ? Number(dto.total_cost)
              : dto.amount != null
                ? Number(dto.amount)
                : null,
        note: dto.note || dto.remarks || dto.comment || null,
        imageUrl: dto.imageUrl || dto.image_url || null,
      },
    });

    // Queue fuel-log sync for the background worker.
    await this.supabase.enqueueFuelLogSync({
      fuelLogId: fuelLog.id,
      driverId: driver.id,
      busId: resolvedBusId || undefined,
      plateNo: resolvedPlateNo || undefined,
      odometer: Number(odometerValue),
      litres: Number(litresValue),
      fuelCostPerLitre:
        dto.fuelCostPerLitre != null
          ? Number(dto.fuelCostPerLitre)
          : dto.fuel_cost_per_litre != null
            ? Number(dto.fuel_cost_per_litre)
            : dto.rate != null
              ? Number(dto.rate)
              : undefined,
      totalCost:
        dto.totalCost != null
          ? Number(dto.totalCost)
          : dto.total_cost != null
            ? Number(dto.total_cost)
            : dto.amount != null
              ? Number(dto.amount)
              : undefined,
      note: dto.note || dto.remarks || dto.comment || undefined,
      imageUrl: dto.imageUrl || dto.image_url || undefined,
      timestamp: fuelLog.timestamp.toISOString(),
    });

    return fuelLog;
  }

  /** Get fuel logs with optional filters */
  async getFuelLogs(params: {
    plateNo?: string;
    busId?: string;
    driverId?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = {};
    if (params.plateNo) where.plateNo = params.plateNo;
    if (params.busId) where.busId = params.busId;
    if (params.driverId) where.driverId = params.driverId;
    if (params.from || params.to) {
      where.timestamp = {};
      if (params.from) where.timestamp.gte = new Date(params.from);
      if (params.to) where.timestamp.lte = new Date(params.to);
    }

    const logs = await this.prisma.fuelLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        bus: { select: { id: true, number: true, routeName: true } },
      },
    });

    // Calculate km/litre between consecutive fuel entries for the same bus
    const enriched = logs.map((log, idx) => {
      let kmPerLitre: number | null = null;
      if (log.plateNo) {
        const prevLog = logs
          .slice(idx + 1)
          .find((l) => l.plateNo === log.plateNo);
        if (prevLog && log.odometer > prevLog.odometer && log.litres > 0) {
          kmPerLitre =
            Math.round(((log.odometer - prevLog.odometer) / log.litres) * 100) /
            100;
        }
      }
      return { ...log, kmPerLitre };
    });

    return enriched;
  }

  async getBusFuelReport(busId: string, from?: string, to?: string) {
    const bus = await this.getBusOrThrow(busId);
    const { start, end } = getReportDateRange(from, to);

    const logs = await this.prisma.fuelLog.findMany({
      where: {
        busId,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: 'asc' },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        bus: { select: { id: true, number: true, routeName: true } },
      },
    });

    const enrichedLogs = this.buildFuelMileageEntries(logs);

    const totalLitres = enrichedLogs.reduce((sum, log) => sum + log.litres, 0);
    const totalCost = enrichedLogs.reduce(
      (sum, log) => sum + (log.totalCost || 0),
      0,
    );
    const summaryMetrics = this.buildFuelMileageSummary(enrichedLogs);

    return {
      period: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
      bus: {
        id: bus.id,
        number: bus.number,
        routeName: bus.routeName,
        capacity: bus.capacity,
        route: bus.route
          ? { id: bus.route.id, routeName: bus.route.routeName }
          : null,
        drivers: bus.drivers,
      },
      summary: {
        fuelEntries: enrichedLogs.length,
        totalLitres: Math.round(totalLitres * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalDistanceKm: summaryMetrics.totalDistanceKm,
        totalFuelConsumedLitres: summaryMetrics.totalFuelConsumedLitres,
        averageKmPerLitre: summaryMetrics.averageKmPerLitre,
        lastOdometer: enrichedLogs[enrichedLogs.length - 1]?.odometer ?? null,
      },
      logs: enrichedLogs,
    };
  }

  async exportBusFuelReportExcel(
    busId: string,
    from?: string,
    to?: string,
  ): Promise<ExportFile> {
    const report = await this.getBusFuelReport(busId, from, to);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GitHub Copilot';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 40 },
    ];
    summarySheet.addRows([
      { field: 'Bus Number', value: report.bus.number },
      { field: 'Route Name', value: report.bus.routeName || '-' },
      { field: 'Period From', value: formatReportDateTime(report.period.from) },
      { field: 'Period To', value: formatReportDateTime(report.period.to) },
      { field: 'Fuel Entries', value: report.summary.fuelEntries },
      { field: 'Total Litres', value: report.summary.totalLitres },
      { field: 'Total Cost', value: report.summary.totalCost },
      { field: 'Total Distance Km', value: report.summary.totalDistanceKm },
      {
        field: 'Average Km Per Litre',
        value: report.summary.averageKmPerLitre ?? '-',
      },
      { field: 'Last Odometer', value: report.summary.lastOdometer ?? '-' },
    ]);

    const logsSheet = workbook.addWorksheet('Fuel Logs');
    logsSheet.columns = [
      { header: 'Date', key: 'date', width: 22 },
      { header: 'Driver', key: 'driver', width: 24 },
      { header: 'Odometer', key: 'odometer', width: 14 },
      { header: 'Litres', key: 'litres', width: 12 },
      { header: 'Total Cost', key: 'totalCost', width: 14 },
      { header: 'Distance Since Previous Fill', key: 'distance', width: 24 },
      { header: 'Km Per Litre', key: 'kmPerLitre', width: 16 },
      { header: 'Note', key: 'note', width: 30 },
    ];
    logsSheet.addRows(
      report.logs.map((log) => ({
        date: formatReportDateTime(log.timestamp),
        driver: log.driver?.name || '-',
        odometer: log.odometer,
        litres: log.litres,
        totalCost: log.totalCost ?? '-',
        distance: log.distanceSincePreviousFill ?? '-',
        kmPerLitre: log.kmPerLitre ?? '-',
        note: log.note || '-',
      })),
    );

    const filename = `${safeFileToken(report.bus.number)}-fuel-report.xlsx`;
    return {
      filename,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: await this.buildWorkbookBuffer(workbook),
    };
  }

  async exportBusFuelReportPdf(
    busId: string,
    from?: string,
    to?: string,
  ): Promise<ExportFile> {
    const report = await this.getBusFuelReport(busId, from, to);
    const content = await this.buildPdfBuffer((doc) => {
      doc.fontSize(18).font('Helvetica-Bold').text('Bus Fuel Report');
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica').text(`Bus: ${report.bus.number}`);
      doc.text(`Route: ${report.bus.routeName || '-'}`);
      doc.text(
        `Period: ${formatReportDateTime(report.period.from)} to ${formatReportDateTime(report.period.to)}`,
      );
      doc.moveDown();

      this.writePdfSummarySection(doc, 'Summary', [
        { label: 'Fuel Entries', value: report.summary.fuelEntries },
        { label: 'Total Litres', value: report.summary.totalLitres },
        {
          label: 'Total Cost',
          value: formatCurrency(report.summary.totalCost),
        },
        {
          label: 'Total Distance',
          value: `${report.summary.totalDistanceKm} km`,
        },
        {
          label: 'Average Km Per Litre',
          value: report.summary.averageKmPerLitre ?? '-',
        },
        { label: 'Last Odometer', value: report.summary.lastOdometer ?? '-' },
      ]);

      this.addPdfTable(
        doc,
        'Fuel Logs',
        ['Date', 'Driver', 'Odometer', 'Litres', 'Cost', 'Km/L'],
        report.logs.map((log) => [
          formatReportDateTime(log.timestamp),
          log.driver?.name || '-',
          String(log.odometer),
          String(log.litres),
          formatCurrency(log.totalCost),
          log.kmPerLitre == null ? '-' : String(log.kmPerLitre),
        ]),
      );
    });

    return {
      filename: `${safeFileToken(report.bus.number)}-fuel-report.pdf`,
      contentType: 'application/pdf',
      content,
    };
  }

  async exportBusMileageReportExcel(
    busId: string,
    from?: string,
    to?: string,
  ): Promise<ExportFile> {
    const report = await this.getBusMileageReport(busId, from, to);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GitHub Copilot';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 40 },
    ];
    summarySheet.addRows([
      { field: 'Bus Number', value: report.bus.number },
      { field: 'Route Name', value: report.bus.routeName || '-' },
      { field: 'Period From', value: formatReportDateTime(report.period.from) },
      { field: 'Period To', value: formatReportDateTime(report.period.to) },
      { field: 'Fuel Entries', value: report.summary.fuelEntries },
      { field: 'Mileage Segments', value: report.summary.mileageSegments },
      { field: 'Total Distance Km', value: report.summary.totalDistanceKm },
      {
        field: 'Fuel Used For Mileage',
        value: report.summary.totalFuelConsumedLitres,
      },
      {
        field: 'Average Km Per Litre',
        value: report.summary.averageKmPerLitre ?? '-',
      },
      { field: 'Start Odometer', value: report.summary.startOdometer ?? '-' },
      { field: 'End Odometer', value: report.summary.endOdometer ?? '-' },
    ]);

    const dailySheet = workbook.addWorksheet('Daily Breakdown');
    dailySheet.columns = [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Distance Km', key: 'distanceKm', width: 16 },
      { header: 'Litres', key: 'litres', width: 14 },
      { header: 'Average Km Per Litre', key: 'averageKmPerLitre', width: 20 },
    ];
    dailySheet.addRows(report.dailyBreakdown);

    const entriesSheet = workbook.addWorksheet('Fuel Mileage');
    entriesSheet.columns = [
      { header: 'Date', key: 'date', width: 22 },
      { header: 'Driver', key: 'driver', width: 24 },
      { header: 'Previous Odometer', key: 'previousOdometer', width: 18 },
      { header: 'Current Odometer', key: 'odometer', width: 18 },
      { header: 'Distance Km', key: 'distanceKm', width: 14 },
      { header: 'Litres', key: 'litres', width: 12 },
      { header: 'Average Km Per Litre', key: 'averageKmPerLitre', width: 20 },
    ];
    entriesSheet.addRows(
      report.entries.map((entry) => ({
        date: formatReportDateTime(entry.timestamp),
        driver: entry.driver?.name || '-',
        previousOdometer: entry.previousOdometer ?? '-',
        odometer: entry.odometer,
        distanceKm: entry.distanceSincePreviousFill ?? '-',
        litres: entry.litres,
        averageKmPerLitre: entry.kmPerLitre ?? '-',
      })),
    );

    return {
      filename: `${safeFileToken(report.bus.number)}-mileage-report.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: await this.buildWorkbookBuffer(workbook),
    };
  }

  async exportBusMileageReportPdf(
    busId: string,
    from?: string,
    to?: string,
  ): Promise<ExportFile> {
    const report = await this.getBusMileageReport(busId, from, to);
    const content = await this.buildPdfBuffer((doc) => {
      doc.fontSize(18).font('Helvetica-Bold').text('Bus Mileage Report');
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica').text(`Bus: ${report.bus.number}`);
      doc.text(`Route: ${report.bus.routeName || '-'}`);
      doc.text(
        `Period: ${formatReportDateTime(report.period.from)} to ${formatReportDateTime(report.period.to)}`,
      );
      doc.moveDown();

      this.writePdfSummarySection(doc, 'Summary', [
        { label: 'Fuel Entries', value: report.summary.fuelEntries },
        { label: 'Mileage Segments', value: report.summary.mileageSegments },
        {
          label: 'Total Distance',
          value: `${report.summary.totalDistanceKm} km`,
        },
        {
          label: 'Fuel Used For Mileage',
          value: `${report.summary.totalFuelConsumedLitres} L`,
        },
        {
          label: 'Average Km Per Litre',
          value: report.summary.averageKmPerLitre ?? '-',
        },
        { label: 'Start Odometer', value: report.summary.startOdometer ?? '-' },
        { label: 'End Odometer', value: report.summary.endOdometer ?? '-' },
      ]);

      this.addPdfTable(
        doc,
        'Daily Breakdown',
        ['Date', 'Distance Km', 'Litres', 'Km/L'],
        report.dailyBreakdown.map((entry) => [
          entry.date,
          String(entry.distanceKm),
          String(entry.litres),
          entry.averageKmPerLitre == null
            ? '-'
            : String(entry.averageKmPerLitre),
        ]),
      );

      this.addPdfTable(
        doc,
        'Fuel Mileage Entries',
        ['Date', 'Driver', 'Prev Odo', 'Odo', 'Distance', 'Litres', 'Km/L'],
        report.entries.map((entry) => [
          formatReportDateTime(entry.timestamp),
          entry.driver?.name || '-',
          entry.previousOdometer == null ? '-' : String(entry.previousOdometer),
          String(entry.odometer),
          entry.distanceSincePreviousFill == null
            ? '-'
            : String(entry.distanceSincePreviousFill),
          String(entry.litres),
          entry.kmPerLitre == null ? '-' : String(entry.kmPerLitre),
        ]),
      );
    });

    return {
      filename: `${safeFileToken(report.bus.number)}-mileage-report.pdf`,
      contentType: 'application/pdf',
      content,
    };
  }

  // ─── TIMELINE & DRIVER ROTATION LOGIC ──────────────────

  async getStudentTransportTimeline(studentId: string, academicYear: string) {
    if (!academicYear) {
      throw new BadRequestException('Academic year is required');
    }

    let timeline = await this.prisma.studentTransportTimeline.findMany({
      where: { studentId, academicYear },
      include: { route: true, stop: true },
      orderBy: { month: 'asc' },
    });

    if (timeline.length === 0) {
      const assignment = await this.prisma.studentTransport.findUnique({
        where: { studentId },
        include: { route: true, stop: true },
      });

      if (assignment) {
        const yearPrefix = academicYear.split('-')[0];
        const nextYearPrefix = String(Number(yearPrefix) + 1);

        const activeMonths = [
          { month: '06', year: yearPrefix },
          { month: '07', year: yearPrefix },
          { month: '08', year: yearPrefix },
          { month: '09', year: yearPrefix },
          { month: '10', year: yearPrefix },
          { month: '11', year: yearPrefix },
          { month: '12', year: yearPrefix },
          { month: '01', year: nextYearPrefix },
          { month: '02', year: nextYearPrefix },
          { month: '03', year: nextYearPrefix },
        ];

        // Initialize ALL months with isSplClass=false — special class surcharge is 0 initially
        const createData = activeMonths.map((m) => {
          const monthStr = `${m.year}-${m.month}`;
          const feeCharged = 0; // Initialize as 0 special class surcharge by default

          return {
            studentId,
            routeId: assignment.routeId,
            stopId: assignment.stopId || null,
            academicYear,
            month: monthStr,
            commuteMode: 'BOTH_WAYS',
            isSplClass: false,
            feeCharged,
          };
        });

        await this.prisma.studentTransportTimeline.createMany({
          data: createData,
        });

        timeline = await this.prisma.studentTransportTimeline.findMany({
          where: { studentId, academicYear },
          include: { route: true, stop: true },
          orderBy: { month: 'asc' },
        });
      }
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { standard: true },
    });
    const sctConfig = await this.resolveStudentSpecialClassTransportConfig(
      studentId,
      academicYear,
      student?.standard == null ? null : String(student.standard),
    );
    const specialClassTransportMonths = sctConfig.months;
    const specialClassTransportFee = sctConfig.monthlyFee;

    const normalizedTimeline = timeline.map((entry) => {
      const multiplier =
        entry.commuteMode === 'MORNING_ONLY' ||
        entry.commuteMode === 'EVENING_ONLY'
          ? 0.5
          : 1.0;
      const feeCharged =
        entry.isSplClass && entry.commuteMode !== 'SUSPENDED'
          ? specialClassTransportFee > 0
            ? Math.round(specialClassTransportFee * multiplier * 100) / 100
            : Math.round((entry.feeCharged || 0) * 100) / 100
          : 0;

      return {
        ...entry,
        feeCharged,
      };
    });

    const specialClassTransportTotal =
      Math.round(
        normalizedTimeline
          .filter(
            (entry) => entry.isSplClass && entry.commuteMode !== 'SUSPENDED',
          )
          .reduce((sum, entry) => sum + Number(entry.feeCharged || 0), 0) * 100,
      ) / 100;

    return {
      timeline: normalizedTimeline,
      specialClassTransportMonths,
      specialClassTransportFee,
      specialClassTransportTotal,
    };
  }

  async updateStudentTransportTimeline(dto: any) {
    const {
      studentId,
      academicYear,
      month,
      routeId,
      stopId,
      commuteMode,
      isSplClass,
    } = dto;
    if (!studentId || !academicYear || !month) {
      throw new BadRequestException(
        'studentId, academicYear, and month are required',
      );
    }

    const targetRouteId = routeId;
    if (!targetRouteId) {
      throw new BadRequestException('routeId is required');
    }

    const route = await this.prisma.transportRoute.findUnique({
      where: { id: targetRouteId },
      include: { stops: true },
    });
    if (!route) throw new NotFoundException('Route not found');

    let yearlyBaseFee = route.baseFee;
    if (stopId) {
      const stop = route.stops.find((s) => s.id === stopId);
      if (stop && stop.fee != null) {
        yearlyBaseFee = stop.fee;
      }
    }

    const monthlyBaseFee = Math.round((yearlyBaseFee / 10) * 100) / 100;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (isSplClass && student) {
      const isEligible =
        student.standard === 'STD_9' ||
        student.standard === 'STD_10' ||
        student.standard === 'STD_11' ||
        student.standard === 'STD_12';
      if (!isEligible) {
        throw new BadRequestException(
          'Special Class transport is only applicable for standards 9, 10, 11, and 12',
        );
      }
    }

    const sctConfig = await this.resolveStudentSpecialClassTransportConfig(
      studentId,
      academicYear,
      student?.standard == null ? null : String(student.standard),
    );
    const splClassMonthlyFee = sctConfig.monthlyFee;

    let feeCharged = 0;
    const finalCommuteMode = commuteMode || 'BOTH_WAYS';
    if (finalCommuteMode !== 'SUSPENDED') {
      const multiplier =
        finalCommuteMode === 'MORNING_ONLY' ||
        finalCommuteMode === 'EVENING_ONLY'
          ? 0.5
          : 1.0;
      if (isSplClass) {
        // Special class is an evening session — if student uses only morning/evening transport,
        // charge half the special class transport fee for that month.
        feeCharged = splClassMonthlyFee * multiplier;
      }
    }
    feeCharged = Math.round(feeCharged * 100) / 100;

    const updatedRecord = await this.prisma.studentTransportTimeline.upsert({
      where: {
        studentId_academicYear_month: { studentId, academicYear, month },
      },
      update: {
        routeId: targetRouteId,
        stopId: stopId || null,
        commuteMode: finalCommuteMode,
        isSplClass: !!isSplClass,
        feeCharged,
      },
      create: {
        studentId,
        routeId: targetRouteId,
        stopId: stopId || null,
        academicYear,
        month,
        commuteMode: finalCommuteMode,
        isSplClass: !!isSplClass,
        feeCharged,
      },
    });

    await this.syncStudentTimelineFees(studentId, academicYear);

    return updatedRecord;
  }

  // ─── Set Special Class Range (bulk start→end month) ──────────────────────
  async setStudentSplClassRange(dto: {
    studentId: string;
    academicYear: string;
    startMonth: string | null; // "YYYY-MM" or null to clear all
    endMonth: string | null; // "YYYY-MM" or null to clear all
  }) {
    const { studentId, academicYear, startMonth, endMonth } = dto;
    if (!studentId || !academicYear) {
      throw new BadRequestException('studentId and academicYear are required');
    }

    const timelines = await this.prisma.studentTransportTimeline.findMany({
      where: { studentId, academicYear },
      include: { route: true, stop: true },
      orderBy: { month: 'asc' },
    });
    if (timelines.length === 0) {
      throw new BadRequestException(
        'No transport timeline found. Please visit the Month-wise tab first to initialise the timeline.',
      );
    }

    // Fetch student + fee structure for spl class fee rate
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new BadRequestException('Student not found');

    const sctConfig = await this.resolveStudentSpecialClassTransportConfig(
      studentId,
      academicYear,
      String(student.standard),
    );
    const splClassMonthlyFee = sctConfig.monthlyFee;

    // For each timeline row decide isSplClass based on range
    for (const t of timelines) {
      const inRange =
        startMonth && endMonth
          ? t.month >= startMonth && t.month <= endMonth
          : false; // null start/end clears everything

      const commuteMultiplier =
        t.commuteMode === 'MORNING_ONLY' || t.commuteMode === 'EVENING_ONLY'
          ? 0.5
          : 1.0;

      let feeCharged = 0;
      if (t.commuteMode !== 'SUSPENDED' && inRange) {
        // Half the spl fee if student only commutes one-way that month
        feeCharged = splClassMonthlyFee * commuteMultiplier;
      }
      feeCharged = Math.round(feeCharged * 100) / 100;

      await this.prisma.studentTransportTimeline.update({
        where: { id: t.id },
        data: {
          isSplClass: inRange,
          feeCharged,
        },
      });
    }

    // Sync the new counts into StudentFee
    await this.syncStudentTimelineFees(studentId, academicYear);

    // Return fresh timeline with standard FeeStructure metadata
    const freshTimeline = await this.prisma.studentTransportTimeline.findMany({
      where: { studentId, academicYear },
      include: { route: true, stop: true },
      orderBy: { month: 'asc' },
    });

    return {
      timeline: freshTimeline,
      specialClassTransportMonths: sctConfig.months,
      specialClassTransportFee: sctConfig.monthlyFee,
      specialClassTransportTotal:
        sctConfig.monthlyFee > 0
          ? Math.round(
              freshTimeline
                .filter((t) => t.isSplClass && t.commuteMode !== 'SUSPENDED')
                .reduce((sum, t) => {
                  const multiplier =
                    t.commuteMode === 'MORNING_ONLY' ||
                    t.commuteMode === 'EVENING_ONLY'
                      ? 0.5
                      : 1.0;
                  return sum + sctConfig.monthlyFee * multiplier;
                }, 0) * 100,
            ) / 100
          : Math.round(
              freshTimeline
                .filter((t) => t.isSplClass && t.commuteMode !== 'SUSPENDED')
                .reduce((sum, t) => sum + Number(t.feeCharged || 0), 0) * 100,
            ) / 100,
    };
  }

  async syncStudentTimelineFees(studentId: string, academicYear: string) {
    const timelines = await this.prisma.studentTransportTimeline.findMany({
      where: { studentId, academicYear },
    });
    if (timelines.length === 0) return;

    // ── Batch-fetch all routes (with stops) needed for stop-wise fee calculation ──
    const uniqueRouteIds = [...new Set(timelines.map((t) => t.routeId))];
    const routes = await this.prisma.transportRoute.findMany({
      where: { id: { in: uniqueRouteIds } },
      include: { stops: true },
    });
    const routeMap = new Map(routes.map((r) => [r.id, r]));

    // ── Fetch student + fee structure ONCE (eliminates N+1 per spl-class month) ──
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { standard: true },
    });
    const sctConfig = await this.resolveStudentSpecialClassTransportConfig(
      studentId,
      academicYear,
      student?.standard == null ? null : String(student.standard),
    );
    const splFeeRate = sctConfig.monthlyFee;
    const configuredSpecialClassTransportMonths = sctConfig.months;

    let totalTransportFee = 0;
    let specialClassTransportFee = 0;
    let specialClassTransportMonths = 0;

    for (const t of timelines) {
      if (t.commuteMode !== 'SUSPENDED') {
        const baseRoute = routeMap.get(t.routeId);
        let monthlyBase = 0;

        if (baseRoute) {
          let yearlyBase = baseRoute.baseFee;
          if (t.stopId) {
            const stop = baseRoute.stops.find((s) => s.id === t.stopId);
            if (stop && stop.fee != null) {
              yearlyBase = stop.fee;
            }
          }
          monthlyBase = Math.round((yearlyBase / 10) * 100) / 100;
        }

        const multiplier =
          t.commuteMode === 'MORNING_ONLY' || t.commuteMode === 'EVENING_ONLY'
            ? 0.5
            : 1.0;

        if (t.isSplClass) {
          specialClassTransportMonths += multiplier;
          specialClassTransportFee = splFeeRate;
        } else {
          // If not special class, charge the regular route base fee
          totalTransportFee += monthlyBase * multiplier;
        }
      }
    }

    totalTransportFee = Math.round(totalTransportFee * 100) / 100;

    const studentFee = await this.prisma.studentFee.findUnique({
      where: {
        studentId_academicYear: { studentId, academicYear },
      },
    });

    if (studentFee) {
      try {
        await this.feesService.updateStudentFee(studentFee.id, {
          transportFee: totalTransportFee,
          specialClassTransportFee: specialClassTransportFee,
          specialClassTransportMonths: specialClassTransportMonths,
        } as any);
      } catch (err) {
        console.error(
          'Failed to sync student timeline fees via updateStudentFee',
          err,
        );
      }
    }
  }

  // ─── DRIVER ROTATION LOGIC ──────────────────────────────

  async getDriverRotations(routeId: string, academicYear: string) {
    if (!academicYear) {
      throw new BadRequestException('academicYear query param is required');
    }
    const whereClause: any = { academicYear };
    if (routeId) whereClause.routeId = routeId;

    return this.prisma.driverRotation.findMany({
      where: whereClause,
      include: { driver: true, route: true },
      orderBy: { month: 'asc' },
    });
  }

  async updateDriverRotation(dto: any) {
    const { driverId, routeId, academicYear, month, extraPayRate } = dto;
    if (!driverId || !routeId || !academicYear || !month) {
      throw new BadRequestException(
        'driverId, routeId, academicYear, and month are required',
      );
    }

    return this.prisma.driverRotation.upsert({
      where: {
        routeId_academicYear_month: { routeId, academicYear, month },
      },
      update: {
        driverId,
        extraPayRate: extraPayRate || 0,
      },
      create: {
        driverId,
        routeId,
        academicYear,
        month,
        extraPayRate: extraPayRate || 0,
      },
      include: { driver: true, route: true },
    });
  }
}
