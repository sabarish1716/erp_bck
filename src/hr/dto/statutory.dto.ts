import { IsOptional, IsNumber, IsBoolean, IsString } from 'class-validator';

export class UpdateStatutorySettingsDto {
  @IsOptional() @IsBoolean() pfEnabled?: boolean;
  @IsOptional() @IsNumber() pfEmployeeRate?: number;
  @IsOptional() @IsNumber() pfEmployerRate?: number;
  @IsOptional() @IsNumber() pfWageLimit?: number;
  @IsOptional() @IsNumber() pfAdminCharges?: number;
  @IsOptional() @IsNumber() pfEdliCharges?: number;
  @IsOptional() @IsBoolean() esiEnabled?: boolean;
  @IsOptional() @IsNumber() esiEmployeeRate?: number;
  @IsOptional() @IsNumber() esiEmployerRate?: number;
  @IsOptional() @IsNumber() esiWageLimit?: number;
  @IsOptional() @IsBoolean() ptEnabled?: boolean;
  @IsOptional() @IsNumber() ptAmount?: number;
}

export class UpdateStaffStatutoryDto {
  @IsOptional() @IsString() pfNumber?: string;
  @IsOptional() @IsString() uanNumber?: string;
  @IsOptional() @IsString() esiNumber?: string;
  @IsOptional() @IsNumber() basicSalary?: number;
  @IsOptional() @IsNumber() grossSalary?: number;
  @IsOptional() @IsBoolean() pfEnabled?: boolean;
  @IsOptional() @IsBoolean() esiEnabled?: boolean;
}
