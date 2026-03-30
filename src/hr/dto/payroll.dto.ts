import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class GeneratePayrollDto {
  @IsNotEmpty() @IsString() month: string;
  @IsOptional() @IsArray() staffIds?: string[];
}

export class ApprovePayrollDto {
  @IsArray() ids: string[];
}
