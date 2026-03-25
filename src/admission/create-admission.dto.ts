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

class DocumentsDto {
  @IsOptional() @IsBoolean() photo?: boolean;
  @IsOptional()  photoPath?: string;

  @IsOptional() @IsBoolean() birthCert?: boolean;
  @IsOptional() @IsString() birthCertPath?: string;

  @IsOptional() @IsBoolean() communityCert?: boolean;
  @IsOptional() @IsString() communityCertPath?: string;

  @IsOptional() @IsBoolean() aadharFather?: boolean;
  @IsOptional() @IsString() aadharFatherPath?: string;

  @IsOptional() @IsBoolean() aadharMother?: boolean;
  @IsOptional() @IsString() aadharMotherPath?: string;

  @IsOptional() @IsBoolean() aadharStudent?: boolean;
  @IsOptional() @IsString() aadharStudentPath?: string;

  @IsOptional() @IsBoolean() transferCert?: boolean;
  @IsOptional() @IsString() transferCertPath?: string;
}

class AcademicDto {
  @IsOptional() @IsString() examName?: string;
  @IsOptional() @IsString() registerNo?: string;
  @IsOptional() @IsString() monthYear?: string;
  @IsOptional() @IsNumber() totalPercentage?: number;
  @IsOptional() @IsString() stream?: string;
  @IsOptional() @IsArray() subjects?: any[];
}

class AdmissionInfoDto {
  @IsOptional() @IsString() admissionNo?: string;
  @IsOptional() @IsString() admissionDate?: string;
  @IsOptional() @IsString() standard?: string;

  @IsOptional() @IsString() staffSignature?: string;
  @IsOptional() @IsString() staffSignaturePath?: string;

  @IsOptional() @IsString() principalSignature?: string;
  @IsOptional() @IsString() principalSignaturePath?: string;
}

export class CreateAdmissionDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() standard?: string;
  @IsOptional() @IsString() gender?: Gender;
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @IsString() community?: Community;
  
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() caste?: string;
  @IsOptional() @IsString() motherTongue?: string;
  @IsOptional() @IsString() aadharNo?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  
  @IsOptional() @IsString() identification1?: string;
  @IsOptional() @IsString() identification2?: string;
  @IsOptional() @IsString() previousSchool?: string;
  @IsOptional() @IsString() transportMode?: string;
  @IsOptional() @IsBoolean() rte?: boolean;

  /* Nested Objects mapped from your JSON */
  @IsOptional()
  @ValidateNested()
  @Type(() => FamilyDto)
  family?: FamilyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  // @IsOptional()
  // @ValidateNested()
  // @Type(() => DocumentsDto)
  // documents?: DocumentsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcademicDto)
  academics?: AcademicDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AdmissionInfoDto)
  admission?: AdmissionInfoDto;

  @IsOptional()
  documents?: Record<string, any>;

  @IsOptional() @IsString() email?: string;
}