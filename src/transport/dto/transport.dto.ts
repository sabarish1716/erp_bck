import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TransportStopDto {
  @IsNotEmpty() @IsString() stopName: string;
  @IsNotEmpty() @IsInt() stopOrder: number;
  @IsOptional() @IsNumber() distanceKm?: number;
  @IsOptional() @IsString() pickupTime?: string;
  @IsOptional() @IsString() dropTime?: string;
  @IsOptional() @IsNumber() fee?: number;
}

export class CreateTransportRouteDto {
  @IsNotEmpty() @IsString() routeName: string;
  @IsOptional() @IsString() routeNo?: string;
  @IsNotEmpty() @IsNumber() baseFee: number;
  @IsOptional() @IsNumber() splClassFee?: number;
  @IsOptional() @IsString() description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransportStopDto)
  stops?: TransportStopDto[];
}

export class AssignStudentTransportDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsNotEmpty() @IsString() routeId: string;
  @IsOptional() @IsString() stopId?: string;
  @IsNotEmpty() @IsString() academicYear: string;
  @IsOptional() isSplClass?: boolean;
}
