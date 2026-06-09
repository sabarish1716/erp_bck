import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class CreatePosTransactionDto {
  @IsNotEmpty() @IsString() type: string; // INCOME / EXPENSE
  @IsNotEmpty() @IsString() category: string; // SALE / PURCHASE / MAINTENANCE / OTHER
  @IsNotEmpty() @IsString() description: string;
  @IsNotEmpty() @IsNumber() amount: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsString() receiptImage?: string;
  @IsOptional() @IsString() remarks?: string;
}
