import { AdmissionService } from './admission.service';
import { BadRequestException } from '@nestjs/common';

describe('AdmissionService', () => {
  let service: AdmissionService;
  let academicStreamService: any;
  let prisma: any;

  beforeEach(() => {
    academicStreamService = {
      resolveStreamId: jest.fn(),
    };
    prisma = {
      appSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      admission: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      feeStructure: {
        findMany: jest.fn(),
      },
      studentFee: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      studentTransport: {
        updateMany: jest.fn(),
      },
    };

    service = new AdmissionService(prisma);
  });


  it('returns year comparison and milestone data for dashboard summary', async () => {
    prisma.appSetting.findUnique
      .mockResolvedValueOnce({ value: { academicYear: '2026-2027' } })
      .mockResolvedValueOnce({ value: { STD_10: 100 } });
    prisma.admission.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(100);
    prisma.admission.findMany
      .mockResolvedValueOnce([{ studentId: 'stu-1' }])
      .mockResolvedValueOnce([]);
    prisma.admission.groupBy
      .mockResolvedValueOnce([{ standard: 'STD_10', _count: { _all: 120 } }])
      .mockResolvedValueOnce([{ standard: 'STD_10', _count: { _all: 80 } }]);
    prisma.student.count.mockResolvedValue(0);

    const result = await service.getAdmissionDashboard();

    expect(result.academicYear).toBe('2026-2027');
    expect(result.yearComparison).toEqual(
      expect.objectContaining({
        previousAcademicYear: '2025-2026',
        currentTotal: 120,
        previousTotal: 100,
        difference: 20,
        percentageChange: 20,
        trend: 'up',
      }),
    );
    expect(result.admissionProgress).toEqual(
      expect.objectContaining({
        basis: 'approved_vs_total_seats',
        totalTarget: 100,
        currentCount: 80,
        progressPercent: 80,
      }),
    );
    expect(result.upcomingMilestones).toEqual([
      expect.objectContaining({ threshold: 100, targetCount: 100, remainingCount: 20, achieved: false }),
    ]);
  });

  it('promotes all students to next standards for the new academic year', async () => {
    prisma.student.findMany.mockResolvedValue([{ id: 'stu-1', name: 'A', standard: 'STD_9' }]);
    prisma.student.update.mockResolvedValue({ id: 'stu-1', standard: 'STD_10', academicYear: '2026-2027' });
    prisma.feeStructure.findMany
      .mockResolvedValueOnce([
        {
          standard: 'STD_10',
          tuitionFee: 10000,
          transportFee: 0,
          bookFee: 0,
          hostelFee: 0,
          otherFee: 0,
          numberOfTerms: 1,
          customItems: [],
          terms: [],
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.studentFee.findMany.mockResolvedValue([]);
    prisma.studentFee.findFirst.mockResolvedValue(null);
    prisma.studentFee.create.mockResolvedValue({ id: 'fee-1' });
    prisma.studentTransport.updateMany.mockResolvedValue({ count: 1 });
    prisma.admission.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.promoteAllStudents('2025-2026', '2026-2027');

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { academicYear: '2025-2026' } }),
    );
    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stu-1' },
        data: expect.objectContaining({ standard: 'STD_10', academicYear: '2026-2027' }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        newAcademicYear: '2026-2027',
        updatedCount: 1,
      }),
    );
  });

  it('demotes all students to previous standards for the new academic year', async () => {
    prisma.student.findMany.mockResolvedValue([{ id: 'stu-9', name: 'B', standard: 'STD_10' }]);
    prisma.student.update.mockResolvedValue({ id: 'stu-9', standard: 'STD_9', academicYear: '2025-2026' });

    const result = await service.demoteAllStudents('2026-2027', '2025-2026');

    expect(prisma.student.findMany).toHaveBeenCalledWith({ where: { academicYear: '2026-2027' } });
    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stu-9' },
        data: expect.objectContaining({ standard: 'STD_9', academicYear: '2025-2026' }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        newAcademicYear: '2025-2026',
        updatedCount: 1,
      }),
    );
  });

  it('returns a bulk upload template with expected headers', () => {
    const csv = service.getBulkUploadTemplateCsv();
    const [headerLine, sampleLine] = csv.split('\n');

    expect(headerLine).toContain('Student Name');
    expect(headerLine).toContain('Academic Year');
    expect(headerLine).toContain('Admission Date');
    expect(headerLine).toContain('Admission Number');
    expect(sampleLine).toContain('Arun Kumar');
  });

  it('rejects bulk upload rows that include non-application columns', async () => {
    await expect(
      service.bulkCreateFromCsv([
        {
          employeeId: 'EMP-1',
          salary: '25000',
        },
      ]),
    ).rejects.toThrow(BadRequestException);
  });
});