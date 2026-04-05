import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class VehicleDriverMappingDto {
  @IsNotEmpty() @IsString() busId: string;
  @IsNotEmpty() @IsString() driverId: string;
  @IsOptional() @IsString() assignedBy?: string;
  @IsOptional() @IsString() assignedAt?: string;
}

export class MileageSnapshotDto {
  @IsNotEmpty() @IsString() busId: string;
  @IsOptional() @IsString() driverId?: string;
  @IsOptional() @IsString() driverPhone?: string;
  @IsNotEmpty() @IsNumber() odometer: number;
  @IsOptional() @IsString() snapshotTime?: string;
}
