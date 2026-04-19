import { IsString, IsArray, IsOptional, ArrayNotEmpty } from 'class-validator';

export class DemoteIndividualDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  studentIds!: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}