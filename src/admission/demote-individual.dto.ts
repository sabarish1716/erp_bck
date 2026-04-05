import { IsString, IsArray, IsOptional } from 'class-validator';

export class DemoteIndividualDto {
  @IsArray()
  @IsString({ each: true })
  studentIds: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}
