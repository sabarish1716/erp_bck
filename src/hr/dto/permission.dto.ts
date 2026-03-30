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
  @IsNotEmpty() @IsString() rejectedBy: string;
  @IsOptional() @IsString() rejectionNote?: string;
}
