import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';

class TermPaymentDto {
  @IsNotEmpty() @IsInt() termNumber: number;
  @IsNotEmpty() @IsNumber() amount: number;
}

export class CollectPaymentDto {
  @IsNotEmpty() @IsString() studentFeeId: string;
  @IsNotEmpty() @IsNumber() amount: number;
  @IsOptional() @IsNumber() manualDiscount?: number;
  @IsNotEmpty() @IsString() paymentMode: string; // CASH / UPI / BANK
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() receiptNo?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsInt() termNumber?: number; // which term this payment is for (legacy)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermPaymentDto)
  payments?: TermPaymentDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermPaymentDto)
  splitPayments?: TermPaymentDto[];
  @IsOptional()
  @IsArray()
  @IsIn(['transportFee', 'bookFee', 'hostelFee', 'otherFee', 'customItems', 'manualDiscount'], {
    each: true,
  })
  receiptComponents?: string[];
  @IsOptional()
  paidComponents?: Record<string, number>;  // { tuition: 17333, transport: 3667, ... }
}
