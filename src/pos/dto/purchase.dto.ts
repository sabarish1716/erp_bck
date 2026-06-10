import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() gstNo?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() gstNo?: string;
  @IsOptional() isActive?: boolean;
}

class PurchaseItemDto {
  @IsNotEmpty() @IsString() itemId: string;
  @IsNotEmpty() @IsInt() @Min(1) quantity: number;
  @IsNotEmpty() @IsNumber() unitPrice: number;
}

export class CreatePurchaseDto {
  @IsNotEmpty() @IsString() supplierId: string;
  @IsNotEmpty() @IsString() storeId: string;
  @IsOptional() @IsString() invoiceNo?: string;
  @IsOptional() @IsDateString() invoiceDate?: string;
  @IsOptional() @IsString() receiptImage?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
