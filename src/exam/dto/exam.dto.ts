import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { AcademicStream, ExamSession, Standard } from '@prisma/client';

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
