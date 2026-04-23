import { AdmissionService } from './admission.service';

describe('AdmissionService', () => {
  let service: AdmissionService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      appSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      admission: {
        count: jest.fn(),
        groupBy: jest.fn(),
        updateMany: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
        update: jest.fn(),
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
    prisma.admission.groupBy
      .mockResolvedValueOnce([{ standard: 'STD_10', _count: { _all: 120 } }])
      .mockResolvedValueOnce([{ standard: 'STD_10', _count: { _all: 80 } }]);

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

    const result = await service.promoteAllStudents('2025-2026', '2026-2027');

    expect(prisma.student.findMany).toHaveBeenCalledWith({ where: { academicYear: '2025-2026' } });
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
});