import { IsEnum, IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

export enum DocRequestType {
  TRANSFER_CERTIFICATE = 'TRANSFER_CERTIFICATE',
  BONAFIDE_CERTIFICATE = 'BONAFIDE_CERTIFICATE',
  CONDUCT_CERTIFICATE = 'CONDUCT_CERTIFICATE',
  STUDY_CERTIFICATE = 'STUDY_CERTIFICATE',
  FEE_CERTIFICATE = 'FEE_CERTIFICATE',
  STAFF_RECOGNITION = 'STAFF_RECOGNITION',
  STAFF_EXPERIENCE = 'STAFF_EXPERIENCE',
  STAFF_SALARY = 'STAFF_SALARY',
  OTHER = 'OTHER',
}

export enum BonafideScenarioType {
  STUDY_PURPOSE = 'STUDY_PURPOSE',
  PASSPORT_VISA = 'PASSPORT_VISA',
  SCHOLARSHIP = 'SCHOLARSHIP',
  EDUCATION_LOAN = 'EDUCATION_LOAN',
}

export class CreateDocRequestDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsEnum(DocRequestType)
  type: DocRequestType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(BonafideScenarioType)
  bonafideScenario?: BonafideScenarioType;

  @IsOptional()
  @IsString()
  bonafidePurpose?: string;

  @IsOptional()
  @IsString()
  bonafideAuthority?: string;

  @IsOptional()
  @IsString()
  bonafideTemplateText?: string;

  @IsOptional()
  @IsString()
  templateText?: string;

  @IsOptional()
  customFields?: any;
}

export class ReviewDocRequestDto {
  @IsEnum({ APPROVED: 'APPROVED', REJECTED: 'REJECTED', IN_REVIEW: 'IN_REVIEW' })
  status: 'APPROVED' | 'REJECTED' | 'IN_REVIEW';

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class IssueDocRequestDto {
  // TC-specific fields
  @IsOptional()
  @IsString()
  tcNo?: string;

  @IsOptional()
  @IsDateString()
  tcDate?: string;

  @IsOptional()
  @IsString()
  leavingReason?: string;

  @IsOptional()
  @IsString()
  conductRemark?: string;

  @IsOptional()
  @IsBoolean()
  qualifiedForPromotion?: boolean;

  @IsOptional()
  @IsDateString()
  dateOfLeaving?: string;

  @IsOptional()
  @IsDateString()
  lastAttendedDate?: string;

  // Bonafide-specific fields
  @IsOptional()
  @IsEnum(BonafideScenarioType)
  bonafideScenario?: BonafideScenarioType;

  @IsOptional()
  @IsString()
  bonafidePurpose?: string;

  @IsOptional()
  @IsString()
  bonafideAuthority?: string;

  @IsOptional()
  @IsString()
  bonafideTemplateText?: string;

  @IsOptional()
  @IsString()
  templateText?: string;

  @IsOptional()
  customFields?: any;
}
