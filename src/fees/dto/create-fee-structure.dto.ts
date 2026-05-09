import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomFeeItemDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsNumber() amount: number;
}

class KitItemDto {
  @IsNotEmpty() @IsString() storeItemId: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsNumber() amount?: number; // override price, else uses sellingPrice × qty
}

class FeeTermTemplateDto {
  @IsNotEmpty() @IsInt() termNumber: number;
  @IsNotEmpty() @IsString() termName: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsNotEmpty() @IsNumber() amount: number;
}

export class CreateFeeStructureDto {
  @IsNotEmpty() @IsString() standard: string;
  @IsNotEmpty() @IsString() academicYear: string;

  @IsNotEmpty() @IsNumber() tuitionFee: number;
  @IsOptional() @IsNumber() transportFee?: number;
  @IsOptional() @IsNumber() bookFee?: number;
  @IsOptional() @IsNumber() hostelFee?: number;
  @IsOptional() @IsNumber() otherFee?: number;
  
  @IsOptional() @IsNumber() specialClassFee?: number;
  @IsOptional() @IsInt() specialClassMonths?: number;
  @IsOptional() @IsNumber() specialClassTransportFee?: number;
  @IsOptional() @IsInt() specialClassTransportMonths?: number;

  @IsOptional() @IsInt() @Min(1) @Max(4) numberOfTerms?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFeeItemDto)
  customItems?: CustomFeeItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeTermTemplateDto)
  terms?: FeeTermTemplateDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KitItemDto)
  kitItems?: KitItemDto[];
}
