import {
  IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsInt, IsEnum, Min,
} from 'class-validator';

enum ItemCategoryEnum {
  STATIONERY = 'STATIONERY',
  UNIFORM = 'UNIFORM',
  BOOKS = 'BOOKS',
  SANITARY = 'SANITARY',
  FURNITURE = 'FURNITURE',
  ID_CARD = 'ID_CARD',
  ACCESSORIES = 'ACCESSORIES',
  OTHER = 'OTHER',
}

export class CreateStoreItemDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsEnum(ItemCategoryEnum) category?: string;
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
  @IsOptional() @IsEnum(ItemCategoryEnum) category?: string;
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
