import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';

export class CreateStoreItemDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() sellingPrice?: number;
  @IsOptional() @IsNumber() costPrice?: number;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsBoolean() isFreeEligible?: boolean;
  @IsOptional() @IsInt() @Min(0) freeLimit?: number;
}

export class UpdateStoreItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() sellingPrice?: number;
  @IsOptional() @IsNumber() costPrice?: number;
  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsBoolean() isFreeEligible?: boolean;
  @IsOptional() @IsInt() @Min(0) freeLimit?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateItemCategoryDto {
  @IsNotEmpty() @IsString() name: string;
}
