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
  @IsOptional() @IsString() busno?: string; // optional override if student is on a different bus than the route's main bus
  @IsOptional() @IsString() academicYear?: string;
  @Type(() => Boolean)
  @IsOptional() @IsBoolean() isSplClass?: boolean;
}

// ════════════════════════════════════════════════
// DRIVER MANAGEMENT
// ════════════════════════════════════════════════

export class CreateDriverDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() deviceId?: string;
  @IsOptional() @IsString() busId?: string;
  @IsOptional() @IsString() licenseNo?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional()  @IsString()  route?: string; // For assigning a route to the driver
}

export class UpdateDriverDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() deviceId?: string;
  @IsOptional() @IsString() busId?: string;
  @IsOptional() @IsString() licenseNo?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional()  @IsString()  route?: string; // For assigning a route to the driver
}


// ════════════════════════════════════════════════
// VEHICLE DRIVER MANAGEMENT
// ════════════════════════════════════════════════

export class CreateVehicleDriverDto {
  @IsNotEmpty() @IsString() plateNo: string;
  @IsNotEmpty() @IsString() driverName: string;
  @IsNotEmpty() @IsString() driverPhone: string;
  @IsNotEmpty() @IsString() licenseNo: string;
}

// ════════════════════════════════════════════════
// BUS MANAGEMENT
// ════════════════════════════════════════════════

export class CreateBusDto {
  @IsNotEmpty() @IsString() number: string;
  @IsOptional() @IsString() routeName?: string;
  @IsOptional() @IsString() routeId?: string;
  @Type(() => Number)
  @IsOptional() @IsInt() capacity?: number;
}

export class UpdateBusDto {
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() routeName?: string;
  @IsOptional() @IsString() routeId?: string;
  @Type(() => Number)
  @IsOptional() @IsInt() capacity?: number;
}
