import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  busId!: string;

  @IsString()
  date!: string;

  @IsEnum(['FUEL', 'MAINTENANCE', 'PARTS', 'TAX'])
  category!: 'FUEL' | 'MAINTENANCE' | 'PARTS' | 'TAX';

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  fuelStation?: string;

  @IsOptional()
  @IsEnum(['CASH', 'CARD'])
  paymentMode?: 'CASH' | 'CARD';

  @IsOptional()
  @IsNumber()
  litres?: number;

  @IsOptional()
  @IsNumber()
  pricePerLitre?: number;

  @IsOptional()
  @IsString()
  workshop?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  partName?: string;

  @IsOptional()
  isShared?: boolean;

  @IsOptional()
  @IsString()
  taxType?: string;
}