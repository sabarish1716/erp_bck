import { IsString } from 'class-validator';

export class PromoteStudentsDto {
  @IsString()
  academicYear!: string;

  @IsString()
  newAcademicYear!: string;
}
