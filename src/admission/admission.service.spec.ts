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

  it('updates admin settings to the next academic year during promotion', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({ value: { academicYear: '2025-2026', schoolCode: 'PSF' } });
    prisma.student.findMany.mockResolvedValue([{ id: 'stu-1', name: 'A', standard: 'STD_9' }]);
    prisma.student.updateMany.mockResolvedValue({ count: 1 });
    prisma.admission.updateMany.mockResolvedValue({ count: 1 });
    prisma.appSetting.upsert.mockResolvedValue({ value: { academicYear: '2026-2027' } });

    const result = await service.promoteStudents('9', '10', '2025-2026');

    expect(prisma.student.updateMany).toHaveBeenCalled();
    expect(prisma.admission.updateMany).toHaveBeenCalled();
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          value: expect.objectContaining({ academicYear: '2026-2027' }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        academicYear: '2025-2026',
        newAcademicYear: '2026-2027',
        updatedCount: 1,
      }),
    );
  });

  it('demotes students and updates admin settings to previous academic year', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({ value: { academicYear: '2026-2027', schoolCode: 'PSF' } });
    prisma.student.findMany.mockResolvedValue([{ id: 'stu-9', name: 'B', standard: 'STD_10' }]);
    prisma.student.updateMany.mockResolvedValue({ count: 1 });
    prisma.admission.updateMany.mockResolvedValue({ count: 1 });
    prisma.appSetting.upsert.mockResolvedValue({ value: { academicYear: '2025-2026' } });

    const result = await service.demoteStudents('10', '9', '2026-2027');

    expect(prisma.student.updateMany).toHaveBeenCalled();
    expect(prisma.admission.updateMany).toHaveBeenCalled();
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          value: expect.objectContaining({ academicYear: '2025-2026' }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        academicYear: '2026-2027',
        newAcademicYear: '2025-2026',
        updatedCount: 1,
      }),
    );
  });
});