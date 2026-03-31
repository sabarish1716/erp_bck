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
        findUnique: jest.fn(),
      },
      studentTransport: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new TransportService(prisma);
  });

  it('returns pending transport students with formatted standard labels', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({ value: { academicYear: '2026-2027' } });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'stu-1',
        name: 'Arun',
        standard: 'STD_10',
        transportMode: 'VAN',
        admission: { admissionNo: 'ADM-1', admissionDate: new Date('2026-04-10T00:00:00.000Z') },
        studentTransport: null,
      },
      {
        id: 'stu-2',
        name: 'Bala',
        standard: 'STD_9',
        transportMode: 'LOCAL',
        admission: { admissionNo: 'ADM-2', admissionDate: new Date('2026-04-11T00:00:00.000Z') },
        studentTransport: null,
      },
      {
        id: 'stu-3',
        name: 'Chitra',
        standard: 'STD_8',
        transportMode: 'VAN',
        admission: { admissionNo: 'ADM-3', admissionDate: new Date('2026-04-12T00:00:00.000Z') },
        studentTransport: { academicYear: '2026-2027', routeId: 'r1', stopId: 's1' },
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
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1', name: 'Arun', standard: 'STD_10' });
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
    ).rejects.toThrow(new ConflictException('Transport is already assigned to this student for the selected academic year'));
  });
});