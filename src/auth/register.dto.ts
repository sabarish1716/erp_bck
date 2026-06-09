import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { Role } from './role.enum';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;
}
