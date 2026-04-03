import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';

export class UpdateSplClassDatesDto {
  @IsNotEmpty() @IsString() studentId: string;
  @IsOptional() @IsDateString() splClassStartDate?: string;
  @IsOptional() @IsDateString() splClassEndDate?: string;
  @IsOptional() @IsInt() @Min(0) splClassDaysUsed?: number;
  @IsOptional() @IsInt() @Min(1) totalWorkingDays?: number;
}
