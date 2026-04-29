import { IsString, IsNumber, IsDateString, IsOptional, Min, IsArray } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  staffId: string;

  @IsNumber()
  @Min(1000)
  loanAmount: number;

  @IsNumber()
  @Min(100)
  emiAmount: number;

  @IsOptional()
  @IsString()
  emiFrequency?: string; // MONTHLY, BI_WEEKLY

  @IsDateString()
  startMonth: string; // YYYY-MM format

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveLoanDto {
  @IsString()
  approvedBy: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectLoanDto {
  @IsString()
  rejectedBy: string;

  @IsString()
  rejectionReason: string;
}

export class SkipLoanEMIDto {
  @IsString()
  month: string; // YYYY-MM format

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResumeLoanEMIDto {
  @IsString()
  month: string; // YYYY-MM format to resume from
}

export class PreCloseLoanDto {
  @IsOptional()
  @IsNumber()
  partialAmount?: number; // If partial payment

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PayLoanEMIDto {
  @IsString()
  month: string; // YYYY-MM format

  @IsNumber()
  @Min(0)
  amountPaid: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetLoansQueryDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  status?: string; // ACTIVE, PAUSED, PRE_CLOSED, CLOSED, REJECTED
}
