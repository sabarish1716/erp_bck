import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class StudentCustomFeeItemDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsNumber() amount: number;
}

enum DiscountTypeEnum {
  FLAT = 'FLAT',
  PERCENTAGE = 'PERCENTAGE',
  TEACHER_DISCOUNT = 'TEACHER_DISCOUNT',
  SIBLING_DISCOUNT = 'SIBLING_DISCOUNT',
  RTE_COMMUNITY = 'RTE_COMMUNITY',
}

class DiscountDto {
  @IsNotEmpty() @IsEnum(DiscountTypeEnum) type: DiscountTypeEnum;
  @IsNotEmpty() @IsNumber() value: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) applicableHeads?: string[];
}

class StudentFeeTermDto {
  @IsNotEmpty() @IsNumber() termNumber: number;
  @IsNotEmpty() @IsString() termName: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsNotEmpty() @IsNumber() amount: number;
}

export class AssignFeeDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsNotEmpty() @IsString() academicYear: string;

  @IsOptional() @IsNumber() tuitionFee?: number;
  @IsOptional() @IsNumber() transportFee?: number;
  @IsOptional() @IsNumber() bookFee?: number;
  @IsOptional() @IsNumber() hostelFee?: number;
  @IsOptional() @IsNumber() otherFee?: number;
  @IsOptional() @IsNumber() applicationFee?: number;

  @IsOptional() @IsNumber() specialClassFee?: number;
  @IsOptional() @IsNumber() specialClassMonths?: number;
  @IsOptional() @IsNumber() specialClassTransportFee?: number;
  @IsOptional() @IsNumber() specialClassTransportMonths?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentCustomFeeItemDto)
  customItems?: StudentCustomFeeItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountDto)
  discounts?: DiscountDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentFeeTermDto)
  terms?: StudentFeeTermDto[];

  // Auto-detect flags — if true, server will check eligibility and apply
  @IsOptional() @IsBoolean() autoTeacherDiscount?: boolean;
  @IsOptional() @IsBoolean() autoSiblingDiscount?: boolean;
  @IsOptional() @IsBoolean() autoRteDiscount?: boolean;

  @IsOptional()
  @IsBoolean()
  hasElgaBooks?: boolean;
}
