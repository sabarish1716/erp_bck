import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CancelPaymentDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class RefundPaymentDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  refundAmount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
