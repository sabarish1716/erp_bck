import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Standard, ExamSession } from '@prisma/client';
import { ExamService } from './exam.service';

describe('ExamService', () => {
  let service: ExamService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      exam: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      examSubject: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      examHall: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      examSchedule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      examRollNumber: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      examSeatAllocation: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new ExamService(prisma);
  });

  it('rejects timetable creation when hall overlap exists', async () => {
    prisma.exam.findUnique.mockResolvedValue({ id: 'exam-1' });
    prisma.examSubject.findUnique.mockResolvedValue({
      id: 'sub-1',
      examId: 'exam-1',
    });
    prisma.examSchedule.findMany.mockResolvedValue([
      {
        id: 'sch-1',
        halls: [{ hallId: 'hall-1', hall: { name: 'Hall A' } }],
      },
    ]);

    await expect(
      service.createTimetable({
        examId: 'exam-1',
        subjectId: 'sub-1',
        standard: Standard.STD_10,
        section: 'A',
        examDate: '2027-03-10T00:00:00.000Z',
        startsAt: '2027-03-10T09:30:00.000Z',
        endsAt: '2027-03-10T12:30:00.000Z',
        session: ExamSession.FN,
      }),
    ).rejects.toThrow(
      new BadRequestException('Hall overlap detected for: Hall A'),
    );
  });

  it('generates roll numbers for filtered students', async () => {
    prisma.exam.findUnique.mockResolvedValue({
      id: 'exam-1',
      code: 'ANNUAL-26-27',
      academicYear: '2026-2027',
    });
    prisma.student.findMany.mockResolvedValue([
      { id: 'stu-1', name: 'Arun', admission: { admissionNo: 'ADM-001' } },
      { id: 'stu-2', name: 'Bala', admission: { admissionNo: 'ADM-002' } },
    ]);
    prisma.examRollNumber.upsert
      .mockResolvedValueOnce({ id: 'roll-1' })
      .mockResolvedValueOnce({ id: 'roll-2' });
    prisma.$transaction.mockResolvedValue([{ id: 'roll-1' }, { id: 'roll-2' }]);

    const result = await service.generateRollNumbers('exam-1', {
      standard: Standard.STD_10,
      section: 'A',
      academicYear: '2026-2027',
    });

    expect(prisma.examRollNumber.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        examId: 'exam-1',
        totalStudents: 2,
        prefix: 'ANNUAL-26-27-STD_10-A',
      }),
    );
  });

  it('fails seat allocation when capacity is insufficient', async () => {
    prisma.examSchedule.findUnique.mockResolvedValue({
      id: 'sch-1',
      examId: 'exam-1',
      standard: Standard.STD_10,
      section: 'A',
      stream: null,
      halls: [{ hallId: 'hall-1', hall: { name: 'Hall A', capacity: 1 } }],
    });
    prisma.examRollNumber.findMany.mockResolvedValue([
      { id: 'roll-1', studentId: 'stu-1', rollNumber: 'R-001' },
      { id: 'roll-2', studentId: 'stu-2', rollNumber: 'R-002' },
    ]);

    await expect(
      service.autoAllocateSeats('sch-1', ['hall-1']),
    ).rejects.toThrow(
      new BadRequestException('Insufficient seats. Required 2, available 1'),
    );
  });

  it('creates seat allocations successfully', async () => {
    prisma.examSchedule.findUnique.mockResolvedValue({
      id: 'sch-1',
      examId: 'exam-1',
      standard: Standard.STD_10,
      section: null,
      stream: null,
      halls: [
        { hallId: 'hall-1', hall: { name: 'Hall A', capacity: 2 } },
        { hallId: 'hall-2', hall: { name: 'Hall B', capacity: 2 } },
      ],
    });
    prisma.examRollNumber.findMany.mockResolvedValue([
      { id: 'roll-1', studentId: 'stu-1', rollNumber: 'R-001' },
      { id: 'roll-2', studentId: 'stu-2', rollNumber: 'R-002' },
      { id: 'roll-3', studentId: 'stu-3', rollNumber: 'R-003' },
    ]);
    prisma.examSeatAllocation.deleteMany.mockResolvedValue({ count: 0 });
    prisma.examSeatAllocation.createMany.mockResolvedValue({ count: 3 });
    prisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 3 }]);

    const result = await service.autoAllocateSeats('sch-1', [
      'hall-1',
      'hall-2',
    ]);

    expect(prisma.examSeatAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          scheduleId: 'sch-1',
          hallId: 'hall-1',
          studentId: 'stu-1',
          rollNumberId: 'roll-1',
          seatNumber: 1,
        },
        {
          scheduleId: 'sch-1',
          hallId: 'hall-1',
          studentId: 'stu-2',
          rollNumberId: 'roll-2',
          seatNumber: 2,
        },
        {
          scheduleId: 'sch-1',
          hallId: 'hall-2',
          studentId: 'stu-3',
          rollNumberId: 'roll-3',
          seatNumber: 1,
        },
      ],
    });
    expect(result).toEqual(
      expect.objectContaining({
        scheduleId: 'sch-1',
        totalAllocated: 3,
        totalCapacity: 4,
        unallocated: 0,
      }),
    );
  });

  it('throws not found when exam does not exist', async () => {
    prisma.exam.findUnique.mockResolvedValue(null);
    await expect(service.getTimetable('missing-exam')).rejects.toThrow(
      new NotFoundException('Exam not found'),
    );
  });
});
