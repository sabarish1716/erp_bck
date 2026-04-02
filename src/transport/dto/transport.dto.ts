import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TransportStopDto {
  @IsOptional() @IsString() id?: string;
  @IsNotEmpty() @IsString() stopName: string;
  @Type(() => Number)
  @IsNotEmpty() @IsInt() stopOrder: number;
  @Type(() => Number)
  @IsOptional() @IsNumber() distanceKm?: number;
  @IsOptional() @IsString() pickupTime?: string;
  @IsOptional() @IsString() dropTime?: string;
  @Type(() => Number)
  @IsOptional() @IsNumber() fee?: number;
}

export class CreateTransportRouteDto {
  @IsNotEmpty() @IsString() routeName: string;
  @IsOptional() @IsString() routeNo?: string;
  @Type(() => Number)
  @IsNotEmpty() @IsNumber() baseFee: number;
  @Type(() => Number)
  @IsOptional() @IsNumber() splClassFee?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() conductorName?: string;
  @IsOptional() @IsString() conductorPhone?: string;

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
  @IsOptional() @IsString() academicYear?: string;
  @Type(() => Boolean)
  @IsOptional() @IsBoolean() isSplClass?: boolean;
}
