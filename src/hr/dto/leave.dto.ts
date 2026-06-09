import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsString() code: string;
  @IsOptional() @IsNumber() maxPerYear?: number;
  @IsOptional() @IsBoolean() carryForward?: boolean;
}

export class ApplyLeaveDto {
  @IsNotEmpty() @IsString() staffId: string;
  @IsNotEmpty() @IsString() leaveTypeId: string;
  @IsNotEmpty() @IsDateString() fromDate: string;
  @IsNotEmpty() @IsDateString() toDate: string;
  @IsNotEmpty() @IsNumber() days: number;
  @IsOptional() @IsBoolean() halfDay?: boolean;
  @IsNotEmpty() @IsString() reason: string;
}

export class ApproveLeaveDto {
  @IsNotEmpty() @IsString() approvedBy: string;
}

export class RejectLeaveDto {
  @IsNotEmpty() @IsString() rejectedBy: string;
  @IsOptional() @IsString() rejectionNote?: string;
}
