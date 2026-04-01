import { IsEnum, IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

export enum DocRequestType {
  TRANSFER_CERTIFICATE = 'TRANSFER_CERTIFICATE',
  BONAFIDE_CERTIFICATE = 'BONAFIDE_CERTIFICATE',
  CONDUCT_CERTIFICATE = 'CONDUCT_CERTIFICATE',
  STUDY_CERTIFICATE = 'STUDY_CERTIFICATE',
  FEE_CERTIFICATE = 'FEE_CERTIFICATE',
  OTHER = 'OTHER',
}

export class CreateDocRequestDto {
  @IsString()
  studentId: string;

  @IsEnum(DocRequestType)
  type: DocRequestType;

  @IsOptional()
  @IsString()
  reason?: string;
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
}
