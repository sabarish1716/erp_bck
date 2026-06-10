import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';

export class GiveTeacherFreeItemDto {
  @IsNotEmpty() @IsString() staffId: string;
  @IsNotEmpty() @IsString() itemId: string;
  @IsNotEmpty() @IsString() academicYear: string;
  @IsNotEmpty() @IsInt() @Min(1) quantity: number;
}

export class ReturnTeacherFreeItemDto {
  @IsNotEmpty() @IsString() teacherFreeItemId: string;
  @IsNotEmpty() @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsDateString() returnedDate?: string;
}
