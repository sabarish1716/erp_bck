import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  driverId: string;

  @IsString()
@IsOptional()
  busId?: string;
}