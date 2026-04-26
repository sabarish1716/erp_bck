import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber } from 'class-validator';

export class ApplyPermissionDto {
  @IsNotEmpty() @IsString() staffId: string;
  @IsNotEmpty() @IsDateString() date: string;
  @IsNotEmpty() @IsString() fromTime: string;
  @IsNotEmpty() @IsString() toTime: string;
  @IsNotEmpty() @IsNumber() hours: number;
  @IsNotEmpty() @IsString() reason: string;
}

export class ApprovePermissionDto {
  @IsNotEmpty() @IsString() approvedBy: string;
}

export class RejectPermissionDto {
  @IsNotEmpty()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  rejectedBy: string;

  // Frontend often sends `reason`; keep it as alias to avoid whitelist validation errors.
  @IsOptional() @IsString() reason?: string;

  @IsOptional() @IsString() rejectionNote?: string;
}
