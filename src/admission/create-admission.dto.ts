import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsNumber,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, Community, AcademicStream } from '@prisma/client';

/* ---------------- FAMILY DTO ---------------- */

class FamilyDto {
  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  fatherPhone?: string;

  @IsOptional()
  @IsString()
  fatherWhatsapp?: string;

  @IsOptional()
  @IsString()
  fatherAadhar?: string;

  @IsOptional()
  @IsString()
  fatherOccupation?: string;

  @IsOptional()
  @IsString()
  motherName?: string;

  @IsOptional()
  @IsString()
  motherPhone?: string;

  @IsOptional()
  @IsString()
  motherWhatsapp?: string;

  @IsOptional()
  @IsString()
  motherAadhar?: string;

  @IsOptional()
  @IsString()
  motherOccupation?: string;

  @IsOptional()
  @IsString()
  otherWhatsapp?: string;

  @IsOptional()
  @IsNumber()
  familyIncome?: number;

  @IsOptional()
  @IsString()
  siblings?: string;

  @IsOptional()
  @IsBoolean()
  hostelRequired?: boolean;
}

/* ---------------- ADDRESS DTO ---------------- */

class AddressDto {
  @IsNotEmpty()
  @IsString()
  line1: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  line3?: string;

  @IsNotEmpty()
  @IsString()
  pin: string;
}

/* ---------------- DOCUMENT DTO ---------------- */

class DocumentDto {
  @IsBoolean()
  photo: boolean;

  @IsBoolean()
  birthCert: boolean;

  @IsBoolean()
  communityCert: boolean;

  @IsBoolean()
  aadharFather: boolean;

  @IsBoolean()
  aadharMother: boolean;

  @IsBoolean()
  aadharStudent: boolean;

  @IsBoolean()
  transferCert: boolean;
}

/* ---------------- SUBJECT DTO ---------------- */

class SubjectMarkDto {
  @IsString()
  subjectName: string;

  @IsNumber()
  maxMarks: number;

  @IsNumber()
  obtainedMarks: number;

  @IsNumber()
  percentage: number;
}

/* ---------------- ACADEMIC DTO ---------------- */

class AcademicDto {
  @IsOptional()
  @IsString()
  examName?: string;

  @IsOptional()
  @IsString()
  registerNo?: string;

  @IsOptional()
  @IsString()
  monthYear?: string;

  @IsOptional()
  @IsNumber()
  totalPercentage?: number;

  @IsOptional()
  @IsEnum(AcademicStream)
  stream?: AcademicStream;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectMarkDto)
  subjects: SubjectMarkDto[];
}

/* ---------------- ADMISSION DTO ---------------- */

class AdmissionInfoDto {
  @IsNotEmpty()
  @IsString()
  admissionNo: string;

  @IsDateString()
  admissionDate: string;

  @IsNotEmpty()
  @IsString()
  standard: string;

  @IsOptional()
  @IsString()
  staffSignature?: string;

  // ✅ IMPORTANT: Principal sign required
  @IsNotEmpty()
  @IsString()
  principalSignature: string;
}

/* ---------------- MAIN DTO ---------------- */

export class CreateAdmissionDto {
  /* Student Info */

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  standard: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsDateString()
  dob: string;

  @IsOptional()
  @IsString()
  religion?: string;

  @IsEnum(Community)
  community: Community;

  @IsOptional()
  @IsString()
  caste?: string;

  @IsOptional()
  @IsString()
  motherTongue?: string;

  @IsOptional()
  @IsString()
  aadharNo?: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  identification1?: string;

  @IsOptional()
  @IsString()
  identification2?: string;

  @IsOptional()
  @IsString()
  previousSchool?: string;

  @IsOptional()
  @IsString()
  transportMode?: string;

  @IsOptional()
  @IsBoolean()
  rte?: boolean;

  /* Nested Objects */

  @ValidateNested()
  @Type(() => FamilyDto)
  family: FamilyDto;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ValidateNested()
  @Type(() => DocumentDto)
  documents: DocumentDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcademicDto)
  academics: AcademicDto[];

  @ValidateNested()
  @Type(() => AdmissionInfoDto)
  admission: AdmissionInfoDto;
}