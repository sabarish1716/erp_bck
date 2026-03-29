import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
  IsIn,
} from 'class-validator';

export class CollectPaymentDto {
  @IsNotEmpty() @IsString() studentFeeId: string;
  @IsNotEmpty() @IsNumber() amount: number;
  @IsNotEmpty() @IsString() paymentMode: string; // CASH / UPI / BANK
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() receiptNo?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsInt() termNumber?: number; // which term this payment is for
  @IsOptional()
  @IsArray()
  @IsIn(['transportFee', 'bookFee', 'hostelFee', 'otherFee', 'customItems'], {
    each: true,
  })
  receiptComponents?: string[];
}
