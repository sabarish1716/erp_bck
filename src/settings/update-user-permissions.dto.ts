import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateUserPermissionsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grants?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  revokes?: string[];
}
