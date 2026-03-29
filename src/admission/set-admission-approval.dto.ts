import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetAdmissionApprovalDto {
  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}
