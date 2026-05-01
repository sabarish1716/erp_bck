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
  @IsNotEmpty() @IsString()
  name!: string; // FULL NAME
  @IsNotEmpty() @IsEmail()
  email!: string; // WORK EMAIL
  @IsOptional() @IsString() phone?: string; // CONTACT NUMBER
  @IsOptional() @IsString() password?: string; // PASSWORD

  // JOB DETAILS
  @IsNotEmpty() @IsString()
  designation!: string; // JOB TITLE
  @IsOptional() @IsString() department?: string; // DEPARTMENT / SPECIALIZATION
  @IsOptional() @IsString() category?: string; // CATEGORY / DEPARTMENT
  @IsOptional() @IsNumber() salary?: number; // MONTHLY SALARY
  @IsOptional() @IsDateString()                                                                                                                                                                                                                                                                                                                                                                                                                                                        joiningDate?: string; // JOINING DATE
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() qualification?: string;
  @IsOptional() @IsNumber() perDaySalary?: number;

  // ADDRESS DETAILS
  @IsOptional() @IsString() doorNo?: string; // DOOR NO
  @IsOptional() @IsString() area?: string; // AREA / UNIT
  @IsOptional() @IsString() town?: string; // TOWN
  @IsOptional() @IsString() taluk?: string; // TALUK
  @IsOptional() @IsString() district?: string; // DISTRICT
  @IsOptional() @IsString() state?: string; // STATE
  @IsOptional() @IsString() pincode?: string; // PIN CODE

  // BANK DETAILS
  @IsOptional() @IsString() paymentMode?: string; // PAYMENT METHOD
  @IsOptional() @IsString() bankName?: string; // BANK NAME
  @IsOptional() @IsString() bankAccountNo?: string; // ACCOUNT NUMBER
  @IsOptional() @IsString() bankIfsc?: string; // IFSC CODE
  @IsOptional() @IsString() bankBranch?: string; // BRANCH NAME

  @IsOptional() @IsDateString() pfJoiningDate?: string;
  @IsOptional() @IsString() city?: string; // CITY
}
