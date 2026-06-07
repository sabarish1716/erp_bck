import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ExamSession, PeriodType, Standard } from '@prisma/client';


export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  academicYear!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMarks!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class CreateExamSubjectDto {
  @IsString()
  @IsNotEmpty()
  examId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsEnum(Standard)
  standard!: Standard;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  academicStreamId?: string;

  /** Staff ID of the teacher assigned to this subject */
  @IsNotEmpty()
  @IsString()
  teacherId!: string;
}

export class CreateExamHallDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity!: number;
}

export class CreateExamScheduleDto {
  @IsString()
  @IsNotEmpty()
  examId!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsEnum(Standard)
  standard!: Standard;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  academicStreamId?: string;



  @IsDateString()
  examDate!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsEnum(ExamSession)
  session!: ExamSession;



  /** Starting period number (1–8) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  periodStart?: number;

  /** Ending period number (1–8) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  periodEnd?: number;

  /** Whether these periods are for Revision or Examination */
  @IsOptional()
  @IsEnum(PeriodType)
  periodType?: PeriodType;
}

export class GenerateRollNumbersDto {
  @IsEnum(Standard)
  standard!: Standard;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  academicStreamId?: string;



  @IsOptional()
  @IsString()
  academicYear?: string;
}

export class AssignInvigilatorDto {
  @IsString()
  @IsNotEmpty()
  hallId!: string;

  @IsString()
  @IsNotEmpty()
  staffId!: string;
}

/** Auto-generate period blocks for an exam date based on marks pattern and class group */
export class AutoGeneratePeriodsDto {
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsEnum(Standard)
  standard!: Standard;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  academicStreamId?: string;



  @IsDateString()
  examDate!: string;

  /**
   * Marks for this exam (determines period split pattern):
   * 25 → periods 1-2 revision, 3-4 exam
   * 50 → periods 1-4 revision, 5-8 exam
   * 100 → full previous day revision + exam day 1-4 revision, 5-8 exam
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  marks!: number;

  /** For 100-mark exams: the date on which full revision is held */
  @IsOptional()
  @IsDateString()
  revisionDate?: string;



  @IsEnum(ExamSession)
  session!: ExamSession;
}

export class AutoGenerateFullTimetableDto {
  @IsEnum(Standard)
  standard!: Standard;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  academicStreamId?: string;

  @IsDateString()
  startDate!: string;


}

export class UpdateExamScheduleCellDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsEnum(PeriodType)
  periodType?: PeriodType;
}

/** Manual seat allocation: mix two standards into one or more halls */
export class ManualHallAllocationDto {
  @IsString()
  @IsNotEmpty()
  hallId!: string;

  @IsEnum(Standard)
  standard1!: Standard;

  @IsOptional()
  @IsString()
  section1?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  count1!: number;

  @IsOptional()
  @IsEnum(Standard)
  standard2?: Standard;

  @IsOptional()
  @IsString()
  section2?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  count2?: number;

  /** Primary invigilator staff ID */
  @IsOptional()
  @IsString()
  invigilator1Id?: string;

  /** Secondary invigilator staff ID */
  @IsOptional()
  @IsString()
  invigilator2Id?: string;
}

export class ManualSeatAllocationDto {
  @IsArray()
  halls!: ManualHallAllocationDto[];
}

/** Patch startsAt / endsAt on an ExamSchedule without regenerating */
export class UpdateScheduleTimingDto {
  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
