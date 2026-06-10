import {
  IsString,
  IsNumber,
  IsIn,
  Min,
  IsOptional,
  IsInt,
} from 'class-validator';

export class SendPaymentLinkDto {
  @IsString()
  studentFeeId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  phoneNumber: string;

  @IsIn(['SMS', 'WHATSAPP'])
  channel: 'SMS' | 'WHATSAPP';

  @IsOptional()
  @IsInt()
  termNumber?: number;
}
