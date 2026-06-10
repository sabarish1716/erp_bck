import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class CreateDeviceDto {
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsString() ipAddress: string;
  @IsOptional() @IsNumber() port?: number;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() deviceType?: string;
  @IsOptional() @IsString() location?: string;
}

export class UpdateDeviceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsNumber() port?: number;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() deviceType?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() isOnline?: boolean;
}

export class MapStaffDeviceDto {
  @IsNotEmpty() @IsString() staffId: string;
  @IsNotEmpty() @IsString() deviceId: string;
  @IsNotEmpty() @IsString() deviceUserId: string;
}
