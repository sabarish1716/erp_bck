import { IsOptional, IsNumber, IsBoolean, IsString } from 'class-validator';

export class UpdateStatutorySettingsDto {
  // PF
  @IsOptional() @IsBoolean() pfEnabled?: boolean;
  @IsOptional() @IsNumber() pfEmployeeRate?: number;
  @IsOptional() @IsNumber() pfEmployerRate?: number;
  @IsOptional() @IsNumber() pfWageLimit?: number;
  @IsOptional() @IsNumber() pfAdminCharges?: number;
  @IsOptional() @IsNumber() pfEdliCharges?: number;
  // ESI
  @IsOptional() @IsBoolean() esiEnabled?: boolean;
  @IsOptional() @IsNumber() esiEmployeeRate?: number;
  @IsOptional() @IsNumber() esiEmployerRate?: number;
  @IsOptional() @IsNumber() esiWageLimit?: number;
  @IsOptional() @IsNumber() esiDailyWageThreshold?: number;
  // PSF (Professional Services Fund - regional statutory deduction)
  @IsOptional() @IsBoolean() psfEnabled?: boolean;
  @IsOptional() @IsNumber() psfEmployeeRate?: number;
  @IsOptional() @IsNumber() psfWageLimit?: number;
  // Professional Tax
  @IsOptional() @IsBoolean() ptEnabled?: boolean;
  @IsOptional() @IsNumber() ptAmount?: number;
  // Salary structure: Gross = Basic (basicRate%) + HRA (hraRate%) + Travel (travelAllowanceRate%) + Other (otherAllowanceRate%)
  @IsOptional() @IsNumber() basicRate?: number;
  @IsOptional() @IsNumber() hraRate?: number;
  @IsOptional() @IsNumber() travelAllowanceRate?: number;
  @IsOptional() @IsNumber() otherAllowanceRate?: number;
  // CL carry-forward lapse period
  @IsOptional() @IsNumber() clLapseMonths?: number;
}

export class UpdateStaffStatutoryDto {
  @IsOptional() @IsString() pfNumber?: string;
  @IsOptional() @IsString() uanNumber?: string;
  @IsOptional() @IsString() esiNumber?: string;
  @IsOptional() @IsNumber() basicSalary?: number;
  @IsOptional() @IsNumber() grossSalary?: number;
  @IsOptional() @IsBoolean() pfEnabled?: boolean;
  @IsOptional() @IsBoolean() esiEnabled?: boolean;
  @IsOptional() @IsBoolean() psfEnabled?: boolean;
  @IsOptional() @IsBoolean() isStipend?: boolean;
  @IsOptional() @IsNumber() dailyRate?: number;
  @IsOptional() @IsString() pfJoiningDate?: string;
}
