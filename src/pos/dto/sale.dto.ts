import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class SaleItemDto {
  @IsNotEmpty() @IsString() itemId: string;
  @IsNotEmpty() @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsNumber() unitPrice?: number; // optional override, else use sellingPrice
}

export class CreateSaleDto {
  @IsNotEmpty() @IsString() storeId: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerType?: string; // WALK_IN / STUDENT / STAFF
  @IsOptional() @IsString() paymentMode?: string; // CASH / UPI / CARD
  @IsOptional() @IsNumber() discount?: number;
  @IsOptional() @IsString() remarks?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}
