import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  busId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  busIds?: string[];

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
  @IsBoolean()
  isShared?: boolean;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsString()
  taxType?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;
}