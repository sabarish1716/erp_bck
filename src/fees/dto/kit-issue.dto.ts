import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';

export class IssueKitItemDto {
  @IsNotEmpty() @IsString() studentFeeId: string;
  @IsNotEmpty() @IsString() storeItemId: string;
  @IsOptional() @IsString() feeId?: string;
  @IsOptional() @IsString() itemId?: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number; // default 1
  @IsOptional() @IsNumber() amount?: number; // override, else uses sellingPrice × qty
  @IsOptional() @IsDateString() issuedDate?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsString() issuerName?: string;
  @IsOptional() @IsString() saleId?: string; // link to POS sale if applicable
  @IsOptional() @IsInt() @Min(1) termNumber?: number; // defaults to 1
}
