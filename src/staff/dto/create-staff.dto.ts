import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsDateString,
  IsEnum,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateStaffDto {
  // BASIC DETAILS
  @IsOptional() @IsString() employeeId?: string; // EMPLOYEE ID
  @IsNotEmpty()
  @IsString()
  name!: string; // FULL NAME
  @IsOptional()
  @IsEmail()
  email?: string; // WORK EMAIL
  @IsOptional() @IsString() phone?: string; // CONTACT NUMBER
  @IsOptional() @IsString() alternatePhone?: string; // ALTERNATE CONTACT
  @IsOptional() @IsString() password?: string; // PASSWORD

  // JOB DETAILS
  @IsNotEmpty()
  @IsString()
  designation!: string; // JOB TITLE
  @IsOptional() @IsString() department?: string; // DEPARTMENT / SPECIALIZATION
  @IsOptional() @IsString() category?: string; // CATEGORY / DEPARTMENT
  @IsOptional() @IsNumber() salary?: number; // MONTHLY SALARY
  @IsNotEmpty() @IsDateString() joiningDate!: string; // JOINING DATE
  @IsOptional() @IsDateString() relievingDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsNumber() perDaySalary?: number;

  // QUALIFICATIONS
  @IsOptional() @IsString() ugDegree?: string;
  @IsOptional() @IsString() pgDegree?: string;
  @IsOptional() @IsBoolean() bEdStatus?: boolean;
  @IsOptional() @IsString() otherQualifications?: string;
  @IsOptional() @IsBoolean() certificatesCollected?: boolean;

  // PREVIOUS EXPERIENCE
  @IsOptional() @IsString() previousSchoolName?: string;
  @IsOptional() @IsString() previousStandardsHandled?: string;
  @IsOptional() @IsString() previousSubjectsHandled?: string;
  @IsOptional() @IsNumber() yearsOfExperience?: number;

  // PERSONAL INFO
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsNumber() numberOfChildren?: number;

  // ADDRESS DETAILS
  @IsOptional() @IsString() doorNo?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() taluk?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;

  // BANK DETAILS
  @IsOptional() @IsString() paymentMode?: string; // PAYMENT METHOD
  @IsOptional() @IsString() bankName?: string; // BANK NAME
  @IsOptional() @IsString() bankAccountNo?: string; // ACCOUNT NUMBER
  @IsOptional() @IsString() bankIfsc?: string; // IFSC CODE
  @IsOptional() @IsString() bankBranch?: string; // BRANCH NAME

  @IsOptional() @IsDateString() pfJoiningDate?: string;
  @IsOptional() @IsString() city?: string; // CITY
}
