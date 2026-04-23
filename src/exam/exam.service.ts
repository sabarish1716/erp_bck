import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignInvigilatorDto,
  CreateExamDto,
  CreateExamHallDto,
  CreateExamScheduleDto,
  CreateExamSubjectDto,
  GenerateRollNumbersDto,
} from './dto/exam.dto';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  async createExam(dto: CreateExamDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    return this.prisma.exam.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        academicYear: dto.academicYear.trim(),
        startDate,
        endDate,
      },
    });
  }

  async getExams(academicYear?: string) {
    return this.prisma.exam.findMany({
      where: academicYear ? { academicYear } : undefined,
      orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
    });
  }

  async createSubject(dto: CreateExamSubjectDto) {
    await this.ensureExamExists(dto.examId);
    return this.prisma.examSubject.create({
      data: {
        examId: dto.examId,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        standard: dto.standard,
        section: dto.section?.trim(),
        stream: dto.stream,
        maxMarks: dto.maxMarks ?? 100,
        passMarks: dto.passMarks ?? 35,
      },
    });
  }

  async getSubjects(examId: string) {
    await this.ensureExamExists(examId);
    return this.prisma.examSubject.findMany({
      where: { examId },
      orderBy: [{ standard: 'asc' }, { section: 'asc' }, { code: 'asc' }],
    });
  }

  async createHall(dto: CreateExamHallDto) {
    return this.prisma.examHall.create({
      data: {
        name: dto.name.trim(),
        building: dto.building?.trim(),
        floor: dto.floor?.trim(),
        capacity: dto.capacity,
      },
    });
  }

  async getHalls() {
    return this.prisma.examHall.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createTimetable(dto: CreateExamScheduleDto) {
    if (!dto.hallIds?.length) {
      throw new BadRequestException('At least one hall is required for a timetable entry');
    }

    await this.ensureExamExists(dto.examId);

    const subject = await this.prisma.examSubject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject || subject.examId !== dto.examId) {
      throw new BadRequestException('Invalid subject for the selected exam');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const examDate = new Date(dto.examDate);

    if (startsAt >= endsAt) {
      throw new BadRequestException('startsAt must be before endsAt');
    }

    await this.ensureNoHallOverlap(dto.hallIds, examDate, startsAt, endsAt);
    await this.ensureNoClassOverlap(dto.standard, dto.section, dto.stream, examDate, startsAt, endsAt);

    const halls = await this.prisma.examHall.findMany({
      where: { id: { in: dto.hallIds }, isActive: true },
      select: { id: true },
    });

    if (halls.length !== new Set(dto.hallIds).size) {
      throw new BadRequestException('One or more hall IDs are invalid or inactive');
    }

    return this.prisma.examSchedule.create({
      data: {
        examId: dto.examId,
        subjectId: dto.subjectId,
        standard: dto.standard,
        section: dto.section?.trim(),
        stream: dto.stream,
        examDate,
        startsAt,
        endsAt,
        session: dto.session,
        halls: {
          create: halls.map((h) => ({ hallId: h.id })),
        },
      },
      include: {
        subject: true,
        halls: { include: { hall: true } },
      },
    });
  }

  async getTimetable(examId: string) {
    await this.ensureExamExists(examId);
    return this.prisma.examSchedule.findMany({
      where: { examId },
      include: {
        subject: true,
        halls: { include: { hall: true } },
      },
      orderBy: [{ examDate: 'asc' }, { startsAt: 'asc' }],
    });
  }

  async generateRollNumbers(examId: string, dto: GenerateRollNumbersDto) {
    const exam = await this.ensureExamExists(examId);
    const academicYear = dto.academicYear ?? exam.academicYear;

    const students = await this.prisma.student.findMany({
      where: {
        standard: dto.standard,
        section: dto.section,
        academicYear,
        ...(dto.stream ? { academicStream: dto.stream } : {}),
      },
      include: { admission: { select: { admissionNo: true } } },
    });

    if (!students.length) {
      throw new BadRequestException('No students found for the selected filters');
    }

    students.sort((a, b) => {
      const aKey = a.admission?.admissionNo || a.name;
      const bKey = b.admission?.admissionNo || b.name;
      return aKey.localeCompare(bKey);
    });

    const prefixParts = [exam.code, dto.standard, dto.section].filter(Boolean);
    const prefix = prefixParts.join('-');

    const upserts = students.map((student, idx) => {
      const rollNumber = `${prefix}-${String(idx + 1).padStart(3, '0')}`;
      return this.prisma.examRollNumber.upsert({
        where: {
          examId_studentId: {
            examId,
            studentId: student.id,
          },
        },
        update: {
          rollNumber,
          standard: dto.standard,
          section: dto.section,
          stream: dto.stream,
          academicYear,
        },
        create: {
          examId,
          studentId: student.id,
          rollNumber,
          standard: dto.standard,
          section: dto.section,
          stream: dto.stream,
          academicYear,
        },
      });
    });

    await this.prisma.$transaction(upserts);

    return {
      message: 'Roll numbers generated successfully',
      examId,
      totalStudents: students.length,
      prefix,
    };
  }

  async getRollNumbers(examId: string) {
    await this.ensureExamExists(examId);
    return this.prisma.examRollNumber.findMany({
      where: { examId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            standard: true,
            section: true,
            academicYear: true,
          },
        },
      },
      orderBy: [{ standard: 'asc' }, { section: 'asc' }, { rollNumber: 'asc' }],
    });
  }

  async autoAllocateSeats(scheduleId: string) {
    const schedule = await this.prisma.examSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        exam: true,
        halls: { include: { hall: true } },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (!schedule.halls.length) {
      throw new BadRequestException('No halls mapped to this schedule');
    }

    const rollNumbers = await this.prisma.examRollNumber.findMany({
      where: {
        examId: schedule.examId,
        standard: schedule.standard,
        section: schedule.section,
        stream: schedule.stream ?? undefined,
      },
      orderBy: { rollNumber: 'asc' },
    });

    if (!rollNumbers.length) {
      throw new BadRequestException('No roll numbers generated for this schedule filters');
    }

    const totalCapacity = schedule.halls.reduce((sum, h) => sum + h.hall.capacity, 0);
    if (rollNumbers.length > totalCapacity) {
      throw new BadRequestException(`Insufficient seats. Required ${rollNumbers.length}, available ${totalCapacity}`);
    }

    const allocationRows: {
      scheduleId: string;
      hallId: string;
      studentId: string;
      rollNumberId: string;
      seatNumber: number;
    }[] = [];

    let cursor = 0;
    for (const sh of schedule.halls) {
      for (let seatNumber = 1; seatNumber <= sh.hall.capacity && cursor < rollNumbers.length; seatNumber += 1) {
        const roll = rollNumbers[cursor];
        allocationRows.push({
          scheduleId,
          hallId: sh.hallId,
          studentId: roll.studentId,
          rollNumberId: roll.id,
          seatNumber,
        });
        cursor += 1;
      }
    }

    await this.prisma.$transaction([
      this.prisma.examSeatAllocation.deleteMany({ where: { scheduleId } }),
      this.prisma.examSeatAllocation.createMany({ data: allocationRows }),
    ]);

    return {
      message: 'Seat allocation completed',
      scheduleId,
      totalAllocated: allocationRows.length,
      totalCapacity,
      unallocated: rollNumbers.length - allocationRows.length,
    };
  }

  async getSeatAllocations(scheduleId: string) {
    return this.prisma.examSeatAllocation.findMany({
      where: { scheduleId },
      include: {
        hall: true,
        student: { select: { id: true, name: true, standard: true, section: true } },
        rollNumber: { select: { rollNumber: true } },
      },
      orderBy: [{ hall: { name: 'asc' } }, { seatNumber: 'asc' }],
    });
  }

  async getInvigilatorCandidates() {
    return this.prisma.staff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        employeeId: true,
        name: true,
        designation: true,
        department: true,
      },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });
  }

  async getInvigilatorAssignments(scheduleId: string) {
    return this.prisma.examInvigilatorAssignment.findMany({
      where: { scheduleId },
      include: {
        hall: { select: { id: true, name: true } },
        staff: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            designation: true,
            department: true,
          },
        },
      },
      orderBy: [{ hall: { name: 'asc' } }],
    });
  }

  async assignInvigilator(scheduleId: string, dto: AssignInvigilatorDto) {
    const schedule = await this.prisma.examSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        halls: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const hallMapped = schedule.halls.some((h) => h.hallId === dto.hallId);
    if (!hallMapped) {
      throw new BadRequestException('Selected hall is not mapped to this schedule');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      select: { id: true, isActive: true },
    });
    if (!staff || !staff.isActive) {
      throw new BadRequestException('Selected invigilator is invalid or inactive');
    }

    const overlappingAssignment = await this.prisma.examInvigilatorAssignment.findFirst({
      where: {
        staffId: dto.staffId,
        schedule: {
          id: { not: scheduleId },
          examDate: schedule.examDate,
          startsAt: { lt: schedule.endsAt },
          endsAt: { gt: schedule.startsAt },
        },
      },
      include: {
        schedule: {
          include: {
            subject: { select: { name: true, code: true } },
          },
        },
        hall: { select: { name: true } },
      },
    });

    if (overlappingAssignment) {
      throw new BadRequestException(
        `Invigilator already assigned to overlapping slot (${overlappingAssignment.hall.name} - ${overlappingAssignment.schedule.subject.code})`,
      );
    }

    return this.prisma.examInvigilatorAssignment.upsert({
      where: {
        scheduleId_hallId: {
          scheduleId,
          hallId: dto.hallId,
        },
      },
      update: {
        staffId: dto.staffId,
      },
      create: {
        scheduleId,
        hallId: dto.hallId,
        staffId: dto.staffId,
      },
      include: {
        hall: { select: { id: true, name: true } },
        staff: { select: { id: true, employeeId: true, name: true } },
      },
    });
  }

  private async ensureExamExists(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  private async ensureNoHallOverlap(hallIds: string[], examDate: Date, startsAt: Date, endsAt: Date) {
    const overlaps = await this.prisma.examSchedule.findMany({
      where: {
        examDate,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        halls: {
          some: {
            hallId: { in: hallIds },
          },
        },
      },
      include: {
        halls: { include: { hall: true } },
      },
    });

    if (overlaps.length) {
      const hallNames = new Set<string>();
      overlaps.forEach((s) => {
        s.halls.forEach((h) => {
          if (hallIds.includes(h.hallId)) hallNames.add(h.hall.name);
        });
      });
      throw new BadRequestException(`Hall overlap detected for: ${Array.from(hallNames).join(', ')}`);
    }
  }

  private async ensureNoClassOverlap(
    standard: any,
    section: string | undefined,
    stream: any,
    examDate: Date,
    startsAt: Date,
    endsAt: Date,
  ) {
    const clash = await this.prisma.examSchedule.findFirst({
      where: {
        standard,
        section: section ?? null,
        stream: stream ?? null,
        examDate,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });

    if (clash) {
      throw new BadRequestException('Class timetable overlap detected for this standard/section/stream');
    }
  }
}
