import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHouseDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() colorCode?: string;
  @IsOptional() @IsString() motto?: string;
}

export class UpdateHouseDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() colorCode?: string;
  @IsOptional() @IsString() motto?: string;
  @IsOptional() @IsString() captainId?: string;
  @IsOptional() @IsString() viceCaptainId?: string;
  @IsOptional() @IsString() bandCaptainId?: string;
}
