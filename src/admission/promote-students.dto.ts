import { IsString, IsOptional } from 'class-validator';

export class PromoteStudentsDto {
  @IsString()
  fromStandard: string;

  @IsString()
  toStandard: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsString()
  newAcademicYear?: string;
}
