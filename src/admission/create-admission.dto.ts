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

export { AcademicStream };

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

  @IsOptional() @IsString() siblingSchool?: string;
@IsOptional() @IsString() otherSchoolName?: string;
}

class AddressDto {
  // 🔥 keep old (required for DB)
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() line3?: string;

  // 🔥 new UI fields
  @IsOptional() @IsString() doorNo?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;

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

class SubjectMarkDto {
  @IsNotEmpty() @IsString() subjectName: string;
  @IsNotEmpty() @IsNumber() maxMarks: number;
  @IsNotEmpty() @IsNumber() obtainedMarks: number;
  @IsOptional() @IsNumber() percentage?: number;
}

class AcademicDto {
  @IsOptional() @IsString() examName?: string;       // SSLC / MATRIC / CBSE
  @IsOptional() @IsString() registerNo?: string;
  @IsOptional() @IsString() monthYear?: string;       // e.g. "March 2024"
  // TOTAL row fields from the qualifying examination table
  @IsOptional() @IsNumber() totalMaxMarks?: number;
  @IsOptional() @IsNumber() totalObtainedMarks?: number;
  @IsOptional() @IsNumber() totalPercentage?: number; // overall % (top-right of form)
  // stream for qualifying exam record (e.g. SSLC/Matric/CBSE board)
  @IsOptional() @IsEnum(AcademicStream) stream?: AcademicStream;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectMarkDto)
  subjects?: SubjectMarkDto[];
}

class AdmissionInfoDto {
  @IsOptional() @IsString() admissionNo?: string;
  @IsOptional() @IsString() admissionDate?: string;
  @IsOptional() @IsString() standard?: string;
  @IsOptional() @IsString() admissionFrom?: string;
  @IsOptional() @IsString() admissionTo?: string;

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
  @IsOptional() @IsString() customCommunity?: string; // For "Others" option
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

  // Section & Academic Year
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() academicYear?: string;

  // 11th & 12th standard: subject stream selection
  // (Part III: BIO_MATHS, CS_MATHS, BIO_CS, COMMERCE)
  @IsOptional() @IsEnum(AcademicStream) academicStream?: AcademicStream;

  // Discount-related
  @IsOptional() @IsString() staffParentId?: string;
  @IsOptional() @IsString() siblingGroupId?: string;

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