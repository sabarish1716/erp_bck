import { ConflictException } from '@nestjs/common';
import { TransportService } from './transport.service';

describe('TransportService', () => {
  let service: TransportService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      appSetting: {
        findUnique: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      transportRoute: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      studentTransport: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      bus: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      driver: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      location: {
        findMany: jest.fn(),
      },
      fuelLog: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      vehicleTripLog: {
        count: jest.fn(),
      },
      mileage: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new TransportService(prisma, {
      syncLocation: jest.fn(),
      syncMileage: jest.fn(),
      enqueueDriverStatusSync: jest.fn(),
      getClient: jest.fn(),
    } as any);
  });

  it('returns pending transport students with formatted standard labels', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({
      value: { academicYear: '2026-2027' },
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'stu-1',
        name: 'Arun',
        standard: 'STD_10',
        transportMode: 'VAN',
        admission: {
          admissionNo: 'ADM-1',
          admissionDate: new Date('2026-04-10T00:00:00.000Z'),
        },
        studentTransport: null,
      },
      {
        id: 'stu-2',
        name: 'Bala',
        standard: 'STD_9',
        transportMode: 'LOCAL',
        admission: {
          admissionNo: 'ADM-2',
          admissionDate: new Date('2026-04-11T00:00:00.000Z'),
        },
        studentTransport: null,
      },
      {
        id: 'stu-3',
        name: 'Chitra',
        standard: 'STD_8',
        transportMode: 'VAN',
        admission: {
          admissionNo: 'ADM-3',
          admissionDate: new Date('2026-04-12T00:00:00.000Z'),
        },
        studentTransport: {
          academicYear: '2026-2027',
          routeId: 'r1',
          stopId: 's1',
        },
      },
    ]);

    const result = await service.getPendingTransportStudents();

    expect(result.academicYear).toBe('2026-2027');
    expect(result.total).toBe(1);
    expect(result.students[0]).toEqual(
      expect.objectContaining({
        id: 'stu-1',
        standard: 'STD_10',
        standardLabel: '10th Standard',
      }),
    );
  });

  it('blocks exact duplicate transport assignments with a readable message', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'stu-1',
      name: 'Arun',
      standard: 'STD_10',
    });
    prisma.transportRoute.findUnique.mockResolvedValue({
      id: 'route-1',
      stops: [{ id: 'stop-1', stopName: 'Main Road', stopOrder: 1 }],
    });
    prisma.studentTransport.findUnique.mockResolvedValue({
      studentId: 'stu-1',
      routeId: 'route-1',
      stopId: 'stop-1',
      academicYear: '2026-2027',
      isSplClass: false,
      route: { id: 'route-1' },
      stop: { id: 'stop-1' },
      student: { id: 'stu-1', name: 'Arun', standard: 'STD_10' },
    });

    await expect(
      service.assignStudent({
        studentId: 'stu-1',
        routeId: 'route-1',
        stopId: 'stop-1',
        academicYear: '2026-2027',
        isSplClass: false,
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Transport is already assigned to this student for the selected academic year',
      ),
    );
  });

  it('returns a transport dashboard summary for the active academic year', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({
      value: { academicYear: '2026-2027' },
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'stu-1',
        name: 'Arun',
        standard: 'STD_10',
        transportMode: 'VAN',
        admission: {
          admissionNo: 'ADM-1',
          admissionDate: new Date('2026-04-10T00:00:00.000Z'),
        },
        studentTransport: null,
      },
    ]);
    prisma.transportRoute.count.mockResolvedValue(4);
    prisma.bus.count.mockResolvedValue(7);
    prisma.driver.count.mockResolvedValueOnce(6).mockResolvedValueOnce(5);
    prisma.studentTransport.count.mockResolvedValue(120);
    prisma.location.findMany.mockResolvedValue([
      { busId: 'bus-1' },
      { busId: 'bus-2' },
    ]);
    prisma.fuelLog.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _sum: { litres: 98, totalCost: 8450 },
    });
    prisma.vehicleTripLog.count.mockResolvedValue(14);
    prisma.mileage.count.mockResolvedValue(9);
    prisma.transportRoute.findMany.mockResolvedValue([
      {
        id: 'route-1',
        routeName: 'Route A',
        routeNo: 'A1',
        _count: { stops: 5, buses: 2, students: 48 },
      },
    ]);

    const result = await service.getDashboard();

    expect(result).toEqual({
      academicYear: '2026-2027',
      overview: {
        totalRoutes: 4,
        totalBuses: 7,
        totalDrivers: 6,
        activeDrivers: 5,
        assignedStudents: 120,
        pendingStudents: 1,
        onlineBuses: 2,
      },
      today: {
        fuelLogs: 3,
        fuelLitres: 98,
        fuelCost: 8450,
        tripEvents: 14,
        mileageSnapshots: 9,
      },
      routes: [
        {
          id: 'route-1',
          routeName: 'Route A',
          routeNo: 'A1',
          stopsCount: 5,
          busesCount: 2,
          studentsCount: 48,
        },
      ],
    });
  });

  it('assigns a selected existing driver to a selected bus from the UI payload', async () => {
    prisma.bus.findUnique.mockResolvedValue({
      id: 'bus-1',
      number: 'TN-01-1234',
      route: { id: 'route-1', routeName: 'Route A' },
    });
    prisma.driver.findUnique.mockResolvedValue({
      id: 'driver-1',
      name: 'Mani',
      phone: '9999999999',
      licenseNo: 'LIC-1',
      status: 'ACTIVE',
      busId: null,
    });
    prisma.driver.updateMany.mockResolvedValue({ count: 0 });
    prisma.driver.update.mockResolvedValue({
      id: 'driver-1',
      name: 'Mani',
      phone: '9999999999',
      licenseNo: 'LIC-1',
      status: 'ACTIVE',
      busId: 'bus-1',
      bus: { id: 'bus-1', number: 'TN-01-1234' },
    });

    const result = await service.assignVehicleDriver({
      busId: 'bus-1',
      driverId: 'driver-1',
    });

    expect(prisma.driver.updateMany).toHaveBeenCalledWith({
      where: {
        busId: 'bus-1',
        id: { not: 'driver-1' },
      },
      data: { busId: null },
    });
    expect(prisma.driver.update).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      data: { busId: 'bus-1' },
      include: { bus: true },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'driver-1',
        busId: 'bus-1',
      }),
    );
  });

  it('returns a fuel report for an individual bus', async () => {
    prisma.bus.findUnique.mockResolvedValue({
      id: 'bus-1',
      number: 'TN-01-1234',
      routeName: 'Route A',
      capacity: 50,
      route: { id: 'route-1', routeName: 'Route A' },
      drivers: [
        { id: 'driver-1', name: 'Mani', phone: '9999999999', status: 'ACTIVE' },
      ],
    });
    prisma.fuelLog.findMany.mockResolvedValue([
      {
        id: 'fuel-1',
        busId: 'bus-1',
        odometer: 1000,
        litres: 20,
        totalCost: 2000,
        timestamp: new Date('2026-04-10T08:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
      {
        id: 'fuel-2',
        busId: 'bus-1',
        odometer: 1200,
        litres: 25,
        totalCost: 2600,
        timestamp: new Date('2026-04-10T18:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
    ]);

    const result = await service.getBusFuelReport(
      'bus-1',
      '2026-04-10',
      '2026-04-10',
    );

    expect(result.summary).toEqual({
      fuelEntries: 2,
      totalLitres: 45,
      totalCost: 4600,
      totalDistanceKm: 200,
      totalFuelConsumedLitres: 25,
      averageKmPerLitre: 8,
      lastOdometer: 1200,
    });
    expect(result.bus).toEqual(
      expect.objectContaining({
        id: 'bus-1',
        number: 'TN-01-1234',
      }),
    );
  });

  it('returns a mileage report for an individual bus', async () => {
    prisma.bus.findUnique.mockResolvedValue({
      id: 'bus-1',
      number: 'TN-01-1234',
      routeName: 'Route A',
      capacity: 50,
      route: { id: 'route-1', routeName: 'Route A' },
      drivers: [
        { id: 'driver-1', name: 'Mani', phone: '9999999999', status: 'ACTIVE' },
      ],
    });
    prisma.fuelLog.findMany.mockResolvedValue([
      {
        id: 'fuel-1',
        busId: 'bus-1',
        odometer: 1000,
        litres: 20,
        totalCost: 2000,
        timestamp: new Date('2026-04-10T08:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
      {
        id: 'fuel-2',
        busId: 'bus-1',
        odometer: 1085,
        litres: 10,
        totalCost: 1000,
        timestamp: new Date('2026-04-10T12:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
      {
        id: 'fuel-3',
        busId: 'bus-1',
        odometer: 1150,
        litres: 5,
        totalCost: 500,
        timestamp: new Date('2026-04-10T17:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
    ]);

    const result = await service.getBusMileageReport(
      'bus-1',
      '2026-04-10',
      '2026-04-10',
    );

    expect(result.summary).toEqual({
      fuelEntries: 3,
      mileageSegments: 2,
      totalDistanceKm: 150,
      totalFuelConsumedLitres: 15,
      averageKmPerLitre: 10,
      startOdometer: 1000,
      endOdometer: 1150,
    });
    expect(result.dailyBreakdown).toEqual([
      {
        date: '2026-04-10',
        distanceKm: 150,
        litres: 15,
        averageKmPerLitre: 10,
      },
    ]);
    expect(result.entries).toHaveLength(3);
  });

  it('exports an individual bus fuel report as Excel and PDF', async () => {
    prisma.bus.findUnique.mockResolvedValue({
      id: 'bus-1',
      number: 'TN-01-1234',
      routeName: 'Route A',
      capacity: 50,
      route: { id: 'route-1', routeName: 'Route A' },
      drivers: [
        { id: 'driver-1', name: 'Mani', phone: '9999999999', status: 'ACTIVE' },
      ],
    });
    prisma.fuelLog.findMany.mockResolvedValue([
      {
        id: 'fuel-1',
        busId: 'bus-1',
        odometer: 1000,
        litres: 20,
        totalCost: 2000,
        note: 'Morning fill',
        timestamp: new Date('2026-04-10T08:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
      {
        id: 'fuel-2',
        busId: 'bus-1',
        odometer: 1200,
        litres: 25,
        totalCost: 2600,
        note: 'Evening fill',
        timestamp: new Date('2026-04-10T18:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
    ]);

    const excel = await service.exportBusFuelReportExcel(
      'bus-1',
      '2026-04-10',
      '2026-04-10',
    );
    const pdf = await service.exportBusFuelReportPdf(
      'bus-1',
      '2026-04-10',
      '2026-04-10',
    );

    expect(excel.filename).toBe('tn-01-1234-fuel-report.xlsx');
    expect(excel.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(Buffer.isBuffer(excel.content)).toBe(true);
    expect(excel.content.length).toBeGreaterThan(0);

    expect(pdf.filename).toBe('tn-01-1234-fuel-report.pdf');
    expect(pdf.contentType).toBe('application/pdf');
    expect(Buffer.isBuffer(pdf.content)).toBe(true);
    expect(pdf.content.slice(0, 4).toString()).toBe('%PDF');
  });

  it('exports an individual bus mileage report as Excel and PDF', async () => {
    prisma.bus.findUnique.mockResolvedValue({
      id: 'bus-1',
      number: 'TN-01-1234',
      routeName: 'Route A',
      capacity: 50,
      route: { id: 'route-1', routeName: 'Route A' },
      drivers: [
        { id: 'driver-1', name: 'Mani', phone: '9999999999', status: 'ACTIVE' },
      ],
    });
    prisma.fuelLog.findMany.mockResolvedValue([
      {
        id: 'fuel-1',
        busId: 'bus-1',
        odometer: 1000,
        litres: 20,
        totalCost: 2000,
        timestamp: new Date('2026-04-10T08:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
      {
        id: 'fuel-2',
        busId: 'bus-1',
        odometer: 1085,
        litres: 10,
        totalCost: 1000,
        timestamp: new Date('2026-04-10T12:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
      {
        id: 'fuel-3',
        busId: 'bus-1',
        odometer: 1150,
        litres: 5,
        totalCost: 500,
        timestamp: new Date('2026-04-10T17:00:00.000Z'),
        driver: { id: 'driver-1', name: 'Mani', phone: '9999999999' },
        bus: { id: 'bus-1', number: 'TN-01-1234', routeName: 'Route A' },
      },
    ]);

    const excel = await service.exportBusMileageReportExcel(
      'bus-1',
      '2026-04-10',
      '2026-04-10',
    );
    const pdf = await service.exportBusMileageReportPdf(
      'bus-1',
      '2026-04-10',
      '2026-04-10',
    );

    expect(excel.filename).toBe('tn-01-1234-mileage-report.xlsx');
    expect(excel.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(Buffer.isBuffer(excel.content)).toBe(true);
    expect(excel.content.length).toBeGreaterThan(0);

    expect(pdf.filename).toBe('tn-01-1234-mileage-report.pdf');
    expect(pdf.contentType).toBe('application/pdf');
    expect(Buffer.isBuffer(pdf.content)).toBe(true);
    expect(pdf.content.slice(0, 4).toString()).toBe('%PDF');
  });
});
