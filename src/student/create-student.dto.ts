import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, Community } from '@prisma/client';

class FamilyDto {
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() fatherPhone?: string;
  @IsOptional() @IsString() fatherWhatsapp?: string;
  @IsOptional() @IsString() fatherAadhar?: string;
  @IsOptional() @IsString() fatherOccupation?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() motherPhone?: string;
  @IsOptional() @IsString() motherWhatsapp?: string;
  @IsOptional() @IsString() motherAadhar?: string;
  @IsOptional() @IsString() motherOccupation?: string;
  @IsOptional() @IsString() otherWhatsapp?: string;
  @IsOptional() familyIncome?: string;
  @IsOptional() @IsString() siblings?: string;
  @IsOptional() @IsBoolean() hostelRequired?: boolean;
}

class AddressDto {
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() line3?: string;
  @IsOptional() @IsString() pin?: string;
}

export class CreateStudentDto {
  @IsString() name: string;
  @IsString() standard: string;
  @IsEnum(Gender) gender: Gender;
  @IsDateString() dob: string;
  @IsOptional() @IsString() religion?: string;
  @IsEnum(Community) community: Community;
  @IsOptional() @IsString() caste?: string;
  @IsOptional() @IsString() motherTongue?: string;
  @IsOptional() @IsString() aadharNo?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() identification1?: string;
  @IsOptional() @IsString() identification2?: string;
  @IsOptional() @IsString() previousSchool?: string;
  @IsOptional() @IsString() transportMode?: string;
  @IsOptional() @IsBoolean() rte?: boolean;
  @IsOptional() @ValidateNested() @Type(() => FamilyDto) family?: FamilyDto;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
}
