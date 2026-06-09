import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdateStudentTransportTimelineDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsNotEmpty() @IsString() academicYear: string;
  @IsNotEmpty() @IsString() month: string; // Format: "YYYY-MM"

  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() stopId?: string;

  // BOTH_WAYS, MORNING_ONLY, EVENING_ONLY, SUSPENDED
  @IsOptional() @IsString() commuteMode?: string;
  @IsOptional() @IsBoolean() isSplClass?: boolean;
}

export class UpdateDriverRotationDto {
  @IsNotEmpty() @IsString() driverId: string;
  @IsNotEmpty() @IsString() routeId: string;
  @IsNotEmpty() @IsString() academicYear: string;
  @IsNotEmpty() @IsString() month: string; // Format: "YYYY-MM"

  @IsOptional() @IsNumber() @Min(0) extraPayRate?: number;
}
