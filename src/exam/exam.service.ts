import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PeriodType, Standard } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignInvigilatorDto,
  AutoGenerateFullTimetableDto,
  AutoGeneratePeriodsDto,
  CreateExamDto,
  CreateExamHallDto,
  CreateExamScheduleDto,
  CreateExamSubjectDto,
  GenerateRollNumbersDto,
  UpdateExamScheduleCellDto,
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

    if (dto.teacherId) {
      const teacher = await this.prisma.staff.findUnique({
        where: { id: dto.teacherId },
        select: { id: true, isActive: true },
      });
      if (!teacher || !teacher.isActive) {
        throw new BadRequestException('Assigned teacher is invalid or inactive');
      }
    }

    return this.prisma.examSubject.create({
      data: {
        exam: { connect: { id: dto.examId } },
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        standard: dto.standard,
        section: dto.section?.trim(),
        stream: dto.academicStreamId ? { connect: { id: dto.academicStreamId } } : undefined,

        maxMarks: dto.maxMarks ?? 100,
        passMarks: dto.passMarks ?? 35,
        teacher: dto.teacherId ? { connect: { id: dto.teacherId } } : undefined,

      },
      include: {
        teacher: {
          select: { id: true, name: true, employeeId: true, designation: true, department: true },
        },
      },
    });
  }

  async getSubjects(examId: string) {
    await this.ensureExamExists(examId);
    return this.prisma.examSubject.findMany({
      where: { examId },
      include: {
        teacher: {
          select: { id: true, name: true, employeeId: true, designation: true, department: true },
        },
      },
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

    if (dto.periodStart !== undefined && dto.periodEnd !== undefined) {
      if (dto.periodStart > dto.periodEnd) {
        throw new BadRequestException('periodStart must be less than or equal to periodEnd');
      }
    }

    await this.ensureNoHallOverlap(dto.hallIds, examDate, startsAt, endsAt);
    await this.ensureNoClassOverlap(dto.standard, dto.section, dto.academicStreamId, examDate, startsAt, endsAt);


    // Teacher clash check: if the subject has an assigned teacher, ensure they are not
    // already teaching another subject/class at the same date + overlapping time slot.
    if (subject.teacherId) {
      await this.ensureNoTeacherClash(subject.teacherId, examDate, startsAt, endsAt, undefined);
    }

    const halls = await this.prisma.examHall.findMany({
      where: { id: { in: dto.hallIds }, isActive: true },
      select: { id: true },
    });

    if (halls.length !== new Set(dto.hallIds).size) {
      throw new BadRequestException('One or more hall IDs are invalid or inactive');
    }

    return this.prisma.examSchedule.create({
      data: {
        exam: { connect: { id: dto.examId } },
        subject: { connect: { id: dto.subjectId } },
        standard: dto.standard,
        section: dto.section?.trim(),
        stream: dto.academicStreamId ? { connect: { id: dto.academicStreamId } } : undefined,

        examDate,
        startsAt,
        endsAt,
        session: dto.session,
        periodStart: dto.periodStart ?? null,
        periodEnd: dto.periodEnd ?? null,
        periodType: dto.periodType ?? null,

        halls: {
          create: halls.map((h) => ({ hallId: h.id })),
        },
      },
      include: {
        subject: {
          include: {
            teacher: {
              select: { id: true, name: true, employeeId: true, designation: true, department: true },
            },
          },
        },
        halls: { include: { hall: true } },
      },
    });
  }

  async getTimetable(examId: string) {
    await this.ensureExamExists(examId);
    return this.prisma.examSchedule.findMany({
      where: { examId },
      include: {
        subject: {
          include: {
            teacher: {
              select: { id: true, name: true, employeeId: true, designation: true, department: true },
            },
          },
        },
        halls: { include: { hall: true } },
      },
      orderBy: [{ examDate: 'asc' }, { periodStart: 'asc' }, { startsAt: 'asc' }],
    });
  }

  /** Class-wise timetable: all schedule entries for a given class/section across the exam */
  async getClassTimetable(examId: string, standard: Standard, section?: string) {
    await this.ensureExamExists(examId);
    const entries = await this.prisma.examSchedule.findMany({
      where: {
        examId,
        standard,
        ...(section ? { section } : {}),
      },
      include: {
        subject: {
          include: {
            teacher: {
              select: { id: true, name: true, employeeId: true, designation: true, department: true },
            },
          },
        },
        halls: { include: { hall: true } },
      },
      orderBy: [{ examDate: 'asc' }, { periodStart: 'asc' }, { startsAt: 'asc' }],
    });

    const byDate = new Map<string, Array<{ period: number; subject: string; teacher: string | null; type: PeriodType | null; scheduleId: string }>>();
    for (const e of entries) {
      const key = e.examDate.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push({
        period: e.periodStart ?? 0,
        subject: e.subject.name,
        teacher: e.subject.teacher?.name ?? null,
        type: e.periodType ?? null,
        scheduleId: e.id,
      });
    }

    return {
      examId,
      standard,
      section: section ?? null,
      days: Array.from(byDate.entries()).map(([date, periods]) => ({
        date,
        periods: periods.sort((a, b) => a.period - b.period),
      })),
    };
  }

  /** Teacher-wise timetable: all schedule entries where the subject's teacher is the given staff */
  async getTeacherTimetable(examId: string, staffId: string) {
    await this.ensureExamExists(examId);

    const teacher = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, employeeId: true, designation: true, department: true },
    });
    if (!teacher) throw new NotFoundException('Teacher (staff) not found');

    const entries = await this.prisma.examSchedule.findMany({
      where: {
        examId,
        subject: { teacherId: staffId },
      },
      include: {
        subject: {
          include: {
            teacher: {
              select: { id: true, name: true, employeeId: true, designation: true, department: true },
            },
          },
        },
        halls: { include: { hall: true } },
      },
      orderBy: [{ examDate: 'asc' }, { periodStart: 'asc' }, { startsAt: 'asc' }],
    });

    const byDate = new Map<string, Array<{ period: number; subject: string; standard: Standard; section: string | null; type: PeriodType | null; scheduleId: string }>>();
    for (const e of entries) {
      const key = e.examDate.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push({
        period: e.periodStart ?? 0,
        subject: e.subject.name,
        standard: e.standard,
        section: e.section ?? null,
        type: e.periodType ?? null,
        scheduleId: e.id,
      });
    }

    return {
      examId,
      teacher,
      days: Array.from(byDate.entries()).map(([date, periods]) => ({
        date,
        periods: periods.sort((a, b) => a.period - b.period),
      })),
    };
  }

  /**
   * Auto-generate period blocks for a subject on the exam date based on marks pattern.
   * 25 marks  → same day: periods 1–2 REVISION, 3–4 EXAMINATION
   * 50 marks  → same day: periods 1–4 REVISION, 5–8 EXAMINATION
   * 100 marks → revisionDate (all 8 periods REVISION) + examDate (1–4 REVISION, 5–8 EXAMINATION)
   * Class-wise override: STD_1/3/5 → 1–4 REVISION, 5–8 EXAM (default)
   *                      STD_2/4/6+ / LKG/UKG → 1–4 EXAM, 5–8 REVISION
   */
  async autoGeneratePeriods(examId: string, dto: AutoGeneratePeriodsDto) {
    await this.ensureExamExists(examId);

    const subject = await this.prisma.examSubject.findUnique({ where: { id: dto.subjectId } });
    if (!subject || subject.examId !== examId) {
      throw new BadRequestException('Invalid subject for the selected exam');
    }

    const halls = await this.prisma.examHall.findMany({
      where: { id: { in: dto.hallIds }, isActive: true },
      select: { id: true },
    });
    if (halls.length !== new Set(dto.hallIds).size) {
      throw new BadRequestException('One or more hall IDs are invalid or inactive');
    }

    const examDate = new Date(dto.examDate);

    // Determine class group for period-split override
    const classGroupSwapped = this.isSwappedClassGroup(dto.standard);

    const periodsToCreate: {
      date: Date;
      periodStart: number;
      periodEnd: number;
      periodType: PeriodType;
    }[] = [];

    if (dto.marks <= 25) {
      // Same day: 1-2 revision, 3-4 exam
      periodsToCreate.push(
        { date: examDate, periodStart: 1, periodEnd: 2, periodType: PeriodType.REVISION },
        { date: examDate, periodStart: 3, periodEnd: 4, periodType: PeriodType.EXAMINATION },
      );
    } else if (dto.marks <= 50) {
      if (classGroupSwapped) {
        // 1-4 EXAM, 5-8 REVISION
        periodsToCreate.push(
          { date: examDate, periodStart: 1, periodEnd: 4, periodType: PeriodType.EXAMINATION },
          { date: examDate, periodStart: 5, periodEnd: 8, periodType: PeriodType.REVISION },
        );
      } else {
        // 1-4 REVISION, 5-8 EXAM
        periodsToCreate.push(
          { date: examDate, periodStart: 1, periodEnd: 4, periodType: PeriodType.REVISION },
          { date: examDate, periodStart: 5, periodEnd: 8, periodType: PeriodType.EXAMINATION },
        );
      }
    } else {
      // 100+ marks
      if (!dto.revisionDate) {
        throw new BadRequestException('revisionDate is required for 100-mark exams');
      }
      const revisionDate = new Date(dto.revisionDate);
      // Previous day: all 8 periods REVISION
      periodsToCreate.push(
        { date: revisionDate, periodStart: 1, periodEnd: 8, periodType: PeriodType.REVISION },
      );
      if (classGroupSwapped) {
        // Exam day: 1-4 EXAM, 5-8 REVISION
        periodsToCreate.push(
          { date: examDate, periodStart: 1, periodEnd: 4, periodType: PeriodType.EXAMINATION },
          { date: examDate, periodStart: 5, periodEnd: 8, periodType: PeriodType.REVISION },
        );
      } else {
        // Exam day: 1-4 REVISION, 5-8 EXAM
        periodsToCreate.push(
          { date: examDate, periodStart: 1, periodEnd: 4, periodType: PeriodType.REVISION },
          { date: examDate, periodStart: 5, periodEnd: 8, periodType: PeriodType.EXAMINATION },
        );
      }
    }

    const created: any[] = [];
    for (const p of periodsToCreate) {
      // Use midnight as the anchor time for period-based entries
      const dayStart = new Date(p.date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(p.date);
      dayEnd.setUTCHours(23, 59, 59, 999);

      await this.ensureNoHallOverlapForPeriod(dto.hallIds, p.date, p.periodStart, p.periodEnd);
      await this.ensureNoClassOverlapForPeriod(dto.standard, dto.section, dto.academicStreamId, p.date, p.periodStart, p.periodEnd);

      if (subject.teacherId) {
        await this.ensureNoTeacherClash(subject.teacherId, p.date, dayStart, dayEnd, undefined, p.periodStart, p.periodEnd);
      }

      const entry = await this.prisma.examSchedule.create({
        data: {
          exam: { connect: { id: examId } },
          subject: { connect: { id: dto.subjectId } },
          standard: dto.standard,
          section: dto.section?.trim(),
          stream: dto.academicStreamId ? { connect: { id: dto.academicStreamId } } : undefined,

          examDate: p.date,
          startsAt: dayStart,
          endsAt: dayEnd,
          session: dto.session,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          periodType: p.periodType,

          halls: {
            create: halls.map((h) => ({ hallId: h.id })),
          },
        },
        include: {
          subject: {
            include: {
              teacher: {
                select: { id: true, name: true, employeeId: true, designation: true, department: true },
              },
            },
          },
          halls: { include: { hall: true } },
        },
      });
      created.push(entry);
    }

    return {
      message: 'Period blocks generated successfully',
      totalBlocks: created.length,
      schedules: created,
    };
  }

  async autoGenerateFullTimetable(examId: string, data: AutoGenerateFullTimetableDto) {
    await this.ensureExamExists(examId);

    if (!data.hallIds?.length) {
      throw new BadRequestException('At least one hall is required');
    }

    const halls = await this.prisma.examHall.findMany({
      where: { id: { in: data.hallIds }, isActive: true },
      select: { id: true },
    });
    if (halls.length !== new Set(data.hallIds ?? []).size) {
      throw new BadRequestException('One or more hall IDs are invalid or inactive');
    }

    const subjects = await this.prisma.examSubject.findMany({
      where: {
        examId,
        standard: data.standard,
        section: data.section,
        ...(data.academicStreamId ? { academicStreamId: data.academicStreamId } : {}),


      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });

    if (!subjects.length) {
      throw new BadRequestException('No subjects found');
    }

    let currentDate = new Date(data.startDate);
    if (Number.isNaN(currentDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }

    const pattern = this.getPattern(data.marks, data.standard);
    if (pattern.length !== 8) {
      throw new BadRequestException('Unable to derive period pattern for provided marks/standard');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.examSchedule.deleteMany({
        where: {
          examId,
          standard: data.standard,
          section: data.section ?? null,
          academicStreamId: data.academicStreamId ?? null,


        },
      });

      const inserted: any[] = [];
      for (const subject of subjects) {
        if (!subject.teacherId) {
          throw new BadRequestException(`Teacher not assigned for ${subject.name}`);
        }

        for (let i = 0; i < pattern.length; i++) {
          const type = pattern[i];
          if (type === 'F') continue;

          const startHour = 9 + i;
          const startsAt = new Date(currentDate);
          startsAt.setHours(startHour, 0, 0, 0);
          const endsAt = new Date(currentDate);
          endsAt.setHours(startHour + 1, 0, 0, 0);

          await this.validateClashes({
            prisma: tx,
            hallIds: data.hallIds,
            standard: data.standard,
            section: data.section,
            academicStreamId: data.academicStreamId,


            examDate: new Date(currentDate),
            startsAt,
            endsAt,
            teacherId: subject.teacherId,
            periodStart: i + 1,
            periodEnd: i + 1,
          });

          const entry = await tx.examSchedule.create({
            data: {
              exam: { connect: { id: examId } },
              subject: { connect: { id: subject.id } },
              standard: data.standard,
              section: data.section,
              stream: data.academicStreamId ? { connect: { id: data.academicStreamId } } : undefined,

              examDate: new Date(currentDate),
              startsAt,
              endsAt,
              session: i < 4 ? 'FN' : 'AN',
              periodStart: i + 1,
              periodEnd: i + 1,
              periodType: type === 'R' ? PeriodType.REVISION : PeriodType.EXAMINATION,

              halls: {
                create: halls.map((h) => ({ hallId: h.id })),
              },
            },
            include: {
              subject: {
                include: {
                  teacher: {
                    select: { id: true, name: true, employeeId: true, designation: true, department: true },
                  },
                },
              },
              halls: { include: { hall: true } },
            },
          });
          inserted.push(entry);
        }

        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        currentDate = nextDate;
      }

      return inserted;
    });

    return {
      message: 'Full timetable generated successfully',
      totalSubjects: subjects.length,
      totalBlocks: created.length,
      schedules: created,
    };
  }

  async updateScheduleCell(scheduleId: string, dto: UpdateExamScheduleCellDto) {
    const schedule = await this.prisma.examSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        subject: true,
        halls: true,
      },
    });
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const subjectId = dto.subjectId ?? schedule.subjectId;
    const subject = await this.prisma.examSubject.findUnique({ where: { id: subjectId } });
    if (!subject || subject.examId !== schedule.examId) {
      throw new BadRequestException('Invalid subject for this exam');
    }

    if (dto.teacherId) {
      const teacher = await this.prisma.staff.findUnique({
        where: { id: dto.teacherId },
        select: { id: true, isActive: true },
      });
      if (!teacher || !teacher.isActive) {
        throw new BadRequestException('Assigned teacher is invalid or inactive');
      }
    }

    const teacherId = dto.teacherId ?? subject.teacherId ?? undefined;
    await this.validateClashes({
      hallIds: schedule.halls.map((h) => h.hallId),
      standard: schedule.standard,
      section: schedule.section ?? undefined,
      academicStreamId: schedule.academicStreamId ?? undefined,

      examDate: schedule.examDate,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      teacherId,
      excludeScheduleId: scheduleId,
      periodStart: schedule.periodStart ?? undefined,
      periodEnd: schedule.periodEnd ?? undefined,
    });

    return this.prisma.$transaction(async (tx) => {
      if (dto.teacherId) {
        await tx.examSubject.update({
          where: { id: subjectId },
          data: { teacherId: dto.teacherId },
        });
      }

      return tx.examSchedule.update({
        where: { id: scheduleId },
        data: {
          subjectId,
          periodType: dto.periodType ?? schedule.periodType,
        },
        include: {
          subject: {
            include: {
              teacher: {
                select: { id: true, name: true, employeeId: true, designation: true, department: true },
              },
            },
          },
          halls: { include: { hall: true } },
        },
      });
    });
  }

  async resetTimetable(examId: string) {
    await this.ensureExamExists(examId);
    const deleted = await this.prisma.examSchedule.deleteMany({ where: { examId } });
    return {
      message: 'Timetable reset successfully',
      examId,
      deletedSchedules: deleted.count,
    };
  }

  /** Returns true if the class group uses the "swapped" pattern (exam first, then revision) */
  private isSwappedClassGroup(standard: Standard): boolean {
    // LKG, UKG, even standards (STD_2, 4, 6, 8, 10, 12) → 1-4 EXAM, 5-8 REVISION
    if (standard === Standard.LKG || standard === Standard.UKG) return true;
    const match = String(standard).match(/^STD_(\d+)$/);
    if (!match) return false;
    const n = parseInt(match[1], 10);
    return n % 2 === 0; // even → swapped
  }

  private getPattern(marks: number, standard: string): Array<'R' | 'E' | 'F'> {
    let pattern: Array<'R' | 'E' | 'F'>;

    if (marks === 25) {
      pattern = ['R', 'R', 'E', 'E', 'F', 'F', 'F', 'F'];
    } else {
      // Base pattern for both 50 and 100, and fallback for custom marks.
      pattern = ['R', 'R', 'R', 'R', 'E', 'E', 'E', 'E'];
    }

    const std = String(standard);
    const isLkgUkg = std === 'LKG' || std === 'UKG';
    const match = std.match(/^STD_(\d+)$/);
    const n = match ? parseInt(match[1], 10) : NaN;

    const isExamThenRevisionClass = isLkgUkg || n === 2 || n === 4 || n >= 6;
    if (isExamThenRevisionClass) {
      return ['E', 'E', 'E', 'E', 'R', 'R', 'R', 'R'];
    }

    return pattern;
  }

  private async validateClashes(args: {
    hallIds: string[];
    standard: any;
    section?: string;
    academicStreamId?: any;

    examDate: Date;
    startsAt: Date;
    endsAt: Date;
    teacherId?: string;
    excludeScheduleId?: string;
    periodStart?: number;
    periodEnd?: number;
    prisma?: any;
  }) {
    const db = args.prisma ?? this.prisma;

    const overlapFilter =
      args.periodStart !== undefined && args.periodEnd !== undefined
        ? { periodStart: { lte: args.periodEnd }, periodEnd: { gte: args.periodStart } }
        : { startsAt: { lt: args.endsAt }, endsAt: { gt: args.startsAt } };

    const hallClash = await db.examSchedule.findFirst({
      where: {
        ...(args.excludeScheduleId ? { id: { not: args.excludeScheduleId } } : {}),
        examDate: args.examDate,
        ...overlapFilter,
        halls: { some: { hallId: { in: args.hallIds } } },
      },
      include: { halls: { include: { hall: true } } },
    });
    if (hallClash) {
      throw new BadRequestException('Hall clash detected for this date and period/time slot');
    }

    const classClash = await db.examSchedule.findFirst({
      where: {
        ...(args.excludeScheduleId ? { id: { not: args.excludeScheduleId } } : {}),
        standard: args.standard,
        section: args.section ?? null,
        academicStreamId: args.academicStreamId ?? null,


        examDate: args.examDate,
        ...overlapFilter,
      },
    });
    if (classClash) {
      throw new BadRequestException('Class clash detected for this date and period/time slot');
    }

    if (args.teacherId) {
      const teacherClash = await db.examSchedule.findFirst({
        where: {
          ...(args.excludeScheduleId ? { id: { not: args.excludeScheduleId } } : {}),
          examDate: args.examDate,
          ...overlapFilter,
          subject: { teacherId: args.teacherId },
        },
        include: {
          subject: { select: { code: true, name: true } },
        },
      });
      if (teacherClash) {
        throw new BadRequestException(
          `Teacher clash detected: teacher is already assigned to "${teacherClash.subject.code} - ${teacherClash.subject.name}"`,
        );
      }
    }
  }

  async generateRollNumbers(examId: string, dto: GenerateRollNumbersDto) {
    const exam = await this.ensureExamExists(examId);
    const academicYear = dto.academicYear ?? exam.academicYear;

    const students = await this.prisma.student.findMany({
      where: {
        standard: dto.standard,
        section: dto.section,
        academicYear,
        ...(dto.academicStreamId ? { academicStreamId: dto.academicStreamId } : {}),


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
          stream: dto.academicStreamId ? { connect: { id: dto.academicStreamId } } : undefined,

          academicYear,

        },
        create: {
          exam: { connect: { id: examId } },
          student: { connect: { id: student.id } },
          rollNumber,
          standard: dto.standard,
          section: dto.section,
          stream: dto.academicStreamId ? { connect: { id: dto.academicStreamId } } : undefined,

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
        academicStreamId: schedule.academicStreamId ?? undefined,

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

  private async ensureNoHallOverlapForPeriod(hallIds: string[], examDate: Date, periodStart: number, periodEnd: number) {
    const clash = await this.prisma.examSchedule.findFirst({
      where: {
        examDate,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        halls: { some: { hallId: { in: hallIds } } },
      },
      include: { halls: { include: { hall: true } } },
    });
    if (clash) {
      const names = clash.halls
        .filter((h) => hallIds.includes(h.hallId))
        .map((h) => h.hall.name)
        .join(', ');
      throw new BadRequestException(`Hall period overlap detected for periods ${periodStart}–${periodEnd}: ${names}`);
    }
  }

  private async ensureNoClassOverlap(
    standard: any,
    section: string | undefined,
    academicStreamId: any,

    examDate: Date,
    startsAt: Date,
    endsAt: Date,
  ) {
    const clash = await this.prisma.examSchedule.findFirst({
      where: {
        standard,
        section: section ?? null,
        academicStreamId: academicStreamId ?? null,

        examDate,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });

    if (clash) {
      throw new BadRequestException('Class timetable overlap detected for this standard/section/stream');
    }
  }

  private async ensureNoClassOverlapForPeriod(
    standard: any,
    section: string | undefined,
    academicStreamId: any,

    examDate: Date,
    periodStart: number,
    periodEnd: number,
  ) {
    const clash = await this.prisma.examSchedule.findFirst({
      where: {
        standard,
        section: section ?? null,
        academicStreamId: academicStreamId ?? null,

        examDate,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });
    if (clash) {
      throw new BadRequestException(
        `Class period overlap detected for ${standard} section ${section ?? 'all'} on periods ${periodStart}–${periodEnd}`,
      );
    }
  }

  /** Ensure a teacher is not already assigned to an overlapping time slot on the same exam date */
  private async ensureNoTeacherClash(
    teacherId: string,
    examDate: Date,
    startsAt: Date,
    endsAt: Date,
    excludeScheduleId?: string,
    periodStart?: number,
    periodEnd?: number,
  ) {
    const periodFilter =
      periodStart !== undefined && periodEnd !== undefined
        ? { periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } }
        : { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } };

    const clash = await this.prisma.examSchedule.findFirst({
      where: {
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
        examDate,
        ...periodFilter,
        subject: { teacherId },
      },
      include: {
        subject: { select: { name: true, code: true, standard: true, section: true } },
      },
    });

    if (clash) {
      throw new BadRequestException(
        `Teacher clash detected: teacher is already assigned to "${clash.subject.code} – ${clash.subject.name}" (${clash.subject.standard} ${clash.subject.section ?? ''}) on the same date and overlapping period/time`,
      );
    }
  }
}
