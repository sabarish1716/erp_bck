import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  schoolCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  academicYear?: string;

  @IsOptional()
  @IsBoolean()
  requireApprovalForAdmission?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAdmissionEditAfterApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  enableFeesModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTransportModule?: boolean;

  @IsOptional()
  @IsBoolean()
  enableStaffModule?: boolean;
}
