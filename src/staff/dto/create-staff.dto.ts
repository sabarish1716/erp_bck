import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsDateString,
  MinLength,
} from 'class-validator';

export class CreateStaffDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsNotEmpty() @IsString() name: string;
  @IsNotEmpty() @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsNotEmpty() @IsString() designation: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() qualification?: string;
  @IsOptional() @IsDateString() joiningDate?: string;
  @IsOptional() @IsNumber() salary?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
