import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum, IsNumber, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkAttendanceDto {
  @IsNotEmpty() @IsString() staffId: string;
  @IsNotEmpty() @IsDateString() date: string;
  @IsNotEmpty() @IsString() status: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @IsString() punchMethod?: string;
  @IsOptional() @IsNumber() workingHours?: number;
  @IsOptional() @IsString() remarks?: string;
}

export class BulkAttendanceEntryDto {
  @IsNotEmpty() @IsString() staffId: string;
  @IsNotEmpty() @IsString() status: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @IsString() punchMethod?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class BulkMarkAttendanceDto {
  @IsNotEmpty() @IsDateString() date: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  entries: BulkAttendanceEntryDto[];
}

export class UpdateAttendanceDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @IsString() punchMethod?: string;
  @IsOptional() @IsNumber() workingHours?: number;
  @IsOptional() @IsString() remarks?: string;
}
