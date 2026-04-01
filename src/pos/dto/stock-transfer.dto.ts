import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class TransferItemDto {
  @IsNotEmpty() @IsString() itemId: string;
  @IsNotEmpty() @IsInt() @Min(1) quantity: number;
}

export class CreateStockTransferDto {
  @IsNotEmpty() @IsString() fromStoreId: string;
  @IsNotEmpty() @IsString() toStoreId: string;
  @IsOptional() @IsString() remarks?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}
