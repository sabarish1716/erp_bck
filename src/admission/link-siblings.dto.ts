import { IsArray, ArrayMinSize, IsString, IsOptional } from 'class-validator';

export class LinkSiblingsDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  studentIds: string[];

  @IsOptional()
  @IsString()
  siblingGroupId?: string;
}
