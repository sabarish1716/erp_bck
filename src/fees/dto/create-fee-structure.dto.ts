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
}
