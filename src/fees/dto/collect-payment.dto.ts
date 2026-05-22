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
  IsObject,
} from 'class-validator';

class TermPaymentDto {
  @IsOptional() @IsInt() termNumber?: number | null;
  @IsNotEmpty() @IsNumber() amount: number;
  @IsOptional() @IsNumber() manualDiscount?: number;
  @IsOptional() @IsObject() paidComponents?: Record<string, number>;
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
  @IsIn(
    [
      'tuitionFee',
      'transportFee',
      'bookFee',
      'hostelFee',
      'otherFee',
      'customItems',
      'manualDiscount',
    ],
    {
      each: true,
    },
  )
  receiptComponents?: string[];

  @IsOptional()
  @IsObject()
  paidComponents?: Record<string, number>; // { tuition: 17333, transport: 3667, ... }
}
