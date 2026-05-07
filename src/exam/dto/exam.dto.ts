import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { AcademicStream, ExamSession, PeriodType, Standard } from '@prisma/client';

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
  @IsEnum(AcademicStream)
  stream?: AcademicStream;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  passMarks?: number;

  /** Staff ID of the teacher assigned to this subject */
  @IsOptional()
  @IsString()
  teacherId?: string;
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
  @IsEnum(AcademicStream)
  stream?: AcademicStream;

  @IsDateString()
  examDate!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsEnum(ExamSession)
  session!: ExamSession;

  @IsArray()
  @IsString({ each: true })
  hallIds!: string[];

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
  @IsEnum(AcademicStream)
  stream?: AcademicStream;

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
  @IsEnum(AcademicStream)
  stream?: AcademicStream;

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

  @IsArray()
  @IsString({ each: true })
  hallIds!: string[];

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
  @IsEnum(AcademicStream)
  stream?: AcademicStream;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  marks!: number;

  @IsDateString()
  startDate!: string;

  @IsArray()
  @IsString({ each: true })
  hallIds!: string[];
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
