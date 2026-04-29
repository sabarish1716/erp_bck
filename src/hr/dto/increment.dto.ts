import { IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';

export class CreateIncrementDto {
  @IsString()
  staffId: string;

  @IsNumber()
  @Min(0)
  fromSalary: number;

  @IsNumber()
  @Min(0)
  toSalary: number;

  @IsDateString()
  incrementDate: string;

  @IsDateString()
  effectiveDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveIncrementDto {
  @IsString()
  approvedBy: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectIncrementDto {
  @IsString()
  rejectedBy: string;

  @IsString()
  rejectionReason: string;
}

export class GetIncrementHistoryDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  status?: string; // PENDING, APPROVED, REJECTED, APPLIED
}
