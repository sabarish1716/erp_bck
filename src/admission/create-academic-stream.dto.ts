import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateAcademicStreamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsBoolean()
  @IsOptional()
  isCustom?: boolean;
}
