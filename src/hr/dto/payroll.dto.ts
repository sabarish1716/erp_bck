import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, IsBoolean } from 'class-validator';

export class GeneratePayrollDto {
  @IsNotEmpty() @IsString() month: string;
  @IsOptional() @IsArray() staffIds?: string[];
}

export class ApprovePayrollDto {
  @IsArray() ids: string[];
}

export class UpdatePayrollDto {
  @IsOptional() @IsBoolean() lopCancelled?: boolean;
  @IsOptional() @IsNumber() bonusIncentive?: number;
  @IsOptional() @IsNumber() extraAllowance?: number;
}
