import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsDateString,
  IsEnum,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

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
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() paymentMode?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccountNo?: string;
  @IsOptional() @IsString() bankIfsc?: string;
  @IsOptional() @IsDateString() pfJoiningDate?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
    // "property doorNo should not exist",
    //     "property area should not exist",
    //     "property city should not exist",
    //     "property state should not exist",
    //     "property pincode should not exist"
  @IsOptional() @IsString() doorNo?:string;
  @IsOptional() @IsString() area?:string;
  @IsOptional() @IsString() city?:string;
  @IsOptional() @IsString() state?:string;
  @IsOptional() @IsString() pincode?:string;

}
