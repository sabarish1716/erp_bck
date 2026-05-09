import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkAssignItemDto {
  @IsNotEmpty() @IsString() admissionNo: string;
  @IsNotEmpty() @IsString() routeNo: string;
  @IsNotEmpty() @IsString() busNo: string;
  @IsString() stopName?: string;
}

export class BulkAssignTransportDto {
  @IsNotEmpty() @IsString() academicYear: string;
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAssignItemDto)
  items: BulkAssignItemDto[];
}
